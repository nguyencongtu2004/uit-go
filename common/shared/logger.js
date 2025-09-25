/**
 * Centralized logging utility for UIT-Go microservices
 * Provides structured logging with different levels and output formats
 */

const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
};

const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white'
};

winston.addColors(colors);

// Custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf((info) => {
        const { timestamp, level, message, service = 'unknown', ...meta } = info;
        const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
        return `${timestamp} [${service.toUpperCase()}] ${level}: ${message} ${metaStr}`;
    })
);

// Custom format for file output
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.json()
);

class Logger {
    constructor(serviceName = 'default', options = {}) {
        this.serviceName = serviceName;
        this.options = {
            level: process.env.LOG_LEVEL || 'info',
            enableFile: process.env.LOG_TO_FILE === 'true',
            logDir: process.env.LOG_DIR || './logs',
            ...options
        };

        this.logger = this.createLogger();
    }

    createLogger() {
        const transports = [
            // Console transport
            new winston.transports.Console({
                level: this.options.level,
                format: consoleFormat
            })
        ];

        // File transports (optional)
        if (this.options.enableFile) {
            // Error logs
            transports.push(
                new winston.transports.File({
                    level: 'error',
                    filename: path.join(this.options.logDir, `${this.serviceName}-error.log`),
                    format: fileFormat,
                    maxsize: 5242880, // 5MB
                    maxFiles: 10
                })
            );

            // Combined logs
            transports.push(
                new winston.transports.File({
                    filename: path.join(this.options.logDir, `${this.serviceName}-combined.log`),
                    format: fileFormat,
                    maxsize: 5242880, // 5MB
                    maxFiles: 10
                })
            );
        }

        return winston.createLogger({
            level: this.options.level,
            levels,
            defaultMeta: { service: this.serviceName },
            transports
        });
    }

    // Log methods
    error(message, meta = {}) {
        this.logger.error(message, meta);
    }

    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    http(message, meta = {}) {
        this.logger.http(message, meta);
    }

    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }

    // Request logging middleware
    requestLogger() {
        return (req, res, next) => {
            const start = Date.now();

            res.on('finish', () => {
                const duration = Date.now() - start;
                this.http(`${req.method} ${req.url}`, {
                    status: res.statusCode,
                    duration: `${duration}ms`,
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                });
            });

            next();
        };
    }

    // Error logging middleware
    errorLogger() {
        return (error, req, res, next) => {
            this.error(`${req.method} ${req.url} - ${error.message}`, {
                stack: error.stack,
                status: error.status || 500,
                ip: req.ip
            });
            next(error);
        };
    }
}

module.exports = Logger;