/**
 * Notification Service
 * Handles real-time notifications for trips using Redis Pub/Sub
 * Manages WebSocket connections and message broadcasting
 */

const Redis = require('redis');
const { Server } = require('socket.io');

// Notification types
const NOTIFICATION_TYPES = {
    TRIP_CREATED: 'trip_created',
    TRIP_ACCEPTED: 'trip_accepted',
    TRIP_CANCELLED: 'trip_cancelled',
    DRIVER_ARRIVING: 'driver_arriving',
    DRIVER_ARRIVED: 'driver_arrived',
    TRIP_STARTED: 'trip_started',
    TRIP_COMPLETED: 'trip_completed',
    DRIVER_LOCATION_UPDATE: 'driver_location_update',
    TIMEOUT_WARNING: 'timeout_warning',
    NEW_TRIP_REQUEST: 'new_trip_request'
};

// User types for targeted notifications
const USER_TYPES = {
    PASSENGER: 'PASSENGER',
    DRIVER: 'DRIVER',
    BOTH: 'BOTH'
};

// Redis keys for connection management
const CONNECTED_USERS_KEY = 'notification:connected_users';
const TRIP_SUBSCRIPTIONS_PREFIX = 'notification:trip_subscriptions:';
const USER_CONNECTIONS_PREFIX = 'notification:user_connection:';

class NotificationService {
    constructor() {
        this.redisClient = null;
        this.redisSubscriber = null;
        this.io = null;
        // Keep local socket references for direct communication
        this.localSockets = new Map(); // socketId -> socket
    }

    /**
     * Initialize Redis clients for pub/sub
     */
    async initializeRedis() {
        try {
            const redisConfig = {
                socket: {
                    host: process.env.REDIS_HOST || 'redis',
                    port: parseInt(process.env.REDIS_PORT) || 6379,
                },
                password: process.env.REDIS_PASSWORD,
                database: parseInt(process.env.REDIS_DB) || 2
            };

            // Publisher client
            this.redisClient = Redis.createClient(redisConfig);
            await this.redisClient.connect();

            // Subscriber client (separate connection for pub/sub)
            this.redisSubscriber = Redis.createClient(redisConfig);
            await this.redisSubscriber.connect();

            // Set up Redis event listeners
            this.redisSubscriber.on('error', (err) => {
                console.error('Notification Redis subscriber error:', err);
            });

            this.redisClient.on('error', (err) => {
                console.error('Notification Redis client error:', err);
            });

            console.log('Notification Service connected to Redis');

            // Subscribe to trip events
            await this.setupRedisSubscriptions();

        } catch (error) {
            console.error('Failed to initialize Redis for notifications:', error);
            throw error;
        }
    }

    /**
     * Initialize Socket.IO server
     * @param {object} httpServer - HTTP server instance
     */
    initializeSocketIO(httpServer) {
        this.io = new Server(httpServer, {
            cors: {
                origin: process.env.WEBSOCKET_CORS_ORIGIN || "http://localhost:3000",
                methods: ["GET", "POST"],
                credentials: true
            },
            transports: ['websocket', 'polling']
        });

        this.setupSocketHandlers();
        console.log('Socket.IO server initialized for notifications');
    }

