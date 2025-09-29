/**
 * Trip State Management Service
 * Manages trip state transitions, timeouts, and validation
 * Implements state machine: REQUESTED → SEARCHING → ACCEPTED → DRIVER_ARRIVING → PICKED_UP → IN_PROGRESS → COMPLETED/CANCELLED
 */

const Redis = require('redis');
const Trip = require('../models/Trip');

// Trip states
const TRIP_STATES = {
    REQUESTED: 'REQUESTED',
    SEARCHING: 'SEARCHING',
    ACCEPTED: 'ACCEPTED',
    DRIVER_ARRIVING: 'DRIVER_ARRIVING',
    PICKED_UP: 'PICKED_UP',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED'
};

// State transition rules
const VALID_TRANSITIONS = {
    [TRIP_STATES.REQUESTED]: [TRIP_STATES.SEARCHING, TRIP_STATES.CANCELLED],
    [TRIP_STATES.SEARCHING]: [TRIP_STATES.ACCEPTED, TRIP_STATES.CANCELLED],
    [TRIP_STATES.ACCEPTED]: [TRIP_STATES.DRIVER_ARRIVING, TRIP_STATES.CANCELLED],
    [TRIP_STATES.DRIVER_ARRIVING]: [TRIP_STATES.PICKED_UP, TRIP_STATES.CANCELLED],
    [TRIP_STATES.PICKED_UP]: [TRIP_STATES.IN_PROGRESS, TRIP_STATES.CANCELLED],
    [TRIP_STATES.IN_PROGRESS]: [TRIP_STATES.COMPLETED, TRIP_STATES.CANCELLED],
    [TRIP_STATES.COMPLETED]: [], // Final state
    [TRIP_STATES.CANCELLED]: []  // Final state
};

// Redis keys for timeout management
const TIMEOUT_KEY_PREFIX = 'trip:timeout:';
const ACTIVE_TIMEOUTS_SET = 'trip:active_timeouts';

// Timeout configurations (in seconds)
const TIMEOUTS = {
    DRIVER_ACCEPTANCE: parseInt(process.env.DRIVER_ACCEPTANCE_TIMEOUT) || 300,
    DRIVER_ARRIVAL: 1800,    // 30 minutes
    PICKUP_WAIT: 300,        // 5 minutes
    TRIP_COMPLETION: 14400   // 4 hours
};

// Redis client for timeout storage and pub/sub notifications
let redisClient = null;

/**
 * Initialize Redis client for state notifications
 */
async function initializeRedis() {
    if (redisClient && redisClient.isOpen) {
        return redisClient;
    }

    try {
        const redisConfig = {
            socket: {
                host: process.env.REDIS_HOST || 'redis',
                port: parseInt(process.env.REDIS_PORT) || 6379,
            },
            password: process.env.REDIS_PASSWORD,
            database: parseInt(process.env.REDIS_DB) || 2
        };

        redisClient = Redis.createClient(redisConfig);

        redisClient.on('error', (err) => {
            console.error('Trip State Redis error:', err);
        });

        redisClient.on('connect', () => {
            console.log('Trip State Service connected to Redis');
        });

        await redisClient.connect();
        return redisClient;
    } catch (error) {
        console.error('Failed to initialize Redis for trip states:', error);
        throw error;
    }
}

/**
 * Validate if a state transition is allowed
 * @param {string} currentState - Current trip state
 * @param {string} newState - Desired new state
 * @returns {boolean} True if transition is valid
 */
function isValidTransition(currentState, newState) {
    const allowedStates = VALID_TRANSITIONS[currentState];
    return allowedStates && allowedStates.includes(newState);
}

/**
 * Get all valid next states for current state
 * @param {string} currentState 
 * @returns {Array<string>} Array of valid next states
 */
function getValidNextStates(currentState) {
    return VALID_TRANSITIONS[currentState] || [];
}

/**
 * Transition trip to new state with validation
 * @param {string} tripId - Trip ID
 * @param {string} newState - New state to transition to
 * @param {object} updateData - Additional data to update
 * @param {object} context - Transition context (user, reason, etc.)
 * @returns {Promise<object>} Transition result
 */
