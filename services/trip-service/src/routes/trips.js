/**
 * Trip Routes
 * Main API endpoints for trip management
 */

const express = require('express');
const router = express.Router();

// Import controllers
const tripController = require('../controllers/tripController');

// Import middlewares
const {
    authenticateToken,
    authenticatePassenger,
    authenticateDriver,
    authenticateUser,
    checkTripOwnership
} = require('../middlewares/auth');

const {
    validateCreateTrip,
    validateUpdateTripStatus,
    validateAcceptTrip,
    validateRateTrip,
    validateTripQuery,
    validateTripId,
    validatePagination,
    sanitizeInput
} = require('../middlewares/validation');

// Apply common middlewares
router.use(sanitizeInput); // Sanitize all inputs

/**
 * GET /trips
 * Get user's trip history with pagination and filtering
 * Accessible by both passengers and drivers
 */
router.get('/',
    authenticateToken,
    authenticateUser,
    validateTripQuery,
    validatePagination,
    tripController.getTripHistory
);

/**
 * POST /trips
 * Create a new trip request
 * Passenger only endpoint
 */
router.post('/',
    authenticateToken,
    authenticatePassenger,
    validateCreateTrip,
    tripController.createTrip
);

/**
 * GET /trips/:id
 * Get specific trip details
 * Accessible by trip participants (passenger or assigned driver)
 */
router.get('/:id',
    authenticateToken,
    authenticateUser,
    validateTripId,
    tripController.getTripDetails
);

/**
 * PATCH /trips/:id/accept
 * Accept a trip request
 * Driver only endpoint
 */
router.patch('/:id/accept',
    authenticateToken,
    authenticateDriver,
    validateTripId,
    validateAcceptTrip,
    tripController.acceptTrip
);

/**
 * PATCH /trips/:id/status
 * Update trip status (driver arriving, picked up, in progress, completed)
 * Accessible by trip participants based on status
 */
router.patch('/:id/status',
    authenticateToken,
    authenticateUser,
    validateTripId,
    validateUpdateTripStatus,
    tripController.updateTripStatus
);

/**
 * PATCH /trips/:id/rating
 * Rate a completed trip
 * Passenger only endpoint
 */
router.patch('/:id/rating',
    authenticateToken,
    authenticatePassenger,
    validateTripId,
    validateRateTrip,
    tripController.rateTrip
);

/**
 * DELETE /trips/:id
 * Cancel a trip
 * Accessible by trip participants
 */
router.delete('/:id',
    authenticateToken,
    authenticateUser,
    validateTripId,
    tripController.cancelTrip
);

/**
 * PATCH /trips/:id/cancel
 * Alternative cancel endpoint with reason
 * Accessible by trip participants
 */
router.patch('/:id/cancel',
    authenticateToken,
    authenticateUser,
    validateTripId,
    tripController.cancelTrip
);

module.exports = router;