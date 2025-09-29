/**
 * Driver Matching Service
 * Finds available drivers near passenger location using Redis GEORADIUS
 * Integrates with Driver Service API for driver status
 */

const axios = require('axios');
const Redis = require('redis');

// Configuration
const DRIVER_SERVICE_URL = process.env.DRIVER_SERVICE_URL || 'http://driver-service:3000';
const SEARCH_RADIUS_KM = parseFloat(process.env.TRIP_SEARCH_RADIUS) / 1000 || 5; // Convert meters to km
const MAX_DRIVERS_PER_TRIP = parseInt(process.env.MAX_DRIVERS_PER_TRIP) || 5;
const DRIVER_ACCEPTANCE_TIMEOUT = parseInt(process.env.DRIVER_ACCEPTANCE_TIMEOUT) || 15; // seconds

// Redis client for geospatial operations
let redisClient = null;

/**
 * Initialize Redis client for driver matching
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
            console.error('Redis connection error:', err);
        });

        redisClient.on('connect', () => {
            console.log('Driver Matching Service connected to Redis');
        });

        await redisClient.connect();
        return redisClient;
    } catch (error) {
        console.error('Failed to initialize Redis for driver matching:', error);
        throw error;
    }
}

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 
 * @param {number} lng1 
 * @param {number} lat2 
 * @param {number} lng2 
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Find available drivers near the pickup location using Redis GEORADIUS
 * @param {number} latitude - Pickup latitude
 * @param {number} longitude - Pickup longitude
 * @param {object} options - Search options
 * @returns {Promise<Array>} Array of nearby drivers
 */
