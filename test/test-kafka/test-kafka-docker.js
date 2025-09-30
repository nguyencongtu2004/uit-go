const { Kafka } = require('kafkajs');

async function testKafkaFromDockerNetwork() {
    process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';

    const kafka = new Kafka({
        clientId: 'docker-network-test',
        brokers: ['kafka:9092'], // Internal Docker network hostname
        connectionTimeout: 3000,
        requestTimeout: 5000,
    });

    const producer = kafka.producer();
    const admin = kafka.admin();

    try {
        console.log('🚀 Testing Kafka from Docker network...');

        // Test admin connection
        await admin.connect();
        console.log('✅ Admin connected to kafka:9092');

        const existingTopics = await admin.listTopics();
        console.log('📋 Topics:', existingTopics);

        // Create missing topics
        const requiredTopics = ['trip-events', 'location-updates', 'user-notifications'];
        const topicsToCreate = requiredTopics.filter(t => !existingTopics.includes(t));

        if (topicsToCreate.length > 0) {
            console.log(`📝 Creating topics: ${topicsToCreate.join(', ')}`);
            await admin.createTopics({
                topics: topicsToCreate.map(topic => ({
                    topic,
                    numPartitions: topic === 'location-updates' ? 20 : topic === 'trip-events' ? 10 : 5,
                    replicationFactor: 1
                }))
            });
            console.log('✅ Topics created');
        }

        // Test producer
        await producer.connect();
        console.log('✅ Producer connected');

        // Send test events
        const testEvents = [
            {
                topic: 'trip-events',
                messages: [{
                    key: 'test-trip-001',
                    value: JSON.stringify({
                        type: 'TRIP_REQUESTED',
                        tripId: 'test-trip-001',
                        passengerId: 'user-123',
                        timestamp: new Date().toISOString()
                    })
                }]
            },
            {
                topic: 'location-updates',
                messages: [{
                    key: 'test-driver-001',
                    value: JSON.stringify({
                        type: 'LOCATION_UPDATE',
                        driverId: 'test-driver-001',
                        location: { lat: 10.7769, lng: 106.7009 },
                        timestamp: new Date().toISOString()
                    })
                }]
            },
            {
                topic: 'user-notifications',
                messages: [{
                    key: 'test-user-123',
                    value: JSON.stringify({
                        type: 'DRIVER_FOUND',
                        userId: 'test-user-123',
                        message: 'Test notification from Docker network',
                        timestamp: new Date().toISOString()
                    })
                }]
            }
        ];

        console.log('📤 Sending test events...');
        for (const event of testEvents) {
            await producer.send(event);
            console.log(`  ✅ Sent to ${event.topic}`);
        }

        console.log('🎉 All tests passed! Event-Driven Architecture working correctly');
        console.log('📊 Summary:');
        console.log('  - ✅ Kafka cluster: Connected (kafka:9092)');
        console.log('  - ✅ Topics: Ready (trip-events, location-updates, user-notifications)');
        console.log('  - ✅ Producer: Working');
        console.log('  - ✅ Event publishing: Success');
        console.log('');
        console.log('🚀 Ready for load testing!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        throw error;
    } finally {
        await producer.disconnect();
        await admin.disconnect();
    }
}

if (require.main === module) {
    testKafkaFromDockerNetwork()
        .then(() => {
            console.log('✅ Docker network test completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Docker network test failed:', error.message);
            process.exit(1);
        });
}

module.exports = { testKafkaFromDockerNetwork };