/**
 * Redis Pub/Sub Configuration for UIT-Go Microservices
 * Defines channels and message patterns for inter-service communication
 */

// Channel Definitions
const CHANNELS = {
    // User Service Channels
    USER_REGISTERED: 'user:registered',
    USER_UPDATED: 'user:updated',
    USER_DELETED: 'user:deleted',
    USER_VERIFIED: 'user:verified',
    USER_LOGIN: 'user:login',
    USER_LOGOUT: 'user:logout',

    // Driver Service Channels
    DRIVER_REGISTERED: 'driver:registered',
    DRIVER_STATUS_CHANGED: 'driver:status:changed',
    DRIVER_LOCATION_UPDATED: 'driver:location:updated',
    DRIVER_AVAILABLE: 'driver:available',
    DRIVER_UNAVAILABLE: 'driver:unavailable',
    DRIVER_TRIP_ACCEPTED: 'driver:trip:accepted',
    DRIVER_TRIP_REJECTED: 'driver:trip:rejected',

    // Trip Service Channels
    TRIP_REQUESTED: 'trip:requested',
    TRIP_ASSIGNED: 'trip:assigned',
    TRIP_ACCEPTED: 'trip:accepted',
    TRIP_REJECTED: 'trip:rejected',
    TRIP_STARTED: 'trip:started',
    TRIP_COMPLETED: 'trip:completed',
    TRIP_CANCELLED: 'trip:cancelled',
    TRIP_STATUS_UPDATE: 'trip:status:update',
    TRIP_LOCATION_UPDATE: 'trip:location:update',

    // Payment Channels
    PAYMENT_INITIATED: 'payment:initiated',
    PAYMENT_COMPLETED: 'payment:completed',
    PAYMENT_FAILED: 'payment:failed',
    PAYMENT_REFUNDED: 'payment:refunded',

    // Notification Channels
    SEND_SMS: 'notification:sms',
    SEND_EMAIL: 'notification:email',
    SEND_PUSH: 'notification:push',

    // Analytics Channels
    EVENT_TRACKED: 'analytics:event',
    METRICS_UPDATE: 'analytics:metrics',

    // System Channels
    SERVICE_HEALTH: 'system:health',
    SERVICE_ERROR: 'system:error',
    SERVICE_ALERT: 'system:alert'
};

// Channel Patterns for Pattern-based Subscriptions
const CHANNEL_PATTERNS = {
    USER_EVENTS: 'user:*',
    DRIVER_EVENTS: 'driver:*',
    TRIP_EVENTS: 'trip:*',
    PAYMENT_EVENTS: 'payment:*',
    NOTIFICATION_EVENTS: 'notification:*',
    ANALYTICS_EVENTS: 'analytics:*',
    SYSTEM_EVENTS: 'system:*',

    // Service-specific patterns
    USER_SERVICE_EVENTS: 'user:*',
    DRIVER_SERVICE_EVENTS: 'driver:*',
    TRIP_SERVICE_EVENTS: 'trip:*'
};

// Message Schemas for type safety and validation
const MESSAGE_SCHEMAS = {
    USER_REGISTERED: {
        userId: 'string',
        email: 'string',
        role: 'string',
        timestamp: 'number',
        metadata: 'object?'
    },

    DRIVER_STATUS_CHANGED: {
        driverId: 'string',
        oldStatus: 'string',
        newStatus: 'string',
        location: 'object?',
        timestamp: 'number'
    },

    TRIP_REQUESTED: {
        tripId: 'string',
        userId: 'string',
        pickup: 'object',
        dropoff: 'object',
        preferences: 'object?',
        timestamp: 'number'
    },

    TRIP_STATUS_UPDATE: {
        tripId: 'string',
        status: 'string',
        driverId: 'string?',
        userId: 'string',
        location: 'object?',
        eta: 'number?',
        timestamp: 'number'
    },

    PAYMENT_COMPLETED: {
        paymentId: 'string',
        tripId: 'string',
        userId: 'string',
        driverId: 'string',
        amount: 'number',
        currency: 'string',
        timestamp: 'number'
    }
};

// Service Subscription Mappings
const SERVICE_SUBSCRIPTIONS = {
    'user-service': [
        CHANNELS.TRIP_COMPLETED,
        CHANNELS.PAYMENT_COMPLETED,
        CHANNEL_PATTERNS.SYSTEM_EVENTS
    ],

    'driver-service': [
        CHANNELS.TRIP_REQUESTED,
        CHANNELS.TRIP_CANCELLED,
        CHANNELS.USER_REGISTERED,
        CHANNEL_PATTERNS.SYSTEM_EVENTS
    ],

    'trip-service': [
        CHANNELS.DRIVER_STATUS_CHANGED,
        CHANNELS.DRIVER_LOCATION_UPDATED,
        CHANNELS.USER_REGISTERED,
        CHANNELS.PAYMENT_COMPLETED,
        CHANNEL_PATTERNS.SYSTEM_EVENTS
    ]
};

