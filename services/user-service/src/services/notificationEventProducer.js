/**
 * Notification Event Producer Service  
 * Handles user notification events that trigger WebSocket broadcasts
 */

const { KafkaClient, EventSchemas, Logger } = require('../../../common/shared');

class NotificationEventProducer {
  constructor() {
    this.kafkaClient = new KafkaClient({
      clientId: process.env.KAFKA_CLIENT_ID || 'user-service',
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092']
    });
    this.producer = null;
    this.isInitialized = false;
    this.logger = new Logger('NotificationEventProducer');
  }

  /**
   * Initialize the producer
   */
  async initialize() {
    try {
      this.producer = await this.kafkaClient.initProducer({
        // Balanced settings for notifications
        maxInFlightRequests: 3,
        idempotent: true, // Prevent duplicate notifications
        batch: {
          size: 25, // Smaller batches for timely delivery
          timeout: 200 // Quick delivery for notifications
        }
      });

      this.isInitialized = true;
      this.logger.info('Notification Event Producer initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Notification Event Producer:', error);
      throw error;
    }
  }

  /**
   * Publish driver assigned notification
   */
  async publishDriverAssigned(userId, driverInfo, tripInfo) {
    const event = EventSchemas.createNotificationEvent(
      EventSchemas.EVENT_TYPES.NOTIFICATION.DRIVER_ASSIGNED,
      userId,
      {
        title: 'Driver Assigned',
        message: `${driverInfo.name} is assigned to your trip`,
        tripId: tripInfo.tripId,
        driverId: driverInfo.driverId,
        priority: 'HIGH',
        metadata: {
          driverInfo,
          estimatedArrival: tripInfo.estimatedArrival
        }
      }
    );

    return this._publishNotificationEvent(event);
  }

  /**
   * Publish driver arriving notification
   */
  async publishDriverArriving(userId, driverInfo, tripInfo) {
    const event = EventSchemas.createNotificationEvent(
      EventSchemas.EVENT_TYPES.NOTIFICATION.DRIVER_ARRIVING,
      userId,
      {
        title: 'Driver Arriving',
        message: `${driverInfo.name} is arriving at your location`,
        tripId: tripInfo.tripId,
        driverId: driverInfo.driverId,
        priority: 'HIGH',
        metadata: {
          driverInfo,
          estimatedArrival: tripInfo.estimatedArrival
        }
      }
    );

    return this._publishNotificationEvent(event);
  }

  /**
   * Publish trip started notification
   */
  async publishTripStarted(userId, driverInfo, tripInfo) {
    const event = EventSchemas.createNotificationEvent(
      EventSchemas.EVENT_TYPES.NOTIFICATION.TRIP_STARTED,
      userId,
      {
        title: 'Trip Started',
        message: 'Your trip has started',
        tripId: tripInfo.tripId,
        driverId: driverInfo.driverId,
        priority: 'MEDIUM',
        metadata: {
          driverInfo,
          destination: tripInfo.destination
        }
      }
    );

    return this._publishNotificationEvent(event);
  }

  /**
   * Publish trip completed notification
   */
  async publishTripCompleted(userId, driverInfo, tripInfo) {
    const event = EventSchemas.createNotificationEvent(
      EventSchemas.EVENT_TYPES.NOTIFICATION.TRIP_COMPLETED,
      userId,
      {
        title: 'Trip Completed',
        message: 'Your trip has been completed. Please rate your experience!',
        tripId: tripInfo.tripId,
        driverId: driverInfo.driverId,
        priority: 'MEDIUM',
        metadata: {
          driverInfo,
          fare: tripInfo.fare,
          duration: tripInfo.duration
        }
      }
    );

    return this._publishNotificationEvent(event);
  }

  /**
   * Publish trip cancelled notification
   */
  async publishTripCancelled(userId, reason, tripInfo) {
    const event = EventSchemas.createNotificationEvent(
      EventSchemas.EVENT_TYPES.NOTIFICATION.TRIP_CANCELLED,
      userId,
      {
        title: 'Trip Cancelled',
        message: `Your trip has been cancelled. Reason: ${reason}`,
        tripId: tripInfo.tripId,
        priority: 'HIGH',
        metadata: {
          reason,
          refundInfo: tripInfo.refundInfo
        }
      }
    );

    return this._publishNotificationEvent(event);
  }

  /**
   * Private method to publish notification events
   */
  async _publishNotificationEvent(event) {
    if (!this.isInitialized) {
      throw new Error('Notification Event Producer not initialized. Call initialize() first.');
    }

    try {
      const partitionKey = EventSchemas.getPartitionKey(
        EventSchemas.TOPICS.USER_NOTIFICATIONS.name,
        event
      );

      const result = await this.kafkaClient.sendMessage(
        EventSchemas.TOPICS.USER_NOTIFICATIONS.name,
        event,
        partitionKey
      );

      this.logger.debug('Notification event published:', {
        eventType: event.eventType,
        userId: event.userId,
        eventId: event.eventId
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to publish notification event:', error);
      throw error;
    }
  }

  /**
   * Batch publish multiple notification events
   */
  async publishBatchNotifications(events) {
    if (!this.isInitialized) {
      throw new Error('Notification Event Producer not initialized. Call initialize() first.');
    }

    try {
      const messages = events.map(event => ({
        key: EventSchemas.getPartitionKey(EventSchemas.TOPICS.USER_NOTIFICATIONS.name, event),
        data: event
      }));

      const result = await this.kafkaClient.sendBatch(
        EventSchemas.TOPICS.USER_NOTIFICATIONS.name,
        messages
      );

      this.logger.debug(`Batch published ${events.length} notification events`);
      return result;
    } catch (error) {
      this.logger.error('Failed to publish notification event batch:', error);
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
      this.logger.info('Notification Event Producer shutdown completed');
    } catch (error) {
      this.logger.error('Error during Notification Event Producer shutdown:', error);
    }
  }
}

module.exports = NotificationEventProducer;