async function transitionTripState(tripId, newState, updateData = {}, context = {}) {
    try {
        console.log(`Transitioning trip ${tripId} to state: ${newState}`);

        // Get current trip state from database
        const trip = await Trip.findById(tripId);
        if (!trip) {
            return {
                success: false,
                error: 'Trip not found',
                message: `Trip ${tripId} does not exist`
            };
        }

        const currentState = trip.status;

        // Validate transition
        if (!isValidTransition(currentState, newState)) {
            return {
                success: false,
                error: 'Invalid state transition',
                message: `Cannot transition from ${currentState} to ${newState}`,
                currentState,
                validTransitions: getValidNextStates(currentState)
            };
        }

        // Clear any existing timeouts for this trip
        console.log(`Attempting to clear timeout for trip ${tripId} before transition to ${newState}`);
        await clearTripTimeout(tripId);

        // Set up timeout for new state if needed
        await setupStateTimeout(tripId, newState, context);

        // Prepare state update data
        const stateUpdate = {
            status: newState,
            ...updateData,
            [`${newState.toLowerCase()}At`]: new Date(),
            updatedBy: context.userId || context.driverId || 'system',
            updatedAt: new Date()
        };

        // Update trip in database
        await Trip.findByIdAndUpdate(tripId, stateUpdate, { new: true });

        // Publish state change notification
        await publishStateChange(tripId, {
            previousState: currentState,
            newState,
            stateUpdate,
            context,
            timestamp: new Date().toISOString()
        });

        console.log(`Trip ${tripId} successfully transitioned from ${currentState} to ${newState}`);

        return {
            success: true,
            previousState: currentState,
            newState,
            stateUpdate,
            message: `Trip successfully transitioned to ${newState}`,
            validNextStates: getValidNextStates(newState)
        };

    } catch (error) {
        console.error(`Error transitioning trip ${tripId} to ${newState}:`, error);
        return {
            success: false,
            error: 'State transition failed',
            message: error.message
        };
    }
}

/**
 * Set up timeout for specific trip state using Redis for persistence
 * @param {string} tripId 
 * @param {string} state 
 * @param {object} context 
 */
async function setupStateTimeout(tripId, state, context) {
    let timeoutDuration = null;
    let timeoutAction = null;

    switch (state) {
        case TRIP_STATES.SEARCHING:
            timeoutDuration = TIMEOUTS.DRIVER_ACCEPTANCE * 1000; // Convert to milliseconds
            timeoutAction = () => handleDriverAcceptanceTimeout(tripId);
            break;

        case TRIP_STATES.DRIVER_ARRIVING:
            timeoutDuration = TIMEOUTS.DRIVER_ARRIVAL * 1000;
            timeoutAction = () => handleDriverArrivalTimeout(tripId);
            break;

        case TRIP_STATES.PICKED_UP:
            timeoutDuration = TIMEOUTS.PICKUP_WAIT * 1000;
            timeoutAction = () => handlePickupTimeout(tripId);
            break;

        case TRIP_STATES.IN_PROGRESS:
            timeoutDuration = TIMEOUTS.TRIP_COMPLETION * 1000;
            timeoutAction = () => handleTripCompletionTimeout(tripId);
            break;
    }

    if (timeoutDuration && timeoutAction) {
        await initializeRedis();

        // Store timeout info in Redis with expiration
        const timeoutInfo = {
            tripId,
            state,
            startTime: Date.now(),
            duration: timeoutDuration,
            expiresAt: Date.now() + timeoutDuration,
            processId: process.pid // Track which process set the timeout
        };

        const timeoutKey = `${TIMEOUT_KEY_PREFIX}${tripId}`;

        await Promise.all([
            // Store timeout data with TTL
            redisClient.setEx(
                timeoutKey,
                Math.ceil(timeoutDuration / 1000),
                JSON.stringify(timeoutInfo)
            ),
            // Add to active timeouts set for monitoring
            redisClient.sAdd(ACTIVE_TIMEOUTS_SET, tripId)
        ]);

        // Set up local timeout handler (each process handles its own timeouts)
        const timeoutId = setTimeout(async () => {
            // Double-check if timeout is still valid before executing
            try {
                const currentTimeoutData = await redisClient.get(timeoutKey);
                if (currentTimeoutData) {
                    const timeoutData = JSON.parse(currentTimeoutData);
                    if (timeoutData.processId === process.pid) {
                        console.log(`Executing timeout for trip ${tripId} (process ${process.pid})`);
                        await timeoutAction();
                    }
                }
            } catch (error) {
                console.error(`Error executing timeout for trip ${tripId}:`, error);
            }
        }, timeoutDuration);

        // Store timeout ID in Redis with short TTL for cleanup tracking
        await redisClient.setEx(
            `${TIMEOUT_KEY_PREFIX}local:${tripId}:${process.pid}`,
            Math.ceil(timeoutDuration / 1000) + 60, // Extra 60s for cleanup
            timeoutId.toString()
        );

        console.log(`Set timeout for trip ${tripId} in state ${state}: ${timeoutDuration / 1000}s (process ${process.pid})`);
    }
}

