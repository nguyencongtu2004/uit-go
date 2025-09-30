/**
 * Trip Event Consumer Service
 * Handles trip state changes and triggers business logic
 * Maintains eventual consistency across services
 */

const { KafkaClient, EventSchemas, Logger } = require('../../../common/shared');
const TripStateService = require('./tripStateService');
const NotificationService = require('./notificationService');

class TripEventConsumer {
  constructor() {
    this.kafkaClient = new KafkaClient({
      clientId: process.env.KAFKA_CLIENT_ID || 'trip-service',
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092']
    });
    this.consumer = null;
    this.isRunning = false;
    this.logger = new Logger('TripEventConsumer');

    // Service dependencies
    this.tripStateService = new TripStateService();
    this.notificationService = new NotificationService();
  }

  /**
   * Initialize and start consuming trip events
   */
  async start() {
    try {
      this.consumer = await this.kafkaClient.initConsumer(
        EventSchemas.CONSUMER_GROUPS.TRIP_PROCESSOR,
        {
          // Consumer optimizations
          maxBytes: 1048576, // 1MB
          maxWaitTime: 500, // 500ms max wait
        }
      );

      // Subscribe to trip events topic
      await this.kafkaClient.subscribe(
        [EventSchemas.TOPICS.TRIP_EVENTS.name],
        this._handleTripEvent.bind(this)
      );

      this.isRunning = true;
      this.logger.info('Trip Event Consumer started successfully');
    } catch (error) {
      this.logger.error('Failed to start Trip Event Consumer:', error);
      throw error;
    }
  }

  /**
   * Handle incoming trip events
   */
  async _handleTripEvent(messageInfo) {
    const { topic, data, key } = messageInfo;

    try {
      this.logger.debug('Processing trip event:', {
        eventType: data.eventType,
        tripId: data.tripId,
        key
      });

      // Process based on event type
      switch (data.eventType) {
        case EventSchemas.EVENT_TYPES.TRIP.REQUESTED:
          await this._handleTripRequested(data);
          break;

        case EventSchemas.EVENT_TYPES.TRIP.DRIVER_ASSIGNED:
          await this._handleDriverAssigned(data);
          break;

        case EventSchemas.EVENT_TYPES.TRIP.ACCEPTED:
          await this._handleTripAccepted(data);
          break;

        case EventSchemas.EVENT_TYPES.TRIP.DRIVER_ARRIVING:
          await this._handleDriverArriving(data);
          break;

        case EventSchemas.EVENT_TYPES.TRIP.DRIVER_ARRIVED:
          await this._handleDriverArrived(data);
          break;

        case EventSchemas.EVENT_TYPES.TRIP.STARTED:
          await this._handleTripStarted(data);
          break;

        case EventSchemas.EVENT_TYPES.TRIP.COMPLETED:
          await this._handleTripCompleted(data);
          break;

        case EventSchemas.EVENT_TYPES.TRIP.CANCELLED:
          await this._handleTripCancelled(data);
          break;

        case EventSchemas.EVENT_TYPES.TRIP.RATING_SUBMITTED:
          await this._handleRatingSubmitted(data);
          break;

        default:
          this.logger.warn('Unknown trip event type:', data.eventType);
      }

    } catch (error) {
      this.logger.error('Error processing trip event:', error);
      // Don't throw - let Kafka retry mechanism handle it
    }
  }

  /**
   * Handle trip requested event
   */
  async _handleTripRequested(eventData) {
    try {
      // Update trip state to searching for driver
      await this.tripStateService.updateTripState(
        eventData.tripId,
        'SEARCHING',
        { searchStarted: new Date() }
      );

      // Trigger driver matching (this would call driver service)
      // For PoC, we'll simulate this
      this.logger.info(`Trip ${eventData.tripId} is now searching for drivers`);

      // In real implementation, this would trigger driver matching service
      // await this.driverMatchingService.findAvailableDrivers(eventData);

    } catch (error) {
      this.logger.error('Error handling trip requested:', error);
    }
  }

  /**
   * Handle driver assigned event
   */
  async _handleDriverAssigned(eventData) {
    try {
      // Update trip state
      await this.tripStateService.updateTripState(
        eventData.tripId,
        'DRIVER_ASSIGNED',
        {
          driverId: eventData.driverId,
          assignedAt: new Date()
        }
      );

      // Send notification to user
      await this.notificationService.sendDriverAssignedNotification(
        eventData.userId,
        eventData.driverId,
        eventData.tripId
      );

      this.logger.info(`Driver ${eventData.driverId} assigned to trip ${eventData.tripId}`);

    } catch (error) {
      this.logger.error('Error handling driver assigned:', error);
    }
  }

