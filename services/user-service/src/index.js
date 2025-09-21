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
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX || 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Basic API info endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'UIT-Go User Service',
        version: '1.0.0',
        description: 'User management service for UIT-Go application',
        endpoints: {
            health: '/health',
            auth: '/api/auth',
            users: '/api/users'
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    const healthCheck = {
        service: 'user-service',
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        dependencies: {
            mongodb: 'connected', // TODO: Add actual MongoDB health check
            redis: 'connected',    // TODO: Add actual Redis health check
            kafka: 'connected'     // TODO: Add actual Kafka health check
        }
    };

    res.status(200).json(healthCheck);
});

// TODO: Add routes
// Temporary test route for users
app.get('/api/users', (req, res) => {
    res.json({
        message: 'User Service - Users endpoint',
        service: 'user-service',
        users: [
            { id: 1, name: 'Test User 1', type: 'passenger' },
            { id: 2, name: 'Test Driver 1', type: 'driver' }
        ]
    });
});

app.get('/api/auth', (req, res) => {
    res.json({
        message: 'User Service - Auth endpoint',
        service: 'user-service',
        endpoints: ['login', 'register', 'refresh']
    });
});
// const authRoutes = require('./routes/auth');
// const userRoutes = require('./routes/users');
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);

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
    console.log(`User Service running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health check available at: http://localhost:${PORT}/health`);
});

module.exports = app;