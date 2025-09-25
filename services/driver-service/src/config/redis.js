const { RedisManager } = require('../../common/shared');

class DriverRedisManager extends RedisManager {
    constructor() {
        super('DriverService');
    }

    // Cache Keys
    static CACHE_KEYS = {
        DRIVER_LOCATION: 'geo:drivers', // Geospatial set for all drivers
        DRIVER_SESSION: 'driver:session:',
        DRIVER_PROFILE: 'driver:profile:',
        DRIVER_STATUS: 'driver:status:',
        DRIVER_RATINGS: 'driver:ratings:',
        AVAILABLE_DRIVERS: 'drivers:available',
        TRIP_REQUESTS: 'driver:requests:',
        DRIVER_METRICS: 'driver:metrics:',
        LOCATION_HISTORY: 'driver:location:history:',
        DRIVER_QUEUE: 'queue:drivers:',
        VEHICLE_INFO: 'vehicle:info:'
    };

    /**
     * Update driver location using Redis geospatial commands
     */
    async updateDriverLocation(driverId, longitude, latitude, metadata = {}) {
        try {
            // Add/update driver location in geospatial index
            await this.geoadd(
                DriverRedisManager.CACHE_KEYS.DRIVER_LOCATION,
                longitude,
                latitude,
                driverId
            );

            // Cache additional metadata if provided
            if (Object.keys(metadata).length > 0) {
                const locationKey = `${DriverRedisManager.CACHE_KEYS.LOCATION_HISTORY}${driverId}`;
                const locationData = {
                    longitude,
                    latitude,
                    timestamp: Date.now(),
                    ...metadata
                };

                await this.lpush(locationKey, JSON.stringify(locationData));
                await this.ltrim(locationKey, 0, 99); // Keep last 100 locations
                await this.expire(locationKey, 86400); // 24 hours
            }

            console.log(`📍 Updated location for driver ${driverId}: ${latitude}, ${longitude}`);
        } catch (error) {
            console.error(`❌ Failed to update driver location: ${error.message}`);
            throw error;
        }
    }

    /**
     * Find nearby drivers within radius
     */
    async findNearbyDrivers(longitude, latitude, radiusMeters = 5000, unit = 'm') {
        try {
            const drivers = await this.georadius(
                DriverRedisManager.CACHE_KEYS.DRIVER_LOCATION,
                longitude,
                latitude,
                radiusMeters,
                unit,
                ['WITHDIST', 'WITHCOORD', 'ASC'] // Include distance, coordinates, sort by distance
            );

            // Format the response
            const formattedDrivers = drivers.map(driver => ({
                driverId: driver[0],
                distance: parseFloat(driver[1]),
                coordinates: {
                    longitude: parseFloat(driver[2][0]),
                    latitude: parseFloat(driver[2][1])
                }
            }));

            console.log(`🔍 Found ${formattedDrivers.length} drivers within ${radiusMeters}${unit}`);
            return formattedDrivers;
        } catch (error) {
            console.error(`❌ Failed to find nearby drivers: ${error.message}`);
            return [];
        }
    }

    /**
     * Get distance between two drivers
     */
    async getDistanceBetweenDrivers(driverId1, driverId2, unit = 'm') {
        try {
            const distance = await this.geodist(
                DriverRedisManager.CACHE_KEYS.DRIVER_LOCATION,
                driverId1,
                driverId2,
                unit
            );

            return distance ? parseFloat(distance) : null;
        } catch (error) {
            console.error(`❌ Failed to get distance between drivers: ${error.message}`);
            return null;
        }
    }

    /**
     * Remove driver from location tracking (when offline)
     */
    async removeDriverLocation(driverId) {
        try {
            await this.zrem(DriverRedisManager.CACHE_KEYS.DRIVER_LOCATION, driverId);
            console.log(`🗑️ Removed driver ${driverId} from location tracking`);
        } catch (error) {
            console.error(`❌ Failed to remove driver location: ${error.message}`);
        }
    }