// Event Priority Levels
const EVENT_PRIORITY = {
    CRITICAL: 1,    // System failures, security issues
    HIGH: 2,        // Trip status changes, payment events
    MEDIUM: 3,      // User updates, driver status changes
    LOW: 4          // Analytics events, general notifications
};

/**
 * Message factory functions
 */
const createMessage = (type, data, priority = EVENT_PRIORITY.MEDIUM) => ({
    id: generateMessageId(),
    type,
    data,
    priority,
    timestamp: Date.now(),
    service: process.env.SERVICE_NAME || 'unknown',
    version: '1.0'
});

const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Message validation helper
 */
const validateMessage = (message, schema) => {
    if (!schema) return true;

    for (const [field, type] in Object.entries(schema)) {
        const isOptional = type.endsWith('?');
        const fieldType = isOptional ? type.slice(0, -1) : type;

        if (!isOptional && !(field in message.data)) {
            throw new Error(`Missing required field: ${field}`);
        }

        if (field in message.data) {
            const value = message.data[field];
            if (fieldType === 'string' && typeof value !== 'string') {
                throw new Error(`Field ${field} must be a string`);
            }
            if (fieldType === 'number' && typeof value !== 'number') {
                throw new Error(`Field ${field} must be a number`);
            }
            if (fieldType === 'object' && typeof value !== 'object') {
                throw new Error(`Field ${field} must be an object`);
            }
        }
    }

    return true;
};

/**
 * Publisher helper class
 */
class MessagePublisher {
    constructor(redisClient) {
        this.redis = redisClient;
    }

    async publish(channel, type, data, priority = EVENT_PRIORITY.MEDIUM) {
        try {
            const message = createMessage(type, data, priority);

            // Validate message if schema exists
            if (MESSAGE_SCHEMAS[type]) {
                validateMessage(message, MESSAGE_SCHEMAS[type]);
            }

            await this.redis.publish(channel, JSON.stringify(message));
            console.log(`📤 Published message to ${channel}:`, message.id);

            return message.id;
        } catch (error) {
            console.error(`❌ Failed to publish message to ${channel}:`, error.message);
            throw error;
        }
    }
}

/**
 * Subscriber helper class
 */
class MessageSubscriber {
    constructor(redisClient) {
        this.redis = redisClient;
        this.handlers = new Map();
    }

    async subscribe(channel, handler) {
        try {
            this.handlers.set(channel, handler);
            await this.redis.subscribe(channel, (message) => {
                try {
                    const parsedMessage = JSON.parse(message);
                    console.log(`📥 Received message on ${channel}:`, parsedMessage.id);
                    handler(parsedMessage);
                } catch (error) {
                    console.error(`❌ Error processing message on ${channel}:`, error.message);
                }
            });

            console.log(`🔔 Subscribed to channel: ${channel}`);
        } catch (error) {
            console.error(`❌ Failed to subscribe to ${channel}:`, error.message);
            throw error;
        }
    }

    async psubscribe(pattern, handler) {
        try {
            this.handlers.set(pattern, handler);
            await this.redis.psubscribe(pattern, (message, channel) => {
                try {
                    const parsedMessage = JSON.parse(message);
                    console.log(`📥 Received message on ${channel} (pattern: ${pattern}):`, parsedMessage.id);
                    handler(parsedMessage, channel);
                } catch (error) {
                    console.error(`❌ Error processing message on ${channel}:`, error.message);
                }
            });

            console.log(`🔔 Subscribed to pattern: ${pattern}`);
        } catch (error) {
            console.error(`❌ Failed to subscribe to pattern ${pattern}:`, error.message);
            throw error;
        }
    }

    async unsubscribe(channel) {
        try {
            this.handlers.delete(channel);
            await this.redis.unsubscribe(channel);
            console.log(`🔕 Unsubscribed from channel: ${channel}`);
        } catch (error) {
            console.error(`❌ Failed to unsubscribe from ${channel}:`, error.message);
        }
    }
}

module.exports = {
    CHANNELS,
    CHANNEL_PATTERNS,
    MESSAGE_SCHEMAS,
    SERVICE_SUBSCRIPTIONS,
    EVENT_PRIORITY,
    MessagePublisher,
    MessageSubscriber,
    createMessage,
    validateMessage
};