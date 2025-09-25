/**
 * Validation utilities for request validation across all services
 */

const Joi = require('joi');

class Validator {
    /**
     * Common validation schemas
     */
    static schemas = {
        // MongoDB ObjectId validation
        objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
            'string.pattern.base': 'Invalid ObjectId format'
        }),

        // Email validation
        email: Joi.string().email().required().messages({
            'string.email': 'Please provide a valid email address'
        }),

        // Password validation (minimum 8 chars, at least 1 uppercase, 1 lowercase, 1 number)
        password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.pattern.base': 'Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number'
        }),

        // Phone number validation (Vietnamese format)
        phone: Joi.string().pattern(/^(\+84|0)[3|5|7|8|9][0-9]{8}$/).required().messages({
            'string.pattern.base': 'Please provide a valid Vietnamese phone number'
        }),

        // Coordinates validation
        latitude: Joi.number().min(-90).max(90).required().messages({
            'number.min': 'Latitude must be between -90 and 90',
            'number.max': 'Latitude must be between -90 and 90'
        }),

        longitude: Joi.number().min(-180).max(180).required().messages({
            'number.min': 'Longitude must be between -180 and 180',
            'number.max': 'Longitude must be between -180 and 180'
        }),

        // Pagination validation
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),

        // Common string validations
        name: Joi.string().min(2).max(50).trim().required(),
        description: Joi.string().max(500).trim().allow(''),

        // Trip status validation
        tripStatus: Joi.string().valid(
            'REQUESTED',
            'SEARCHING',
            'ACCEPTED',
            'DRIVER_ARRIVING',
            'PICKED_UP',
            'IN_PROGRESS',
            'COMPLETED',
            'CANCELLED'
        ),

        // Driver status validation
        driverStatus: Joi.string().valid('ONLINE', 'OFFLINE', 'BUSY'),

        // User role validation
        userRole: Joi.string().valid('PASSENGER', 'DRIVER', 'ADMIN').default('PASSENGER')
    };

    /**
     * Validate request body, query, or params
     * @param {object} schema - Joi validation schema
     * @param {string} property - Property to validate ('body', 'query', 'params')
     */
    static validate(schema, property = 'body') {
        return (req, res, next) => {
            const { error, value } = schema.validate(req[property], {
                abortEarly: false,
                stripUnknown: true,
                convert: true
            });

            if (error) {
                const errors = error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                    value: detail.context?.value
                }));

                return res.apiValidationError(errors);
            }

            // Replace the original data with validated and converted data
            req[property] = value;
            next();
        };
    }

    /**
     * Validate multiple properties at once
     * @param {object} schemas - Object containing schemas for different properties
     */
    static validateMultiple(schemas) {
        return (req, res, next) => {
            const errors = [];

            for (const [property, schema] of Object.entries(schemas)) {
                const { error, value } = schema.validate(req[property], {
                    abortEarly: false,
                    stripUnknown: true,
                    convert: true
                });

                if (error) {
                    errors.push(...error.details.map(detail => ({
                        field: `${property}.${detail.path.join('.')}`,
                        message: detail.message,
                        value: detail.context?.value
                    })));
                } else {
                    req[property] = value;
                }
            }

            if (errors.length > 0) {
                return res.apiValidationError(errors);
            }

            next();
        };
    }

    /**
     * Sanitize data to prevent XSS and other attacks
     * @param {*} data - Data to sanitize
     */
    static sanitize(data) {
        if (typeof data === 'string') {
            return data
                .replace(/[<>]/g, '') // Remove potential HTML tags
                .trim();
        }

        if (Array.isArray(data)) {
            return data.map(item => this.sanitize(item));
        }

        if (typeof data === 'object' && data !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(data)) {
                sanitized[key] = this.sanitize(value);
            }
            return sanitized;
        }

        return data;
    }

    /**
     * Custom validation middleware for sanitization
     */
    static sanitizeInput() {
        return (req, res, next) => {
            req.body = this.sanitize(req.body);
            req.query = this.sanitize(req.query);
            req.params = this.sanitize(req.params);
            next();
        };
    }
}

module.exports = Validator;