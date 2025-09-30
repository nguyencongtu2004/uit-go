/**
 * Trip Controller - Event-Driven Version
 * Integrates with Kafka event producers for eventual consistency
 * Maintains critical client APIs while using event-driven backend
 */

const Trip = require('../models/Trip');
const fareCalculationService = require('../services/fareCalculationService');
const driverMatchingService = require('../services/driverMatchingService');
const tripStateService = require('../services/tripStateService');
const TripEventProducer = require('../services/tripEventProducer');
const NotificationEventProducer = require('../../user-service/src/services/notificationEventProducer');

// Initialize event producers (will be done in service startup)
let tripEventProducer = null;
let notificationEventProducer = null;

/**
 * Initialize event producers
 */
async function initializeEventProducers() {
    if (!tripEventProducer) {
        tripEventProducer = new TripEventProducer();
        await tripEventProducer.initialize();
    }

    if (!notificationEventProducer) {
        notificationEventProducer = new NotificationEventProducer();
        await notificationEventProducer.initialize();
    }
}

/**
 * Create a new trip request - Event-Driven Version
 * POST /trips
 */
async function createTrip(req, res) {
    try {
        const { origin, destination } = req.body;
        const passengerId = req.userId;

        console.log(`Creating trip for passenger ${passengerId}`);

        // Calculate fare and distance
        const fareResult = fareCalculationService.calculateTripFare(origin, destination);

        if (!fareResult.success) {
            return res.status(400).json({
                success: false,
                error: 'Fare calculation failed',
                message: fareResult.message
            });
        }

        // Create trip in database (immediate for client response)
        const tripData = {
            passengerId,
            origin,
            destination,
            estimatedFare: fareResult.estimatedFare,
            status: tripStateService.TRIP_STATES.REQUESTED,
            createdAt: new Date(),
            searchStartTime: new Date()
        };

        const trip = new Trip(tripData);
        await trip.save();

        console.log(`Trip ${trip._id} created successfully`);

        // Publish trip requested event (eventual consistency)
        try {
            await tripEventProducer.publishTripRequested({
                tripId: trip._id.toString(),
                userId: passengerId,
                pickup: origin,
                destination,
                fare: fareResult.estimatedFare,
                status: 'REQUESTED',
                metadata: {
                    distance: fareResult.distance,
                    duration: fareResult.estimatedDuration,
                    createdAt: new Date().toISOString()
                }
            });
        } catch (eventError) {
            console.error('Failed to publish trip requested event:', eventError);
            // Continue with response - event will be retried
        }

        // Return immediate response to client
        res.status(201).json({
            success: true,
            message: 'Trip request created successfully',
            trip: {
                id: trip._id,
                passengerId,
                origin,
                destination,
                estimatedFare: fareResult.estimatedFare,
                status: trip.status,
                createdAt: trip.createdAt
            },
            fareDetails: fareResult
        });

        // Async driver matching (don't block client response)
        setImmediate(async () => {
            try {
                await _findAndNotifyDrivers(trip, fareResult);
            } catch (error) {
                console.error(`Error in async driver matching for trip ${trip._id}:`, error);
            }
        });

    } catch (error) {
        console.error('Error creating trip:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to create trip request'
        });
    }
}

/**
 * Async driver matching and notification
 */
