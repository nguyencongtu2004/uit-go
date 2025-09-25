/**
 * API Response utilities for consistent response formatting across all services
 */

class APIResponse {
    /**
     * Success response
     * @param {*} data - Response data
     * @param {string} message - Success message
     * @param {number} statusCode - HTTP status code (default: 200)
     * @param {object} meta - Additional metadata
     */
    static success(data = null, message = 'Request successful', statusCode = 200, meta = {}) {
        return {
            success: true,
            statusCode,
            message,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                ...meta
            }
        };
    }

    /**
     * Error response
     * @param {string} message - Error message
     * @param {number} statusCode - HTTP status code (default: 500)
     * @param {string} errorCode - Internal error code
     * @param {*} details - Error details
     */
    static error(message = 'Internal server error', statusCode = 500, errorCode = null, details = null) {
        return {
            success: false,
            statusCode,
            message,
            errorCode,
            details,
            meta: {
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Validation error response
     * @param {array} errors - Array of validation errors
     * @param {string} message - Error message
     */
    static validationError(errors = [], message = 'Validation failed') {
        return this.error(message, 400, 'VALIDATION_ERROR', errors);
    }

    /**
     * Not found response
     * @param {string} resource - Resource that was not found
     * @param {string} message - Custom message
     */
    static notFound(resource = 'Resource', message = null) {
        const defaultMessage = `${resource} not found`;
        return this.error(message || defaultMessage, 404, 'NOT_FOUND');
    }

    /**
     * Unauthorized response
     * @param {string} message - Custom message
     */
    static unauthorized(message = 'Unauthorized access') {
        return this.error(message, 401, 'UNAUTHORIZED');
    }

    /**
     * Forbidden response
     * @param {string} message - Custom message
     */
    static forbidden(message = 'Forbidden access') {
        return this.error(message, 403, 'FORBIDDEN');
    }

    /**
     * Too many requests response
     * @param {string} message - Custom message
     */
    static tooManyRequests(message = 'Too many requests') {
        return this.error(message, 429, 'TOO_MANY_REQUESTS');
    }

    /**
     * Paginated response
     * @param {array} data - Array of items
     * @param {object} pagination - Pagination info
     * @param {string} message - Success message
     */
    static paginated(data = [], pagination = {}, message = 'Request successful') {
        const defaultPagination = {
            page: 1,
            limit: 10,
            total: 0,
            pages: 0,
            ...pagination
        };

        return this.success(data, message, 200, { pagination: defaultPagination });
    }

    /**
     * Created response
     * @param {*} data - Created resource data
     * @param {string} message - Success message
     */
    static created(data = null, message = 'Resource created successfully') {
        return this.success(data, message, 201);
    }

    /**
     * Updated response
     * @param {*} data - Updated resource data
     * @param {string} message - Success message
     */
    static updated(data = null, message = 'Resource updated successfully') {
        return this.success(data, message, 200);
    }

    /**
     * Deleted response
     * @param {string} message - Success message
     */
    static deleted(message = 'Resource deleted successfully') {
        return this.success(null, message, 200);
    }

    /**
     * Express middleware to send response
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     */
    static sendResponse(req, res, next) {
        res.apiSuccess = (data, message, statusCode, meta) => {
            const response = APIResponse.success(data, message, statusCode, meta);
            return res.status(response.statusCode).json(response);
        };

        res.apiError = (message, statusCode, errorCode, details) => {
            const response = APIResponse.error(message, statusCode, errorCode, details);
            return res.status(response.statusCode).json(response);
        };

        res.apiValidationError = (errors, message) => {
            const response = APIResponse.validationError(errors, message);
            return res.status(response.statusCode).json(response);
        };

        res.apiNotFound = (resource, message) => {
            const response = APIResponse.notFound(resource, message);
            return res.status(response.statusCode).json(response);
        };

        res.apiUnauthorized = (message) => {
            const response = APIResponse.unauthorized(message);
            return res.status(response.statusCode).json(response);
        };

        res.apiForbidden = (message) => {
            const response = APIResponse.forbidden(message);
            return res.status(response.statusCode).json(response);
        };

        res.apiTooManyRequests = (message) => {
            const response = APIResponse.tooManyRequests(message);
            return res.status(response.statusCode).json(response);
        };

        res.apiPaginated = (data, pagination, message) => {
            const response = APIResponse.paginated(data, pagination, message);
            return res.status(response.statusCode).json(response);
        };

        res.apiCreated = (data, message) => {
            const response = APIResponse.created(data, message);
            return res.status(response.statusCode).json(response);
        };

        res.apiUpdated = (data, message) => {
            const response = APIResponse.updated(data, message);
            return res.status(response.statusCode).json(response);
        };

        res.apiDeleted = (message) => {
            const response = APIResponse.deleted(message);
            return res.status(response.statusCode).json(response);
        };

        next();
    }
}

module.exports = APIResponse;