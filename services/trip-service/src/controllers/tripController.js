/**
 * Trip Controller
 * Main business logic for trip management
 * Orchestrates fare calculation, driver matching, and state management
 */

const Trip = require('../models/Trip');
const fareCalculationService = require('../services/fareCalculationService');
const driverMatchingService = require('../services/driverMatchingService');
const tripStateService = require('../services/tripStateService');
const { notificationService } = require('../services/notificationService');

/**
 * Create a new trip request
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

        // Create trip in database
        const tripData = {
            passengerId,
            origin,
            destination,
            estimatedFare: fareResult.estimatedFare,
            status: tripStateService.TRIP_STATES.REQUESTED
        };

        const trip = new Trip(tripData);
        await trip.save();

        console.log(`Trip ${trip._id} created successfully`);

        // Initialize trip state
        await tripStateService.transitionTripState(
            trip._id.toString(),
            tripStateService.TRIP_STATES.SEARCHING,
            {},
            { userId: passengerId, action: 'create_trip' }
        );

        // Find available drivers
        const matchingResult = await driverMatchingService.getOptimalDrivers({
            tripId: trip._id.toString(),
            origin,
            destination,
            passengerId,
            estimatedFare: fareResult.estimatedFare
        });

        if (!matchingResult.success || matchingResult.optimalDrivers.length === 0) {
            // No drivers available, cancel trip
            await trip.cancel();
            await tripStateService.transitionTripState(
                trip._id.toString(),
                tripStateService.TRIP_STATES.CANCELLED,
                { cancellationReason: 'No drivers available' },
                { userId: passengerId, action: 'auto_cancel' }
            );

            return res.status(404).json({
                success: false,
                error: 'No drivers available',
                message: 'No drivers found in your area. Please try again later.',
                tripId: trip._id,
                searchRadius: matchingResult.searchRadius
            });
        }

        // Notify selected drivers about the trip
        const driverIds = matchingResult.optimalDrivers.map(d => d.driverId);

        await Promise.all([
            // Notify via driver service
            driverMatchingService.notifyDriversAboutTrip(matchingResult.optimalDrivers, {
                tripId: trip._id.toString(),
                origin,
                destination,
                estimatedFare: fareResult.estimatedFare,
                passengerName: req.user.name,
                passengerRating: req.user.rating
            }),

            // Send real-time notifications
            notificationService.notifyDriversAboutTripRequest(driverIds, {
                tripId: trip._id.toString(),
                origin,
                destination,
                estimatedFare: fareResult.estimatedFare,
                distance: fareResult.distance
            })
        ]);

        // Return trip details with fare breakdown
        res.status(201).json({
            success: true,
            data: {
                trip: {
                    id: trip._id,
                    passengerId,
                    origin,
                    destination,
                    status: trip.status,
                    estimatedFare: trip.estimatedFare,
                    createdAt: trip.createdAt
                },
                fareDetails: fareResult,
                driversNotified: matchingResult.optimalDrivers.length,
                availableDrivers: matchingResult.optimalDrivers.map(driver => ({
                    driverId: driver.driverId,
                    distance: driver.distance,
                    estimatedArrival: driver.estimatedArrival,
                    rating: driver.driverInfo?.rating,
                    score: driver.score
                })),
                timeout: tripStateService.TIMEOUTS.DRIVER_ACCEPTANCE
            },
            message: 'Trip created successfully. Searching for drivers...'
        });

    } catch (error) {
        console.error('Error creating trip:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create trip',
            message: error.message
        });
    }
}

/**
 * Accept a trip (driver endpoint)
 * PATCH /trips/:id/accept
 */
