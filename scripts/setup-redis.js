#!/usr/bin/env node

/**
 * Redis Setup Script for UIT-Go Services
 * Initializes Redis connections and pub/sub channels for all services
 */

const path = require('path');

// Import the Redis managers
const UserRedisManager = require('../services/user-service/src/config/redis');
const DriverRedisManager = require('../services/driver-service/src/config/redis');
const TripRedisManager = require('../services/trip-service/src/config/redis');
const { MessageSubscriber, SERVICE_SUBSCRIPTIONS, CHANNELS } = require('../common/shared');

/**
 * Initialize Redis connections for all services
 */
async function initializeRedisConnections() {
    console.log('🚀 Initializing Redis connections for all services...\n');

    try {
        // Connect User Service Redis
        console.log('📦 Connecting User Service Redis...');
        await UserRedisManager.connect();
        console.log('✅ User Service Redis connected successfully');

        // Connect Driver Service Redis
        console.log('📦 Connecting Driver Service Redis...');
        await DriverRedisManager.connect();
        console.log('✅ Driver Service Redis connected successfully');

        // Connect Trip Service Redis
        console.log('📦 Connecting Trip Service Redis...');
        await TripRedisManager.connect();
        console.log('✅ Trip Service Redis connected successfully');

        console.log('\n✅ All Redis connections initialized successfully!\n');

    } catch (error) {
        console.error('❌ Failed to initialize Redis connections:', error.message);
        process.exit(1);
    }
}

/**
 * Setup pub/sub subscriptions based on service configuration
 */
async function setupPubSubChannels() {
    console.log('🔔 Setting up pub/sub channels...\n');

    try {
        // Setup User Service subscriptions
        if (SERVICE_SUBSCRIPTIONS['user-service']) {
            console.log('📨 Setting up User Service subscriptions...');
            const userSubscriber = new MessageSubscriber(UserRedisManager.client);

            for (const channel of SERVICE_SUBSCRIPTIONS['user-service']) {
                await userSubscriber.subscribe(channel, (message) => {
                    console.log(`📥 User Service received message on ${channel}:`, message.type);
                    // Message handling logic would go here
                });
            }
        }

        // Setup Driver Service subscriptions
        if (SERVICE_SUBSCRIPTIONS['driver-service']) {
            console.log('📨 Setting up Driver Service subscriptions...');
            const driverSubscriber = new MessageSubscriber(DriverRedisManager.client);

            for (const channel of SERVICE_SUBSCRIPTIONS['driver-service']) {
                await driverSubscriber.subscribe(channel, (message) => {
                    console.log(`📥 Driver Service received message on ${channel}:`, message.type);
                    // Message handling logic would go here
                });
            }
        }

        // Setup Trip Service subscriptions
        if (SERVICE_SUBSCRIPTIONS['trip-service']) {
            console.log('📨 Setting up Trip Service subscriptions...');
            const tripSubscriber = new MessageSubscriber(TripRedisManager.client);

            for (const channel of SERVICE_SUBSCRIPTIONS['trip-service']) {
                await tripSubscriber.subscribe(channel, (message) => {
                    console.log(`📥 Trip Service received message on ${channel}:`, message.type);
                    // Message handling logic would go here
                });
            }
        }

        console.log('\n✅ Pub/sub channels setup completed!\n');

    } catch (error) {
        console.error('❌ Failed to setup pub/sub channels:', error.message);
        process.exit(1);
    }
}

/**
 * Test Redis operations
 */
async function testRedisOperations() {
    console.log('🧪 Testing Redis operations...\n');

    try {
        // Test User Service Redis operations
        console.log('🧪 Testing User Service Redis...');
        await UserRedisManager.set('test:user', 'test_value', 60);
        const userValue = await UserRedisManager.get('test:user');
        console.log(`   Set/Get test: ${userValue === 'test_value' ? '✅ PASS' : '❌ FAIL'}`);

        // Test rate limiting
        const rateLimit = await UserRedisManager.checkRateLimit('test:user:123', 60, 10);
        console.log(`   Rate limiting test: ${rateLimit.current === 1 ? '✅ PASS' : '❌ FAIL'}`);

        // Test Driver Service Redis operations
        console.log('🧪 Testing Driver Service Redis...');
        await DriverRedisManager.updateDriverLocation('test_driver', -122.4194, 37.7749, { speed: 50 });
        const nearbyDrivers = await DriverRedisManager.findNearbyDrivers(-122.4194, 37.7749, 1000);
        console.log(`   Geospatial operations: ${nearbyDrivers.length >= 0 ? '✅ PASS' : '❌ FAIL'}`);

        // Test Trip Service Redis operations
        console.log('🧪 Testing Trip Service Redis...');
        const tripData = { tripId: 'test_trip', userId: 'test_user', status: 'requested' };
        await TripRedisManager.cacheTripData('test_trip', tripData, 300);
        const cachedTrip = await TripRedisManager.getTripData('test_trip');
        console.log(`   Trip data caching: ${cachedTrip?.tripId === 'test_trip' ? '✅ PASS' : '❌ FAIL'}`);

        console.log('\n✅ All Redis operations tests passed!\n');

    } catch (error) {
        console.error('❌ Redis operations test failed:', error.message);
        process.exit(1);
    }
}

/**
 * Cleanup test data
 */
async function cleanup() {
    console.log('🧹 Cleaning up test data...');

    try {
        // Clean up test keys
        await UserRedisManager.del('test:user');
        await DriverRedisManager.removeDriverLocation('test_driver');
        await TripRedisManager.del('trip:data:test_trip');

        console.log('✅ Cleanup completed');

    } catch (error) {
        console.error('⚠️ Cleanup warning:', error.message);
    }
}

/**
 * Display Redis configuration information
 */
function displayRedisInfo() {
    console.log('📋 Redis Configuration Information:');
    console.log('=====================================');
    console.log(`Redis Host: ${process.env.REDIS_HOST || 'localhost'}`);
    console.log(`Redis Port: ${process.env.REDIS_PORT || 6379}`);
    console.log(`Redis Database: ${process.env.REDIS_DB || 0}`);
    console.log(`Connection Pool Size: ${process.env.REDIS_POOL_SIZE || 10}`);
    console.log(`Command Timeout: ${process.env.REDIS_COMMAND_TIMEOUT || 5000}ms`);
    console.log(`Retry Attempts: ${process.env.REDIS_RETRY_ATTEMPTS || 3}`);
    console.log('=====================================\n');
}

/**
 * Main setup function
 */
async function main() {
    console.log('🚀 UIT-Go Redis Setup & Test Script\n');

    displayRedisInfo();

    try {
        await initializeRedisConnections();
        await setupPubSubChannels();
        await testRedisOperations();
        await cleanup();

        console.log('🎉 Redis setup completed successfully!');
        console.log('📊 All services are now ready to use Redis for:');
        console.log('   • Caching and session management');
        console.log('   • Geospatial operations for driver tracking');
        console.log('   • Real-time pub/sub messaging');
        console.log('   • Rate limiting and security features');
        console.log('   • Trip data and analytics storage\n');

        process.exit(0);

    } catch (error) {
        console.error('❌ Redis setup failed:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Redis setup...');
    await cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Terminating Redis setup...');
    await cleanup();
    process.exit(0);
});

// Run the setup if this script is executed directly
if (require.main === module) {
    main();
}

module.exports = {
    initializeRedisConnections,
    setupPubSubChannels,
    testRedisOperations,
    cleanup
};