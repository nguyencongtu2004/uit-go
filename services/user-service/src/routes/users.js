const express = require('express');
const router = express.Router();

// Import controllers
const {
    getUsers,
    getUserById,
    updateUser,
    updateLocation,
    updateDriverStatus,
    getAvailableDrivers,
    deactivateUser
} = require('../controllers/userController');

// Import middleware
const { authenticateToken, authorize, checkOwnership } = require('../middlewares/auth');
const {
    validateUpdateProfile,
    validateLocation,
    validateDriverStatus,
    validateUserQuery
} = require('../middlewares/validation');

/**
 * @route   GET /api/users
 * @desc    Get all users with pagination and filtering
 * @access  Private (Any authenticated user)
 * @query   page, limit, role, isOnline, sortBy, sortOrder
 */
router.get('/',
    authenticateToken,
    validateUserQuery,
    getUsers
);

/**
 * @route   GET /api/users/drivers/available
 * @desc    Get available drivers for trip matching
 * @access  Private
 * @query   vehicleType, lat, lng, radius
 */
router.get('/drivers/available',
    authenticateToken,
    getAvailableDrivers
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (Own profile or any authenticated user)
 */
router.get('/:id',
    authenticateToken,
    getUserById
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user profile
 * @access  Private (Own profile only)
 */
router.put('/:id',
    authenticateToken,
    checkOwnership,
    validateUpdateProfile,
    updateUser
);

/**
 * @route   PUT /api/users/:id/location
 * @desc    Update user location
 * @access  Private (Own profile only)
 */
router.put('/:id/location',
    authenticateToken,
    checkOwnership,
    validateLocation,
    updateLocation
);

/**
 * @route   PUT /api/users/:id/driver-status
 * @desc    Update driver status (DRIVER only)
 * @access  Private (Own profile only, DRIVER role)
 */
router.put('/:id/driver-status',
    authenticateToken,
    authorize('DRIVER'),
    checkOwnership,
    validateDriverStatus,
    updateDriverStatus
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Deactivate user (soft delete)
 * @access  Private (Own profile only)
 */
router.delete('/:id',
    authenticateToken,
    checkOwnership,
    deactivateUser
);

/**
 * @route   GET /api/users
 * @desc    Get users service info
 * @access  Public
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        service: 'UIT-Go User Management Service',
        version: '1.0.0',
        endpoints: {
            getUsers: 'GET /api/users',
            getAvailableDrivers: 'GET /api/users/drivers/available',
            getUserById: 'GET /api/users/:id',
            updateUser: 'PUT /api/users/:id',
            updateLocation: 'PUT /api/users/:id/location',
            updateDriverStatus: 'PUT /api/users/:id/driver-status',
            deactivateUser: 'DELETE /api/users/:id'
        },
        description: 'User management service for UIT-Go platform'
    });
});

module.exports = router;