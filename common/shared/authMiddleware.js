const axios = require('axios');

/**
 * Authentication middleware cho service-to-service communication
 * Gọi User Service để verify JWT token
 */
const authenticateServiceToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Access denied',
                message: 'No token provided'
            });
        }

        // Gọi User Service để verify token
        const userServiceUrl = process.env.USER_SERVICE_URL || 'http://user-service:3000';

        const response = await axios.post(`${userServiceUrl}/auth/verify-service`, {
            token: token
        }, {
            timeout: 5000, // 5 second timeout
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success && response.data.data.valid) {
            // Attach user info to request
            req.user = response.data.data.user;
            req.userId = response.data.data.user.id;
            req.userRole = response.data.data.user.role;

            next();
        } else {
            return res.status(401).json({
                success: false,
                error: 'Invalid token',
                message: 'Token verification failed'
            });
        }

    } catch (error) {
        console.error('Service authentication error:', error.message);

        // Handle different error types
        if (error.response) {
            // User service returned an error response
            const { status, data } = error.response;
            return res.status(status).json(data);
        }

        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            // User service is unavailable
            return res.status(503).json({
                success: false,
                error: 'Service unavailable',
                message: 'Authentication service is currently unavailable'
            });
        }

        // Other errors
        return res.status(500).json({
            success: false,
            error: 'Authentication error',
            message: 'Internal server error during authentication'
        });
    }
};

/**
 * Optional authentication middleware
 * Nếu có token thì verify, nếu không có thì vẫn cho qua
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            // No token provided, continue without authentication
            return next();
        }

        // Try to verify token
        const userServiceUrl = process.env.USER_SERVICE_URL || 'http://user-service:3000';

        const response = await axios.post(`${userServiceUrl}/auth/verify-service`, {
            token: token
        }, {
            timeout: 3000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success && response.data.data.valid) {
            // Attach user info if token is valid
            req.user = response.data.data.user;
            req.userId = response.data.data.user.id;
            req.userRole = response.data.data.user.role;
        }

        next();

    } catch (error) {
        console.warn('Optional auth failed:', error.message);
        // Continue without authentication if verification fails
        next();
    }
};

/**
 * Role-based authorization middleware
 * @param {...string} roles - Required roles
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !req.userRole) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'Please login first'
            });
        }

        if (!roles.includes(req.userRole)) {
            return res.status(403).json({
                success: false,
                error: 'Access forbidden',
                message: `Access denied. Required roles: ${roles.join(', ')}`
            });
        }

        next();
    };
};

module.exports = {
    authenticateServiceToken,
    optionalAuth,
    requireRole
};