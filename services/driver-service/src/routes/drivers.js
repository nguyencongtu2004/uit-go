const express = require('express');
const driverStatusService = require('../services/driverStatusService');
const { authenticateTokenCached, authenticateDriver, optionalAuth } = require('../middlewares/auth');

const router = express.Router();

/**
 * PUT /drivers/:driverId/location
 * High-frequency endpoint for location updates
 * Optimized for 10,000+ requests per second
 * Uses optional auth for load testing, required auth in production
 */
router.put('/:driverId/location',
    process.env.NODE_ENV === 'production' ? authenticateTokenCached : optionalAuth,
    async (req, res) => {
        try {
            const { driverId } = req.params;
            const { longitude, latitude } = req.body;

            // Fast validation
            if (!longitude || !latitude ||
                typeof longitude !== 'number' || typeof latitude !== 'number') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid longitude or latitude'
                });
            }

            // Validate coordinate ranges
            if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
                return res.status(400).json({
                    success: false,
                    error: 'Coordinates out of valid range'
                });
            }

            const result = await driverStatusService.updateLocation(driverId, longitude, latitude);

            res.status(200).json(result);
        } catch (error) {
            console.error('Location update error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    });

/**
 * POST /drivers/:driverId/online
 * Set driver online with location
 * Uses driver authentication for production, optional for testing
 */
router.post('/:driverId/online',
    process.env.NODE_ENV === 'production' ? [authenticateTokenCached, authenticateDriver] : optionalAuth,
    async (req, res) => {
        try {
            const { driverId } = req.params;
            const { longitude, latitude } = req.body;

            if (!longitude || !latitude) {
                return res.status(400).json({
                    success: false,
                    error: 'Location required to go online'
                });
            }

            const result = await driverStatusService.setDriverOnline(driverId, longitude, latitude);

            res.status(200).json(result);
        } catch (error) {
            console.error('Set online error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to set driver online'
            });
        }
    });

/**
 * POST /drivers/:driverId/offline
 * Set driver offline
 * Uses driver authentication for production, optional for testing
 */
router.post('/:driverId/offline',
    process.env.NODE_ENV === 'production' ? [authenticateTokenCached, authenticateDriver] : optionalAuth,
    async (req, res) => {
        try {
            const { driverId } = req.params;
            const result = await driverStatusService.setDriverOffline(driverId);

            res.status(200).json(result);
        } catch (error) {
            console.error('Set offline error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to set driver offline'
            });
        }
    });

/**
 * POST /drivers/:driverId/trip
 * Set driver in trip status
 * Uses driver authentication for production, optional for testing
 */
router.post('/:driverId/trip',
    process.env.NODE_ENV === 'production' ? [authenticateTokenCached, authenticateDriver] : optionalAuth,
    async (req, res) => {
        try {
            const { driverId } = req.params;
            const result = await driverStatusService.setDriverInTrip(driverId);

            res.status(200).json(result);
        } catch (error) {
            console.error('Set in trip error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to set driver in trip'
            });
        }
    });

/**
 * GET /drivers/:driverId/status
 * Get current driver status
 * Public endpoint with optional auth
 */
router.get('/:driverId/status', optionalAuth, async (req, res) => {
    try {
        const { driverId } = req.params;
        const status = await driverStatusService.getDriverStatus(driverId);

        if (!status) {
            return res.status(404).json({
                success: false,
                error: 'Driver not found'
            });
        }

        res.status(200).json({
            success: true,
            driver: status
        });
    } catch (error) {
        console.error('Get status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get driver status'
        });
    }
});

module.exports = router;