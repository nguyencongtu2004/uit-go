/**
 * Redis connection and utility manager for caching and pub/sub operations
 */

const Redis = require('ioredis');

class RedisManager {
    constructor(serviceName) {
        this.serviceName = serviceName;
        this.client = null;
        this.subscriber = null;
        this.publisher = null;
        this.isConnected = false;
    }

    /**
     * Connect to Redis with optimized settings
     * @param {object} options - Redis connection options
     */
    async connect(options = {}) {
        const defaultOptions = {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || 'redis123',
            db: process.env.REDIS_DB || 0,

            // Connection pool settings
            connectTimeout: 5000,
            commandTimeout: 5000,
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3,

            // Reconnection settings
            retryDelayOnClusterDown: 300,
            retryBackoff: function (times) {
                return Math.min(times * 50, 2000);
            },

            // Performance settings
            lazyConnect: true,
            keepAlive: 30000,

            ...options
        };

        try {
            // Main client for general operations
            this.client = new Redis(defaultOptions);

            // Separate clients for pub/sub to avoid blocking
            this.subscriber = new Redis({ ...defaultOptions, lazyConnect: false });
            this.publisher = new Redis({ ...defaultOptions, lazyConnect: false });

            // Setup event handlers
            this.setupEventHandlers();

            // Connect to Redis
            await this.client.connect();

            this.isConnected = true;
            console.log(`✅ ${this.serviceName} - Redis connected successfully`);
            console.log(`   Host: ${defaultOptions.host}:${defaultOptions.port}`);
            console.log(`   Database: ${defaultOptions.db}`);

            return this.client;

        } catch (error) {
            console.error(`❌ ${this.serviceName} - Failed to connect to Redis:`, error.message);
            throw error;
        }
    }

    /**
     * Setup Redis event handlers
     */
    setupEventHandlers() {
        // Main client events
        this.client.on('connect', () => {
            this.isConnected = true;
            console.log(`✅ ${this.serviceName} - Redis client connected`);
        });

        this.client.on('error', (error) => {
            this.isConnected = false;
            console.error(`❌ ${this.serviceName} - Redis client error:`, error.message);
        });

        this.client.on('close', () => {
            this.isConnected = false;
            console.log(`⚠️ ${this.serviceName} - Redis client disconnected`);
        });

        this.client.on('reconnecting', () => {
            console.log(`🔄 ${this.serviceName} - Redis client reconnecting...`);
        });

        // Subscriber events
        this.subscriber.on('error', (error) => {
            console.error(`❌ ${this.serviceName} - Redis subscriber error:`, error.message);
        });

        // Publisher events
        this.publisher.on('error', (error) => {
            console.error(`❌ ${this.serviceName} - Redis publisher error:`, error.message);
        });
    }

    /**
     * Disconnect from Redis
     */
    async disconnect() {
        const clients = [this.client, this.subscriber, this.publisher];

        for (const client of clients) {
            if (client) {
                try {
                    await client.quit();
                } catch (error) {
                    console.error(`❌ ${this.serviceName} - Error disconnecting Redis client:`, error.message);
                }
            }
        }

        this.isConnected = false;
        console.log(`✅ ${this.serviceName} - Redis disconnected gracefully`);
    }

    /**
     * Get Redis health status
     */
    async getHealthStatus() {
        if (!this.client || !this.isConnected) {
            return {
                status: 'disconnected',
                connected: false
            };
        }

        try {
            const info = await this.client.ping();
            return {
                status: 'connected',
                connected: true,
                ping: info === 'PONG'
            };
        } catch (error) {
            return {
                status: 'error',
                connected: false,
                error: error.message
            };
        }
    }

    /**
     * Cache operations with TTL
     */
    async set(key, value, ttl = 3600) {
        try {
            const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
            if (ttl > 0) {
                return await this.client.setex(key, ttl, serializedValue);
            }
            return await this.client.set(key, serializedValue);
        } catch (error) {
            console.error(`❌ ${this.serviceName} - Redis SET error:`, error.message);
            throw error;
        }
    }

    async get(key) {
        try {
            const value = await this.client.get(key);
            if (!value) return null;

            try {
                return JSON.parse(value);
            } catch {
                return value; // Return as string if not JSON
            }
        } catch (error) {
            console.error(`❌ ${this.serviceName} - Redis GET error:`, error.message);
            throw error;
        }
    }

    async del(key) {
        try {
            return await this.client.del(key);
        } catch (error) {
            console.error(`❌ ${this.serviceName} - Redis DEL error:`, error.message);
            throw error;
        }
    }

    /**
     * Geospatial operations for driver location tracking
     */
    async geoAdd(key, longitude, latitude, member) {
        try {
            return await this.client.geoadd(key, longitude, latitude, member);
        } catch (error) {
            console.error(`❌ ${this.serviceName} - Redis GEOADD error:`, error.message);
            throw error;
        }
    }

    async geoRadius(key, longitude, latitude, radius, unit = 'm', options = {}) {
        try {
            const defaultOptions = {
                WITHCOORD: true,
                WITHDIST: true,
                COUNT: 10,
                ASC: true,
                ...options
            };

            const args = [key, longitude, latitude, radius, unit];

            if (defaultOptions.WITHCOORD) args.push('WITHCOORD');
            if (defaultOptions.WITHDIST) args.push('WITHDIST');
            if (defaultOptions.COUNT) args.push('COUNT', defaultOptions.COUNT);
            if (defaultOptions.ASC) args.push('ASC');
            else if (defaultOptions.DESC) args.push('DESC');

            return await this.client.georadius(...args);
        } catch (error) {
            console.error(`❌ ${this.serviceName} - Redis GEORADIUS error:`, error.message);
            throw error;
        }
    }

    async geoDist(key, member1, member2, unit = 'm') {
        try {
            return await this.client.geodist(key, member1, member2, unit);
        } catch (error) {
            console.error(`❌ ${this.serviceName} - Redis GEODIST error:`, error.message);
            throw error;
        }
    }

    /**
     * Pub/Sub operations
     */
    async publish(channel, message) {
        try {
            const serializedMessage = typeof message === 'string' ? message : JSON.stringify(message);
            return await this.publisher.publish(channel, serializedMessage);
        } catch (error) {
            console.error(`❌ ${this.serviceName} - Redis PUBLISH error:`, error.message);
            throw error;
        }
    }

    async subscribe(channel, callback) {
        try {
            await this.subscriber.subscribe(channel);

            this.subscriber.on('message', (receivedChannel, message) => {
                if (receivedChannel === channel) {
                    try {
                        const parsedMessage = JSON.parse(message);
                        callback(parsedMessage);
                    } catch {
                        callback(message); // Return as string if not JSON
                    }
                }
            });
        } catch (error) {
            console.error(`❌ ${this.serviceName} - Redis SUBSCRIBE error:`, error.message);
            throw error;
        }
    }

    async unsubscribe(channel) {
        try {
            return await this.subscriber.unsubscribe(channel);
        } catch (error) {
            console.error(`❌ ${this.serviceName} - Redis UNSUBSCRIBE error:`, error.message);
            throw error;
        }
    }

    /**
     * Get Redis client instances
     */
    getClient() {
        return this.client;
    }

    getSubscriber() {
        return this.subscriber;
    }

    getPublisher() {
        return this.publisher;
    }

    /**
     * Wrapper for graceful shutdown
     */
    async gracefulShutdown(signal) {
        console.log(`📝 ${this.serviceName} - Received ${signal}. Disconnecting Redis...`);
        await this.disconnect();
    }
}

module.exports = RedisManager;