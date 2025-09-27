const express = require('express');
require('dotenv').config();

// Database connection
const dbConnection = require('./config/database');
const Trip = require('./models/Trip');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware (security handled by Traefik)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
                redis: 'not configured',
                kafka: 'not configured',
                userService: 'not configured',
                driverService: 'not configured'
            },
            tripStates: [
                'searching',
                'accepted',
                'ongoing',
                'completed',
                'cancelled'
            ]
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

// TODO: Add routes
// Temporary test routes
app.get('/trips', (req, res) => {
    res.json({
        message: 'Trip Service - Trips endpoint',
        service: 'trip-service',
        trips: [
            { id: 1, passenger: 'User 1', driver: 'Driver 1', status: 'completed' },
            { id: 2, passenger: 'User 2', driver: 'Driver 2', status: 'ongoing' }
        ]
    });
});

app.get('/booking', (req, res) => {
    res.json({
        message: 'Trip Service - Booking endpoint',
        service: 'trip-service',
        endpoints: ['create', 'cancel', 'status']
    });
});
// const tripRoutes = require('./routes/trips');
// const bookingRoutes = require('./routes/booking');
// app.use('/trips', tripRoutes);
// app.use('/booking', bookingRoutes);

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

        // Start HTTP server
        const server = app.listen(PORT, () => {
            console.log(`Trip Service running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`Health check available at: http://localhost:${PORT}/health`);
        });

        // Graceful shutdown handling
        const gracefulShutdown = async (signal) => {
            console.log(`Received ${signal}. Starting graceful shutdown...`);

            server.close(async () => {
                console.log('HTTP server closed.');

                try {
                    await dbConnection.disconnect();
                    console.log('Database connection closed.');
                    process.exit(0);
                } catch (error) {
                    console.error('Error during database disconnection:', error);
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

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();

module.exports = app;