/**
 * Clear timeout for a trip using Redis
 * @param {string} tripId 
 */
async function clearTripTimeout(tripId) {
    console.log(`clearTripTimeout called for trip ${tripId}`);
    try {
        await initializeRedis();

        const timeoutKey = `${TIMEOUT_KEY_PREFIX}${tripId}`;

        // Get timeout info before clearing
        const timeoutData = await redisClient.get(timeoutKey);
        if (timeoutData) {
            const timeout = JSON.parse(timeoutData);
            console.log(`Found timeout for trip ${tripId}, process: ${timeout.processId}`);
        }

        // Clear timeout data from Redis
        const results = await Promise.allSettled([
            redisClient.del(timeoutKey),
            redisClient.sRem(ACTIVE_TIMEOUTS_SET, tripId),
            // Clear local timeout ID for this process
            redisClient.del(`${TIMEOUT_KEY_PREFIX}local:${tripId}:${process.pid}`)
        ]);

        const deletedMain = results[0].status === 'fulfilled' ? results[0].value : 0;
        const removedFromSet = results[1].status === 'fulfilled' ? results[1].value : 0;

        if (deletedMain > 0 || removedFromSet > 0) {
            console.log(`Cleared Redis timeout data for trip ${tripId} (deleted: ${deletedMain}, removed from set: ${removedFromSet})`);
        } else {
            console.log(`No Redis timeout data found for trip ${tripId}`);
        }

    } catch (error) {
        console.error(`Error clearing timeout for trip ${tripId}:`, error);
    }
}

/**
 * Handle driver acceptance timeout (15 seconds)
 * @param {string} tripId 
 */
