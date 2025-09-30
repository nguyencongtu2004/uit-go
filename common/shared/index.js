/**
 * Main entry point for UIT-Go shared utilities
 * Exports all common utilities for use across microservices
 */

const Logger = require('./logger');
const APIResponse = require('./apiResponse');
const Validator = require('./validator');
const RedisManager = require('./redisManager');
const KafkaClient = require('./kafkaClient');
const EventSchemas = require('./eventSchemas');
const {
    CHANNELS,
    CHANNEL_PATTERNS,
    MESSAGE_SCHEMAS,
    SERVICE_SUBSCRIPTIONS,
    EVENT_PRIORITY,
    MessagePublisher,
    MessageSubscriber,
    createMessage,
    validateMessage
} = require('./pubsub');

module.exports = {
    // Core Utilities
    Logger,
    APIResponse,
    Validator,

    // Redis and Caching
    RedisManager,

    // Kafka Event Streaming
    KafkaClient,
    EventSchemas,

    // Pub/Sub Messaging
    CHANNELS,
    CHANNEL_PATTERNS,
    MESSAGE_SCHEMAS,
    SERVICE_SUBSCRIPTIONS,
    EVENT_PRIORITY,
    MessagePublisher,
    MessageSubscriber,
    createMessage,
    validateMessage,

    // Utility Functions
    generateId: () => {
        return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    sleep: (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    isProduction: () => {
        return process.env.NODE_ENV === 'production';
    },

    isDevelopment: () => {
        return process.env.NODE_ENV === 'development';
    },

    getServiceName: () => {
        return process.env.SERVICE_NAME || 'unknown-service';
    },

    getCurrentTimestamp: () => {
        return new Date().toISOString();
    }
};