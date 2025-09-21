const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Rate limiting
const limiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
    max: process.env.RATE_LIMIT_MAX || 100
});
app.use(limiter);

// Basic API info endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'UIT-Go Driver Service',
        version: '1.0.0',
        description: 'Driver location and status management service',
        endpoints: {
            health: '/health',
            drivers: '/api/drivers',
            location: '/api/location',
            search: '/api/search'
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    const healthCheck = {
        service: 'driver-service',
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        dependencies: {
            mongodb: 'connected', // TODO: Add actual MongoDB health check
            redis: 'connected',    // TODO: Add actual Redis health check
            kafka: 'connected'     // TODO: Add actual Kafka health check
        },
        features: {
            geospatial: 'enabled',
            realtime: 'enabled'
        }
    };

    res.status(200).json(healthCheck);
});

// TODO: Add routes
// Temporary test routes
app.get('/api/drivers', (req, res) => {
    res.json({
        message: 'Driver Service - Drivers endpoint',
        service: 'driver-service',
        drivers: [
            { id: 1, name: 'Driver 1', status: 'online', lat: 10.762622, lng: 106.660172 },
            { id: 2, name: 'Driver 2', status: 'offline', lat: 10.776889, lng: 106.695244 }
        ]
    });
});

app.get('/api/location', (req, res) => {
    res.json({
        message: 'Driver Service - Location endpoint',
        service: 'driver-service',
        endpoints: ['update', 'track', 'nearby']
    });
});
// const driverRoutes = require('./routes/drivers');
// const locationRoutes = require('./routes/location');
// app.use('/api/drivers', driverRoutes);
// app.use('/api/location', locationRoutes);

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

// Start server
app.listen(PORT, () => {
    console.log(`Driver Service running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health check available at: http://localhost:${PORT}/health`);
});

module.exports = app;