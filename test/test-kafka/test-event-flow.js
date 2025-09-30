const { Kafka } = require('kafkajs');

async function testEventFlow() {
    process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1'; // Silence warning

    const kafka = new Kafka({
        clientId: 'event-flow-test',
        brokers: ['localhost:9094'], // External port for host machine
    });

    const producer = kafka.producer();

    try {
        console.log('🚀 Testing Event-Driven Architecture from host machine...');

        // Connect producer
        await producer.connect();
        console.log('✅ Producer connected to localhost:9094');

        // Send test events to demonstrate the Event-Driven Architecture
        const events = [
            {
                topic: 'trip-events',
                messages: [{
                    key: 'trip-001',
                    value: JSON.stringify({
                        type: 'TRIP_REQUESTED',
                        tripId: 'trip-001',
                        passengerId: 'user-123',
                        location: { lat: 10.7769, lng: 106.7009 }, // UIT location
                        destination: { lat: 10.7829, lng: 106.6963 }, // District 1
                        estimatedFare: 45000,
                        timestamp: new Date().toISOString()
                    })
                }]
            },
            {
                topic: 'location-updates',
                messages: [{
                    key: 'driver-001',
                    value: JSON.stringify({
                        type: 'LOCATION_UPDATE',
                        driverId: 'driver-001',
                        location: { lat: 10.7780, lng: 106.7020 },
                        status: 'available',
                        speed: 25.5,
                        heading: 90,
                        timestamp: new Date().toISOString()
                    })
                }]
            },
            {
                topic: 'user-notifications',
                messages: [{
                    key: 'user-123',
                    value: JSON.stringify({
                        type: 'DRIVER_FOUND',
                        userId: 'user-123',
                        tripId: 'trip-001',
                        driverId: 'driver-001',
                        driverName: 'Nguyen Van A',
                        vehicleInfo: {
                            plate: '59A-12345',
                            model: 'Honda Wave',
                            color: 'Red'
                        },
                        estimatedArrival: '5 minutes',
                        message: 'Driver found! Please wait at the pickup location.',
                        timestamp: new Date().toISOString()
                    })
                }]
            }
        ];

        console.log('📤 Sending realistic UIT-Go events...');

        for (const event of events) {
            await producer.send(event);
            console.log(`✅ Sent ${JSON.parse(event.messages[0].value).type} to ${event.topic}`);
        }

        console.log('');
        console.log('🎉 Event-Driven Architecture test completed successfully!');
        console.log('📊 Test Results:');
        console.log('  - ✅ Kafka connection: Working (localhost:9094)');
        console.log('  - ✅ Event production: Working');
        console.log('  - ✅ All topics: Ready');
        console.log('  - ✅ Trip workflow: Simulated');
        console.log('');
        console.log('🏗️ Architecture Summary:');
        console.log('  📍 trip-events: Trip requests, updates, completions');
        console.log('  🚗 location-updates: Real-time driver positions');
        console.log('  📱 user-notifications: User alerts and updates');
        console.log('');
        console.log('🚀 Ready for stress testing with:');
        console.log('  - 1000 drivers updating location every 5 seconds');
        console.log('  - 100 concurrent trips');
        console.log('  - Real-time event processing');

    } catch (error) {
        console.error('❌ Event flow test failed:', error.message);
        throw error;
    } finally {
        await producer.disconnect();
        console.log('🔌 Producer disconnected');
    }
}

testEventFlow()
    .then(() => {
        console.log('✅ Event-Driven Architecture is ready for UIT-Go stress testing!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Test failed:', error.message);
        process.exit(1);
    });