    /**
     * Set up Socket.IO event handlers
     */
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`Socket connected: ${socket.id}`);

            // Handle user authentication and registration
            socket.on('authenticate', async (data) => {
                try {
                    const { userId, userRole, token } = data;

                    // Verify token (simplified for PoC)
                    if (!userId || !userRole || !token) {
                        socket.emit('auth_error', { message: 'Invalid authentication data' });
                        return;
                    }

                    // TODO: Verify JWT token with User Service in production
                    // For PoC, we'll accept valid-looking data

                    // Check if user already connected (disconnect old connection)
                    const existingConnection = await this.getUserConnection(userId);
                    if (existingConnection && this.localSockets.has(existingConnection.socketId)) {
                        const oldSocket = this.localSockets.get(existingConnection.socketId);
                        if (oldSocket && oldSocket.connected) {
                            console.log(`User ${userId} already connected, disconnecting old connection`);
                            oldSocket.emit('connection_replaced', {
                                message: 'New connection established from another device'
                            });
                            oldSocket.disconnect();
                        }
                    }

                    // Store user connection in Redis
                    const connectionInfo = {
                        userId,
                        socketId: socket.id,
                        role: userRole,
                        token: token,
                        connectedAt: new Date().toISOString(),
                        lastActivity: new Date().toISOString(),
                        isAuthenticated: true,
                        processId: process.pid
                    };

                    await this.storeUserConnection(userId, connectionInfo);

                    // Store local socket reference
                    this.localSockets.set(socket.id, socket);

                    // Join user-specific room
                    socket.join(`user:${userId}`);
                    socket.join(`role:${userRole.toLowerCase()}`);

                    socket.userId = userId;
                    socket.userRole = userRole;
                    socket.isAuthenticated = true;

                    socket.emit('authenticated', {
                        success: true,
                        userId,
                        role: userRole,
                        socketId: socket.id,
                        serverTime: new Date().toISOString(),
                        features: {
                            realTimeNotifications: true,
                            locationUpdates: userRole === 'DRIVER',
                            tripSubscriptions: true
                        }
                    });

                    console.log(`✅ User ${userId} (${userRole}) authenticated on socket ${socket.id}`);

                    // Auto-subscribe drivers to driver-specific events
                    if (userRole === 'DRIVER') {
                        socket.join('drivers:available');
                        console.log(`Driver ${userId} joined available drivers room`);
                    }

                    // Auto-subscribe to user's active trips
                    await this.subscribeToActiveTrips(userId, userRole, socket);

                } catch (error) {
                    console.error('Socket authentication error:', error);
                    socket.emit('auth_error', { message: 'Authentication failed' });
                }
            });

            // Handle trip subscription
            socket.on('subscribe_trip', async (data) => {
                const { tripId } = data;

                if (!socket.userId || !tripId) {
                    socket.emit('subscription_error', { message: 'Invalid subscription data' });
                    return;
                }

                // Join trip-specific room
                socket.join(`trip:${tripId}`);

                // Store subscription in Redis
                await this.addTripSubscription(tripId, socket.userId);

                socket.emit('trip_subscribed', { tripId, timestamp: new Date().toISOString() });
                console.log(`User ${socket.userId} subscribed to trip ${tripId}`);
            });

            // Handle trip unsubscription
            socket.on('unsubscribe_trip', async (data) => {
                const { tripId } = data;

                if (tripId) {
                    socket.leave(`trip:${tripId}`);

                    // Remove subscription from Redis
                    await this.removeTripSubscription(tripId, socket.userId);

                    socket.emit('trip_unsubscribed', { tripId });
                    console.log(`User ${socket.userId} unsubscribed from trip ${tripId}`);
                }
            });

            // Handle driver status updates
            socket.on('driver_status_update', async (data) => {
                if (socket.userRole !== 'DRIVER') {
                    socket.emit('error', { message: 'Only drivers can update status' });
                    return;
                }

                const { status } = data; // 'ONLINE', 'OFFLINE', 'BUSY'

                if (status === 'ONLINE') {
                    // Driver going online - join available drivers
                    socket.join('drivers:available');
                    console.log(`Driver ${socket.userId} went online`);
                } else if (status === 'OFFLINE') {
                    // Driver going offline - leave available drivers
                    socket.leave('drivers:available');
                    console.log(`Driver ${socket.userId} went offline`);
                }

                // Broadcast status change (could be used for admin dashboards)
                socket.to('role:admin').emit('driver_status_changed', {
                    driverId: socket.userId,
                    status: status,
                    timestamp: new Date().toISOString()
                });
            });

            // Handle passenger trip creation
            socket.on('trip_created', async (data) => {
                if (socket.userRole !== 'PASSENGER') return;

                const { tripId } = data;
                if (tripId) {
                    socket.join(`trip:${tripId}`);
                    console.log(`Passenger ${socket.userId} subscribed to trip ${tripId}`);
                }
            });

            // Handle location updates (for drivers)
            socket.on('location_update', async (data) => {
                if (socket.userRole === 'DRIVER') {
                    await this.handleDriverLocationUpdate(socket.userId, data);
                }
            });

            // Handle ping for keepalive
            socket.on('ping', async () => {
                if (socket.userId) {
                    await this.updateUserActivity(socket.userId);
                }
                socket.emit('pong', { timestamp: new Date().toISOString() });
            });

            // Handle disconnection
            socket.on('disconnect', async (reason) => {
                console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);

                if (socket.userId) {
                    // Remove user connection from Redis
                    await this.removeUserConnection(socket.userId);

                    // Clean up trip subscriptions for this user
                    await this.cleanupUserSubscriptions(socket.userId);

                    console.log(`User ${socket.userId} disconnected`);
                }

                // Remove from local sockets
                this.localSockets.delete(socket.id);
            });

            // Handle errors
            socket.on('error', (error) => {
                console.error(`Socket error for ${socket.id}:`, error);
            });
        });
    }

    /**
     * Set up Redis subscriptions for trip events
     */
    async setupRedisSubscriptions() {
        // Subscribe to general trip events
        await this.redisSubscriber.subscribe('trip:events', (message) => {
            this.handleTripEvent(JSON.parse(message));
        });

        // Subscribe to driver location updates
        await this.redisSubscriber.subscribe('driver:location:updates', (message) => {
            this.handleDriverLocationEvent(JSON.parse(message));
        });

        console.log('Redis subscriptions set up for notifications');
    }

    /**
     * Auto-subscribe user to their active trips
     * @param {string} userId 
     * @param {string} userRole 
     * @param {object} socket 
     */
    async subscribeToActiveTrips(userId, userRole, socket) {
        try {
            const Trip = require('../models/Trip');
            const tripStateService = require('./tripStateService');

            // Find user's active trips
            let query;
            const activeStates = [
                tripStateService.TRIP_STATES.REQUESTED,
                tripStateService.TRIP_STATES.SEARCHING,
                tripStateService.TRIP_STATES.ACCEPTED,
                tripStateService.TRIP_STATES.DRIVER_ARRIVING,
                tripStateService.TRIP_STATES.PICKED_UP,
                tripStateService.TRIP_STATES.IN_PROGRESS
            ];

            if (userRole === 'PASSENGER') {
                query = {
                    passengerId: userId,
                    status: { $in: activeStates }
                };
            } else if (userRole === 'DRIVER') {
                query = {
                    driverId: userId,
                    status: { $in: activeStates }
                };
            }

            if (query) {
                const activeTrips = await Trip.find(query).limit(5);

                for (const trip of activeTrips) {
                    const tripId = trip._id.toString();
                    socket.join(`trip:${tripId}`);

                    // Store subscription in Redis
                    await this.addTripSubscription(tripId, userId);
                }

                if (activeTrips.length > 0) {
                    console.log(`✅ Auto-subscribed ${userRole} ${userId} to ${activeTrips.length} active trips`);

                    // Notify client about active subscriptions
                    socket.emit('active_trips_subscribed', {
                        count: activeTrips.length,
                        tripIds: activeTrips.map(trip => trip._id.toString()),
                        message: `Subscribed to ${activeTrips.length} active trips`
                    });
                }
            }

        } catch (error) {
            console.error('Error subscribing to active trips:', error);
        }
    }

    /**
     * Handle trip event from Redis
     * @param {object} eventData 
     */
    async handleTripEvent(eventData) {
        try {
            const { tripId, newState, previousState, context } = eventData;

            let notificationType;
            let message;
            let targetUsers = USER_TYPES.BOTH;

            // Determine notification type and message
            switch (newState) {
                case 'ACCEPTED':
                    notificationType = NOTIFICATION_TYPES.TRIP_ACCEPTED;
                    message = 'Your trip has been accepted by a driver!';
                    targetUsers = USER_TYPES.PASSENGER;
                    break;

                case 'DRIVER_ARRIVING':
                    notificationType = NOTIFICATION_TYPES.DRIVER_ARRIVING;
                    message = 'Your driver is on the way!';
                    targetUsers = USER_TYPES.PASSENGER;
                    break;

                case 'PICKED_UP':
                    notificationType = NOTIFICATION_TYPES.DRIVER_ARRIVED;
                    message = 'Driver has arrived at pickup location';
                    targetUsers = USER_TYPES.PASSENGER;
                    break;

                case 'IN_PROGRESS':
                    notificationType = NOTIFICATION_TYPES.TRIP_STARTED;
                    message = 'Your trip has started';
                    targetUsers = USER_TYPES.BOTH;
                    break;

                case 'COMPLETED':
                    notificationType = NOTIFICATION_TYPES.TRIP_COMPLETED;
                    message = 'Trip completed successfully';
                    targetUsers = USER_TYPES.BOTH;
                    break;

                case 'CANCELLED':
                    notificationType = NOTIFICATION_TYPES.TRIP_CANCELLED;
                    message = 'Trip has been cancelled';
                    targetUsers = USER_TYPES.BOTH;
                    break;

                default:
                    return; // Don't send notification for other states
            }

            // Send notification to trip subscribers
            await this.notifyTripParticipants(tripId, {
                type: notificationType,
                tripId,
                message,
                data: eventData,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error handling trip event:', error);
        }
    }

    /**
     * Handle driver location event from Redis
     * @param {object} locationData 
     */
    async handleDriverLocationEvent(locationData) {
        try {
            const { driverId, location, tripId } = locationData;

            if (tripId) {
                // Send location update to trip subscribers
                this.io.to(`trip:${tripId}`).emit('driver_location_update', {
                    type: NOTIFICATION_TYPES.DRIVER_LOCATION_UPDATE,
                    driverId,
                    location,
                    tripId,
                    timestamp: new Date().toISOString()
                });
            }

        } catch (error) {
            console.error('Error handling driver location event:', error);
        }
    }

    /**
     * Handle driver location update from WebSocket
     * @param {string} driverId 
     * @param {object} locationData 
     */
    async handleDriverLocationUpdate(driverId, locationData) {
        try {
            const { latitude, longitude, tripId } = locationData;

            // Publish to Redis for other services
            await this.publishDriverLocation(driverId, {
                latitude,
                longitude,
                tripId,
                timestamp: new Date().toISOString()
            });

            // Broadcast to trip subscribers if tripId is provided
            if (tripId) {
                this.io.to(`trip:${tripId}`).emit('driver_location_update', {
                    type: NOTIFICATION_TYPES.DRIVER_LOCATION_UPDATE,
                    driverId,
                    location: { latitude, longitude },
                    tripId,
                    timestamp: new Date().toISOString()
                });
            }

        } catch (error) {
            console.error('Error handling driver location update:', error);
        }
    }

    /**
     * Send notification to specific user
     * @param {string} userId 
     * @param {object} notification 
     */
    async notifyUser(userId, notification) {
        try {
            // Send via WebSocket if user is connected
            this.io.to(`user:${userId}`).emit('notification', notification);

            // Also publish to Redis for persistence/other services
            await this.publishNotification(`user:${userId}`, notification);

            console.log(`Notification sent to user ${userId}:`, notification.type);

        } catch (error) {
            console.error(`Error sending notification to user ${userId}:`, error);
        }
    }

    /**
     * Send notification to multiple users
     * @param {Array<string>} userIds 
     * @param {object} notification 
     */
    async notifyUsers(userIds, notification) {
        try {
            const promises = userIds.map(userId => this.notifyUser(userId, notification));
            await Promise.allSettled(promises);

        } catch (error) {
            console.error('Error sending bulk notifications:', error);
        }
    }

    /**
     * Send notification to all trip participants
     * @param {string} tripId 
     * @param {object} notification 
     */
    async notifyTripParticipants(tripId, notification) {
        try {
            // Send to trip room (all subscribers)
            this.io.to(`trip:${tripId}`).emit('trip_notification', notification);

            // Also publish to Redis
            await this.publishNotification(`trip:${tripId}`, notification);

            console.log(`Trip notification sent for ${tripId}:`, notification.type);

        } catch (error) {
            console.error(`Error sending trip notification for ${tripId}:`, error);
        }
    }

    /**
     * Notify drivers about new trip request
     * @param {Array<string>} driverIds 
     * @param {object} tripRequest 
     */
    async notifyDriversAboutTripRequest(driverIds, tripRequest) {
        try {
            const notification = {
                type: NOTIFICATION_TYPES.NEW_TRIP_REQUEST,
                tripId: tripRequest.tripId,
                pickup: tripRequest.origin,
                destination: tripRequest.destination,
                estimatedFare: tripRequest.estimatedFare,
                distance: tripRequest.distance,
                timeout: 15, // seconds
                message: 'New trip request available',
                timestamp: new Date().toISOString()
            };

            // Send to each driver
            console.log(`Sending trip request to drivers:`, driverIds);
            for (const driverId of driverIds) {
                const room = `user:${driverId}`;
                const connectedSockets = this.io.sockets.adapter.rooms.get(room);
                console.log(`Room ${room} has ${connectedSockets?.size || 0} connected sockets`);

                this.io.to(room).emit('trip_request', notification);
                console.log(`Sent trip_request to room: ${room}`);
            }

            console.log(`Trip request sent to ${driverIds.length} drivers`);

        } catch (error) {
            console.error('Error notifying drivers about trip request:', error);
        }
    }

    /**
     * Send timeout warning
     * @param {string} tripId 
     * @param {number} remainingSeconds 
     */
    async sendTimeoutWarning(tripId, remainingSeconds) {
        try {
            const notification = {
                type: NOTIFICATION_TYPES.TIMEOUT_WARNING,
                tripId,
                remainingSeconds,
                message: `Trip will timeout in ${remainingSeconds} seconds`,
                timestamp: new Date().toISOString()
            };

            await this.notifyTripParticipants(tripId, notification);

        } catch (error) {
            console.error('Error sending timeout warning:', error);
        }
    }

    /**
     * Publish notification to Redis
     * @param {string} channel 
     * @param {object} notification 
     */
    async publishNotification(channel, notification) {
        try {
            await this.redisClient.publish(channel, JSON.stringify(notification));
        } catch (error) {
            console.error('Error publishing notification to Redis:', error);
        }
    }

    /**
     * Publish driver location to Redis
     * @param {string} driverId 
     * @param {object} locationData 
     */
    async publishDriverLocation(driverId, locationData) {
        try {
            await this.redisClient.publish('driver:location:updates', JSON.stringify({
                driverId,
                ...locationData
            }));
        } catch (error) {
            console.error('Error publishing driver location:', error);
        }
    }

    // =================== Redis Helper Methods ===================

    /**
     * Store user connection info in Redis
     * @param {string} userId 
     * @param {object} connectionInfo 
     */
    async storeUserConnection(userId, connectionInfo) {
        try {
            const connectionKey = `${USER_CONNECTIONS_PREFIX}${userId}`;

            // Store connection with TTL (auto-expire if not refreshed)
            await this.redisClient.setEx(
                connectionKey,
                3600, // 1 hour TTL
                JSON.stringify(connectionInfo)
            );

            // Add to connected users set for quick lookup
            await this.redisClient.sAdd(CONNECTED_USERS_KEY, userId);

        } catch (error) {
            console.error('Error storing user connection:', error);
        }
    }

    /**
     * Get user connection info from Redis
     * @param {string} userId 
     * @returns {Promise<object|null>} Connection info
     */
    async getUserConnection(userId) {
        try {
            const connectionKey = `${USER_CONNECTIONS_PREFIX}${userId}`;
            const connectionData = await this.redisClient.get(connectionKey);

            return connectionData ? JSON.parse(connectionData) : null;
        } catch (error) {
            console.error('Error getting user connection:', error);
            return null;
        }
    }

    /**
     * Remove user connection from Redis
     * @param {string} userId 
     */
    async removeUserConnection(userId) {
        try {
            const connectionKey = `${USER_CONNECTIONS_PREFIX}${userId}`;

            await Promise.all([
                this.redisClient.del(connectionKey),
                this.redisClient.sRem(CONNECTED_USERS_KEY, userId)
            ]);

        } catch (error) {
            console.error('Error removing user connection:', error);
        }
    }

    /**
     * Update user activity timestamp
     * @param {string} userId 
     */
    async updateUserActivity(userId) {
        try {
            const connectionInfo = await this.getUserConnection(userId);
            if (connectionInfo) {
                connectionInfo.lastActivity = new Date().toISOString();
                await this.storeUserConnection(userId, connectionInfo);
            }
        } catch (error) {
            console.error('Error updating user activity:', error);
        }
    }

    /**
     * Add trip subscription in Redis
     * @param {string} tripId 
     * @param {string} userId 
     */
    async addTripSubscription(tripId, userId) {
        try {
            const subscriptionKey = `${TRIP_SUBSCRIPTIONS_PREFIX}${tripId}`;
            await this.redisClient.sAdd(subscriptionKey, userId);

            // Set TTL for trip subscription (auto-cleanup after 24 hours)
            await this.redisClient.expire(subscriptionKey, 86400); // 24 hours

        } catch (error) {
            console.error('Error adding trip subscription:', error);
        }
    }

    /**
     * Remove trip subscription from Redis
     * @param {string} tripId 
     * @param {string} userId 
     */
    async removeTripSubscription(tripId, userId) {
        try {
            const subscriptionKey = `${TRIP_SUBSCRIPTIONS_PREFIX}${tripId}`;
            await this.redisClient.sRem(subscriptionKey, userId);

        } catch (error) {
            console.error('Error removing trip subscription:', error);
        }
    }

    /**
     * Get trip subscribers from Redis
     * @param {string} tripId 
     * @returns {Promise<Array>} List of subscriber user IDs
     */
    async getTripSubscribers(tripId) {
        try {
            const subscriptionKey = `${TRIP_SUBSCRIPTIONS_PREFIX}${tripId}`;
            return await this.redisClient.sMembers(subscriptionKey);

        } catch (error) {
            console.error('Error getting trip subscribers:', error);
            return [];
        }
    }

    /**
     * Clean up all subscriptions for a user
     * @param {string} userId 
     */
    async cleanupUserSubscriptions(userId) {
        try {
            // Find all trip subscriptions for this user
            const pattern = `${TRIP_SUBSCRIPTIONS_PREFIX}*`;
            const keys = await this.redisClient.keys(pattern);

            const pipeline = this.redisClient.multi();
            for (const key of keys) {
                pipeline.sRem(key, userId);
            }
            await pipeline.exec();

        } catch (error) {
            console.error('Error cleaning up user subscriptions:', error);
        }
    }

    /**
     * Get connected users count from Redis
     */
    async getConnectedUsersCount() {
        try {
            const connectedUserIds = await this.redisClient.sMembers(CONNECTED_USERS_KEY);
            const userConnections = await Promise.all(
                connectedUserIds.map(userId => this.getUserConnection(userId))
            );

            // Filter out null connections and count by role
            const validConnections = userConnections.filter(conn => conn !== null);

            return {
                total: validConnections.length,
                passengers: validConnections.filter(user => user.role === USER_TYPES.PASSENGER).length,
                drivers: validConnections.filter(user => user.role === USER_TYPES.DRIVER).length
            };
        } catch (error) {
            console.error('Error getting connected users count:', error);
            return { total: 0, passengers: 0, drivers: 0 };
        }
    }

    /**
     * Get trip subscription count from Redis
     */
    async getTripSubscriptionsCount() {
        try {
            const pattern = `${TRIP_SUBSCRIPTIONS_PREFIX}*`;
            const keys = await this.redisClient.keys(pattern);
            return keys.length;
        } catch (error) {
            console.error('Error getting trip subscriptions count:', error);
            return 0;
        }
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        try {
            // Close Socket.IO
            if (this.io) {
                this.io.close();
            }

            // Close Redis connections
            if (this.redisClient && this.redisClient.isOpen) {
                await this.redisClient.quit();
            }

            if (this.redisSubscriber && this.redisSubscriber.isOpen) {
                await this.redisSubscriber.quit();
            }

            // Clear local socket map
            this.localSockets.clear();

            console.log('Notification Service cleaned up');

        } catch (error) {
            console.error('Error cleaning up Notification Service:', error);
        }
    }
}

// Create singleton instance
const notificationService = new NotificationService();

module.exports = {
    notificationService,
    NotificationService,
    NOTIFICATION_TYPES,
    USER_TYPES
};