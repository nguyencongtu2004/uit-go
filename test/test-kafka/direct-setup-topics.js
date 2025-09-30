const { Kafka } = require('kafkajs');

async function setupKafkaTopics() {
  // Force localhost để tránh metadata redirect đến kafka:9092
  const kafka = new Kafka({
    clientId: 'direct-setup',
    brokers: ['localhost:9094'], // External port for host machine
    connectionTimeout: 3000,
    requestTimeout: 5000,
  });

  const topics = [
    {
      topic: 'trip-events',
      numPartitions: 10,
      replicationFactor: 1,
    },
    {
      topic: 'location-updates',
      numPartitions: 20,
      replicationFactor: 1,
    },
    {
      topic: 'user-notifications',
      numPartitions: 5,
      replicationFactor: 1,
    }
  ];

  let admin;

  try {
    console.log('🚀 Setting up Kafka topics...');

    // Test với producer trước
    const producer = kafka.producer();
    await producer.connect();
    console.log('✅ Producer connection verified');
    await producer.disconnect();

    // Giờ setup topics 
    admin = kafka.admin();
    await admin.connect();
    console.log('🔗 Admin connected');

    // Check existing topics
    const existingTopics = await admin.listTopics();
    console.log(`📋 Existing topics: ${existingTopics.join(', ')}`);

    // Create new topics
    const topicsToCreate = topics.filter(
      t => !existingTopics.includes(t.topic)
    );

    if (topicsToCreate.length === 0) {
      console.log('✅ All topics already exist');
      return;
    }

    console.log(`📝 Creating topics: ${topicsToCreate.map(t => t.topic).join(', ')}`);

    await admin.createTopics({
      topics: topicsToCreate
    });

    console.log('✅ Topics created successfully');

    // Verify
    const finalTopics = await admin.listTopics();
    const ourTopics = finalTopics.filter(t =>
      topics.some(topic => topic.topic === t)
    );

    console.log(`🎉 Ready with topics: ${ourTopics.join(', ')}`);

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    throw error;
  } finally {
    if (admin) {
      await admin.disconnect();
    }
  }
}

setupKafkaTopics()
  .then(() => {
    console.log('🏁 Kafka setup completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Kafka setup failed:', error.message);
    process.exit(1);
  });