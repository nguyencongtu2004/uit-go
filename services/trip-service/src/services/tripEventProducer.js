/**
 * Trip Event Producer Service
 * Handles publishing trip-related events to Kafka for event-driven architecture
 */

const { KafkaClient, EventSchemas, Logger } = require('../../../common/shared');

class TripEventProducer {
  constructor() {
    this.kafkaClient = new KafkaClient({
      clientId: process.env.KAFKA_CLIENT_ID || 'trip-service',
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092']
    });
    this.producer = null;
    this.isInitialized = false;
    this.logger = new Logger('TripEventProducer');
  }

  /**
   * Initialize the producer
   */
  async initialize() {
    try {
      this.producer = await this.kafkaClient.initProducer({
        // Optimized for trip events - reliability over speed
        maxInFlightRequests: 1, // Ensure ordering
        idempotent: true, // Prevent duplicate trip events
        batch: {
          size: 50, // Smaller batches for trip events
          timeout: 100 // Quick processing for critical events
        }
      });

      this.isInitialized = true;
      this.logger.info('Trip Event Producer initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Trip Event Producer:', error);
      throw error;
    }
  }

  /**
   * Publish trip requested event
   */
  async publishTripRequested(tripData) {
    const event = EventSchemas.createTripEvent(
      EventSchemas.EVENT_TYPES.TRIP.REQUESTED,
      tripData
    );

    return this._publishTripEvent(event);
  }

  /**
   * Publish driver assigned event
   */
  async publishDriverAssigned(tripData) {
    const event = EventSchemas.createTripEvent(
      EventSchemas.EVENT_TYPES.TRIP.DRIVER_ASSIGNED,
      tripData
    );

    return this._publishTripEvent(event);
  }

  /**
   * Publish trip accepted event
   */
  async publishTripAccepted(tripData) {
    const event = EventSchemas.createTripEvent(
      EventSchemas.EVENT_TYPES.TRIP.ACCEPTED,
      tripData
    );

    return this._publishTripEvent(event);
  }

  /**
   * Publish driver arriving event
   */
  async publishDriverArriving(tripData) {
    const event = EventSchemas.createTripEvent(
      EventSchemas.EVENT_TYPES.TRIP.DRIVER_ARRIVING,
      tripData
    );

    return this._publishTripEvent(event);
  }

  /**
   * Publish driver arrived event
   */
  async publishDriverArrived(tripData) {
    const event = EventSchemas.createTripEvent(
      EventSchemas.EVENT_TYPES.TRIP.DRIVER_ARRIVED,
      tripData
    );

    return this._publishTripEvent(event);
  }

  /**
   * Publish trip started event
   */
  async publishTripStarted(tripData) {
    const event = EventSchemas.createTripEvent(
      EventSchemas.EVENT_TYPES.TRIP.STARTED,
      tripData
    );

    return this._publishTripEvent(event);
  }

  /**
   * Publish trip completed event
   */
  async publishTripCompleted(tripData) {
    const event = EventSchemas.createTripEvent(
      EventSchemas.EVENT_TYPES.TRIP.COMPLETED,
      tripData
    );

    return this._publishTripEvent(event);
  }

  /**
   * Publish trip cancelled event
   */
  async publishTripCancelled(tripData) {
    const event = EventSchemas.createTripEvent(
      EventSchemas.EVENT_TYPES.TRIP.CANCELLED,
      tripData
    );

    return this._publishTripEvent(event);
  }

  /**
   * Publish trip rating submitted event
   */
  async publishTripRatingSubmitted(tripData) {
    const event = EventSchemas.createTripEvent(
      EventSchemas.EVENT_TYPES.TRIP.RATING_SUBMITTED,
      tripData
    );

    return this._publishTripEvent(event);
  }

  /**
   * Private method to publish trip events with proper partitioning
   */
  async _publishTripEvent(event) {
    if (!this.isInitialized) {
      throw new Error('Trip Event Producer not initialized. Call initialize() first.');
    }

    try {
      const partitionKey = EventSchemas.getPartitionKey(
        EventSchemas.TOPICS.TRIP_EVENTS.name,
        event
      );

      const result = await this.kafkaClient.sendMessage(
        EventSchemas.TOPICS.TRIP_EVENTS.name,
        event,
        partitionKey
      );

      this.logger.debug('Trip event published:', {
        eventType: event.eventType,
        tripId: event.tripId,
        eventId: event.eventId
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to publish trip event:', error);
      throw error;
    }
  }

  /**
   * Batch publish multiple trip events for performance
   */
  async publishBatchEvents(events) {
    if (!this.isInitialized) {
      throw new Error('Trip Event Producer not initialized. Call initialize() first.');
    }

    try {
      const messages = events.map(event => ({
        key: EventSchemas.getPartitionKey(EventSchemas.TOPICS.TRIP_EVENTS.name, event),
        data: event
      }));

      const result = await this.kafkaClient.sendBatch(
        EventSchemas.TOPICS.TRIP_EVENTS.name,
        messages
      );

      this.logger.debug(`Batch published ${events.length} trip events`);
      return result;
    } catch (error) {
      this.logger.error('Failed to publish trip event batch:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      return {
        status: this.isInitialized ? 'healthy' : 'not_initialized',
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
      await this.kafkaClient.disconnect();
      this.isInitialized = false;
      this.logger.info('Trip Event Producer shutdown completed');
    } catch (error) {
      this.logger.error('Error during Trip Event Producer shutdown:', error);
    }
  }
}

module.exports = TripEventProducer;