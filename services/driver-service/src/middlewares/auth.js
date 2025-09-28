const axios = require('axios');

// Service URLs
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3000';

/**
 * Middleware to authenticate requests using JWT token
 * Validates token by calling User Service
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Access denied',
                message: 'Authentication token required'
            });
        }

        // Call User Service to verify token
        const response = await axios.post(`${USER_SERVICE_URL}/auth/verify-service`, {
            token: token
        }, {
            timeout: 5000 // 5 second timeout
        });

        if (response.data.success && response.data.data.valid) {
            // Add user info to request
            req.user = response.data.data.user;
            req.userId = response.data.data.user.id;
            next();
        } else {
            return res.status(401).json({
                success: false,
                error: 'Invalid token',
                message: 'Authentication failed'
            });
        }

    } catch (error) {
        console.error('Authentication error:', error.message);

        // Handle different types of errors
        if (error.response) {
            // User service returned an error
            return res.status(error.response.status).json({
                success: false,
                error: 'Authentication failed',
                message: error.response.data?.message || 'Token validation failed'
            });
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
            // User service is down
            return res.status(503).json({
                success: false,
                error: 'Service unavailable',
                message: 'Authentication service is temporarily unavailable'
            });
        } else if (error.code === 'ECONNABORTED') {
            // Timeout
            return res.status(504).json({
                success: false,
                error: 'Request timeout',
                message: 'Authentication service timeout'
            });
        } else {
            // Other errors
            return res.status(500).json({
                success: false,
                error: 'Authentication error',
                message: 'Internal server error during authentication'
            });
        }
    }
};

/**
 * Middleware to authenticate only drivers
 * Must be used after authenticateToken
 */
const authenticateDriver = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            message: 'User not authenticated'
        });
    }

    if (req.user.role !== 'DRIVER') {
        return res.status(403).json({
            success: false,
            error: 'Access denied',
            message: 'Only drivers can access this resource'
        });
    }

    next();
};

/**
 * Middleware to authenticate only passengers
 * Must be used after authenticateToken
 */
const authenticatePassenger = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            message: 'User not authenticated'
        });
    }

    if (req.user.role !== 'PASSENGER') {
        return res.status(403).json({
            success: false,
            error: 'Access denied',
            message: 'Only passengers can access this resource'
        });
    }

    next();
};

/**
 * Optional authentication middleware
 * Sets user info if token is valid, but doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            // No token provided, continue without authentication
            return next();
        }

        // Try to verify token
        const response = await axios.post(`${USER_SERVICE_URL}/auth/verify-service`, {
            token: token
        }, {
            timeout: 3000 // Shorter timeout for optional auth
        });

        if (response.data.success && response.data.data.valid) {
            req.user = response.data.data.user;
            req.userId = response.data.data.user.id;
        }

        next();

    } catch (error) {
        // For optional auth, we just log the error and continue
        console.log('Optional auth failed:', error.message);
        next();
    }
};

/**
 * Middleware to check if user owns the resource (by userId)
 * Must be used after authenticateToken
 */
const checkOwnership = (paramName = 'userId') => {
    return (req, res, next) => {
        const resourceUserId = req.params[paramName];
        const authenticatedUserId = req.userId;

        if (resourceUserId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied',
                message: 'You can only access your own resources'
            });
        }

        next();
    };
};

/**
 * Cache for token validation to reduce calls to User Service
 */
class TokenCache {
    constructor(ttl = 300000) { // 5 minutes default
        this.cache = new Map();
        this.ttl = ttl;
    }

    set(token, userData) {
        this.cache.set(token, {
            userData,
            timestamp: Date.now()
        });
    }

    get(token) {
        const cached = this.cache.get(token);
        if (!cached) return null;

        // Check if expired
        if (Date.now() - cached.timestamp > this.ttl) {
            this.cache.delete(token);
            return null;
        }

        return cached.userData;
    }

    clear() {
        this.cache.clear();
    }

    size() {
        return this.cache.size;
    }
}

// Create token cache instance
const tokenCache = new TokenCache(300000); // 5 minutes

/**
 * Cached version of authenticateToken
 * Uses local cache to reduce User Service calls
 */
const authenticateTokenCached = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Access denied',
                message: 'Authentication token required'
            });
        }

        // Check cache first
        const cachedUser = tokenCache.get(token);
        if (cachedUser) {
            req.user = cachedUser;
            req.userId = cachedUser.id;
            return next();
        }

        // Call User Service if not in cache
        const response = await axios.post(`${USER_SERVICE_URL}/auth/verify-service`, {
            token: token
        }, {
            timeout: 5000
        });

        if (response.data.success && response.data.data.valid) {
            const userData = response.data.data.user;

            // Cache the result
            tokenCache.set(token, userData);

            req.user = userData;
            req.userId = userData.id;
            next();
        } else {
            return res.status(401).json({
                success: false,
                error: 'Invalid token',
                message: 'Authentication failed'
            });
        }

    } catch (error) {
        console.error('Cached authentication error:', error.message);

        if (error.response) {
            return res.status(error.response.status).json({
                success: false,
                error: 'Authentication failed',
                message: error.response.data?.message || 'Token validation failed'
            });
        } else {
            return res.status(503).json({
                success: false,
                error: 'Service unavailable',
                message: 'Authentication service is temporarily unavailable'
            });
        }
    }
};

module.exports = {
    authenticateToken,
    authenticateDriver,
    authenticatePassenger,
    optionalAuth,
    checkOwnership,
    authenticateTokenCached,
    tokenCache
};