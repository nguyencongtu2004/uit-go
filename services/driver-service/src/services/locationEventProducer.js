/**
 * Location Event Producer Service
 * Handles high-frequency location updates for 1000+ drivers (every 5 seconds)
 * Optimized for performance and batching
 */

const { KafkaClient, EventSchemas, Logger } = require('../../../common/shared');

class LocationEventProducer {
  constructor() {
    this.kafkaClient = new KafkaClient({
      clientId: process.env.KAFKA_CLIENT_ID || 'driver-service',
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092']
    });
    this.producer = null;
    this.isInitialized = false;
    this.logger = new Logger('LocationEventProducer');

    // Batching for high-frequency location updates
    this.batchBuffer = [];
    this.batchTimeout = null;
    this.BATCH_SIZE = 100; // Send in batches of 100
    this.BATCH_TIMEOUT = 1000; // Or every 1 second
  }

  /**
   * Initialize the producer with high-performance settings
   */
  async initialize() {
    try {
      this.producer = await this.kafkaClient.initProducer({
        // High performance settings for location updates
        maxInFlightRequests: 5, // Higher throughput
        idempotent: false, // Speed over deduplication for location
        batch: {
          size: 200, // Large batches for location data
          timeout: 50 // Fast batching
        },
        compression: 'gzip' // Compress location data
      });

      this.isInitialized = true;
      this.logger.info('Location Event Producer initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Location Event Producer:', error);
      throw error;
    }
  }

  /**
   * Publish driver location update (optimized for 5-second intervals)
   */
  async publishLocationUpdate(driverId, location, status, tripId = null) {
    const event = EventSchemas.createLocationEvent(driverId, location, status, tripId);

    // Add to batch buffer for performance
    this.batchBuffer.push(event);

    // Send immediately if batch is full
    if (this.batchBuffer.length >= this.BATCH_SIZE) {
      return this._flushBatch();
    }

    // Set timeout to send batch if not full
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this._flushBatch();
      }, this.BATCH_TIMEOUT);
    }

    return Promise.resolve();
  }

  /**
   * Publish driver went online event
   */
  async publishDriverOnline(driverId, location) {
    const event = {
      eventId: `online_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType: EventSchemas.EVENT_TYPES.LOCATION.DRIVER_ONLINE,
      driverId,
      timestamp: Date.now(),
      location,
      status: 'ONLINE'
    };

    return this._publishLocationEvent(event);
  }

  /**
   * Publish driver went offline event
   */
  async publishDriverOffline(driverId, location) {
    const event = {
      eventId: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType: EventSchemas.EVENT_TYPES.LOCATION.DRIVER_OFFLINE,
      driverId,
      timestamp: Date.now(),
      location,
      status: 'OFFLINE'
    };

    return this._publishLocationEvent(event);
  }

  /**
   * Flush the batch buffer immediately
   */
  async _flushBatch() {
    if (this.batchBuffer.length === 0) {
      return;
    }

    if (!this.isInitialized) {
      this.logger.warn('Producer not initialized, dropping location batch');
      this.batchBuffer = [];
      return;
    }

    try {
      const events = [...this.batchBuffer];
      this.batchBuffer = [];

      // Clear timeout
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }

      const messages = events.map(event => ({
        key: EventSchemas.getPartitionKey(EventSchemas.TOPICS.LOCATION_UPDATES.name, event),
        data: event
      }));

      const result = await this.kafkaClient.sendBatch(
        EventSchemas.TOPICS.LOCATION_UPDATES.name,
        messages
      );

      this.logger.debug(`Flushed batch of ${events.length} location events`);
      return result;
    } catch (error) {
      this.logger.error('Failed to flush location event batch:', error);
      throw error;
    }
  }

  /**
   * Private method to publish single location events
   */
  async _publishLocationEvent(event) {
    if (!this.isInitialized) {
      throw new Error('Location Event Producer not initialized. Call initialize() first.');
    }

    try {
      const partitionKey = EventSchemas.getPartitionKey(
        EventSchemas.TOPICS.LOCATION_UPDATES.name,
        event
      );

      const result = await this.kafkaClient.sendMessage(
        EventSchemas.TOPICS.LOCATION_UPDATES.name,
        event,
        partitionKey
      );

      this.logger.debug('Location event published:', {
        eventType: event.eventType,
        driverId: event.driverId,
        eventId: event.eventId
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to publish location event:', error);
      throw error;
    }
  }

  /**
   * Force flush all pending location updates
   */
  async forceFlush() {
    return this._flushBatch();
  }

  /**
   * Get batch statistics for monitoring
   */
  getBatchStats() {
    return {
      bufferSize: this.batchBuffer.length,
      maxBatchSize: this.BATCH_SIZE,
      batchTimeout: this.BATCH_TIMEOUT,
      hasPendingTimeout: !!this.batchTimeout
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      return {
        status: this.isInitialized ? 'healthy' : 'not_initialized',
        batchStats: this.getBatchStats(),
        kafkaHealth: await this.kafkaClient.healthCheck()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      // Flush any remaining batches
      await this._flushBatch();

      // Clear timeout
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }

      await this.kafkaClient.disconnect();
      this.isInitialized = false;
      this.logger.info('Location Event Producer shutdown completed');
    } catch (error) {
      this.logger.error('Error during Location Event Producer shutdown:', error);
    }
  }
}

module.exports = LocationEventProducer;