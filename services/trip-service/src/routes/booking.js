/**
 * Booking Routes
 * Alternative endpoints for trip booking with additional features
 */

const express = require('express');
const router = express.Router();

// Import services directly for booking-specific operations
const fareCalculationService = require('../services/fareCalculationService');
const driverMatchingService = require('../services/driverMatchingService');
const tripStateService = require('../services/tripStateService');

// Import middlewares
const {
    authenticateToken,
    authenticatePassenger,
    authenticateDriver,
    optionalAuth
} = require('../middlewares/auth');

const {
    validateCreateTrip,
    validateCoordinates,
    sanitizeInput
} = require('../middlewares/validation');

// Apply common middlewares
router.use(sanitizeInput);

/**
 * POST /booking/estimate
 * Get fare estimate without creating a trip
 * Optional authentication (better rates for logged-in users)
 */
router.post('/estimate',
    optionalAuth,
    validateCreateTrip,
    async (req, res) => {
        try {
            const { origin, destination } = req.body;

            // Calculate fare estimate
            const fareResult = fareCalculationService.calculateTripFare(origin, destination);

            if (!fareResult.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Fare calculation failed',
                    message: fareResult.message
                });
            }

            // Get fare range for better transparency
            const rangeResult = fareCalculationService.estimateFareRange(origin, destination);

            // Check driver availability in the area (optional)
            let availabilityInfo = null;
            try {
                const nearbyResult = await driverMatchingService.findNearbyDrivers(
                    origin.latitude,
                    origin.longitude,
                    { radius: 5, limit: 1 }
                );

                availabilityInfo = {
                    driversInArea: nearbyResult.drivers ? nearbyResult.drivers.length : 0,
                    estimated_wait_time: nearbyResult.drivers && nearbyResult.drivers.length > 0
                        ? nearbyResult.drivers[0].estimatedArrival
                        : null
                };
            } catch (error) {
                console.warn('Could not check driver availability:', error.message);
            }

            res.json({
                success: true,
                data: {
                    fareEstimate: fareResult,
                    fareRange: rangeResult,
                    availability: availabilityInfo,
                    route: {
                        origin,
                        destination,
                        distance: fareResult.distance,
                        estimatedDuration: fareResult.estimatedDuration
                    }
                },
                message: 'Fare estimated successfully'
            });

        } catch (error) {
            console.error('Error estimating fare:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to estimate fare',
                message: error.message
            });
        }
    }
);

/**
 * GET /booking/availability
 * Check driver availability in a specific area
 * Public endpoint with optional authentication
 */
router.get('/availability',
    optionalAuth,
    validateCoordinates,
    async (req, res) => {
        try {
            const { latitude, longitude, radius = 5 } = req.query;
            const coordinates = req.coordinates || { latitude: parseFloat(latitude), longitude: parseFloat(longitude) };

            const result = await driverMatchingService.findNearbyDrivers(
                coordinates.latitude,
                coordinates.longitude,
                {
                    radius: parseFloat(radius),
                    limit: 10
                }
            );

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to check availability',
                    message: result.message
                });
            }

            // Process availability data
            const availability = {
                location: {
                    latitude: coordinates.latitude,
                    longitude: coordinates.longitude,
                    searchRadius: parseFloat(radius)
                },
                driversAvailable: result.drivers.length,
                estimatedWaitTime: result.drivers.length > 0
                    ? Math.min(...result.drivers.map(d => d.estimatedArrival))
                    : null,
                averageWaitTime: result.drivers.length > 0
                    ? Math.round(result.drivers.reduce((sum, d) => sum + d.estimatedArrival, 0) / result.drivers.length)
                    : null,
                demand: getDemandLevel(result.drivers.length),
                surge: fareCalculationService.getCurrentSurgeInfo(coordinates.latitude, coordinates.longitude)
            };

            // Add driver distribution (without sensitive info)
            availability.driverDistribution = result.drivers.map(driver => ({
                distance: driver.distance,
                estimatedArrival: driver.estimatedArrival,
                rating: driver.driverInfo?.rating || 0
            }));

            res.json({
                success: true,
                data: availability,
                message: result.drivers.length > 0
                    ? `${result.drivers.length} drivers available in your area`
                    : 'No drivers currently available in your area'
            });

        } catch (error) {
            console.error('Error checking availability:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to check availability',
                message: error.message
            });
        }
    }
);

/**
 * POST /booking/request
 * Create trip request (same as POST /trips but with booking context)
 * Passenger only endpoint
 */