async function acceptTrip(req, res) {
    try {
        const tripId = req.params.id;
        const driverId = req.userId;
        const { estimatedArrivalTime } = req.body;

        console.log(`Driver ${driverId} attempting to accept trip ${tripId}`);

        // Find the trip
        const trip = await Trip.findById(tripId);

        if (!trip) {
            return res.status(404).json({
                success: false,
                error: 'Trip not found',
                message: 'The requested trip does not exist'
            });
        }

        // Check if trip is in correct state for acceptance
        if (trip.status !== tripStateService.TRIP_STATES.SEARCHING) {
            return res.status(409).json({
                success: false,
                error: 'Trip cannot be accepted',
                message: `Trip is in ${trip.status} state and cannot be accepted`,
                currentStatus: trip.status
            });
        }

        // Check if trip already has a driver
        if (trip.driverId) {
            return res.status(409).json({
                success: false,
                error: 'Trip already accepted',
                message: 'This trip has already been accepted by another driver'
            });
        }

        // Accept the trip
        await trip.accept(driverId);

        // Update trip state
        const stateResult = await tripStateService.acceptTrip(tripId, driverId, {
            estimatedArrivalTime: estimatedArrivalTime || null
        });

        if (!stateResult.success) {
            return res.status(400).json({
                success: false,
                error: 'State transition failed',
                message: stateResult.message
            });
        }

        // Notify passenger about acceptance
        await notificationService.notifyUser(trip.passengerId.toString(), {
            type: 'trip_accepted',
            tripId: tripId,
            driverId: driverId,
            estimatedArrival: estimatedArrivalTime,
            message: 'Your trip has been accepted by a driver!',
            timestamp: new Date().toISOString()
        });

        console.log(`Trip ${tripId} successfully accepted by driver ${driverId}`);

        res.json({
            success: true,
            data: {
                trip: {
                    id: trip._id,
                    passengerId: trip.passengerId,
                    driverId: trip.driverId,
                    status: trip.status,
                    origin: trip.origin,
                    destination: trip.destination,
                    estimatedFare: trip.estimatedFare,
                    acceptedAt: trip.acceptedAt
                },
                estimatedArrival: estimatedArrivalTime,
                nextStates: tripStateService.getValidNextStates(trip.status)
            },
            message: 'Trip accepted successfully'
        });

    } catch (error) {
        console.error('Error accepting trip:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to accept trip',
            message: error.message
        });
    }
}

/**
 * Update trip status
 * PATCH /trips/:id/status
 */
async function updateTripStatus(req, res) {
    try {
        const tripId = req.params.id;
        const { status, actualFare, location } = req.body;
        const userId = req.userId;
        const userRole = req.user.role;

        console.log(`Updating trip ${tripId} status to ${status} by ${userRole} ${userId}`);

        // Find the trip
        const trip = await Trip.findById(tripId);

        if (!trip) {
            return res.status(404).json({
                success: false,
                error: 'Trip not found',
                message: 'The requested trip does not exist'
            });
        }

        // Check user authorization
        const isPassenger = trip.passengerId.toString() === userId;
        const isDriver = trip.driverId && trip.driverId.toString() === userId;

        if (!isPassenger && !isDriver) {
            return res.status(403).json({
                success: false,
                error: 'Access denied',
                message: 'You can only update your own trips'
            });
        }

        // Validate state transition
        if (!tripStateService.isValidTransition(trip.status, status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status transition',
                message: `Cannot transition from ${trip.status} to ${status}`,
                currentStatus: trip.status,
                validTransitions: tripStateService.getValidNextStates(trip.status)
            });
        }

        // Prepare update data
        const updateData = { actualFare, location };

        // Handle specific status updates
        let updatedTrip;
        switch (status) {
            case tripStateService.TRIP_STATES.DRIVER_ARRIVING:
                updatedTrip = trip;
                updatedTrip.status = status;
                await updatedTrip.save();
                break;

            case tripStateService.TRIP_STATES.PICKED_UP:
                updatedTrip = await trip.pickUp();
                break;

            case tripStateService.TRIP_STATES.IN_PROGRESS:
                updatedTrip = await trip.startTrip();
                break;

            case tripStateService.TRIP_STATES.COMPLETED:
                updatedTrip = await trip.complete(actualFare);
                break;

            case tripStateService.TRIP_STATES.CANCELLED:
                updatedTrip = await trip.cancel();
                updateData.cancellationReason = 'Cancelled by user';
                break;

            default:
                updatedTrip = trip;
                updatedTrip.status = status;
                await updatedTrip.save();
        }

        // Update trip state service
        const stateResult = await tripStateService.transitionTripState(
            tripId,
            status,
            updateData,
            { userId, userRole, action: 'status_update' }
        );

        if (!stateResult.success) {
            console.warn(`State service update failed for trip ${tripId}:`, stateResult.message);
        }

        // Send notifications based on status
        await sendStatusUpdateNotifications(updatedTrip, status, location);

        console.log(`Trip ${tripId} status updated to ${status} successfully`);

        res.json({
            success: true,
            data: {
                trip: {
                    id: updatedTrip._id,
                    passengerId: updatedTrip.passengerId,
                    driverId: updatedTrip.driverId,
                    status: updatedTrip.status,
                    origin: updatedTrip.origin,
                    destination: updatedTrip.destination,
                    estimatedFare: updatedTrip.estimatedFare,
                    actualFare: updatedTrip.actualFare,
                    acceptedAt: updatedTrip.acceptedAt,
                    pickedUpAt: updatedTrip.pickedUpAt,
                    completedAt: updatedTrip.completedAt,
                    cancelledAt: updatedTrip.cancelledAt,
                    updatedAt: updatedTrip.updatedAt
                },
                validNextStates: tripStateService.getValidNextStates(status)
            },
            message: `Trip status updated to ${status}`
        });

    } catch (error) {
        console.error('Error updating trip status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update trip status',
            message: error.message
        });
    }
}