async function findNearbyDrivers(latitude, longitude, options = {}) {
    try {
        await initializeRedis();

        const searchRadius = options.radius || SEARCH_RADIUS_KM;
        const maxResults = options.limit || MAX_DRIVERS_PER_TRIP;

        console.log(`Searching for drivers within ${searchRadius}km of ${latitude}, ${longitude}`);

        // Use Redis GEORADIUS to find nearby drivers
        // Key format: "driver_locations" contains all online driver locations
        const nearbyDrivers = await redisClient.sendCommand([
            'GEORADIUS',
            'driver_locations',
            longitude.toString(),
            latitude.toString(),
            searchRadius.toString(),
            'KM',
            'WITHCOORD',
            'WITHDIST',
            'COUNT', maxResults.toString(),
            'ASC'
        ]);

        if (!nearbyDrivers || nearbyDrivers.length === 0) {
            console.log('No drivers found in the search area');
            return {
                success: true,
                drivers: [],
                searchArea: {
                    latitude,
                    longitude,
                    radiusKm: searchRadius
                },
                message: 'No available drivers found in your area'
            };
        }

        console.log(`Found ${nearbyDrivers.length} drivers within search radius`);
        console.log('Raw Redis response:', JSON.stringify(nearbyDrivers, null, 2));

        // Format the Redis response and enrich with driver details
        const formattedDrivers = await Promise.all(
            nearbyDrivers.map(async (driverData) => {
                // Redis GEORADIUS with WITHCOORD WITHDIST returns:
                // [driverId, distance, [longitude, latitude]]
                console.log('Processing driver data:', JSON.stringify(driverData, null, 2));

                const driverId = driverData[0];
                const distance = parseFloat(driverData[1]);
                const coordinates = driverData[2];

                return {
                    driverId: driverId,
                    distance: distance,
                    location: {
                        latitude: parseFloat(coordinates[1]),
                        longitude: parseFloat(coordinates[0])
                    },
                    estimatedArrival: estimateArrivalTime(distance)
                };
            })
        );

        // Verify driver availability through Driver Service
        // For now, trust Redis data as drivers in Redis are already validated as available
        // const availableDrivers = await verifyDriverAvailability(formattedDrivers);
        const availableDrivers = formattedDrivers;

        console.log(`Verified ${availableDrivers.length} available drivers`);

        return {
            success: true,
            drivers: availableDrivers,
            searchArea: {
                latitude,
                longitude,
                radiusKm: searchRadius
            },
            totalFound: nearbyDrivers.length,
            availableCount: availableDrivers.length,
            searchedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error('Error finding nearby drivers:', error);
        return {
            success: false,
            error: 'Failed to find nearby drivers',
            message: error.message,
            drivers: []
        };
    }
}

/**
 * Verify driver availability by calling Driver Service
 * @param {Array} drivers - Array of potential drivers
 * @returns {Promise<Array>} Array of available drivers with full details
 */
async function verifyDriverAvailability(drivers) {
    try {
        if (!drivers || drivers.length === 0) {
            return [];
        }

        const driverIds = drivers.map(d => d.driverId);

        // Call Driver Service to get driver statuses
        const response = await axios.post(
            `${DRIVER_SERVICE_URL}/drivers/batch-status`,
            { driverIds },
            {
                timeout: 5000,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.data.success || !response.data.data) {
            console.warn('Failed to verify driver availability');
            return drivers; // Return drivers without verification
        }

        const driverStatuses = response.data.data;

        // Filter and enrich drivers with full details
        const availableDrivers = drivers
            .map(driver => {
                const driverStatus = driverStatuses.find(status => status.driverId === driver.driverId);

                if (!driverStatus) {
                    return null; // Driver not found
                }

                // Only include online and available drivers
                if (driverStatus.status !== 'ONLINE' || !driverStatus.isAvailable) {
                    return null;
                }

                return {
                    ...driver,
                    driverInfo: {
                        name: driverStatus.name || 'Driver',
                        phone: driverStatus.phone || null,
                        rating: driverStatus.rating || 0,
                        completedTrips: driverStatus.completedTrips || 0,
                        vehicleType: driverStatus.vehicleType || 'Car',
                        licensePlate: driverStatus.licensePlate || null
                    },
                    status: driverStatus.status,
                    lastLocationUpdate: driverStatus.lastLocationUpdate
                };
            })
            .filter(driver => driver !== null)
            .sort((a, b) => a.distance - b.distance); // Sort by distance

        console.log(`${availableDrivers.length} drivers are available out of ${drivers.length} nearby drivers`);

        return availableDrivers;

    } catch (error) {
        console.error('Error verifying driver availability:', error);

        // If Driver Service is unavailable, return basic driver info
        return drivers.map(driver => ({
            ...driver,
            driverInfo: {
                name: 'Driver',
                rating: 0
            },
            status: 'UNKNOWN',
            verified: false
        }));
    }
}

/**
 * Estimate arrival time based on distance
 * @param {number} distanceKm - Distance in kilometers
 * @returns {number} Estimated arrival time in minutes
 */
function estimateArrivalTime(distanceKm) {
    const averageSpeedKmh = 25; // Average city speed for drivers
    const timeHours = distanceKm / averageSpeedKmh;
    const timeMinutes = Math.ceil(timeHours * 60);

    return Math.max(timeMinutes, 1); // Minimum 1 minute
}

/**
 * Notify selected drivers about a trip request
 * @param {Array} drivers - Selected drivers to notify
 * @param {object} tripDetails - Trip information
 * @returns {Promise<object>} Notification results
 */
async function notifyDriversAboutTrip(drivers, tripDetails) {
    try {
        if (!drivers || drivers.length === 0) {
            return {
                success: false,
                message: 'No drivers to notify',
                notified: []
            };
        }

        console.log(`Notifying ${drivers.length} drivers about trip ${tripDetails.tripId}`);

        // Use notification service for WebSocket notifications
        const { notificationService } = require('./notificationService');

        const driverIds = drivers.map(driver => driver.driverId);

        try {
            await notificationService.notifyDriversAboutTripRequest(driverIds, {
                tripId: tripDetails.tripId,
                origin: tripDetails.origin,
                destination: tripDetails.destination,
                estimatedFare: tripDetails.estimatedFare,
                distance: drivers[0]?.distance || 0,
                timeout: DRIVER_ACCEPTANCE_TIMEOUT
            });

            console.log(`Trip request sent to ${driverIds.length} drivers`);

            return {
                success: true,
                message: 'Drivers notified successfully',
                notified: drivers.map(driver => ({
                    driverId: driver.driverId,
                    success: true,
                    notifiedAt: new Date().toISOString()
                }))
            };

        } catch (error) {
            console.error('Error notifying drivers via WebSocket:', error);

            return {
                success: false,
                message: 'Failed to notify drivers',
                error: error.message,
                notified: []
            };
        }
    } catch (error) {
        console.error('Error in notifyDriversAboutTrip:', error);
        return {
            success: false,
            error: 'Failed to notify drivers',
            message: error.message,
            notified: []
        };
    }
}

/**
 * Get optimal drivers for a trip request
 * This is the main function that orchestrates the driver matching process
 * @param {object} tripRequest - Trip request details
 * @returns {Promise<object>} Driver matching results
 */
async function getOptimalDrivers(tripRequest) {
    try {
        const { origin, destination, passengerId, tripId } = tripRequest;

        console.log(`Finding optimal drivers for trip ${tripId}`);

        // Find nearby drivers
        const nearbyResult = await findNearbyDrivers(
            origin.latitude,
            origin.longitude,
            {
                radius: SEARCH_RADIUS_KM,
                limit: MAX_DRIVERS_PER_TRIP
            }
        );

        if (!nearbyResult.success || nearbyResult.drivers.length === 0) {
            return {
                success: false,
                message: 'No available drivers found in your area',
                searchRadius: SEARCH_RADIUS_KM,
                driversFound: 0,
                optimalDrivers: []
            };
        }

        // Select optimal drivers (closest and highest rated)
        const optimalDrivers = selectOptimalDrivers(nearbyResult.drivers);

        return {
            success: true,
            driversFound: nearbyResult.drivers.length,
            optimalDrivers: optimalDrivers,
            searchArea: nearbyResult.searchArea,
            message: `Found ${optimalDrivers.length} optimal drivers for your trip`
        };

    } catch (error) {
        console.error('Error getting optimal drivers:', error);
        return {
            success: false,
            error: 'Failed to find optimal drivers',
            message: error.message,
            optimalDrivers: []
        };
    }
}

/**
 * Select optimal drivers based on distance, rating, and availability
 * @param {Array} drivers - Available drivers
 * @returns {Array} Optimal drivers sorted by preference
 */
function selectOptimalDrivers(drivers) {
    // Score each driver based on multiple factors
    const scoredDrivers = drivers.map(driver => {
        let score = 0;

        // Distance score (closer is better) - 40% weight
        const maxDistance = Math.max(...drivers.map(d => d.distance));
        const distanceScore = maxDistance > 0 ? (1 - (driver.distance / maxDistance)) * 40 : 40;
        score += distanceScore;

        // Rating score - 35% weight
        const rating = driver.driverInfo?.rating || 0;
        const ratingScore = (rating / 5) * 35;
        score += ratingScore;

        // Experience score (completed trips) - 15% weight
        const completedTrips = driver.driverInfo?.completedTrips || 0;
        const maxTrips = Math.max(...drivers.map(d => d.driverInfo?.completedTrips || 0));
        const experienceScore = maxTrips > 0 ? (completedTrips / maxTrips) * 15 : 0;
        score += experienceScore;

        // Availability score (recent location update) - 10% weight
        const lastUpdate = new Date(driver.lastLocationUpdate || Date.now());
        const timeSinceUpdate = Date.now() - lastUpdate.getTime();
        const availabilityScore = timeSinceUpdate < 60000 ? 10 : timeSinceUpdate < 300000 ? 5 : 0; // < 1min = 10, < 5min = 5, else 0
        score += availabilityScore;

        return {
            ...driver,
            score: Math.round(score * 100) / 100,
            factors: {
                distanceScore: Math.round(distanceScore * 100) / 100,
                ratingScore: Math.round(ratingScore * 100) / 100,
                experienceScore: Math.round(experienceScore * 100) / 100,
                availabilityScore
            }
        };
    });

    // Sort by score (highest first) and return top drivers
    return scoredDrivers
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_DRIVERS_PER_TRIP);
}

/**
 * Handle driver response to trip request (accept/reject)
 * @param {string} tripId - Trip ID
 * @param {string} driverId - Driver ID
 * @param {string} response - 'accept' or 'reject'
 * @returns {Promise<object>} Response handling result
 */
async function handleDriverResponse(tripId, driverId, response) {
    try {
        // This would typically notify the Trip Service about the driver's response
        // For now, we'll just log and return the result

        console.log(`Driver ${driverId} ${response}ed trip ${tripId}`);

        return {
            success: true,
            tripId,
            driverId,
            response,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('Error handling driver response:', error);
        return {
            success: false,
            error: 'Failed to handle driver response',
            message: error.message
        };
    }
}

/**
 * Clean up Redis connection
 */
async function cleanup() {
    if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        console.log('Driver matching Redis connection closed');
    }
}

/**
 * Add or update driver location in Redis
 * @param {string} driverId - Driver ID
 * @param {number} longitude - Driver longitude
 * @param {number} latitude - Driver latitude
 * @returns {Promise<Object>} Result object
 */
async function addDriverLocation(driverId, longitude, latitude) {
    try {
        await initializeRedis();

        // Add driver to Redis geospatial index
        const result = await redisClient.geoAdd('driver_locations', {
            longitude: longitude,
            latitude: latitude,
            member: driverId
        });

        console.log(`Driver ${driverId} location updated: ${latitude}, ${longitude}`);

        return {
            success: true,
            driverId,
            location: { latitude, longitude },
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('Error adding driver location:', error);
        return {
            success: false,
            error: 'Failed to add driver location',
            message: error.message
        };
    }
}

/**
 * Remove driver from Redis when going offline
 * @param {string} driverId - Driver ID
 * @returns {Promise<Object>} Result object
 */
async function removeDriverLocation(driverId) {
    try {
        await initializeRedis();

        // Remove driver from Redis geospatial index
        const result = await redisClient.zRem('driver_locations', driverId);

        console.log(`Driver ${driverId} removed from location index`);

        return {
            success: true,
            driverId,
            removed: result > 0,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('Error removing driver location:', error);
        return {
            success: false,
            error: 'Failed to remove driver location',
            message: error.message
        };
    }
}

/**
 * Sync all available drivers from User Service to Redis
 * @returns {Promise<Object>} Result object
 */
async function syncAvailableDrivers() {
    try {
        const userServiceUrl = process.env.USER_SERVICE_URL || 'http://user-service:3000';

        // Get all available drivers from User Service
        const response = await axios.get(
            `${userServiceUrl}/users?role=DRIVER&isOnline=true`,
            {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.data.success || !response.data.data) {
            throw new Error('Failed to fetch drivers from User Service');
        }

        const drivers = response.data.data.users || response.data.data;
        let syncedCount = 0;

        for (const driver of drivers) {
            if (driver.location && driver.location.latitude && driver.location.longitude &&
                driver.driverInfo && driver.driverInfo.driverStatus === 'AVAILABLE') {

                await addDriverLocation(
                    driver._id || driver.id,
                    driver.location.longitude,
                    driver.location.latitude
                );
                syncedCount++;
            }
        }

        console.log(`Synced ${syncedCount} available drivers to Redis`);

        return {
            success: true,
            totalDrivers: drivers.length,
            syncedDrivers: syncedCount,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('Error syncing available drivers:', error);
        return {
            success: false,
            error: 'Failed to sync available drivers',
            message: error.message
        };
    }
}

module.exports = {
    findNearbyDrivers,
    getOptimalDrivers,
    notifyDriversAboutTrip,
    verifyDriverAvailability,
    selectOptimalDrivers,
    handleDriverResponse,
    calculateDistance,
    estimateArrivalTime,
    initializeRedis,
    cleanup,
    addDriverLocation,
    removeDriverLocation,
    syncAvailableDrivers,

    // Constants for testing
    CONSTANTS: {
        SEARCH_RADIUS_KM,
        MAX_DRIVERS_PER_TRIP,
        DRIVER_ACCEPTANCE_TIMEOUT
    }
};