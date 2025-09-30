/**
 * Trip Service Main Entry Point - Event-Driven Version
 * Integrates Kafka event producers and consumers for scalable architecture
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// Database connection
const dbConnection = require('./config/database');
const Trip = require('./models/Trip');

// Routes
const tripRoutes = require('./routes/trips');
const bookingRoutes = require('./routes/booking');
const driversRoutes = require('./routes/drivers');

// Event-Driven Services
const TripEventProducer = require('./services/tripEventProducer');
const TripEventConsumer = require('./services/tripEventConsumer');
const WebSocketNotificationConsumer = require('./services/webSocketNotificationConsumer');
const tripControllerEventDriven = require('./controllers/tripControllerEventDriven');

// Traditional Services (kept for backward compatibility)
const { notificationService } = require('./services/notificationService');
const tripStateService = require('./services/tripStateService');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO for real-time communication
const io = socketIo(server, {
    cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

const PORT = process.env.PORT || 3000;

// Global event producers and consumers
let tripEventProducer = null;
let tripEventConsumer = null;
let wsNotificationConsumer = null;

// Basic middleware (security handled by Traefik)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS configuration
const cors = require('cors');
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Handle user authentication for WebSocket
    socket.on('authenticate', (data) => {
        if (data.userId) {
            socket.join(`user_${data.userId}`);
            console.log(`User ${data.userId} joined room: user_${data.userId}`);
            socket.emit('authenticated', { success: true });
        }
    });

    // Handle driver authentication for WebSocket
    socket.on('authenticate_driver', (data) => {
        if (data.driverId) {
            socket.join(`driver_${data.driverId}`);
            console.log(`Driver ${data.driverId} joined room: driver_${data.driverId}`);
            socket.emit('authenticated', { success: true });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

// Basic API info endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'UIT-Go Trip Service (Event-Driven)',
        version: '2.0.0',
        description: 'Trip orchestration with Kafka event streaming and WebSocket real-time communication',
        architecture: 'Event-Driven Microservice',
        endpoints: {
            health: '/health',
            trips: '/trips',
            booking: '/booking',
            drivers: '/drivers',
            events: '/events/health'
        },
        eventTopics: ['trip-events', 'user-notifications'],
        realTime: {
            websocket: true,
            kafkaConsumers: true
        }
    });
});

// Health check endpoint with Kafka status
app.get('/health', async (req, res) => {
    try {
        const healthCheck = {
            service: 'trip-service',
            version: '2.0.0',
            timestamp: new Date().toISOString(),
            status: 'OK',
            dependencies: {
                mongodb: 'unknown',
                kafka: 'unknown',
                websocket: 'unknown'
            },
            eventProducers: {},
            eventConsumers: {},
            connectedClients: io.engine.clientsCount || 0
        };

        // Check MongoDB connection
        try {
            healthCheck.dependencies.mongodb = dbConnection.isConnected() ? 'connected' : 'disconnected';
        } catch (error) {
            healthCheck.dependencies.mongodb = 'error';
        }

        // Check Kafka event producer
        if (tripEventProducer) {
            try {
                healthCheck.eventProducers.tripEvents = await tripEventProducer.healthCheck();
            } catch (error) {
                healthCheck.eventProducers.tripEvents = { status: 'error', error: error.message };
            }
        } else {
            healthCheck.eventProducers.tripEvents = { status: 'not_initialized' };
        }

        // Check Kafka event consumers
        if (tripEventConsumer) {
            try {
                healthCheck.eventConsumers.tripEvents = await tripEventConsumer.healthCheck();
            } catch (error) {
                healthCheck.eventConsumers.tripEvents = { status: 'error', error: error.message };
            }
        } else {
            healthCheck.eventConsumers.tripEvents = { status: 'not_initialized' };
        }

        if (wsNotificationConsumer) {
            try {
                healthCheck.eventConsumers.notifications = await wsNotificationConsumer.healthCheck();
            } catch (error) {
                healthCheck.eventConsumers.notifications = { status: 'error', error: error.message };
            }
        } else {
            healthCheck.eventConsumers.notifications = { status: 'not_initialized' };
        }

        // Determine overall status
        const hasErrors = Object.values(healthCheck.dependencies).includes('error') ||
            Object.values(healthCheck.eventProducers).some(p => p.status === 'error') ||
            Object.values(healthCheck.eventConsumers).some(c => c.status === 'error');

        if (hasErrors) {
            healthCheck.status = 'DEGRADED';
            res.status(503);
        }

        healthCheck.dependencies.websocket = io.engine.clientsCount >= 0 ? 'connected' : 'disconnected';

        res.json(healthCheck);

    } catch (error) {
        console.error('Health check error:', error);
        res.status(503).json({
            service: 'trip-service',
            status: 'ERROR',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Event system health endpoint
app.get('/events/health', async (req, res) => {
    try {
        const eventHealth = {
            producers: {},
            consumers: {},
            websocket: {
                connected: io.engine.clientsCount || 0,
                rooms: Object.keys(io.sockets.adapter.rooms || {})
            }
        };

        if (tripEventProducer) {
            eventHealth.producers.tripEvents = await tripEventProducer.healthCheck();
        }

        if (tripEventConsumer) {
            eventHealth.consumers.tripEvents = await tripEventConsumer.healthCheck();
        }

        if (wsNotificationConsumer) {
            eventHealth.consumers.notifications = await wsNotificationConsumer.healthCheck();
        }

        res.json(eventHealth);

    } catch (error) {
        res.status(500).json({
            error: 'Event health check failed',
            message: error.message
        });
    }
});

// Routes
app.use('/trips', tripRoutes);
app.use('/booking', bookingRoutes);
app.use('/drivers', driversRoutes);

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
});

/**
 * Initialize Event-Driven Architecture
 */