/**
 * Cancel a trip
 * DELETE /trips/:id or PATCH /trips/:id/cancel
 */
async function cancelTrip(req, res) {
    try {
        const tripId = req.params.id;
        const { reason } = req.body;
        const userId = req.userId;
        const userRole = req.user.role;

        console.log(`${userRole} ${userId} cancelling trip ${tripId}`);

        // Find the trip
        const trip = await Trip.findById(tripId);

        if (!trip) {
            return res.status(404).json({
                success: false,
                error: 'Trip not found',
                message: 'The requested trip does not exist'
            });
        }

        // Check user authorization
        const isPassenger = trip.passengerId.toString() === userId;
        const isDriver = trip.driverId && trip.driverId.toString() === userId;

        if (!isPassenger && !isDriver) {
            return res.status(403).json({
                success: false,
                error: 'Access denied',
                message: 'You can only cancel your own trips'
            });
        }

        // Check if trip can be cancelled
        if (trip.status === tripStateService.TRIP_STATES.COMPLETED) {
            return res.status(400).json({
                success: false,
                error: 'Cannot cancel completed trip',
                message: 'This trip has already been completed'
            });
        }

        if (trip.status === tripStateService.TRIP_STATES.CANCELLED) {
            return res.status(400).json({
                success: false,
                error: 'Trip already cancelled',
                message: 'This trip has already been cancelled'
            });
        }

        // Cancel the trip
        const cancelledTrip = await trip.cancel();

        // Update state service
        await tripStateService.cancelTrip(tripId, {
            reason: reason || 'Cancelled by user',
            cancelledBy: userId
        }, {
            userId,
            userRole,
            action: 'cancel_trip'
        });

        // Send cancellation notifications
        const otherUserId = isPassenger ? trip.driverId : trip.passengerId;

        if (otherUserId) {
            await notificationService.notifyUser(otherUserId.toString(), {
                type: 'trip_cancelled',
                tripId: tripId,
                cancelledBy: userRole,
                reason: reason || 'Trip was cancelled',
                message: `Trip has been cancelled by the ${userRole.toLowerCase()}`,
                timestamp: new Date().toISOString()
            });
        }

        console.log(`Trip ${tripId} cancelled successfully by ${userRole} ${userId}`);

        res.json({
            success: true,
            data: {
                trip: {
                    id: cancelledTrip._id,
                    status: cancelledTrip.status,
                    cancelledAt: cancelledTrip.cancelledAt,
                    cancellationReason: reason || 'Cancelled by user'
                }
            },
            message: 'Trip cancelled successfully'
        });

    } catch (error) {
        console.error('Error cancelling trip:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel trip',
            message: error.message
        });
    }
}

