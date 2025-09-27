const express = require('express');
const router = express.Router();

// Import controllers
const {
    register,
    login,
    logout,
    getProfile,
    verifyToken,
    verifyTokenService,
    changePassword
} = require('../controllers/authController');

// Import middleware
const { authenticateToken, authRateLimit, registerRateLimit } = require('../middlewares/auth');
const { validateRegister, validateLogin } = require('../middlewares/validation');

/**
 * @route   POST /api/auth/register
 * @desc    Register new user (passenger or driver)
 * @access  Public
 * @body    { email, password, fullName, phoneNumber, role, driverInfo? }
 */
router.post('/register',
    registerRateLimit,
    validateRegister,
    register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 * @body    { email, password }
 */
router.post('/login',
    authRateLimit,
    validateLogin,
    login
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (update online status)
 * @access  Private
 */
router.post('/logout',
    authenticateToken,
    logout
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile',
    authenticateToken,
    getProfile
);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify JWT token validity
 * @access  Private
 */
router.get('/verify',
    authenticateToken,
    verifyToken
);

/**
 * @route   POST /api/auth/verify-service
 * @desc    Verify JWT token for service-to-service communication
 * @access  Public (Service-to-service)
 * @body    { token }
 */
router.post('/verify-service', verifyTokenService);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 * @body    { currentPassword, newPassword }
 */
router.put('/change-password',
    authenticateToken,
    changePassword
);

/**
 * @route   GET /api/auth
 * @desc    Get auth service info
 * @access  Public
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        service: 'UIT-Go Authentication Service',
        version: '1.0.0',
        endpoints: {
            register: 'POST /api/auth/register',
            login: 'POST /api/auth/login',
            logout: 'POST /api/auth/logout',
            profile: 'GET /api/auth/profile',
            verify: 'GET /api/auth/verify',
            changePassword: 'PUT /api/auth/change-password'
        },
        description: 'Authentication and authorization service for UIT-Go platform'
    });
});

module.exports = router;