async function initializeEventSystem() {
    try {
        console.log('Initializing Event-Driven Architecture...');

        // Initialize Trip Event Producer
        tripEventProducer = new TripEventProducer();
        await tripEventProducer.initialize();
        console.log('✅ Trip Event Producer initialized');

        // Initialize event producers in controller
        await tripControllerEventDriven.initializeEventProducers();
        console.log('✅ Controller Event Producers initialized');

        // Initialize Trip Event Consumer
        tripEventConsumer = new TripEventConsumer();
        await tripEventConsumer.start();
        console.log('✅ Trip Event Consumer started');

        // Initialize WebSocket Notification Consumer
        wsNotificationConsumer = new WebSocketNotificationConsumer(io);
        await wsNotificationConsumer.start();
        console.log('✅ WebSocket Notification Consumer started');

        console.log('🚀 Event-Driven Architecture initialized successfully!');

    } catch (error) {
        console.error('❌ Failed to initialize Event-Driven Architecture:', error);
        throw error;
    }
}

/**
 * Graceful shutdown
 */
async function gracefulShutdown() {
    console.log('Initiating graceful shutdown...');

    try {
        // Stop Kafka consumers first
        if (tripEventConsumer) {
            await tripEventConsumer.stop();
            console.log('Trip Event Consumer stopped');
        }

        if (wsNotificationConsumer) {
            await wsNotificationConsumer.stop();
            console.log('WebSocket Notification Consumer stopped');
        }

        // Stop Kafka producers
        if (tripEventProducer) {
            await tripEventProducer.shutdown();
            console.log('Trip Event Producer stopped');
        }

        // Close Socket.IO
        io.close();
        console.log('Socket.IO closed');

        // Close database connection
        await dbConnection.close();
        console.log('Database connection closed');

        // Close HTTP server
        server.close(() => {
            console.log('HTTP server closed');
            process.exit(0);
        });

    } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
}

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGUSR2', gracefulShutdown); // Nodemon restart

// Start server
async function startServer() {
    try {
        // Connect to database first
        await dbConnection.connect();
        console.log('✅ Database connected');

        // Initialize event system
        await initializeEventSystem();

        // Start HTTP server
        server.listen(PORT, () => {
            console.log(`🚀 Trip Service (Event-Driven) running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`🔄 Event health: http://localhost:${PORT}/events/health`);
            console.log(`🌐 WebSocket endpoint: ws://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();