  /**
   * Handle trip accepted event
   */
  async _handleTripAccepted(eventData) {
    try {
      // Update trip state
      await this.tripStateService.updateTripState(
        eventData.tripId,
        'ACCEPTED',
        {
          acceptedAt: new Date(),
          estimatedArrival: eventData.data.estimatedArrival
        }
      );

      this.logger.info(`Trip ${eventData.tripId} accepted by driver ${eventData.driverId}`);

    } catch (error) {
      this.logger.error('Error handling trip accepted:', error);
    }
  }

  /**
   * Handle driver arriving event
   */
  async _handleDriverArriving(eventData) {
    try {
      // Update trip state
      await this.tripStateService.updateTripState(
        eventData.tripId,
        'DRIVER_ARRIVING',
        { arrivingAt: new Date() }
      );

      // Send notification to user
      await this.notificationService.sendDriverArrivingNotification(
        eventData.userId,
        eventData.driverId,
        eventData.tripId
      );

      this.logger.info(`Driver ${eventData.driverId} arriving for trip ${eventData.tripId}`);

    } catch (error) {
      this.logger.error('Error handling driver arriving:', error);
    }
  }

  /**
   * Handle driver arrived event
   */
  async _handleDriverArrived(eventData) {
    try {
      // Update trip state
      await this.tripStateService.updateTripState(
        eventData.tripId,
        'DRIVER_ARRIVED',
        { arrivedAt: new Date() }
      );

      this.logger.info(`Driver ${eventData.driverId} arrived for trip ${eventData.tripId}`);

    } catch (error) {
      this.logger.error('Error handling driver arrived:', error);
    }
  }

  /**
   * Handle trip started event
   */
  async _handleTripStarted(eventData) {
    try {
      // Update trip state
      await this.tripStateService.updateTripState(
        eventData.tripId,
        'IN_PROGRESS',
        {
          startedAt: new Date(),
          actualPickup: eventData.data.pickup
        }
      );

      // Send notification to user
      await this.notificationService.sendTripStartedNotification(
        eventData.userId,
        eventData.driverId,
        eventData.tripId
      );

      this.logger.info(`Trip ${eventData.tripId} started`);

    } catch (error) {
      this.logger.error('Error handling trip started:', error);
    }
  }

  /**
   * Handle trip completed event
   */
  async _handleTripCompleted(eventData) {
    try {
      // Update trip state
      await this.tripStateService.updateTripState(
        eventData.tripId,
        'COMPLETED',
        {
          completedAt: new Date(),
          finalFare: eventData.data.fare,
          actualDestination: eventData.data.destination
        }
      );

      // Send notification to user
      await this.notificationService.sendTripCompletedNotification(
        eventData.userId,
        eventData.driverId,
        eventData.tripId
      );

      this.logger.info(`Trip ${eventData.tripId} completed`);

    } catch (error) {
      this.logger.error('Error handling trip completed:', error);
    }
  }

  /**
   * Handle trip cancelled event
   */
  async _handleTripCancelled(eventData) {
    try {
      // Update trip state
      await this.tripStateService.updateTripState(
        eventData.tripId,
        'CANCELLED',
        {
          cancelledAt: new Date(),
          cancelReason: eventData.data.reason,
          cancelledBy: eventData.data.cancelledBy
        }
      );

      // Send notification to user
      await this.notificationService.sendTripCancelledNotification(
        eventData.userId,
        eventData.data.reason,
        eventData.tripId
      );

      this.logger.info(`Trip ${eventData.tripId} cancelled`);

    } catch (error) {
      this.logger.error('Error handling trip cancelled:', error);
    }
  }

  /**
   * Handle rating submitted event
   */
  async _handleRatingSubmitted(eventData) {
    try {
      // Update trip with rating
      await this.tripStateService.updateTripRating(
        eventData.tripId,
        {
          rating: eventData.data.rating,
          feedback: eventData.data.feedback,
          ratedAt: new Date()
        }
      );

      this.logger.info(`Rating submitted for trip ${eventData.tripId}`);

    } catch (error) {
      this.logger.error('Error handling rating submitted:', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    return {
      status: this.isRunning ? 'running' : 'stopped',
      consumerGroup: EventSchemas.CONSUMER_GROUPS.TRIP_PROCESSOR,
      kafkaHealth: await this.kafkaClient.healthCheck()
    };
  }

  /**
   * Graceful shutdown
   */
  async stop() {
    try {
      this.isRunning = false;
      await this.kafkaClient.disconnect();
      this.logger.info('Trip Event Consumer stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping Trip Event Consumer:', error);
    }
  }
}

module.exports = TripEventConsumer;