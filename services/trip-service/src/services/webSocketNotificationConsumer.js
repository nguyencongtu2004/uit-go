/**
 * WebSocket Notification Consumer Service
 * Consumes notification events and broadcasts to connected WebSocket clients
 * Bridges Kafka events with real-time WebSocket communication
 */

const { KafkaClient, EventSchemas, Logger } = require('../../../common/shared');
const NotificationService = require('./notificationService');

class WebSocketNotificationConsumer {
  constructor(io) {
    this.kafkaClient = new KafkaClient({
      clientId: process.env.KAFKA_CLIENT_ID || 'websocket-service',
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092']
    });
    this.consumer = null;
    this.isRunning = false;
    this.logger = new Logger('WebSocketNotificationConsumer');

    // WebSocket.IO instance for real-time communication
    this.io = io;
    this.notificationService = new NotificationService();

    // Performance metrics
    this.processedCount = 0;
    this.broadcastCount = 0;
    this.errorCount = 0;
  }

  /**
   * Initialize and start consuming notification events
   */
  async start() {
    try {
      this.consumer = await this.kafkaClient.initConsumer(
        EventSchemas.CONSUMER_GROUPS.WEBSOCKET_BROADCASTER,
        {
          // Real-time optimized settings
          maxBytes: 1048576, // 1MB
          maxWaitTime: 100, // Fast delivery - 100ms max wait
          sessionTimeout: 30000,
          heartbeatInterval: 3000
        }
      );

      // Subscribe to notification events topic
      await this.kafkaClient.subscribe(
        [EventSchemas.TOPICS.USER_NOTIFICATIONS.name],
        this._handleNotificationEvent.bind(this)
      );

      this.isRunning = true;
      this.logger.info('WebSocket Notification Consumer started successfully');

    } catch (error) {
      this.logger.error('Failed to start WebSocket Notification Consumer:', error);
      throw error;
    }
  }

  /**
   * Handle incoming notification events and broadcast via WebSocket
   */
  async _handleNotificationEvent(messageInfo) {
    const { topic, data, key } = messageInfo;

    try {
      this.processedCount++;

      const { eventType, userId, data: notificationData } = data;

      this.logger.debug('Processing notification event:', {
        eventType,
        userId,
        title: notificationData.title
      });

      // Process based on notification type
      switch (eventType) {
        case EventSchemas.EVENT_TYPES.NOTIFICATION.DRIVER_ASSIGNED:
          await this._broadcastDriverAssigned(userId, notificationData);
          break;

        case EventSchemas.EVENT_TYPES.NOTIFICATION.DRIVER_ARRIVING:
          await this._broadcastDriverArriving(userId, notificationData);
          break;

        case EventSchemas.EVENT_TYPES.NOTIFICATION.TRIP_STARTED:
          await this._broadcastTripStarted(userId, notificationData);
          break;

        case EventSchemas.EVENT_TYPES.NOTIFICATION.TRIP_COMPLETED:
          await this._broadcastTripCompleted(userId, notificationData);
          break;

        case EventSchemas.EVENT_TYPES.NOTIFICATION.TRIP_CANCELLED:
          await this._broadcastTripCancelled(userId, notificationData);
          break;

        default:
          this.logger.warn('Unknown notification event type:', eventType);
      }

    } catch (error) {
      this.errorCount++;
      this.logger.error('Error processing notification event:', error);
    }
  }

  /**
   * Broadcast driver assigned notification
   */
  async _broadcastDriverAssigned(userId, notificationData) {
    try {
      const message = {
        type: 'driver_assigned',
        title: notificationData.title,
        message: notificationData.message,
        tripId: notificationData.tripId,
        driverId: notificationData.driverId,
        driverInfo: notificationData.metadata.driverInfo,
        estimatedArrival: notificationData.metadata.estimatedArrival,
        timestamp: Date.now()
      };

      // Broadcast to specific user
      await this._broadcastToUser(userId, message);

      this.broadcastCount++;
      this.logger.debug(`Driver assigned notification sent to user ${userId}`);

    } catch (error) {
      this.logger.error('Error broadcasting driver assigned:', error);
    }
  }

