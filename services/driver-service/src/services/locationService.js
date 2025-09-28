const redis = require('../config/redis');

class LocationService {
    constructor() {
        this.DRIVER_LOCATION_KEY = 'driver:locations';
        this.DRIVER_STATUS_PREFIX = 'driver:status:';
        this.LOCATION_EXPIRY = 3600; // 1 hour in seconds
    }

    /**
     * Update driver location using Redis GEOADD for high performance
     * Optimized for 10,000+ ops/second
     */
    async updateDriverLocation(driverId, longitude, latitude, status = 'ONLINE') {
        try {
            const pipeline = redis.pipeline();

            // Store geospatial data
            pipeline.geoadd(this.DRIVER_LOCATION_KEY, longitude, latitude, driverId);

            // Store driver status with expiry
            pipeline.setex(`${this.DRIVER_STATUS_PREFIX}${driverId}`, this.LOCATION_EXPIRY, status);

            // Add to online drivers set if status is ONLINE
            if (status === 'ONLINE') {
                pipeline.sadd('drivers:online', driverId);
            } else {
                pipeline.srem('drivers:online', driverId);
            }

            await pipeline.exec();
            return { success: true };
        } catch (error) {
            console.error('Error updating driver location:', error);
            throw error;
        }
    }

    /**
     * Find nearby drivers using Redis GEORADIUS - sub-10ms performance
     * Optimized for real-time driver matching
     */
    async findNearbyDrivers(longitude, latitude, radiusKm = 5, limit = 10) {
        try {
            // Use GEORADIUS with optimized parameters for speed
            const nearbyDrivers = await redis.georadius(
                this.DRIVER_LOCATION_KEY,
                longitude,
                latitude,
                radiusKm,
                'km',
                'WITHDIST',
                'WITHCOORD',
                'ASC', // Sort by distance
                'COUNT', limit
            );

            // Filter only online drivers
            const onlineDrivers = [];
            for (const driverData of nearbyDrivers) {
                const driverId = driverData[0];
                const distance = parseFloat(driverData[1]);
                const coordinates = driverData[2];

                // Check if driver is online
                const status = await redis.get(`${this.DRIVER_STATUS_PREFIX}${driverId}`);
                if (status === 'ONLINE') {
                    onlineDrivers.push({
                        driverId,
                        distance,
                        location: {
                            longitude: parseFloat(coordinates[0]),
                            latitude: parseFloat(coordinates[1])
                        }
                    });
                }
            }

            return onlineDrivers;
        } catch (error) {
            console.error('Error finding nearby drivers:', error);
            throw error;
        }
    }

    /**
     * Get driver current location from Redis
     */
    async getDriverLocation(driverId) {
        try {
            const position = await redis.geopos(this.DRIVER_LOCATION_KEY, driverId);
            if (position && position[0]) {
                return {
                    longitude: parseFloat(position[0][0]),
                    latitude: parseFloat(position[0][1])
                };
            }
            return null;
        } catch (error) {
            console.error('Error getting driver location:', error);
            throw error;
        }
    }

    /**
     * Remove driver from location tracking
     */
    async removeDriverLocation(driverId) {
        try {
            const pipeline = redis.pipeline();
            pipeline.zrem(this.DRIVER_LOCATION_KEY, driverId);
            pipeline.del(`${this.DRIVER_STATUS_PREFIX}${driverId}`);
            pipeline.srem('drivers:online', driverId);
            await pipeline.exec();
            return { success: true };
        } catch (error) {
            console.error('Error removing driver location:', error);
            throw error;
        }
    }

    /**
     * Get all online drivers count for monitoring
     */
    async getOnlineDriversCount() {
        try {
            return await redis.scard('drivers:online');
        } catch (error) {
            console.error('Error getting online drivers count:', error);
            return 0;
        }
    }

    /**
     * Batch update for multiple drivers - optimized for load testing
     */
    async batchUpdateLocations(updates) {
        try {
            const pipeline = redis.pipeline();

            for (const { driverId, longitude, latitude, status } of updates) {
                pipeline.geoadd(this.DRIVER_LOCATION_KEY, longitude, latitude, driverId);
                pipeline.setex(`${this.DRIVER_STATUS_PREFIX}${driverId}`, this.LOCATION_EXPIRY, status);

                if (status === 'ONLINE') {
                    pipeline.sadd('drivers:online', driverId);
                } else {
                    pipeline.srem('drivers:online', driverId);
                }
            }

            await pipeline.exec();
            return { success: true, count: updates.length };
        } catch (error) {
            console.error('Error batch updating locations:', error);
            throw error;
        }
    }
}

module.exports = new LocationService();