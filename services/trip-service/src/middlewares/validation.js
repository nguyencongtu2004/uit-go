const Joi = require('joi');

/**
 * Validation schemas for trip-related requests
 */

const createTripSchema = Joi.object({
    origin: Joi.object({
        address: Joi.string().required().min(5).max(500),
        latitude: Joi.number().required().min(-90).max(90),
        longitude: Joi.number().required().min(-180).max(180)
    }).required(),
    destination: Joi.object({
        address: Joi.string().required().min(5).max(500),
        latitude: Joi.number().required().min(-90).max(90),
        longitude: Joi.number().required().min(-180).max(180)
    }).required(),
    estimatedFare: Joi.number().optional().min(0)
});

const updateTripStatusSchema = Joi.object({
    status: Joi.string().valid(
        'SEARCHING',
        'ACCEPTED',
        'DRIVER_ARRIVING',
        'PICKED_UP',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED'
    ).required(),
    actualFare: Joi.number().optional().min(0),
    location: Joi.object({
        latitude: Joi.number().min(-90).max(90),
        longitude: Joi.number().min(-180).max(180)
    }).optional()
});

const acceptTripSchema = Joi.object({
    estimatedArrivalTime: Joi.number().optional().min(0)
});

const rateTripSchema = Joi.object({
    rating: Joi.number().required().min(1).max(5),
    comment: Joi.string().optional().max(500)
});

const tripQuerySchema = Joi.object({
    page: Joi.number().optional().min(1).default(1),
    limit: Joi.number().optional().min(1).max(100).default(10),
    status: Joi.string().optional().valid(
        'REQUESTED',
        'SEARCHING',
        'ACCEPTED',
        'DRIVER_ARRIVING',
        'PICKED_UP',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED'
    ),
    passengerId: Joi.string().optional(),
    driverId: Joi.string().optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional().min(Joi.ref('startDate'))
});

/**
 * Generic validation middleware factory
 */
const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false,
            allowUnknown: true,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));

            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                message: 'Invalid request data',
                details: errors
            });
        }

        // Replace the property with sanitized data
        req[property] = value;
        next();
    };
};

/**
 * Specific validation middlewares
 */
const validateCreateTrip = validate(createTripSchema, 'body');
const validateUpdateTripStatus = validate(updateTripStatusSchema, 'body');
const validateAcceptTrip = validate(acceptTripSchema, 'body');
const validateRateTrip = validate(rateTripSchema, 'body');
const validateTripQuery = validate(tripQuerySchema, 'query');

/**
 * Validate trip ID parameter
 */
const validateTripId = (req, res, next) => {
    const { id, tripId } = req.params;
    const tripIdValue = id || tripId;

    if (!tripIdValue) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            message: 'Trip ID is required'
        });
    }

    // Basic MongoDB ObjectId validation
    if (!/^[a-fA-F0-9]{24}$/.test(tripIdValue)) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            message: 'Invalid trip ID format'
        });
    }

    req.tripId = tripIdValue;
    next();
};

/**
 * Validate coordinates
 */
const validateCoordinates = (req, res, next) => {
    const { latitude, longitude } = req.query;

    if ((latitude && !longitude) || (!latitude && longitude)) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            message: 'Both latitude and longitude are required for location queries'
        });
    }

    if (latitude && longitude) {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                message: 'Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180'
            });
        }

        req.coordinates = { latitude: lat, longitude: lng };
    }

    next();
};

/**
 * Validate pagination parameters
 */
const validatePagination = (req, res, next) => {
    let { page = 1, limit = 10 } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    if (isNaN(page) || page < 1) {
        page = 1;
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
        limit = 10;
    }

    req.pagination = {
        page,
        limit,
        skip: (page - 1) * limit
    };

    next();
};

/**
 * Sanitize text input to prevent XSS
 */
const sanitizeTextInput = (text) => {
    if (typeof text !== 'string') return text;

    return text
        .replace(/[<>]/g, '') // Remove < and > characters
        .trim()
        .slice(0, 1000); // Limit length
};

/**
 * Sanitization middleware
 */
const sanitizeInput = (req, res, next) => {
    // Sanitize common text fields
    const textFields = ['comment', 'address', 'notes'];

    // Check body
    if (req.body && typeof req.body === 'object') {
        for (const field of textFields) {
            if (req.body[field]) {
                req.body[field] = sanitizeTextInput(req.body[field]);
            }
        }

        // Sanitize nested address fields
        if (req.body.origin && req.body.origin.address) {
            req.body.origin.address = sanitizeTextInput(req.body.origin.address);
        }
        if (req.body.destination && req.body.destination.address) {
            req.body.destination.address = sanitizeTextInput(req.body.destination.address);
        }
    }

    next();
};

/**
 * Error handler for validation errors
 */
const handleValidationError = (error, req, res, next) => {
    if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => ({
            field: err.path,
            message: err.message,
            value: err.value
        }));

        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            message: 'Invalid request data',
            details: errors
        });
    }

    if (error.name === 'CastError') {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            message: `Invalid ${error.path}: ${error.value}`,
            details: [{
                field: error.path,
                message: `Expected ${error.kind}, got ${typeof error.value}`,
                value: error.value
            }]
        });
    }

    next(error);
};

module.exports = {
    // Schema validation
    validateCreateTrip,
    validateUpdateTripStatus,
    validateAcceptTrip,
    validateRateTrip,
    validateTripQuery,

    // Parameter validation
    validateTripId,
    validateCoordinates,
    validatePagination,

    // Input sanitization
    sanitizeInput,
    sanitizeTextInput,

    // Error handling
    handleValidationError,

    // Raw schemas for testing
    schemas: {
        createTripSchema,
        updateTripStatusSchema,
        acceptTripSchema,
        rateTripSchema,
        tripQuerySchema
    }
};