async function _findAndNotifyDrivers(trip, fareResult) {
    try {
        // Find available drivers
        const matchingResult = await driverMatchingService.getOptimalDrivers({
            tripId: trip._id.toString(),
            origin: trip.origin,
            destination: trip.destination,
            passengerId: trip.passengerId,
            estimatedFare: fareResult.estimatedFare
        });

        if (!matchingResult.success || matchingResult.optimalDrivers.length === 0) {
            // No drivers available - publish cancellation event
            await tripEventProducer.publishTripCancelled({
                tripId: trip._id.toString(),
                userId: trip.passengerId,
                driverId: null,
                status: 'CANCELLED',
                pickup: trip.origin,
                destination: trip.destination,
                metadata: {
                    reason: 'No drivers available',
                    searchRadius: matchingResult.searchRadius,
                    cancelledBy: 'system'
                }
            });

            return;
        }

        // Select first optimal driver
        const selectedDriver = matchingResult.optimalDrivers[0];

        // Publish driver assigned event
        await tripEventProducer.publishDriverAssigned({
            tripId: trip._id.toString(),
            userId: trip.passengerId,
            driverId: selectedDriver.driverId,
            status: 'DRIVER_ASSIGNED',
            pickup: trip.origin,
            destination: trip.destination,
            fare: trip.estimatedFare,
            metadata: {
                driverInfo: selectedDriver,
                estimatedArrival: selectedDriver.estimatedArrival,
                assignedAt: new Date().toISOString()
            }
        });

        console.log(`Driver ${selectedDriver.driverId} assigned to trip ${trip._id}`);

    } catch (error) {
        console.error('Error in driver matching:', error);

        // Publish error event for monitoring
        await tripEventProducer.publishTripCancelled({
            tripId: trip._id.toString(),
            userId: trip.passengerId,
            status: 'CANCELLED',
            pickup: trip.origin,
            destination: trip.destination,
            metadata: {
                reason: 'Driver matching failed',
                error: error.message,
                cancelledBy: 'system'
            }
        });
    }
}

/**
 * Accept trip by driver - Event-Driven Version
 * PUT /trips/:tripId/accept
 */
async function acceptTrip(req, res) {
    try {
        const { tripId } = req.params;
        const driverId = req.userId; // From driver auth middleware

        // Validate trip exists and is in correct state
        const trip = await Trip.findById(tripId);
        if (!trip) {
            return res.status(404).json({
                success: false,
                error: 'Trip not found'
            });
        }

        if (trip.status !== tripStateService.TRIP_STATES.DRIVER_ASSIGNED) {
            return res.status(400).json({
                success: false,
                error: 'Trip cannot be accepted',
                message: `Trip is in ${trip.status} state`
            });
        }

        // Update trip immediately for driver response
        trip.status = tripStateService.TRIP_STATES.ACCEPTED;
        trip.acceptedAt = new Date();
        await trip.save();

        // Publish trip accepted event
        await tripEventProducer.publishTripAccepted({
            tripId: tripId,
            userId: trip.passengerId,
            driverId: driverId,
            status: 'ACCEPTED',
            pickup: trip.origin,
            destination: trip.destination,
            fare: trip.estimatedFare,
            metadata: {
                acceptedAt: new Date().toISOString(),
                estimatedArrival: req.body.estimatedArrival || '5 minutes'
            }
        });

        res.status(200).json({
            success: true,
            message: 'Trip accepted successfully',
            trip: {
                id: trip._id,
                status: trip.status,
                acceptedAt: trip.acceptedAt
            }
        });

    } catch (error) {
        console.error('Error accepting trip:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to accept trip'
        });
    }
}

/**
 * Start trip - Event-Driven Version
 * PUT /trips/:tripId/start
 */
async function startTrip(req, res) {
    try {
        const { tripId } = req.params;
        const driverId = req.userId;
        const { actualPickupLocation } = req.body;

        const trip = await Trip.findById(tripId);
        if (!trip) {
            return res.status(404).json({
                success: false,
                error: 'Trip not found'
            });
        }

        // Update trip state
        trip.status = tripStateService.TRIP_STATES.IN_PROGRESS;
        trip.startedAt = new Date();
        trip.actualPickupLocation = actualPickupLocation;
        await trip.save();

        // Publish trip started event
        await tripEventProducer.publishTripStarted({
            tripId: tripId,
            userId: trip.passengerId,
            driverId: driverId,
            status: 'STARTED',
            pickup: actualPickupLocation || trip.origin,
            destination: trip.destination,
            fare: trip.estimatedFare,
            metadata: {
                startedAt: new Date().toISOString(),
                actualPickup: actualPickupLocation
            }
        });

        res.status(200).json({
            success: true,
            message: 'Trip started successfully',
            trip: {
                id: trip._id,
                status: trip.status,
                startedAt: trip.startedAt
            }
        });

    } catch (error) {
        console.error('Error starting trip:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to start trip'
        });
    }
}

/**
 * Complete trip - Event-Driven Version
 * PUT /trips/:tripId/complete
 */
