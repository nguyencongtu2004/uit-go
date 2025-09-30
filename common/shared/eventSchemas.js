/**
 * Event Schema Definitions for UIT-Go Event-Driven Architecture
 * Optimized for load testing: 1000 drivers, 100 concurrent trips
 */

// Topic Configurations for Load Testing
const TOPICS = {
  TRIP_EVENTS: {
    name: 'trip-events',
    partitions: 10,
    replicationFactor: 1,
    config: [
      { name: 'retention.ms', value: '86400000' }, // 24 hours
      { name: 'cleanup.policy', value: 'delete' }
    ]
  },
  LOCATION_UPDATES: {
    name: 'location-updates',
    partitions: 20,
    replicationFactor: 1,
    config: [
      { name: 'retention.ms', value: '3600000' }, // 1 hour (high volume)
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'gzip' }
    ]
  },
  USER_NOTIFICATIONS: {
    name: 'user-notifications',
    partitions: 5,
    replicationFactor: 1,
    config: [
      { name: 'retention.ms', value: '172800000' }, // 48 hours
      { name: 'cleanup.policy', value: 'delete' }
    ]
  }
};

// Event Types
const EVENT_TYPES = {
  // Trip Events (Critical - Strong Ordering)
  TRIP: {
    REQUESTED: 'TRIP_REQUESTED',
    DRIVER_ASSIGNED: 'TRIP_DRIVER_ASSIGNED',
    ACCEPTED: 'TRIP_ACCEPTED',
    DRIVER_ARRIVING: 'TRIP_DRIVER_ARRIVING',
    DRIVER_ARRIVED: 'TRIP_DRIVER_ARRIVED',
    STARTED: 'TRIP_STARTED',
    COMPLETED: 'TRIP_COMPLETED',
    CANCELLED: 'TRIP_CANCELLED',
    RATING_SUBMITTED: 'TRIP_RATING_SUBMITTED'
  },

  // Location Events (High Volume - Eventual Consistency)
  LOCATION: {
    DRIVER_UPDATED: 'DRIVER_LOCATION_UPDATED',
    DRIVER_ONLINE: 'DRIVER_WENT_ONLINE',
    DRIVER_OFFLINE: 'DRIVER_WENT_OFFLINE'
  },

  // User Notification Events
  NOTIFICATION: {
    DRIVER_ASSIGNED: 'NOTIFICATION_DRIVER_ASSIGNED',
    DRIVER_ARRIVING: 'NOTIFICATION_DRIVER_ARRIVING',
    TRIP_STARTED: 'NOTIFICATION_TRIP_STARTED',
    TRIP_COMPLETED: 'NOTIFICATION_TRIP_COMPLETED',
    TRIP_CANCELLED: 'NOTIFICATION_TRIP_CANCELLED'
  }
};

// Event Schemas
const EVENT_SCHEMAS = {
  // Trip Event Schema
  TRIP_EVENT: {
    eventId: { type: 'string', required: true },
    eventType: { type: 'string', required: true },
    tripId: { type: 'string', required: true },
    userId: { type: 'string', required: true },
    driverId: { type: 'string', required: false },
    timestamp: { type: 'number', required: true },
    data: {
      pickup: {
        lat: { type: 'number', required: true },
        lng: { type: 'number', required: true },
        address: { type: 'string', required: false }
      },
      destination: {
        lat: { type: 'number', required: true },
        lng: { type: 'number', required: true },
        address: { type: 'string', required: false }
      },
      fare: { type: 'number', required: false },
      status: { type: 'string', required: true },
      metadata: { type: 'object', required: false }
    }
  },

  // Location Event Schema (High Performance)
  LOCATION_EVENT: {
    eventId: { type: 'string', required: true },
    eventType: { type: 'string', required: true },
    driverId: { type: 'string', required: true },
    timestamp: { type: 'number', required: true },
    location: {
      lat: { type: 'number', required: true },
      lng: { type: 'number', required: true },
      accuracy: { type: 'number', required: false },
      heading: { type: 'number', required: false },
      speed: { type: 'number', required: false }
    },
    status: { type: 'string', required: true }, // ONLINE, OFFLINE, BUSY
    tripId: { type: 'string', required: false } // If driver is on trip
  },

  // User Notification Schema
  NOTIFICATION_EVENT: {
    eventId: { type: 'string', required: true },
    eventType: { type: 'string', required: true },
    userId: { type: 'string', required: true },
    timestamp: { type: 'number', required: true },
    data: {
      title: { type: 'string', required: true },
      message: { type: 'string', required: true },
      tripId: { type: 'string', required: false },
      driverId: { type: 'string', required: false },
      priority: { type: 'string', required: false }, // HIGH, MEDIUM, LOW
      metadata: { type: 'object', required: false }
    }
  }
};

// Consumer Group Configurations
const CONSUMER_GROUPS = {
  TRIP_PROCESSOR: 'trip-processor-group',
  LOCATION_PROCESSOR: 'location-processor-group',
  NOTIFICATION_PROCESSOR: 'notification-processor-group',
  WEBSOCKET_BROADCASTER: 'websocket-broadcaster-group',
  ANALYTICS_PROCESSOR: 'analytics-processor-group'
};

// Message Creation Helpers
const createTripEvent = (eventType, tripData) => {
  return {
    eventId: `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    eventType,
    tripId: tripData.tripId,
    userId: tripData.userId,
    driverId: tripData.driverId || null,
    timestamp: Date.now(),
    data: tripData
  };
};

const createLocationEvent = (driverId, location, status, tripId = null) => {
  return {
    eventId: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    eventType: EVENT_TYPES.LOCATION.DRIVER_UPDATED,
    driverId,
    timestamp: Date.now(),
    location,
    status,
    tripId
  };
};

const createNotificationEvent = (eventType, userId, notificationData) => {
  return {
    eventId: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    eventType,
    userId,
    timestamp: Date.now(),
    data: notificationData
  };
};

// Partitioning Strategies for Load Testing
const getPartitionKey = (topic, event) => {
  switch (topic) {
    case TOPICS.TRIP_EVENTS.name:
      // Partition by tripId for ordering
      return event.tripId;

    case TOPICS.LOCATION_UPDATES.name:
      // Partition by driverId for even distribution
      return event.driverId;

    case TOPICS.USER_NOTIFICATIONS.name:
      // Partition by userId
      return event.userId;

    default:
      return Date.now().toString();
  }
};

module.exports = {
  TOPICS,
  EVENT_TYPES,
  EVENT_SCHEMAS,
  CONSUMER_GROUPS,
  createTripEvent,
  createLocationEvent,
  createNotificationEvent,
  getPartitionKey
};