/**
 * Kafka Topic Initialization Script for UIT-Go
 * Creates topics optimized for load testing requirements
 */

const { KafkaClient, EventSchemas, Logger } = require('../common/shared');

async function initializeKafkaTopics() {
  const logger = new Logger('TopicInitializer');
  const kafkaClient = new KafkaClient({
    clientId: 'topic-initializer',
    brokers: ['localhost:9094'] // External port for host machine execution
  });

  try {
    // Initialize admin client
    await kafkaClient.initAdmin();

    logger.info('Starting Kafka topic initialization...');

    // Create all topics from EventSchemas
    const topicConfigs = Object.values(EventSchemas.TOPICS);

    logger.info('Creating topics:', topicConfigs.map(t => `${t.name} (${t.partitions} partitions)`));

    await kafkaClient.createTopics(topicConfigs);

    // Verify topics were created
    const admin = kafkaClient.admin;
    const topics = await admin.listTopics();

    logger.info('Available topics:', topics);

    // Get topic details
    for (const topicConfig of topicConfigs) {
      try {
        const metadata = await admin.fetchTopicMetadata({
          topics: [topicConfig.name]
        });

        const topic = metadata.topics[0];
        logger.info(`Topic ${topicConfig.name}:`, {
          partitions: topic.partitions.length,
          replicationFactor: topic.partitions[0].replicas.length
        });
      } catch (error) {
        logger.warn(`Could not fetch metadata for topic ${topicConfig.name}:`, error.message);
      }
    }

    logger.info('✅ Kafka topics initialized successfully!');

  } catch (error) {
    logger.error('❌ Failed to initialize Kafka topics:', error);
    throw error;
  } finally {
    await kafkaClient.disconnect();
  }
}

// Run if this file is executed directly
if (require.main === module) {
  // Load environment variables
  require('dotenv').config({ path: './env/trip-service.env' });

  // Override KAFKA_BROKERS for host machine execution
  process.env.KAFKA_BROKERS = 'localhost:9094';

  initializeKafkaTopics()
    .then(() => {
      console.log('✅ Topic initialization completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Topic initialization failed:', error);
      process.exit(1);
    });
}

module.exports = initializeKafkaTopics;