const Redis = require('ioredis');

// Simple Redis client for high-performance load testing
class DriverRedisClient {
    constructor() {
        this.client = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            db: 1, // Use DB 1 for driver service
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            // Optimized for high throughput
            enableOfflineQueue: false,
            maxLoadingTimeout: 2000,
            commandTimeout: 3000
        });

        this.client.on('connect', () => {
            console.log('✅ Driver Redis connected successfully');
        });

        this.client.on('error', (err) => {
            console.error('❌ Driver Redis connection error:', err);
        });

        // Ensure connection on startup
        this.connect();
    }

    async connect() {
        try {
            await this.client.connect();
        } catch (error) {
            console.error('Failed to connect to Redis:', error);
        }
    }

    async disconnect() {
        try {
            await this.client.disconnect();
        } catch (error) {
            console.error('Failed to disconnect from Redis:', error);
        }
    }

    // Geospatial operations for location tracking
    async geoadd(key, longitude, latitude, member) {
        return this.client.geoadd(key, longitude, latitude, member);
    }

    async georadius(key, longitude, latitude, radius, unit, ...options) {
        return this.client.georadius(key, longitude, latitude, radius, unit, ...options);
    }

    async geopos(key, member) {
        return this.client.geopos(key, member);
    }

    async zrem(key, member) {
        return this.client.zrem(key, member);
    }

    // Basic Redis operations
    async get(key) {
        return this.client.get(key);
    }

    async setex(key, seconds, value) {
        return this.client.setex(key, seconds, value);
    }

    async del(key) {
        return this.client.del(key);
    }

    async sadd(key, member) {
        return this.client.sadd(key, member);
    }

    async srem(key, member) {
        return this.client.srem(key, member);
    }

    async scard(key) {
        return this.client.scard(key);
    }

    async smembers(key) {
        return this.client.smembers(key);
    }

    // Pipeline for batch operations
    pipeline() {
        return this.client.pipeline();
    }
}

// Export singleton instance
const redisClient = new DriverRedisClient();
module.exports = redisClient;