/**
 * Get trip details
 * GET /trips/:id
 */
async function getTripDetails(req, res) {
    try {
        const tripId = req.params.id;
        const userId = req.userId;

        // Find the trip
        const trip = await Trip.findById(tripId);

        if (!trip) {
            return res.status(404).json({
                success: false,
                error: 'Trip not found',
                message: 'The requested trip does not exist'
            });
        }

        // Check user authorization
        const isPassenger = trip.passengerId.toString() === userId;
        const isDriver = trip.driverId && trip.driverId.toString() === userId;

        if (!isPassenger && !isDriver) {
            return res.status(403).json({
                success: false,
                error: 'Access denied',
                message: 'You can only view your own trips'
            });
        }

        // Get trip state info
        const stateInfo = tripStateService.getTripState(tripId);
        const timeoutInfo = tripStateService.getTripTimeout(tripId);

        res.json({
            success: true,
            data: {
                trip: {
                    id: trip._id,
                    passengerId: trip.passengerId,
                    driverId: trip.driverId,
                    origin: trip.origin,
                    destination: trip.destination,
                    status: trip.status,
                    estimatedFare: trip.estimatedFare,
                    actualFare: trip.actualFare,
                    rating: trip.rating,
                    comment: trip.comment,
                    requestedAt: trip.requestedAt,
                    acceptedAt: trip.acceptedAt,
                    pickedUpAt: trip.pickedUpAt,
                    completedAt: trip.completedAt,
                    cancelledAt: trip.cancelledAt,
                    createdAt: trip.createdAt,
                    updatedAt: trip.updatedAt
                },
                state: stateInfo,
                timeout: timeoutInfo
            },
            message: 'Trip details retrieved successfully'
        });

    } catch (error) {
        console.error('Error getting trip details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get trip details',
            message: error.message
        });
    }
}

/**
 * Get user's trip history
 * GET /trips
 */
async function getTripHistory(req, res) {
    try {
        const userId = req.userId;
        const userRole = req.user.role;
        const { page = 1, limit = 10, status } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build query based on user role
        let query;
        if (userRole === 'PASSENGER') {
            query = { passengerId: userId };
        } else if (userRole === 'DRIVER') {
            query = { driverId: userId };
        } else {
            return res.status(403).json({
                success: false,
                error: 'Access denied',
                message: 'Invalid user role'
            });
        }

        // Add status filter if provided
        if (status) {
            query.status = status;
        }

        // Get trips with pagination
        const [trips, totalTrips] = await Promise.all([
            Trip.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Trip.countDocuments(query)
        ]);

        // Get trip statistics
        const stats = await Trip.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalFare: {
                        $sum: {
                            $cond: [
                                { $ne: ['$actualFare', null] },
                                '$actualFare',
                                '$estimatedFare'
                            ]
                        }
                    }
                }
            }
        ]);

        const pagination = {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalTrips,
            pages: Math.ceil(totalTrips / parseInt(limit)),
            hasNext: skip + trips.length < totalTrips,
            hasPrev: parseInt(page) > 1
        };

        res.json({
            success: true,
            data: {
                trips: trips.map(trip => ({
                    id: trip._id,
                    passengerId: trip.passengerId,
                    driverId: trip.driverId,
                    origin: trip.origin,
                    destination: trip.destination,
                    status: trip.status,
                    estimatedFare: trip.estimatedFare,
                    actualFare: trip.actualFare,
                    rating: trip.rating,
                    createdAt: trip.createdAt,
                    completedAt: trip.completedAt
                })),
                pagination,
                statistics: stats.reduce((acc, stat) => {
                    acc[stat._id] = {
                        count: stat.count,
                        totalFare: stat.totalFare
                    };
                    return acc;
                }, {}),
                summary: {
                    totalTrips,
                    totalEarnings: stats.reduce((sum, stat) => sum + stat.totalFare, 0)
                }
            },
            message: 'Trip history retrieved successfully'
        });

    } catch (error) {
        console.error('Error getting trip history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get trip history',
            message: error.message
        });
    }
}

