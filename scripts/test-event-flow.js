/**
 * Event-Driven Architecture Test Script
 * Tests end-to-end event flow for load testing scenarios
 */

const { KafkaClient, EventSchemas } = require('../common/shared');
require('dotenv').config({ path: './env/trip-service.env' });

class EventFlowTester {
  constructor() {
    this.kafkaClient = new KafkaClient({
      clientId: 'event-flow-tester',
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092']
    });
    this.producer = null;
    this.consumer = null;
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Event Flow Tester...');

      // Initialize producer
      this.producer = await this.kafkaClient.initProducer();
      console.log('✅ Producer initialized');

      // Initialize consumer for monitoring
      this.consumer = await this.kafkaClient.initConsumer('event-flow-test-group');
      console.log('✅ Consumer initialized');

      // Initialize topics
      const admin = await this.kafkaClient.initAdmin();
      await this.kafkaClient.createTopics(Object.values(EventSchemas.TOPICS));
      console.log('✅ Topics verified/created');

    } catch (error) {
      console.error('❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Test trip event flow (simulates 100 concurrent trips)
   */
  async testTripEventFlow(tripCount = 100) {
    console.log(`\n📋 Testing Trip Event Flow with ${tripCount} trips...`);

    const startTime = Date.now();
    const events = [];

    // Generate trip events
    for (let i = 1; i <= tripCount; i++) {
      const tripId = `test_trip_${i}_${Date.now()}`;
      const userId = `user_${Math.floor(Math.random() * 1000) + 1}`;

      const tripEvent = EventSchemas.createTripEvent(
        EventSchemas.EVENT_TYPES.TRIP.REQUESTED,
        {
          tripId,
          userId,
          pickup: {
            lat: 10.762622 + (Math.random() - 0.5) * 0.1, // Around Ho Chi Minh City
            lng: 106.660172 + (Math.random() - 0.5) * 0.1,
            address: `Pickup Location ${i}`
          },
          destination: {
            lat: 10.762622 + (Math.random() - 0.5) * 0.1,
            lng: 106.660172 + (Math.random() - 0.5) * 0.1,
            address: `Destination ${i}`
          },
          fare: Math.floor(Math.random() * 200000) + 50000, // 50k-250k VND
          status: 'REQUESTED'
        }
      );

      events.push({
        key: EventSchemas.getPartitionKey(EventSchemas.TOPICS.TRIP_EVENTS.name, tripEvent),
        data: tripEvent
      });
    }

    // Send batch
    await this.kafkaClient.sendBatch(EventSchemas.TOPICS.TRIP_EVENTS.name, events);

    const duration = Date.now() - startTime;
    console.log(`✅ Sent ${tripCount} trip events in ${duration}ms (${(tripCount / duration * 1000).toFixed(2)} events/sec)`);
  }

  /**
   * Test location event flow (simulates 1000 drivers updating every 5 seconds)
   */
  async testLocationEventFlow(driverCount = 1000, batchSize = 100) {
    console.log(`\n📍 Testing Location Event Flow with ${driverCount} drivers...`);

    const startTime = Date.now();
    const events = [];

    // Generate location events
    for (let i = 1; i <= driverCount; i++) {
      const driverId = `driver_${i}`;

      const locationEvent = EventSchemas.createLocationEvent(
        driverId,
        {
          lat: 10.762622 + (Math.random() - 0.5) * 0.2, // Around Ho Chi Minh City
          lng: 106.660172 + (Math.random() - 0.5) * 0.2,
          accuracy: Math.floor(Math.random() * 10) + 5, // 5-15m accuracy
          heading: Math.floor(Math.random() * 360), // 0-359 degrees
          speed: Math.floor(Math.random() * 60) // 0-60 km/h
        },
        Math.random() > 0.3 ? 'ONLINE' : 'BUSY', // 70% online, 30% busy
        Math.random() > 0.8 ? `trip_${Math.floor(Math.random() * 100)}` : null // 20% on trip
      );

      events.push({
        key: EventSchemas.getPartitionKey(EventSchemas.TOPICS.LOCATION_UPDATES.name, locationEvent),
        data: locationEvent
      });
    }

    // Send in batches
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      await this.kafkaClient.sendBatch(EventSchemas.TOPICS.LOCATION_UPDATES.name, batch);

      // Small delay between batches to simulate real traffic
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Sent ${driverCount} location events in ${duration}ms (${(driverCount / duration * 1000).toFixed(2)} events/sec)`);
  }

  /**
   * Test notification event flow
   */
  async testNotificationEventFlow(notificationCount = 200) {
    console.log(`\n🔔 Testing Notification Event Flow with ${notificationCount} notifications...`);

    const startTime = Date.now();
    const events = [];
    const notificationTypes = [
      EventSchemas.EVENT_TYPES.NOTIFICATION.DRIVER_ASSIGNED,
      EventSchemas.EVENT_TYPES.NOTIFICATION.DRIVER_ARRIVING,
      EventSchemas.EVENT_TYPES.NOTIFICATION.TRIP_STARTED,
      EventSchemas.EVENT_TYPES.NOTIFICATION.TRIP_COMPLETED
    ];

    // Generate notification events
    for (let i = 1; i <= notificationCount; i++) {
      const userId = `user_${Math.floor(Math.random() * 500) + 1}`;
      const notificationType = notificationTypes[Math.floor(Math.random() * notificationTypes.length)];

      const notificationEvent = EventSchemas.createNotificationEvent(
        notificationType,
        userId,
        {
          title: `Test Notification ${i}`,
          message: `This is a test notification for event flow testing`,
          tripId: `trip_${Math.floor(Math.random() * 100)}`,
          driverId: `driver_${Math.floor(Math.random() * 1000)}`,
          priority: Math.random() > 0.5 ? 'HIGH' : 'MEDIUM',
          metadata: {
            testData: true,
            timestamp: new Date().toISOString()
          }
        }
      );

      events.push({
        key: EventSchemas.getPartitionKey(EventSchemas.TOPICS.USER_NOTIFICATIONS.name, notificationEvent),
        data: notificationEvent
      });
    }

    // Send batch
    await this.kafkaClient.sendBatch(EventSchemas.TOPICS.USER_NOTIFICATIONS.name, events);

    const duration = Date.now() - startTime;
    console.log(`✅ Sent ${notificationCount} notification events in ${duration}ms (${(notificationCount / duration * 1000).toFixed(2)} events/sec)`);
  }

  /**
   * Monitor event consumption
   */
  async monitorEvents(duration = 30000) {
    console.log(`\n👀 Monitoring events for ${duration / 1000} seconds...`);

    let eventCount = 0;
    const eventTypes = {};

    // Subscribe to all topics for monitoring
    await this.kafkaClient.subscribe(
      Object.values(EventSchemas.TOPICS).map(t => t.name),
      (messageInfo) => {
        eventCount++;
        const eventType = messageInfo.data.eventType;
        eventTypes[eventType] = (eventTypes[eventType] || 0) + 1;
      }
    );

    // Monitor for specified duration
    await new Promise(resolve => setTimeout(resolve, duration));

    console.log(`📊 Monitoring Results:`);
    console.log(`   Total events processed: ${eventCount}`);
    console.log(`   Events per second: ${(eventCount / (duration / 1000)).toFixed(2)}`);
    console.log(`   Event types:`);
    Object.entries(eventTypes).forEach(([type, count]) => {
      console.log(`     ${type}: ${count}`);
    });
  }

  /**
   * Full load test simulation
   */
  async runLoadTest() {
    try {
      console.log('🏁 Starting Load Test Simulation...');
      console.log('Target: 1000 drivers, 100 concurrent trips, 200 notifications');

      const startTime = Date.now();

      // Run tests in parallel
      await Promise.all([
        this.testTripEventFlow(100),
        this.testLocationEventFlow(1000),
        this.testNotificationEventFlow(200)
      ]);

      const totalDuration = Date.now() - startTime;
      console.log(`\n🎉 Load Test Completed in ${totalDuration}ms`);
      console.log(`📈 Total events sent: 1300 events`);
      console.log(`⚡ Overall throughput: ${(1300 / totalDuration * 1000).toFixed(2)} events/sec`);

      // Monitor for a bit to see consumption
      await this.monitorEvents(10000);

    } catch (error) {
      console.error('❌ Load test failed:', error);
    }
  }

  async cleanup() {
    try {
      await this.kafkaClient.disconnect();
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

// Run the test
async function main() {
  const tester = new EventFlowTester();

  try {
    await tester.initialize();
    await tester.runLoadTest();
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await tester.cleanup();
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = EventFlowTester;