  /**
   * Broadcast driver arriving notification
   */
  async _broadcastDriverArriving(userId, notificationData) {
    try {
      const message = {
        type: 'driver_arriving',
        title: notificationData.title,
        message: notificationData.message,
        tripId: notificationData.tripId,
        driverId: notificationData.driverId,
        driverInfo: notificationData.metadata.driverInfo,
        estimatedArrival: notificationData.metadata.estimatedArrival,
        timestamp: Date.now()
      };

      await this._broadcastToUser(userId, message);

      this.broadcastCount++;
      this.logger.debug(`Driver arriving notification sent to user ${userId}`);

    } catch (error) {
      this.logger.error('Error broadcasting driver arriving:', error);
    }
  }

  /**
   * Broadcast trip started notification
   */
  async _broadcastTripStarted(userId, notificationData) {
    try {
      const message = {
        type: 'trip_started',
        title: notificationData.title,
        message: notificationData.message,
        tripId: notificationData.tripId,
        driverId: notificationData.driverId,
        driverInfo: notificationData.metadata.driverInfo,
        destination: notificationData.metadata.destination,
        timestamp: Date.now()
      };

      await this._broadcastToUser(userId, message);

      this.broadcastCount++;
      this.logger.debug(`Trip started notification sent to user ${userId}`);

    } catch (error) {
      this.logger.error('Error broadcasting trip started:', error);
    }
  }

  /**
   * Broadcast trip completed notification
   */
  async _broadcastTripCompleted(userId, notificationData) {
    try {
      const message = {
        type: 'trip_completed',
        title: notificationData.title,
        message: notificationData.message,
        tripId: notificationData.tripId,
        driverId: notificationData.driverId,
        driverInfo: notificationData.metadata.driverInfo,
        fare: notificationData.metadata.fare,
        duration: notificationData.metadata.duration,
        timestamp: Date.now()
      };

      await this._broadcastToUser(userId, message);

      this.broadcastCount++;
      this.logger.debug(`Trip completed notification sent to user ${userId}`);

    } catch (error) {
      this.logger.error('Error broadcasting trip completed:', error);
    }
  }

  /**
   * Broadcast trip cancelled notification
   */
  async _broadcastTripCancelled(userId, notificationData) {
    try {
      const message = {
        type: 'trip_cancelled',
        title: notificationData.title,
        message: notificationData.message,
        tripId: notificationData.tripId,
        reason: notificationData.metadata.reason,
        refundInfo: notificationData.metadata.refundInfo,
        timestamp: Date.now()
      };

      await this._broadcastToUser(userId, message);

      this.broadcastCount++;
      this.logger.debug(`Trip cancelled notification sent to user ${userId}`);

    } catch (error) {
      this.logger.error('Error broadcasting trip cancelled:', error);
    }
  }

  /**
   * Broadcast message to specific user via WebSocket
   */
  async _broadcastToUser(userId, message) {
    try {
      // Emit to user-specific room
      this.io.to(`user_${userId}`).emit('notification', message);

      // Also store in notification service for persistence
      await this.notificationService.storeNotification(userId, message);

    } catch (error) {
      this.logger.error(`Error broadcasting to user ${userId}:`, error);
    }
  }

  /**
   * Broadcast to all connected clients (for system-wide notifications)
   */
  async _broadcastToAll(message) {
    try {
      this.io.emit('system_notification', message);
    } catch (error) {
      this.logger.error('Error broadcasting to all clients:', error);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      processedCount: this.processedCount,
      broadcastCount: this.broadcastCount,
      errorCount: this.errorCount,
      errorRate: this.processedCount > 0 ? (this.errorCount / this.processedCount * 100) : 0,
      connectedClients: this.io.engine.clientsCount || 0
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    const metrics = this.getMetrics();
    const isHealthy = this.isRunning && metrics.errorRate < 5;

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      isRunning: this.isRunning,
      consumerGroup: EventSchemas.CONSUMER_GROUPS.WEBSOCKET_BROADCASTER,
      metrics,
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
      this.logger.info('WebSocket Notification Consumer stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping WebSocket Notification Consumer:', error);
    }
  }
}

module.exports = WebSocketNotificationConsumer;