/**
 * Rate a trip (passenger endpoint)
 * PATCH /trips/:id/rating
 */
async function rateTrip(req, res) {
    try {
        const tripId = req.params.id;
        const { rating, comment } = req.body;
        const passengerId = req.userId;

        // Find the trip
        const trip = await Trip.findById(tripId);

        if (!trip) {
            return res.status(404).json({
                success: false,
                error: 'Trip not found',
                message: 'The requested trip does not exist'
            });
        }

        // Check if user is the passenger
        if (trip.passengerId.toString() !== passengerId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied',
                message: 'You can only rate your own trips'
            });
        }

        // Check if trip is completed
        if (trip.status !== tripStateService.TRIP_STATES.COMPLETED) {
            return res.status(400).json({
                success: false,
                error: 'Cannot rate incomplete trip',
                message: 'You can only rate completed trips'
            });
        }

        // Check if trip is already rated
        if (trip.rating) {
            return res.status(400).json({
                success: false,
                error: 'Trip already rated',
                message: 'You have already rated this trip'
            });
        }

        // Add rating
        const ratedTrip = await trip.addRating(rating, comment);

        console.log(`Trip ${tripId} rated ${rating}/5 by passenger ${passengerId}`);

        res.json({
            success: true,
            data: {
                trip: {
                    id: ratedTrip._id,
                    rating: ratedTrip.rating,
                    comment: ratedTrip.comment,
                    updatedAt: ratedTrip.updatedAt
                }
            },
            message: 'Trip rated successfully'
        });

    } catch (error) {
        console.error('Error rating trip:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to rate trip',
            message: error.message
        });
    }
}

/**
 * Send status update notifications
 * @param {object} trip 
 * @param {string} status 
 * @param {object} location 
 */
async function sendStatusUpdateNotifications(trip, status, location) {
    try {
        const tripId = trip._id.toString();
        const passengerId = trip.passengerId.toString();
        const driverId = trip.driverId?.toString();

        let notificationData = {
            tripId,
            status,
            timestamp: new Date().toISOString()
        };

        switch (status) {
            case tripStateService.TRIP_STATES.DRIVER_ARRIVING:
                if (passengerId) {
                    await notificationService.notifyUser(passengerId, {
                        type: 'driver_arriving',
                        message: 'Your driver is on the way!',
                        ...notificationData
                    });
                }
                break;

            case tripStateService.TRIP_STATES.PICKED_UP:
                if (passengerId) {
                    await notificationService.notifyUser(passengerId, {
                        type: 'driver_arrived',
                        message: 'Driver has arrived at pickup location',
                        ...notificationData
                    });
                }
                break;

            case tripStateService.TRIP_STATES.IN_PROGRESS:
                await notificationService.notifyTripParticipants(tripId, {
                    type: 'trip_started',
                    message: 'Trip has started',
                    ...notificationData
                });
                break;

            case tripStateService.TRIP_STATES.COMPLETED:
                await notificationService.notifyTripParticipants(tripId, {
                    type: 'trip_completed',
                    message: 'Trip completed successfully',
                    actualFare: trip.actualFare,
                    ...notificationData
                });
                break;
        }

        // Send location update if provided
        if (location && driverId) {
            await notificationService.notifyTripParticipants(tripId, {
                type: 'driver_location_update',
                driverId,
                location,
                ...notificationData
            });
        }

    } catch (error) {
        console.error('Error sending status update notifications:', error);
    }
}

module.exports = {
    createTrip,
    acceptTrip,
    updateTripStatus,
    cancelTrip,
    getTripDetails,
    getTripHistory,
    rateTrip
};