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
        service: 'UIT-Go Trip Service',
        version: '1.0.0',
        description: 'Trip orchestration and state management service',
        endpoints: {
            health: '/health',
            trips: '/api/trips',
            booking: '/api/booking',
            status: '/api/status'
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    const healthCheck = {
        service: 'trip-service',
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        dependencies: {
            mongodb: 'connected', // TODO: Add actual MongoDB health check
            redis: 'connected',    // TODO: Add actual Redis health check
            kafka: 'connected',    // TODO: Add actual Kafka health check
            userService: 'connected',   // TODO: Add actual service health check
            driverService: 'connected'  // TODO: Add actual service health check
        },
        tripStates: [
            'searching',
            'accepted',
            'ongoing',
            'completed',
            'cancelled'
        ]
    };

    res.status(200).json(healthCheck);
});

// TODO: Add routes
// Temporary test routes
app.get('/api/trips', (req, res) => {
    res.json({
        message: 'Trip Service - Trips endpoint',
        service: 'trip-service',
        trips: [
            { id: 1, passenger: 'User 1', driver: 'Driver 1', status: 'completed' },
            { id: 2, passenger: 'User 2', driver: 'Driver 2', status: 'ongoing' }
        ]
    });
});

app.get('/api/booking', (req, res) => {
    res.json({
        message: 'Trip Service - Booking endpoint',
        service: 'trip-service',
        endpoints: ['create', 'cancel', 'status']
    });
});
// const tripRoutes = require('./routes/trips');
// const bookingRoutes = require('./routes/booking');
// app.use('/api/trips', tripRoutes);
// app.use('/api/booking', bookingRoutes);

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
    console.log(`Trip Service running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health check available at: http://localhost:${PORT}/health`);
});

module.exports = app;