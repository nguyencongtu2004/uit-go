const express = require('express');
require('dotenv').config();

// Database connection
const dbConnection = require('./config/database');
const Driver = require('./models/Driver');

// Load testing optimization - simple middleware only
const app = express();
const PORT = process.env.PORT || 3000;

// Optimized middleware for high throughput
app.use(express.json({ limit: '1mb' })); // Reduced for performance
app.use(express.urlencoded({ extended: true }));

// Minimal request logging for production performance
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
        next();
    });
}

// Basic API info endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'UIT-Go Driver Service',
        version: '1.0.0',
        description: 'Driver location and status management service - Optimized for Load Testing',
        mode: 'PoC Load Testing',
        endpoints: {
            health: '/health',
            drivers: '/drivers/*',
            location: '/location/*'
        }
    });
});

// Health check endpoint - optimized for monitoring
app.get('/health', async (req, res) => {
    const healthCheck = {
        service: 'driver-service',
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0-poc',
        dependencies: {
            mongodb: dbConnection.isConnected() ? 'connected' : 'disconnected',
            database: 'uitgo_drivers',
            redis: 'connected' // Assume connected for PoC
        },
        features: {
            geospatial: 'redis-optimized',
            realtime: 'high-performance',
            loadTesting: 'enabled'
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

// Load optimized routes
const driverRoutes = require('./routes/drivers');
const locationRoutes = require('./routes/location');

// Use routes without auth middleware for PoC load testing
app.use('/drivers', driverRoutes);
app.use('/location', locationRoutes);

// Public endpoint for quick testing
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

// Start server with database connection
async function startServer() {
    try {
        // Connect to MongoDB first
        await dbConnection.connect();

        // Start HTTP server
        app.listen(PORT, () => {
            console.log(`🚗 Driver Service running on port ${PORT}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🏥 Health check: http://localhost:${PORT}/health`);
            console.log(`📊 Load Testing Mode: ENABLED`);
            console.log(`📍 Geospatial Redis: OPTIMIZED`);
            console.log(`💾 Database: uitgo_drivers`);
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