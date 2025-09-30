/**
 * Location Event Consumer Service
 * Handles high-frequency location updates from 1000+ drivers
 * Updates Redis cache and triggers real-time broadcasts
 */

const { KafkaClient, EventSchemas, Logger, RedisManager } = require('../../../common/shared');
const LocationService = require('./locationService');

class LocationEventConsumer {
  constructor() {
    this.kafkaClient = new KafkaClient({
      clientId: process.env.KAFKA_CLIENT_ID || 'driver-service',
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092']
    });
    this.consumer = null;
    this.isRunning = false;
    this.logger = new Logger('LocationEventConsumer');

    // Service dependencies
    this.locationService = new LocationService();
    this.redisManager = new RedisManager();

    // Performance metrics
    this.processedCount = 0;
    this.errorCount = 0;
    this.lastProcessedTime = Date.now();
  }

  /**
   * Initialize and start consuming location events
   */
  async start() {
    try {
      this.consumer = await this.kafkaClient.initConsumer(
        EventSchemas.CONSUMER_GROUPS.LOCATION_PROCESSOR,
        {
          // High-performance settings for location processing
          maxBytes: 10485760, // 10MB - large batches for location data
          maxWaitTime: 100, // Fast processing - 100ms max wait
          sessionTimeout: 30000,
          heartbeatInterval: 3000
        }
      );

      // Subscribe to location events topic
      await this.kafkaClient.subscribe(
        [EventSchemas.TOPICS.LOCATION_UPDATES.name],
        this._handleLocationEvent.bind(this)
      );

      this.isRunning = true;
      this.logger.info('Location Event Consumer started successfully');

      // Start performance monitoring
      this._startPerformanceMonitoring();

    } catch (error) {
      this.logger.error('Failed to start Location Event Consumer:', error);
      throw error;
    }
  }

  /**
   * Handle incoming location events (optimized for high throughput)
   */
  async _handleLocationEvent(messageInfo) {
    const { topic, data, key } = messageInfo;

    try {
      this.processedCount++;

      // Process based on event type
      switch (data.eventType) {
        case EventSchemas.EVENT_TYPES.LOCATION.DRIVER_UPDATED:
          await this._handleDriverLocationUpdate(data);
          break;

        case EventSchemas.EVENT_TYPES.LOCATION.DRIVER_ONLINE:
          await this._handleDriverOnline(data);
          break;

        case EventSchemas.EVENT_TYPES.LOCATION.DRIVER_OFFLINE:
          await this._handleDriverOffline(data);
          break;

        default:
          this.logger.warn('Unknown location event type:', data.eventType);
      }

      this.lastProcessedTime = Date.now();

    } catch (error) {
      this.errorCount++;
      this.logger.error('Error processing location event:', error);
      // Don't throw - prioritize throughput over individual message failures
    }
  }

  /**
   * Handle driver location update (most frequent event)
   */
  async _handleDriverLocationUpdate(eventData) {
    try {
      const { driverId, location, status, tripId, timestamp } = eventData;

      // Update Redis cache first (fastest operation)
      await this.redisManager.geoAdd(
        'driver_locations',
        location.lng,
        location.lat,
        driverId
      );

      // Store additional location data in Redis hash
      const locationData = {
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy || 0,
        heading: location.heading || 0,
        speed: location.speed || 0,
        status,
        tripId: tripId || '',
        timestamp,
        lastUpdated: Date.now()
      };

      await this.redisManager.hset(
        `driver:${driverId}:location`,
        locationData,
        300 // 5-minute TTL for location data
      );

      // Update driver status if changed
      if (status) {
        await this.redisManager.hset(
          `driver:${driverId}:status`,
          { status, lastUpdated: Date.now() },
          3600 // 1-hour TTL for status
        );
      }

      // For drivers on trips, update trip-specific location
      if (tripId) {
        await this.redisManager.hset(
          `trip:${tripId}:driver_location`,
          locationData,
          1800 // 30-minute TTL for trip location
        );
      }

      // Trigger real-time broadcast to clients (WebSocket)
      await this.locationService.broadcastLocationUpdate(driverId, locationData);

    } catch (error) {
      this.logger.error('Error handling driver location update:', error);
    }
  }

  /**
   * Handle driver going online
   */
  async _handleDriverOnline(eventData) {
    try {
      const { driverId, location, timestamp } = eventData;

      // Add to active drivers set
      await this.redisManager.sadd('active_drivers', driverId);

      // Update location and status
      await this.redisManager.geoAdd(
        'driver_locations',
        location.lng,
        location.lat,
        driverId
      );

      await this.redisManager.hset(
        `driver:${driverId}:status`,
        {
          status: 'ONLINE',
          onlineAt: timestamp,
          lastUpdated: Date.now()
        },
        3600 // 1-hour TTL
      );

      this.logger.debug(`Driver ${driverId} went online`);

    } catch (error) {
      this.logger.error('Error handling driver online:', error);
    }
  }

  /**
   * Handle driver going offline
   */
  async _handleDriverOffline(eventData) {
    try {
      const { driverId, timestamp } = eventData;

      // Remove from active drivers set
      await this.redisManager.srem('active_drivers', driverId);

      // Remove from geo location
      await this.redisManager.geoRem('driver_locations', driverId);

      // Update status to offline
      await this.redisManager.hset(
        `driver:${driverId}:status`,
        {
          status: 'OFFLINE',
          offlineAt: timestamp,
          lastUpdated: Date.now()
        },
        300 // 5-minute TTL for offline status
      );

      this.logger.debug(`Driver ${driverId} went offline`);

    } catch (error) {
      this.logger.error('Error handling driver offline:', error);
    }
  }

  /**
   * Start performance monitoring
   */
  _startPerformanceMonitoring() {
    setInterval(() => {
      const now = Date.now();
      const timeSinceLastProcess = now - this.lastProcessedTime;

      this.logger.debug('Location Consumer Performance:', {
        processedCount: this.processedCount,
        errorCount: this.errorCount,
        errorRate: this.processedCount > 0 ? (this.errorCount / this.processedCount * 100).toFixed(2) + '%' : '0%',
        timeSinceLastProcess: timeSinceLastProcess + 'ms',
        messagesPerSecond: this.processedCount > 0 ? (this.processedCount / ((now - this.startTime) / 1000)).toFixed(2) : '0'
      });
    }, 30000); // Every 30 seconds

    this.startTime = Date.now();
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const now = Date.now();
    const uptimeSeconds = (now - this.startTime) / 1000;

    return {
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      errorRate: this.processedCount > 0 ? (this.errorCount / this.processedCount * 100) : 0,
      messagesPerSecond: this.processedCount > 0 ? (this.processedCount / uptimeSeconds) : 0,
      uptimeSeconds,
      lastProcessedTime: this.lastProcessedTime
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    const metrics = this.getMetrics();
    const isHealthy = this.isRunning &&
      (Date.now() - this.lastProcessedTime) < 30000 && // Processed within last 30 seconds
      metrics.errorRate < 5; // Error rate under 5%

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      isRunning: this.isRunning,
      consumerGroup: EventSchemas.CONSUMER_GROUPS.LOCATION_PROCESSOR,
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
      this.logger.info('Location Event Consumer stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping Location Event Consumer:', error);
    }
  }
}

module.exports = LocationEventConsumer;