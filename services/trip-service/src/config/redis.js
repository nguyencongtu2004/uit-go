const { RedisManager } = require('../../common/shared');

class TripRedisManager extends RedisManager {
    constructor() {
        super('TripService');
    }

    // Cache Keys
    static CACHE_KEYS = {
        TRIP_DATA: 'trip:data:',
        TRIP_STATUS: 'trip:status:',
        ACTIVE_TRIPS: 'trips:active',
        TRIP_QUEUE: 'queue:trips',
        TRIP_TRACKING: 'trip:tracking:',
        USER_TRIPS: 'user:trips:',
        DRIVER_TRIPS: 'driver:trips:',
        TRIP_MATCHING: 'matching:trips:',
        TRIP_ANALYTICS: 'analytics:trips:',
        FARE_ESTIMATES: 'fare:estimates:',
        ROUTE_CACHE: 'route:cache:',
        ETA_CACHE: 'eta:cache:'
    };

    /**
     * Cache trip data
     */
    async cacheTripData(tripId, tripData, ttlSeconds = 3600) {
        try {
            const key = `${TripRedisManager.CACHE_KEYS.TRIP_DATA}${tripId}`;
            await this.setex(key, ttlSeconds, JSON.stringify(tripData));
        } catch (error) {
            console.error(`❌ Failed to cache trip data: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get cached trip data
     */
    async getTripData(tripId) {
        try {
            const key = `${TripRedisManager.CACHE_KEYS.TRIP_DATA}${tripId}`;
            const tripData = await this.get(key);
            return tripData ? JSON.parse(tripData) : null;
        } catch (error) {
            console.error(`❌ Failed to get trip data: ${error.message}`);
            return null;
        }
    }

    /**
     * Update trip status with real-time tracking
     */
    async updateTripStatus(tripId, status, metadata = {}) {
        try {
            const statusKey = `${TripRedisManager.CACHE_KEYS.TRIP_STATUS}${tripId}`;
            const statusData = {
                status,
                timestamp: Date.now(),
                ...metadata
            };

            await this.setex(statusKey, 86400, JSON.stringify(statusData)); // 24 hours

            // Manage active trips set
            if (['requested', 'accepted', 'picked_up', 'in_progress'].includes(status)) {
                await this.sadd(TripRedisManager.CACHE_KEYS.ACTIVE_TRIPS, tripId);
            } else {
                await this.srem(TripRedisManager.CACHE_KEYS.ACTIVE_TRIPS, tripId);
            }

            // Publish status update for real-time notifications
            await this.publish(`trip:status:${tripId}`, JSON.stringify(statusData));

            console.log(`🚕 Trip ${tripId} status updated to: ${status}`);
        } catch (error) {
            console.error(`❌ Failed to update trip status: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get trip status
     */
    async getTripStatus(tripId) {
        try {
            const key = `${TripRedisManager.CACHE_KEYS.TRIP_STATUS}${tripId}`;
            const statusData = await this.get(key);
            return statusData ? JSON.parse(statusData) : null;
        } catch (error) {
            console.error(`❌ Failed to get trip status: ${error.message}`);
            return null;
        }
    }

    /**
     * Add trip to matching queue
     */
    async addTripToQueue(tripData, priority = 0) {
        try {
            const tripWithTimestamp = {
                ...tripData,
                queuedAt: Date.now()
            };

            await this.zadd(
                TripRedisManager.CACHE_KEYS.TRIP_QUEUE,
                priority,
                JSON.stringify(tripWithTimestamp)
            );

            console.log(`📋 Added trip ${tripData.tripId} to matching queue`);
        } catch (error) {
            console.error(`❌ Failed to add trip to queue: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get next trip from queue
     */
    async getNextTripFromQueue() {
        try {
            const trips = await this.zrange(TripRedisManager.CACHE_KEYS.TRIP_QUEUE, 0, 0);

            if (trips.length > 0) {
                const tripData = JSON.parse(trips[0]);
                await this.zrem(TripRedisManager.CACHE_KEYS.TRIP_QUEUE, trips[0]);
                return tripData;
            }

            return null;
        } catch (error) {
            console.error(`❌ Failed to get next trip from queue: ${error.message}`);
            return null;
        }
    }

    /**
     * Track trip location in real-time
     */
    async updateTripTracking(tripId, trackingData) {
        try {
            const trackingKey = `${TripRedisManager.CACHE_KEYS.TRIP_TRACKING}${tripId}`;
            const timestamp = Date.now();

            const locationUpdate = {
                ...trackingData,
                timestamp
            };

            // Add to tracking list (keep last 100 updates)
            await this.lpush(trackingKey, JSON.stringify(locationUpdate));
            await this.ltrim(trackingKey, 0, 99);
            await this.expire(trackingKey, 86400); // 24 hours

            // Publish real-time update
            await this.publish(`trip:tracking:${tripId}`, JSON.stringify(locationUpdate));

        } catch (error) {
            console.error(`❌ Failed to update trip tracking: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get trip tracking history
     */
    async getTripTracking(tripId, count = 50) {
        try {
            const trackingKey = `${TripRedisManager.CACHE_KEYS.TRIP_TRACKING}${tripId}`;
            const tracking = await this.lrange(trackingKey, 0, count - 1);
            return tracking.map(item => JSON.parse(item));
        } catch (error) {
            console.error(`❌ Failed to get trip tracking: ${error.message}`);
            return [];
        }
    }

    /**
     * Cache user's trip history
     */
    async cacheUserTrips(userId, trips, ttlSeconds = 1800) {
        try {
            const userTripsKey = `${TripRedisManager.CACHE_KEYS.USER_TRIPS}${userId}`;
            await this.setex(userTripsKey, ttlSeconds, JSON.stringify(trips));
        } catch (error) {
            console.error(`❌ Failed to cache user trips: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get cached user trips
     */
    async getUserTrips(userId) {
        try {
            const userTripsKey = `${TripRedisManager.CACHE_KEYS.USER_TRIPS}${userId}`;
            const trips = await this.get(userTripsKey);
            return trips ? JSON.parse(trips) : null;
        } catch (error) {
            console.error(`❌ Failed to get user trips: ${error.message}`);
            return null;
        }
    }

    /**
     * Cache driver's trip history
     */
    async cacheDriverTrips(driverId, trips, ttlSeconds = 1800) {
        try {
            const driverTripsKey = `${TripRedisManager.CACHE_KEYS.DRIVER_TRIPS}${driverId}`;
            await this.setex(driverTripsKey, ttlSeconds, JSON.stringify(trips));
        } catch (error) {
            console.error(`❌ Failed to cache driver trips: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get cached driver trips
     */
    async getDriverTrips(driverId) {
        try {
            const driverTripsKey = `${TripRedisManager.CACHE_KEYS.DRIVER_TRIPS}${driverId}`;
            const trips = await this.get(driverTripsKey);
            return trips ? JSON.parse(trips) : null;
        } catch (error) {
            console.error(`❌ Failed to get driver trips: ${error.message}`);
            return null;
        }
    }

    /**
     * Cache fare estimate
     */
    async cacheFareEstimate(routeHash, estimate, ttlSeconds = 3600) {
        try {
            const fareKey = `${TripRedisManager.CACHE_KEYS.FARE_ESTIMATES}${routeHash}`;
            await this.setex(fareKey, ttlSeconds, JSON.stringify(estimate));
        } catch (error) {
            console.error(`❌ Failed to cache fare estimate: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get cached fare estimate
     */
    async getFareEstimate(routeHash) {
        try {
            const fareKey = `${TripRedisManager.CACHE_KEYS.FARE_ESTIMATES}${routeHash}`;
            const estimate = await this.get(fareKey);
            return estimate ? JSON.parse(estimate) : null;
        } catch (error) {
            console.error(`❌ Failed to get fare estimate: ${error.message}`);
            return null;
        }
    }

    /**
     * Cache route information
     */
    async cacheRoute(routeHash, routeData, ttlSeconds = 7200) {
        try {
            const routeKey = `${TripRedisManager.CACHE_KEYS.ROUTE_CACHE}${routeHash}`;
            await this.setex(routeKey, ttlSeconds, JSON.stringify(routeData));
        } catch (error) {
            console.error(`❌ Failed to cache route: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get cached route
     */
    async getCachedRoute(routeHash) {
        try {
            const routeKey = `${TripRedisManager.CACHE_KEYS.ROUTE_CACHE}${routeHash}`;
            const routeData = await this.get(routeKey);
            return routeData ? JSON.parse(routeData) : null;
        } catch (error) {
            console.error(`❌ Failed to get cached route: ${error.message}`);
            return null;
        }
    }

    /**
     * Cache ETA calculation
     */
    async cacheETA(routeHash, eta, ttlSeconds = 300) {
        try {
            const etaKey = `${TripRedisManager.CACHE_KEYS.ETA_CACHE}${routeHash}`;
            await this.setex(etaKey, ttlSeconds, JSON.stringify(eta));
        } catch (error) {
            console.error(`❌ Failed to cache ETA: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get cached ETA
     */
    async getCachedETA(routeHash) {
        try {
            const etaKey = `${TripRedisManager.CACHE_KEYS.ETA_CACHE}${routeHash}`;
            const eta = await this.get(etaKey);
            return eta ? JSON.parse(eta) : null;
        } catch (error) {
            console.error(`❌ Failed to get cached ETA: ${error.message}`);
            return null;
        }
    }

    /**
     * Store trip analytics data
     */
    async updateTripAnalytics(tripId, analyticsData) {
        try {
            const analyticsKey = `${TripRedisManager.CACHE_KEYS.TRIP_ANALYTICS}${tripId}`;
            await this.hmset(analyticsKey, analyticsData);
            await this.expire(analyticsKey, 604800); // 7 days
        } catch (error) {
            console.error(`❌ Failed to update trip analytics: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get trip analytics
     */
    async getTripAnalytics(tripId) {
        try {
            const analyticsKey = `${TripRedisManager.CACHE_KEYS.TRIP_ANALYTICS}${tripId}`;
            const analytics = await this.hgetall(analyticsKey);
            return analytics;
        } catch (error) {
            console.error(`❌ Failed to get trip analytics: ${error.message}`);
            return {};
        }
    }

    /**
     * Get all active trips
     */
    async getActiveTrips() {
        try {
            const activeTrips = await this.smembers(TripRedisManager.CACHE_KEYS.ACTIVE_TRIPS);
            return activeTrips || [];
        } catch (error) {
            console.error(`❌ Failed to get active trips: ${error.message}`);
            return [];
        }
    }

    /**
     * Subscribe to trip status updates
     */
    async subscribeTripUpdates(tripId, callback) {
        try {
            const channel = `trip:status:${tripId}`;
            await this.subscribe(channel, callback);
            console.log(`🔔 Subscribed to trip updates for ${tripId}`);
        } catch (error) {
            console.error(`❌ Failed to subscribe to trip updates: ${error.message}`);
        }
    }

    /**
     * Subscribe to trip tracking updates
     */
    async subscribeTripTracking(tripId, callback) {
        try {
            const channel = `trip:tracking:${tripId}`;
            await this.subscribe(channel, callback);
            console.log(`🔔 Subscribed to trip tracking for ${tripId}`);
        } catch (error) {
            console.error(`❌ Failed to subscribe to trip tracking: ${error.message}`);
        }
    }

    /**
     * Cleanup completed trip data
     */
    async cleanupCompletedTrip(tripId) {
        try {
            console.log(`🧹 Cleaning up data for completed trip ${tripId}`);

            // Remove from active trips
            await this.srem(TripRedisManager.CACHE_KEYS.ACTIVE_TRIPS, tripId);

            // Keep tracking data for a bit longer for analytics
            const trackingKey = `${TripRedisManager.CACHE_KEYS.TRIP_TRACKING}${tripId}`;
            await this.expire(trackingKey, 604800); // 7 days

            console.log(`✅ Cleaned up data for trip ${tripId}`);
        } catch (error) {
            console.error(`❌ Failed to cleanup trip data: ${error.message}`);
        }
    }
}

// Export singleton instance
const tripRedis = new TripRedisManager();
module.exports = tripRedis;