async function completeTrip(req, res) {
    try {
        const { tripId } = req.params;
        const driverId = req.userId;
        const { actualDestination, finalFare } = req.body;

        const trip = await Trip.findById(tripId);
        if (!trip) {
            return res.status(404).json({
                success: false,
                error: 'Trip not found'
            });
        }

        // Calculate final fare if not provided
        const calculatedFare = finalFare || trip.estimatedFare;

        // Update trip state
        trip.status = tripStateService.TRIP_STATES.COMPLETED;
        trip.completedAt = new Date();
        trip.actualDestination = actualDestination;
        trip.finalFare = calculatedFare;
        await trip.save();

        // Publish trip completed event
        await tripEventProducer.publishTripCompleted({
            tripId: tripId,
            userId: trip.passengerId,
            driverId: driverId,
            status: 'COMPLETED',
            pickup: trip.actualPickupLocation || trip.origin,
            destination: actualDestination || trip.destination,
            fare: calculatedFare,
            metadata: {
                completedAt: new Date().toISOString(),
                duration: trip.startedAt ? Date.now() - trip.startedAt.getTime() : 0,
                actualDestination: actualDestination
            }
        });

        res.status(200).json({
            success: true,
            message: 'Trip completed successfully',
            trip: {
                id: trip._id,
                status: trip.status,
                completedAt: trip.completedAt,
                finalFare: calculatedFare
            }
        });

    } catch (error) {
        console.error('Error completing trip:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to complete trip'
        });
    }
}

/**
 * Cancel trip - Event-Driven Version
 * PUT /trips/:tripId/cancel
 */
async function cancelTrip(req, res) {
    try {
        const { tripId } = req.params;
        const userId = req.userId;
        const { reason } = req.body;

        const trip = await Trip.findById(tripId);
        if (!trip) {
            return res.status(404).json({
                success: false,
                error: 'Trip not found'
            });
        }

        // Update trip state
        trip.status = tripStateService.TRIP_STATES.CANCELLED;
        trip.cancelledAt = new Date();
        trip.cancellationReason = reason;
        await trip.save();

        // Publish trip cancelled event
        await tripEventProducer.publishTripCancelled({
            tripId: tripId,
            userId: trip.passengerId,
            driverId: trip.driverId,
            status: 'CANCELLED',
            pickup: trip.origin,
            destination: trip.destination,
            metadata: {
                reason: reason || 'User cancelled',
                cancelledAt: new Date().toISOString(),
                cancelledBy: userId
            }
        });

        res.status(200).json({
            success: true,
            message: 'Trip cancelled successfully',
            trip: {
                id: trip._id,
                status: trip.status,
                cancelledAt: trip.cancelledAt
            }
        });

    } catch (error) {
        console.error('Error cancelling trip:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to cancel trip'
        });
    }
}

/**
 * Get trip status (read operation - no events needed)
 */
async function getTripStatus(req, res) {
    try {
        const { tripId } = req.params;

        const trip = await Trip.findById(tripId);
        if (!trip) {
            return res.status(404).json({
                success: false,
                error: 'Trip not found'
            });
        }

        res.status(200).json({
            success: true,
            trip: {
                id: trip._id,
                passengerId: trip.passengerId,
                driverId: trip.driverId,
                status: trip.status,
                origin: trip.origin,
                destination: trip.destination,
                estimatedFare: trip.estimatedFare,
                finalFare: trip.finalFare,
                createdAt: trip.createdAt,
                acceptedAt: trip.acceptedAt,
                startedAt: trip.startedAt,
                completedAt: trip.completedAt,
                cancelledAt: trip.cancelledAt
            }
        });

    } catch (error) {
        console.error('Error getting trip status:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to get trip status'
        });
    }
}

/**
 * Health check for event producers
 */
async function healthCheck(req, res) {
    try {
        const tripProducerHealth = tripEventProducer ?
            await tripEventProducer.healthCheck() :
            { status: 'not_initialized' };

        res.status(200).json({
            success: true,
            service: 'trip-controller',
            eventProducers: {
                tripEvents: tripProducerHealth
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Health check failed',
            message: error.message
        });
    }
}

module.exports = {
    createTrip,
    acceptTrip,
    startTrip,
    completeTrip,
    cancelTrip,
    getTripStatus,
    healthCheck,
    initializeEventProducers
};