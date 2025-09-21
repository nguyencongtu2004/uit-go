const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Service URLs
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3000';
const DRIVER_SERVICE_URL = process.env.DRIVER_SERVICE_URL || 'http://driver-service:3000';
const TRIP_SERVICE_URL = process.env.TRIP_SERVICE_URL || 'http://trip-service:3000';

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
    max: process.env.RATE_LIMIT_MAX || 100
});
app.use(limiter);

// Health check endpoint
app.get('/health', async (req, res) => {
    const healthCheck = {
        service: 'api-gateway',
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        services: {
            userService: {
                url: USER_SERVICE_URL,
                status: 'unknown' // TODO: Add actual health check
            },
            driverService: {
                url: DRIVER_SERVICE_URL,
                status: 'unknown' // TODO: Add actual health check
            },
            tripService: {
                url: TRIP_SERVICE_URL,
                status: 'unknown' // TODO: Add actual health check
            }
        }
    };

    res.status(200).json(healthCheck);
});

// Basic API info endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'UIT-Go API Gateway',
        version: '1.0.0',
        description: 'API Gateway for UIT-Go microservices',
        routes: {
            users: '/api/users/*',
            drivers: '/api/drivers/*',
            trips: '/api/trips/*',
            auth: '/api/auth/*'
        },
        health: '/health'
    });
});

// Route proxying
app.use('/api/users', createProxyMiddleware({
    target: USER_SERVICE_URL,
    changeOrigin: true,
    timeout: 30000,
    onError: (err, req, res) => {
        console.error('Proxy error:', err.message);
        res.status(503).json({
            error: 'Service unavailable',
            message: 'Unable to reach the requested service'
        });
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log('Proxying request to:', proxyReq.path);
    }
}));

app.use('/api/auth', createProxyMiddleware({
    target: USER_SERVICE_URL,
    changeOrigin: true,
    timeout: 30000,
    onError: (err, req, res) => {
        console.error('Proxy error:', err.message);
        res.status(503).json({
            error: 'Service unavailable',
            message: 'Unable to reach the requested service'
        });
    }
}));

app.use('/api/drivers', createProxyMiddleware({
    target: DRIVER_SERVICE_URL,
    changeOrigin: true,
    timeout: 30000,
    onError: (err, req, res) => {
        console.error('Proxy error:', err.message);
        res.status(503).json({
            error: 'Service unavailable',
            message: 'Unable to reach the requested service'
        });
    }
}));

app.use('/api/location', createProxyMiddleware({
    target: DRIVER_SERVICE_URL,
    changeOrigin: true,
    timeout: 30000,
    onError: (err, req, res) => {
        console.error('Proxy error:', err.message);
        res.status(503).json({
            error: 'Service unavailable',
            message: 'Unable to reach the requested service'
        });
    }
}));

app.use('/api/trips', createProxyMiddleware({
    target: TRIP_SERVICE_URL,
    changeOrigin: true,
    timeout: 30000,
    onError: (err, req, res) => {
        console.error('Proxy error:', err.message);
        res.status(503).json({
            error: 'Service unavailable',
            message: 'Unable to reach the requested service'
        });
    }
}));

app.use('/api/booking', createProxyMiddleware({
    target: TRIP_SERVICE_URL,
    changeOrigin: true,
    timeout: 30000,
    onError: (err, req, res) => {
        console.error('Proxy error:', err.message);
        res.status(503).json({
            error: 'Service unavailable',
            message: 'Unable to reach the requested service'
        });
    }
}));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Gateway error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        availableRoutes: [
            '/health',
            '/api/users/*',
            '/api/auth/*',
            '/api/drivers/*',
            '/api/location/*',
            '/api/trips/*',
            '/api/booking/*'
        ]
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health check available at: http://localhost:${PORT}/health`);
    console.log('Proxying to:');
    console.log(`  User Service: ${USER_SERVICE_URL}`);
    console.log(`  Driver Service: ${DRIVER_SERVICE_URL}`);
    console.log(`  Trip Service: ${TRIP_SERVICE_URL}`);
});

module.exports = app;