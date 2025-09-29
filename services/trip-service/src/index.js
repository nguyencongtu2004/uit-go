const express = require('express');
const http = require('http');
require('dotenv').config();

// Database connection
const dbConnection = require('./config/database');
const Trip = require('./models/Trip');

// Routes
const tripRoutes = require('./routes/trips');
const bookingRoutes = require('./routes/booking');
const driversRoutes = require('./routes/drivers');

// Services
const { notificationService } = require('./services/notificationService');
const tripStateService = require('./services/tripStateService');
const driverMatchingService = require('./services/driverMatchingService');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

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

// Basic API info endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'UIT-Go Trip Service',
        version: '1.0.0',
        description: 'Trip orchestration and state management service',
        endpoints: {
            health: '/health',
            trips: '/trips',
            booking: '/booking',
            status: '/status'
        }
    });
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Check MongoDB connection
        const mongoStatus = dbConnection.isConnected() ? 'connected' : 'disconnected';

        // Check Redis connections
        let redisStatus = 'not_configured';
        try {
            await tripStateService.initializeRedis();
            redisStatus = 'connected';
        } catch (error) {
            redisStatus = 'disconnected';
        }

        const healthCheck = {
            service: 'trip-service',
            status: mongoStatus === 'connected' ? 'OK' : 'DEGRADED',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            version: process.env.npm_package_version || '1.0.0',
            database: {
                name: 'uitgo_trips',
                status: mongoStatus,
                uri: process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/\/\/.*@/, '//***:***@') : 'not configured'
            },
            dependencies: {
                mongodb: mongoStatus,
                redis: redisStatus,
                userService: process.env.USER_SERVICE_URL || 'http://user-service:3000',
                driverService: process.env.DRIVER_SERVICE_URL || 'http://driver-service:3000'
            },
            features: {
                realTimeNotifications: !!process.env.ENABLE_WEBSOCKET,
                driverMatching: true,
                fareCalculation: true,
                stateManagement: true
            },
            tripStates: Object.values(tripStateService.TRIP_STATES),
            connectedUsers: notificationService.getConnectedUsersCount()
        };

        const statusCode = mongoStatus === 'connected' ? 200 : 503;
        res.status(statusCode).json(healthCheck);
    } catch (error) {
        console.error('Health check error:', error);
        res.status(503).json({
            service: 'trip-service',
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Routes
app.use('/trips', tripRoutes);
app.use('/booking', bookingRoutes);
app.use('/drivers', driversRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
    });
});

// Start server with database connection
async function startServer() {
    try {
        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        await dbConnection.connect();
        console.log('Connected to uitgo_trips database');

        // Initialize services
        console.log('Initializing services...');

        // Initialize Redis for state management and driver matching
        await tripStateService.initializeRedis();
        await driverMatchingService.initializeRedis();

        // Initialize notification service with Redis and WebSocket
        await notificationService.initializeRedis();

        // Initialize Socket.IO for real-time notifications
        if (process.env.ENABLE_WEBSOCKET !== 'false') {
            notificationService.initializeSocketIO(server);
            console.log('WebSocket server initialized');
        }

        console.log('All services initialized successfully');

        // Start HTTP server
        const httpServer = server.listen(PORT, () => {
            console.log(`Trip Service running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`Health check available at: http://localhost:${PORT}/health`);
            console.log(`WebSocket available at: ws://localhost:${PORT}`);

            // Log available endpoints
            console.log('\nAvailable endpoints:');
            console.log('  GET  /health - Health check');
            console.log('  GET  /trips - Get trip history');
            console.log('  POST /trips - Create new trip');
            console.log('  GET  /trips/:id - Get trip details');
            console.log('  PATCH /trips/:id/accept - Accept trip (driver)');
            console.log('  PATCH /trips/:id/status - Update trip status');
            console.log('  DELETE /trips/:id - Cancel trip');
            console.log('  POST /booking/estimate - Get fare estimate');
            console.log('  GET  /booking/availability - Check driver availability');
            console.log('  GET  /booking/active - Get active bookings');
        });

        // Graceful shutdown handling
        const gracefulShutdown = async (signal) => {
            console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

            httpServer.close(async () => {
                console.log('HTTP server closed.');

                try {
                    // Clean up services
                    await notificationService.cleanup();
                    await tripStateService.cleanup();
                    await driverMatchingService.cleanup();
                    console.log('Services cleaned up.');

                    // Close database connection
                    await dbConnection.disconnect();
                    console.log('Database connection closed.');

                    console.log('Graceful shutdown completed.');
                    process.exit(0);
                } catch (error) {
                    console.error('Error during graceful shutdown:', error);
                    process.exit(1);
                }
            });

            // Force close after 30 seconds
            setTimeout(() => {
                console.error('Could not close connections in time, forcefully shutting down');
                process.exit(1);
            }, 30000);
        };

        // Listen for termination signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            gracefulShutdown('UNCAUGHT_EXCEPTION');
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            gracefulShutdown('UNHANDLED_REJECTION');
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();

module.exports = app;