const Joi = require('joi');

/**
 * Middleware factory để validate request body
 * @param {Object} schema - Joi schema object
 * @param {string} property - Property của request để validate ('body', 'query', 'params')
 */
const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false, // Trả về tất cả errors, không chỉ error đầu tiên
            stripUnknown: true, // Remove unknown fields
            convert: true // Convert types (string to number, etc.)
        });

        if (error) {
            const errorDetails = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context.value
            }));

            return res.status(400).json({
                success: false,
                error: 'Validation error',
                message: 'Invalid input data',
                details: errorDetails
            });
        }

        // Replace the property with the validated (and potentially transformed) version
        req[property] = value;
        next();
    };
};

/**
 * Schema validation cho user registration
 */
const registerSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        }),

    password: Joi.string()
        .min(6)
        .max(100)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .required()
        .messages({
            'string.min': 'Password must be at least 6 characters long',
            'string.max': 'Password must be less than 100 characters',
            'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
            'any.required': 'Password is required'
        }),

    fullName: Joi.string()
        .min(2)
        .max(100)
        .trim()
        .required()
        .messages({
            'string.min': 'Full name must be at least 2 characters long',
            'string.max': 'Full name must be less than 100 characters',
            'any.required': 'Full name is required'
        }),

    phoneNumber: Joi.string()
        .pattern(/^(\+84|0)[0-9]{9,10}$/)
        .required()
        .messages({
            'string.pattern.base': 'Please provide a valid Vietnamese phone number',
            'any.required': 'Phone number is required'
        }),

    role: Joi.string()
        .valid('PASSENGER', 'DRIVER')
        .required()
        .messages({
            'any.only': 'Role must be either PASSENGER or DRIVER',
            'any.required': 'Role is required'
        }),

    // Optional driver info nếu role = 'DRIVER'
    driverInfo: Joi.when('role', {
        is: 'DRIVER',
        then: Joi.object({
            vehicle: Joi.object({
                licensePlate: Joi.string().required(),
                make: Joi.string().required(),
                model: Joi.string().required(),
                year: Joi.number().integer().min(1990).max(new Date().getFullYear()).required(),
                color: Joi.string().required(),
                vehicleType: Joi.string().valid('MOTORBIKE', 'CAR_4_SEAT', 'CAR_7_SEAT').default('CAR_4_SEAT')
            }).required()
        }).required(),
        otherwise: Joi.forbidden()
    })
});

/**
 * Schema validation cho user login
 */
const loginSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        }),

    password: Joi.string()
        .required()
        .messages({
            'any.required': 'Password is required'
        })
});

/**
 * Schema validation cho location update
 */
const locationSchema = Joi.object({
    coordinates: Joi.array()
        .items(Joi.number())
        .length(2)
        .required()
        .custom((value, helpers) => {
            const [lng, lat] = value;
            if (lng < -180 || lng > 180) {
                return helpers.error('coordinates.longitude');
            }
            if (lat < -90 || lat > 90) {
                return helpers.error('coordinates.latitude');
            }
            return value;
        })
        .messages({
            'array.length': 'Coordinates must contain exactly 2 numbers [longitude, latitude]',
            'coordinates.longitude': 'Longitude must be between -180 and 180',
            'coordinates.latitude': 'Latitude must be between -90 and 90',
            'any.required': 'Coordinates are required'
        }),

    address: Joi.string()
        .max(200)
        .optional()
        .messages({
            'string.max': 'Address must be less than 200 characters'
        })
});

/**
 * Schema validation cho profile update
 */
const updateProfileSchema = Joi.object({
    fullName: Joi.string()
        .min(2)
        .max(100)
        .trim()
        .optional(),

    phoneNumber: Joi.string()
        .pattern(/^(\+84|0)[0-9]{9,10}$/)
        .optional()
        .messages({
            'string.pattern.base': 'Please provide a valid Vietnamese phone number'
        }),

    // Driver có thể update vehicle info
    driverInfo: Joi.object({
        vehicle: Joi.object({
            licensePlate: Joi.string(),
            make: Joi.string(),
            model: Joi.string(),
            year: Joi.number().integer().min(1990).max(new Date().getFullYear()),
            color: Joi.string(),
            vehicleType: Joi.string().valid('MOTORBIKE', 'CAR_4_SEAT', 'CAR_7_SEAT')
        })
    }).optional(),

    // Device info
    deviceInfo: Joi.object({
        fcmToken: Joi.string().optional(),
        deviceId: Joi.string().optional(),
        platform: Joi.string().valid('WEB', 'ANDROID', 'IOS').optional()
    }).optional()
});

/**
 * Schema validation cho driver status update
 */
const driverStatusSchema = Joi.object({
    driverStatus: Joi.string()
        .valid('OFFLINE', 'AVAILABLE', 'BUSY', 'IN_TRIP')
        .required()
        .messages({
            'any.only': 'Driver status must be one of: OFFLINE, AVAILABLE, BUSY, IN_TRIP',
            'any.required': 'Driver status is required'
        }),

    location: Joi.object({
        latitude: Joi.number().min(-90).max(90).required(),
        longitude: Joi.number().min(-180).max(180).required(),
        address: Joi.string().optional()
    }).optional()
});

/**
 * Schema validation cho query parameters
 */
const userQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    role: Joi.string().valid('PASSENGER', 'DRIVER').optional(),
    isOnline: Joi.boolean().optional(),
    sortBy: Joi.string().valid('createdAt', 'rating', 'totalTrips').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// Export validation middleware functions
module.exports = {
    validate,
    validateRegister: validate(registerSchema),
    validateLogin: validate(loginSchema),
    validateLocation: validate(locationSchema),
    validateUpdateProfile: validate(updateProfileSchema),
    validateDriverStatus: validate(driverStatusSchema),
    validateUserQuery: validate(userQuerySchema, 'query'),

    // Export schemas for manual validation if needed
    schemas: {
        registerSchema,
        loginSchema,
        locationSchema,
        updateProfileSchema,
        driverStatusSchema,
        userQuerySchema
    }
};