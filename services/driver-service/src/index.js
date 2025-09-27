const express = require('express');
require('dotenv').config();

// Database connection
const dbConnection = require('./config/database');
const Driver = require('./models/Driver');

// Authentication middleware
const { authenticateServiceToken, optionalAuth } = require('../common/shared/authMiddleware');

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
        service: 'UIT-Go Driver Service',
        version: '1.0.0',
        description: 'Driver location and status management service',
        endpoints: {
            health: '/health',
            drivers: '/drivers',
            location: '/location',
            search: '/search'
        }
    });
});

// Health check endpoint
app.get('/health', async (req, res) => {
    const healthCheck = {
        service: 'driver-service',
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        dependencies: {
            mongodb: dbConnection.isConnected() ? 'connected' : 'disconnected',
            database: 'uitgo_drivers'
        },
        features: {
            geospatial: 'enabled',
            realtime: 'enabled'
        }
    };

    // Set status based on critical dependencies
    if (!dbConnection.isConnected()) {
        healthCheck.status = 'DEGRADED';
        res.status(503);
    } else {
        res.status(200);
    }

    res.json(healthCheck);
});

// TODO: Add routes
// Protected routes with authentication
app.get('/drivers',
    authenticateServiceToken,
    async (req, res) => {
        try {
            const drivers = await Driver.find().limit(10);
            res.json({
                message: 'Driver Service - Drivers endpoint',
                service: 'driver-service',
                database: 'uitgo_drivers',
                user: req.user,
                count: drivers.length,
                drivers: drivers
            });
        } catch (error) {
            console.error('Error fetching drivers:', error);
            res.status(500).json({
                error: 'Database error',
                message: 'Failed to fetch drivers'
            });
        }
    }
);

app.get('/location',
    authenticateServiceToken,
    (req, res) => {
        res.json({
            message: 'Driver Service - Location endpoint',
            service: 'driver-service',
            database: 'uitgo_drivers',
            user: req.user,
            endpoints: ['update', 'track', 'nearby']
        });
    }
);

// Public route for testing
app.get('/drivers/public', async (req, res) => {
    try {
        const count = await Driver.countDocuments();
        res.json({
            message: 'Driver Service - Public endpoint',
            service: 'driver-service',
            database: 'uitgo_drivers',
            totalDrivers: count
        });
    } catch (error) {
        console.error('Error fetching driver count:', error);
        res.status(500).json({
            error: 'Database error',
            message: 'Failed to fetch driver count'
        });
    }
});

// const driverRoutes = require('./routes/drivers');
// const locationRoutes = require('./routes/location');
// app.use('/drivers', driverRoutes);
// app.use('/location', locationRoutes);

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
        // Connect to MongoDB first
        await dbConnection.connect();

        // Start HTTP server
        app.listen(PORT, () => {
            console.log(`Driver Service running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`Health check available at: http://localhost:${PORT}/health`);
            console.log(`Database: uitgo_drivers`);
        });
    } catch (error) {
        console.error('Failed to start Driver Service:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Received SIGINT. Graceful shutdown...');
    await dbConnection.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM. Graceful shutdown...');
    await dbConnection.disconnect();
    process.exit(0);
});

startServer();

module.exports = app;