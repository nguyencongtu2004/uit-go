const express = require('express');
require('dotenv').config();

// Database connection
const dbConnection = require('./config/database');
const User = require('./models/User');

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
        service: 'UIT-Go User Service',
        version: '1.0.0',
        description: 'User management service for UIT-Go application',
        endpoints: {
            health: '/health',
            auth: '/auth',
            users: '/users'
        }
    });
});

// Health check endpoint
app.get('/health', async (req, res) => {
    const healthCheck = {
        service: 'user-service',
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        dependencies: {
            mongodb: dbConnection.isConnected() ? 'connected' : 'disconnected',
            database: 'uitgo_users'
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

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const testRoutes = require('./routes/test');

// Apply routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);

// Test routes (development only)
if (process.env.NODE_ENV !== 'production') {
    app.use('/test', testRoutes);
    console.log('🧪 Test endpoints enabled (development mode)');
}

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
            console.log(`User Service running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`Health check available at: http://localhost:${PORT}/health`);
            console.log(`Database: uitgo_users`);
        });
    } catch (error) {
        console.error('Failed to start User Service:', error);
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