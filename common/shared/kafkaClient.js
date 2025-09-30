/**
 * Shared Kafka Client Utility for UIT-Go Services
 * Optimized for load testing with proper error handling and performance
 */

const { Kafka, logLevel } = require('kafkajs');
const Logger = require('./logger');

class KafkaClient {
  constructor(config = {}) {
    this.logger = new Logger('KafkaClient');
    this.kafka = new Kafka({
      clientId: config.clientId || process.env.KAFKA_CLIENT_ID || 'uit-go-client',
      brokers: config.brokers || process.env.KAFKA_BROKERS?.split(',') || ['localhost:9094'],
      logLevel: logLevel.ERROR, // Reduce log noise for performance
      retry: {
        initialRetryTime: 100,
        retries: 8
      },
      connectionTimeout: 10000,
      requestTimeout: 30000,
    });

    this.producer = null;
    this.consumer = null;
    this.admin = null;
    this.connected = false;
  }

  /**
   * Initialize producer with performance optimizations
   */
  async initProducer(options = {}) {
    try {
      this.producer = this.kafka.producer({
        // Performance optimizations for load testing
        maxInFlightRequests: 5,
        idempotent: false, // Disable for better performance in PoC
        retry: {
          initialRetryTime: 100,
          retries: 3
        },
        // Batching for high throughput
        batch: {
          size: 100, // Batch up to 100 messages
          timeout: 50 // or wait max 50ms
        },
        compression: 'gzip',
        ...options
      });

      await this.producer.connect();
      this.this.logger.info('Kafka producer connected successfully');
      return this.producer;
    } catch (error) {
      this.this.logger.error('Failed to initialize Kafka producer:', error);
      throw error;
    }
  }

  /**
   * Initialize consumer with proper group management
   */
  async initConsumer(groupId, options = {}) {
    try {
      this.consumer = this.kafka.consumer({
        groupId,
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
        // Performance settings for load testing
        maxBytesPerPartition: 1048576, // 1MB
        maxBytes: 10485760, // 10MB
        maxWaitTime: 1000, // Max wait 1s for messages
        ...options
      });

      await this.consumer.connect();
      this.logger.info(`Kafka consumer connected successfully with groupId: ${groupId}`);
      return this.consumer;
    } catch (error) {
      this.logger.error('Failed to initialize Kafka consumer:', error);
      throw error;
    }
  }

  /**
   * Initialize admin client for topic management
   */
  async initAdmin() {
    try {
      this.admin = this.kafka.admin();
      await this.admin.connect();
      this.logger.info('Kafka admin connected successfully');
      return this.admin;
    } catch (error) {
      this.logger.error('Failed to initialize Kafka admin:', error);
      throw error;
    }
  }

  /**
   * Send single message with automatic retry
   */
  async sendMessage(topic, message, key = null) {
    if (!this.producer) {
      throw new Error('Producer not initialized. Call initProducer() first.');
    }

    try {
      const result = await this.producer.send({
        topic,
        messages: [{
          key: key || message.eventId || Date.now().toString(),
          value: JSON.stringify(message),
          timestamp: Date.now().toString()
        }]
      });

      this.logger.debug(`Message sent to topic ${topic}:`, { messageId: key });
      return result;
    } catch (error) {
      this.logger.error(`Failed to send message to topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Send batch messages for high throughput
   */
  async sendBatch(topic, messages) {
    if (!this.producer) {
      throw new Error('Producer not initialized. Call initProducer() first.');
    }

    try {
      const kafkaMessages = messages.map(msg => ({
        key: msg.key || msg.eventId || Date.now().toString(),
        value: JSON.stringify(msg.data || msg),
        timestamp: Date.now().toString()
      }));

      const result = await this.producer.send({
        topic,
        messages: kafkaMessages
      });

      this.logger.debug(`Batch of ${messages.length} messages sent to topic ${topic}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send batch to topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to topics and process messages
   */
  async subscribe(topics, messageHandler) {
    if (!this.consumer) {
      throw new Error('Consumer not initialized. Call initConsumer() first.');
    }

    try {
      // Subscribe to topics
      for (const topic of topics) {
        await this.consumer.subscribe({ topic, fromBeginning: false });
      }

      // Start processing messages
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const data = JSON.parse(message.value.toString());
            const messageInfo = {
              topic,
              partition,
              offset: message.offset,
              key: message.key?.toString(),
              data,
              timestamp: message.timestamp
            };

            await messageHandler(messageInfo);
          } catch (error) {
            this.logger.error(`Error processing message from ${topic}:`, error);
          }
        },
      });

      this.logger.info(`Subscribed to topics: ${topics.join(', ')}`);
    } catch (error) {
      this.logger.error('Failed to subscribe to topics:', error);
      throw error;
    }
  }

  /**
   * Create topics with proper partitioning for load testing
   */
  async createTopics(topicConfigs) {
    if (!this.admin) {
      throw new Error('Admin not initialized. Call initAdmin() first.');
    }

    try {
      const topics = topicConfigs.map(config => ({
        topic: config.name,
        numPartitions: config.partitions || 1,
        replicationFactor: config.replicationFactor || 1,
        configEntries: config.config || []
      }));

      await this.admin.createTopics({
        topics,
        waitForLeaders: true,
      });

      this.logger.info('Topics created successfully:', topics.map(t => t.topic));
    } catch (error) {
      // Ignore if topics already exist
      if (error.message.includes('already exists')) {
        this.logger.info('Topics already exist, skipping creation');
      } else {
        this.logger.error('Failed to create topics:', error);
        throw error;
      }
    }
  }

  /**
   * Graceful shutdown
   */
  async disconnect() {
    try {
      const promises = [];

      if (this.producer) {
        promises.push(this.producer.disconnect());
      }
      if (this.consumer) {
        promises.push(this.consumer.disconnect());
      }
      if (this.admin) {
        promises.push(this.admin.disconnect());
      }

      await Promise.all(promises);
      this.connected = false;
      this.logger.info('Kafka client disconnected successfully');
    } catch (error) {
      this.logger.error('Error during Kafka disconnect:', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.admin) {
        await this.initAdmin();
      }

      await this.admin.listTopics();
      return { status: 'healthy', connected: true };
    } catch (error) {
      this.logger.error('Kafka health check failed:', error);
      return { status: 'unhealthy', connected: false, error: error.message };
    }
  }
}

module.exports = KafkaClient;
