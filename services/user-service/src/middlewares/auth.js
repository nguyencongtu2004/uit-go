const jwt = require('jsonwebtoken');
const User = require('../models/User');
const rateLimit = require('express-rate-limit');

// JWT Secret từ environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'uitgo-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Middleware xác thực JWT token
 * Verify token và attach user info vào req.user
 */
const authenticateToken = async (req, res, next) => {
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

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Tìm user từ database để đảm bảo user vẫn còn active
        const user = await User.findById(decoded.userId).select('-passwordHash');
        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                error: 'Invalid token',
                message: 'User not found or inactive'
            });
        }

        // Attach user info vào request object
        req.user = user;
        req.userId = user.id;
        req.userRole = user.role;

        next();
    } catch (error) {
        console.error('JWT verification failed:', error.message);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired',
                message: 'Please login again'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token',
                message: 'Token is malformed'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Authentication error',
            message: 'Internal server error'
        });
    }
};

/**
 * Middleware phân quyền theo role
 * @param {...string} roles - Danh sách roles được phép
 */
const authorize = (...roles) => {
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

/**
 * Middleware kiểm tra ownership
 * User chỉ có thể access resource của chính mình (trừ ADMIN)
 */
const checkOwnership = (req, res, next) => {
    const resourceUserId = req.params.userId || req.params.id;
    const currentUserId = req.userId;

    // Admin có thể access tất cả
    if (req.userRole === 'ADMIN') {
        return next();
    }

    // User chỉ có thể access resource của chính mình
    if (resourceUserId && resourceUserId !== currentUserId) {
        return res.status(403).json({
            success: false,
            error: 'Access forbidden',
            message: 'You can only access your own resources'
        });
    }

    next();
};

/**
 * Rate limiting cho authentication endpoints
 */
const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit mỗi IP tối đa 5 login attempts per 15 minutes
    message: {
        success: false,
        error: 'Too many requests',
        message: 'Too many authentication attempts, please try again later',
        retryAfter: 15 * 60 // seconds
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            message: 'Too many authentication attempts, please try again later',
            retryAfter: Math.round(req.rateLimit.msBeforeNext / 1000)
        });
    }
});

/**
 * Rate limiting cho registration endpoints
 */
const registerRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit mỗi IP tối đa 3 registrations per hour
    message: {
        success: false,
        error: 'Too many requests',
        message: 'Too many registration attempts, please try again later'
    }
});

/**
 * Utility function để tạo JWT token
 */
const generateToken = (user) => {
    const payload = {
        userId: user._id || user.id,
        email: user.email,
        role: user.role,
        iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'uit-go-user-service',
        audience: 'uit-go-app'
    });
};

/**
 * Utility function để decode token mà không verify (để debug)
 */
const decodeToken = (token) => {
    try {
        return jwt.decode(token);
    } catch (error) {
        return null;
    }
};

module.exports = {
    authenticateToken,
    authorize,
    checkOwnership,
    authRateLimit,
    registerRateLimit,
    generateToken,
    decodeToken,
    JWT_SECRET,
    JWT_EXPIRES_IN
};