    /**
     * Cache driver session data
     */
    async cacheDriverSession(driverId, sessionData, ttlSeconds = 86400) {
        try {
            const key = `${DriverRedisManager.CACHE_KEYS.DRIVER_SESSION}${driverId}`;
            await this.setex(key, ttlSeconds, JSON.stringify(sessionData));
        } catch (error) {
            console.error(`❌ Failed to cache driver session: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get cached driver session
     */
    async getDriverSession(driverId) {
        try {
            const key = `${DriverRedisManager.CACHE_KEYS.DRIVER_SESSION}${driverId}`;
            const sessionData = await this.get(key);
            return sessionData ? JSON.parse(sessionData) : null;
        } catch (error) {
            console.error(`❌ Failed to get driver session: ${error.message}`);
            return null;
        }
    }

    /**
     * Update driver status (available, busy, offline)
     */
    async updateDriverStatus(driverId, status, metadata = {}) {
        try {
            const statusKey = `${DriverRedisManager.CACHE_KEYS.DRIVER_STATUS}${driverId}`;
            const statusData = {
                status,
                timestamp: Date.now(),
                ...metadata
            };

            await this.setex(statusKey, 3600, JSON.stringify(statusData));

            // Add/remove from available drivers set
            if (status === 'available') {
                await this.sadd(DriverRedisManager.CACHE_KEYS.AVAILABLE_DRIVERS, driverId);
            } else {
                await this.srem(DriverRedisManager.CACHE_KEYS.AVAILABLE_DRIVERS, driverId);
            }

            console.log(`🚗 Driver ${driverId} status updated to: ${status}`);
        } catch (error) {
            console.error(`❌ Failed to update driver status: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get driver status
     */
    async getDriverStatus(driverId) {
        try {
            const key = `${DriverRedisManager.CACHE_KEYS.DRIVER_STATUS}${driverId}`;
            const statusData = await this.get(key);
            return statusData ? JSON.parse(statusData) : null;
        } catch (error) {
            console.error(`❌ Failed to get driver status: ${error.message}`);
            return null;
        }
    }

    /**
     * Get all available drivers
     */
    async getAvailableDrivers() {
        try {
            const driverIds = await this.smembers(DriverRedisManager.CACHE_KEYS.AVAILABLE_DRIVERS);
            return driverIds || [];
        } catch (error) {
            console.error(`❌ Failed to get available drivers: ${error.message}`);
            return [];
        }
    }

    /**
     * Add trip request to driver's queue
     */
    async addTripRequest(driverId, tripData, ttlSeconds = 300) {
        try {
            const queueKey = `${DriverRedisManager.CACHE_KEYS.TRIP_REQUESTS}${driverId}`;
            await this.lpush(queueKey, JSON.stringify(tripData));
            await this.expire(queueKey, ttlSeconds); // Expire requests after 5 minutes

            console.log(`📋 Added trip request to driver ${driverId} queue`);
        } catch (error) {
            console.error(`❌ Failed to add trip request: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get pending trip requests for driver
     */
    async getTripRequests(driverId) {
        try {
            const queueKey = `${DriverRedisManager.CACHE_KEYS.TRIP_REQUESTS}${driverId}`;
            const requests = await this.lrange(queueKey, 0, -1);
            return requests.map(req => JSON.parse(req));
        } catch (error) {
            console.error(`❌ Failed to get trip requests: ${error.message}`);
            return [];
        }
    }

    /**
     * Remove trip request from driver's queue
     */
    async removeTripRequest(driverId, tripData) {
        try {
            const queueKey = `${DriverRedisManager.CACHE_KEYS.TRIP_REQUESTS}${driverId}`;
            await this.lrem(queueKey, 1, JSON.stringify(tripData));
        } catch (error) {
            console.error(`❌ Failed to remove trip request: ${error.message}`);
        }
    }

    /**
     * Cache driver metrics and statistics
     */
    async updateDriverMetrics(driverId, metrics) {
        try {
            const metricsKey = `${DriverRedisManager.CACHE_KEYS.DRIVER_METRICS}${driverId}`;
            await this.hmset(metricsKey, metrics);
            await this.expire(metricsKey, 86400); // 24 hours
        } catch (error) {
            console.error(`❌ Failed to update driver metrics: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get driver metrics
     */
    async getDriverMetrics(driverId) {
        try {
            const metricsKey = `${DriverRedisManager.CACHE_KEYS.DRIVER_METRICS}${driverId}`;
            const metrics = await this.hgetall(metricsKey);
            return metrics;
        } catch (error) {
            console.error(`❌ Failed to get driver metrics: ${error.message}`);
            return {};
        }
    }

    /**
     * Cache vehicle information
     */
    async cacheVehicleInfo(driverId, vehicleData, ttlSeconds = 86400) {
        try {
            const vehicleKey = `${DriverRedisManager.CACHE_KEYS.VEHICLE_INFO}${driverId}`;
            await this.setex(vehicleKey, ttlSeconds, JSON.stringify(vehicleData));
        } catch (error) {
            console.error(`❌ Failed to cache vehicle info: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get cached vehicle information
     */
    async getVehicleInfo(driverId) {
        try {
            const vehicleKey = `${DriverRedisManager.CACHE_KEYS.VEHICLE_INFO}${driverId}`;
            const vehicleData = await this.get(vehicleKey);
            return vehicleData ? JSON.parse(vehicleData) : null;
        } catch (error) {
            console.error(`❌ Failed to get vehicle info: ${error.message}`);
            return null;
        }
    }

    /**
     * Get driver location history
     */
    async getDriverLocationHistory(driverId, count = 20) {
        try {
            const locationKey = `${DriverRedisManager.CACHE_KEYS.LOCATION_HISTORY}${driverId}`;
            const locations = await this.lrange(locationKey, 0, count - 1);
            return locations.map(loc => JSON.parse(loc));
        } catch (error) {
            console.error(`❌ Failed to get driver location history: ${error.message}`);
            return [];
        }
    }

    /**
     * Get current driver location
     */
    async getCurrentDriverLocation(driverId) {
        try {
            const position = await this.geopos(
                DriverRedisManager.CACHE_KEYS.DRIVER_LOCATION,
                driverId
            );

            if (position && position[0]) {
                return {
                    longitude: parseFloat(position[0][0]),
                    latitude: parseFloat(position[0][1])
                };
            }
            return null;
        } catch (error) {
            console.error(`❌ Failed to get current driver location: ${error.message}`);
            return null;
        }
    }

    /**
     * Cleanup driver data (when driver goes offline)
     */
    async cleanupDriverData(driverId) {
        try {
            console.log(`🧹 Cleaning up data for driver ${driverId}`);

            // Remove from geospatial index
            await this.removeDriverLocation(driverId);

            // Remove from available drivers
            await this.srem(DriverRedisManager.CACHE_KEYS.AVAILABLE_DRIVERS, driverId);

            // Clear trip requests queue
            const queueKey = `${DriverRedisManager.CACHE_KEYS.TRIP_REQUESTS}${driverId}`;
            await this.del(queueKey);

            console.log(`✅ Cleaned up data for driver ${driverId}`);
        } catch (error) {
            console.error(`❌ Failed to cleanup driver data: ${error.message}`);
        }
    }
}

// Export singleton instance
const driverRedis = new DriverRedisManager();
module.exports = driverRedis;