async function handleDriverAcceptanceTimeout(tripId) {
    console.log(`Driver acceptance timeout for trip ${tripId}`);

    try {
        await transitionTripState(tripId, TRIP_STATES.CANCELLED, {
            cancellationReason: 'No driver accepted the trip',
            cancelledBy: 'system'
        }, {
            reason: 'driver_acceptance_timeout'
        });

        // Notify passenger about cancellation
        await publishStateChange(tripId, {
            type: 'trip_timeout',
            reason: 'driver_acceptance_timeout',
            message: 'No drivers accepted your trip request. Please try again.',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`Failed to handle acceptance timeout for trip ${tripId}:`, error);
    }
}

/**
 * Handle driver arrival timeout
 * @param {string} tripId 
 */
async function handleDriverArrivalTimeout(tripId) {
    console.log(`Driver arrival timeout for trip ${tripId}`);

    try {
        // Check if driver is still available, if not, cancel trip
        await transitionTripState(tripId, TRIP_STATES.CANCELLED, {
            cancellationReason: 'Driver took too long to arrive',
            cancelledBy: 'system'
        }, {
            reason: 'driver_arrival_timeout'
        });

    } catch (error) {
        console.error(`Failed to handle arrival timeout for trip ${tripId}:`, error);
    }
}

/**
 * Handle pickup timeout
 * @param {string} tripId 
 */
async function handlePickupTimeout(tripId) {
    console.log(`Pickup timeout for trip ${tripId}`);

    try {
        await transitionTripState(tripId, TRIP_STATES.CANCELLED, {
            cancellationReason: 'Passenger was not found at pickup location',
            cancelledBy: 'system'
        }, {
            reason: 'pickup_timeout'
        });

    } catch (error) {
        console.error(`Failed to handle pickup timeout for trip ${tripId}:`, error);
    }
}

/**
 * Handle trip completion timeout
 * @param {string} tripId 
 */
async function handleTripCompletionTimeout(tripId) {
    console.log(`Trip completion timeout for trip ${tripId}`);

    try {
        // Auto-complete the trip after maximum duration
        await transitionTripState(tripId, TRIP_STATES.COMPLETED, {
            actualFare: null, // Would be calculated based on time/distance
            completionReason: 'Auto-completed due to maximum trip duration',
            completedBy: 'system'
        }, {
            reason: 'trip_completion_timeout'
        });

    } catch (error) {
        console.error(`Failed to handle completion timeout for trip ${tripId}:`, error);
    }
}

/**
 * Publish state change notification via Redis
 * @param {string} tripId 
 * @param {object} stateChangeData 
 */
async function publishStateChange(tripId, stateChangeData) {
    try {
        await initializeRedis();

        const notification = {
            tripId,
            timestamp: new Date().toISOString(),
            ...stateChangeData
        };

        // Publish to trip-specific channel
        await redisClient.publish(`trip:${tripId}:state`, JSON.stringify(notification));

        // Publish to general trip events channel
        await redisClient.publish('trip:events', JSON.stringify(notification));

        console.log(`Published state change for trip ${tripId}:`, stateChangeData.newState || 'event');

    } catch (error) {
        console.error('Failed to publish state change:', error);
    }
}

/**
 * Get current state of a trip
 * @param {string} tripId 
 * @returns {Promise<object>} Trip state info
 */
async function getTripState(tripId) {
    try {
        // Get current state from database
        const trip = await Trip.findById(tripId);
        const currentState = trip ? trip.status : TRIP_STATES.REQUESTED;

        // Get timeout info from Redis
        await initializeRedis();
        const timeoutData = await redisClient.get(`timeout:${tripId}`);
        const timeout = timeoutData ? JSON.parse(timeoutData) : null;

        return {
            tripId,
            currentState,
            validNextStates: getValidNextStates(currentState),
            hasActiveTimeout: !!timeout,
            timeoutInfo: timeout ? {
                state: timeout.state,
                remainingTime: Math.max(0, timeout.expiresAt - Date.now()),
                startTime: new Date(timeout.startTime).toISOString()
            } : null
        };
    } catch (error) {
        console.error(`Error getting trip state for ${tripId}:`, error);
        return {
            tripId,
            currentState: TRIP_STATES.REQUESTED,
            validNextStates: getValidNextStates(TRIP_STATES.REQUESTED),
            hasActiveTimeout: false,
            timeoutInfo: null
        };
    }
}

/**
 * Cancel a trip with reason
 * @param {string} tripId 
 * @param {object} cancellationData 
 * @param {object} context 
 * @returns {Promise<object>}
 */
async function cancelTrip(tripId, cancellationData = {}, context = {}) {
    try {
        // Get current state from database
        const trip = await Trip.findById(tripId);
        const currentState = trip ? trip.status : TRIP_STATES.REQUESTED;

        // Check if trip can be cancelled
        if (currentState === TRIP_STATES.COMPLETED) {
            return {
                success: false,
                error: 'Cannot cancel completed trip',
                currentState
            };
        }

        if (currentState === TRIP_STATES.CANCELLED) {
            return {
                success: false,
                error: 'Trip is already cancelled',
                currentState
            };
        }

        return await transitionTripState(tripId, TRIP_STATES.CANCELLED, {
            cancellationReason: cancellationData.reason || 'Cancelled by user',
            cancelledBy: context.userId || context.driverId || 'user',
            ...cancellationData
        }, context);
    } catch (error) {
        console.error(`Error cancelling trip ${tripId}:`, error);
        return {
            success: false,
            error: 'Failed to cancel trip',
            message: error.message
        };
    }
}

/**
 * Accept trip by driver
 * @param {string} tripId 
 * @param {string} driverId 
 * @param {object} acceptanceData 
 * @returns {Promise<object>}
 */
async function acceptTrip(tripId, driverId, acceptanceData = {}) {
    return await transitionTripState(tripId, TRIP_STATES.ACCEPTED, {
        driverId,
        acceptedAt: new Date(),
        ...acceptanceData
    }, {
        driverId,
        action: 'accept_trip'
    });
}

/**
 * Complete a trip
 * @param {string} tripId 
 * @param {object} completionData 
 * @param {object} context 
 * @returns {Promise<object>}
 */
async function completeTrip(tripId, completionData = {}, context = {}) {
    return await transitionTripState(tripId, TRIP_STATES.COMPLETED, {
        actualFare: completionData.actualFare,
        completedAt: new Date(),
        ...completionData
    }, context);
}

/**
 * Get timeout information for a trip from Redis
 * @param {string} tripId 
 * @returns {Promise<object>} Timeout info
 */
async function getTripTimeout(tripId) {
    try {
        await initializeRedis();
        const timeoutData = await redisClient.get(`${TIMEOUT_KEY_PREFIX}${tripId}`);

        if (!timeoutData) {
            return {
                hasTimeout: false,
                tripId
            };
        }

        const timeout = JSON.parse(timeoutData);
        const elapsed = Date.now() - timeout.startTime;
        const remaining = Math.max(0, timeout.expiresAt - Date.now());

        return {
            hasTimeout: true,
            tripId,
            state: timeout.state,
            duration: timeout.duration,
            elapsed,
            remaining,
            remainingSeconds: Math.ceil(remaining / 1000),
            startTime: new Date(timeout.startTime).toISOString(),
            processId: timeout.processId
        };
    } catch (error) {
        console.error(`Error getting timeout for trip ${tripId}:`, error);
        return {
            hasTimeout: false,
            tripId,
            error: error.message
        };
    }
}

/**
 * Clean up expired timeouts from Redis (maintenance function)
 * Should be called periodically to clean up stale data
 */
async function cleanupExpiredTimeouts() {
    try {
        await initializeRedis();

        // Get all active timeout trip IDs
        const activeTimeouts = await redisClient.sMembers(ACTIVE_TIMEOUTS_SET);
        let cleanedCount = 0;

        for (const tripId of activeTimeouts) {
            const timeoutKey = `${TIMEOUT_KEY_PREFIX}${tripId}`;
            const timeoutData = await redisClient.get(timeoutKey);

            if (!timeoutData) {
                // Timeout data missing, remove from set
                await redisClient.sRem(ACTIVE_TIMEOUTS_SET, tripId);
                cleanedCount++;
                console.log(`Cleaned up missing timeout data for trip ${tripId}`);
            }
        }

        console.log(`Cleaned up ${cleanedCount} expired/missing timeouts`);
        return { cleanedCount, totalChecked: activeTimeouts.length };

    } catch (error) {
        console.error('Error cleaning up expired timeouts:', error);
        return { error: error.message };
    }
}

/**
 * Get all active timeouts (for monitoring)
 * @returns {Promise<Array>} List of active timeouts
 */
async function getActiveTimeouts() {
    try {
        await initializeRedis();

        const activeTimeoutIds = await redisClient.sMembers(ACTIVE_TIMEOUTS_SET);
        const activeTimeouts = [];

        for (const tripId of activeTimeoutIds) {
            const timeoutInfo = await getTripTimeout(tripId);
            if (timeoutInfo.hasTimeout) {
                activeTimeouts.push(timeoutInfo);
            }
        }

        return {
            success: true,
            count: activeTimeouts.length,
            timeouts: activeTimeouts
        };

    } catch (error) {
        console.error('Error getting active timeouts:', error);
        return {
            success: false,
            error: error.message,
            timeouts: []
        };
    }
}

/**
 * Clean up resources
 */
async function cleanup() {
    try {
        // Close Redis connection
        if (redisClient && redisClient.isOpen) {
            await redisClient.quit();
            console.log('Trip State Redis connection closed');
        }
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

module.exports = {
    // Core functions
    transitionTripState,
    isValidTransition,
    getValidNextStates,
    getTripState,

    // State-specific actions
    acceptTrip,
    cancelTrip,
    completeTrip,

    // Timeout management
    setupStateTimeout,
    clearTripTimeout,
    getTripTimeout,
    cleanupExpiredTimeouts,
    getActiveTimeouts,

    // Utility functions
    publishStateChange,
    initializeRedis,
    cleanup,

    // Constants
    TRIP_STATES,
    VALID_TRANSITIONS,
    TIMEOUTS
};