router.post('/request',
    authenticateToken,
    authenticatePassenger,
    validateCreateTrip,
    async (req, res) => {
        try {
            // This is essentially the same as creating a trip
            // but could have different business logic for booking vs general trips
            const tripController = require('../controllers/tripController');
            await tripController.createTrip(req, res);
        } catch (error) {
            console.error('Error creating booking request:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create booking request',
                message: error.message
            });
        }
    }
);

/**
 * GET /booking/active
 * Get user's active bookings
 * Passenger and Driver endpoint
 */
router.get('/active',
    authenticateToken,
    async (req, res) => {
        try {
            const userId = req.userId;
            const userRole = req.user.role;

            const Trip = require('../models/Trip');

            // Build query for active trips
            let query;
            const activeStates = [
                tripStateService.TRIP_STATES.REQUESTED,
                tripStateService.TRIP_STATES.SEARCHING,
                tripStateService.TRIP_STATES.ACCEPTED,
                tripStateService.TRIP_STATES.DRIVER_ARRIVING,
                tripStateService.TRIP_STATES.PICKED_UP,
                tripStateService.TRIP_STATES.IN_PROGRESS
            ];

            if (userRole === 'PASSENGER') {
                query = {
                    passengerId: userId,
                    status: { $in: activeStates }
                };
            } else if (userRole === 'DRIVER') {
                query = {
                    driverId: userId,
                    status: { $in: activeStates }
                };
            } else {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied',
                    message: 'Invalid user role'
                });
            }

            const activeTrips = await Trip.find(query)
                .sort({ createdAt: -1 })
                .limit(10)
                .lean();

            // Add state information for each trip
            const tripsWithState = activeTrips.map(trip => {
                const stateInfo = tripStateService.getTripState(trip._id.toString());
                const timeoutInfo = tripStateService.getTripTimeout(trip._id.toString());

                return {
                    id: trip._id,
                    passengerId: trip.passengerId,
                    driverId: trip.driverId,
                    origin: trip.origin,
                    destination: trip.destination,
                    status: trip.status,
                    estimatedFare: trip.estimatedFare,
                    actualFare: trip.actualFare,
                    createdAt: trip.createdAt,
                    acceptedAt: trip.acceptedAt,
                    state: stateInfo,
                    timeout: timeoutInfo
                };
            });

            res.json({
                success: true,
                data: {
                    activeTrips: tripsWithState,
                    count: tripsWithState.length,
                    userRole: userRole
                },
                message: `Found ${tripsWithState.length} active bookings`
            });

        } catch (error) {
            console.error('Error getting active bookings:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get active bookings',
                message: error.message
            });
        }
    }
);

/**
 * GET /booking/surge
 * Get current surge pricing information for an area
 * Public endpoint
 */
router.get('/surge',
    validateCoordinates,
    async (req, res) => {
        try {
            const { latitude, longitude } = req.query;
            const coordinates = req.coordinates || { latitude: parseFloat(latitude), longitude: parseFloat(longitude) };

            const surgeInfo = fareCalculationService.getCurrentSurgeInfo(
                coordinates.latitude,
                coordinates.longitude
            );

            res.json({
                success: true,
                data: {
                    surge: surgeInfo,
                    location: coordinates,
                    explanation: getSurgeExplanation(surgeInfo.surgeMultiplier)
                },
                message: surgeInfo.isActive
                    ? `Surge pricing active (${surgeInfo.surgeMultiplier}x)`
                    : 'Normal pricing'
            });

        } catch (error) {
            console.error('Error getting surge info:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get surge information',
                message: error.message
            });
        }
    }
);

/**
 * Helper function to determine demand level
 * @param {number} driverCount 
 * @returns {string} Demand level
 */
function getDemandLevel(driverCount) {
    if (driverCount >= 5) return 'low';
    if (driverCount >= 2) return 'medium';
    if (driverCount >= 1) return 'high';
    return 'very_high';
}

/**
 * Helper function to explain surge pricing
 * @param {number} multiplier 
 * @returns {string} Explanation
 */
function getSurgeExplanation(multiplier) {
    if (multiplier >= 2.0) {
        return 'Very high demand - prices significantly increased';
    } else if (multiplier >= 1.5) {
        return 'High demand - prices moderately increased';
    } else if (multiplier > 1.0) {
        return 'Slightly increased demand - small price increase';
    } else {
        return 'Normal demand - standard pricing';
    }
}

module.exports = router;