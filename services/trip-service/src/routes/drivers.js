const express = require('express');
const router = express.Router();
const driverMatchingService = require('../services/driverMatchingService');

/**
 * @route POST /drivers/location/sync
 * @desc Sync driver location to Redis for driver matching
 * @access Internal service communication
 */
router.post('/location/sync', async (req, res) => {
    try {
        const { driverId, latitude, longitude, status } = req.body;

        // Validate required fields
        if (!driverId) {
            return res.status(400).json({
                success: false,
                error: 'Driver ID is required'
            });
        }

        let result;

        if (status === 'AVAILABLE' && latitude && longitude) {
            // Add/update driver location in Redis
            result = await driverMatchingService.addDriverLocation(
                driverId,
                parseFloat(longitude),
                parseFloat(latitude)
            );
        } else if (status === 'OFFLINE' || status === 'BUSY') {
            // Remove driver from Redis
            result = await driverMatchingService.removeDriverLocation(driverId);
        } else {
            return res.status(400).json({
                success: false,
                error: 'Invalid status or missing location data'
            });
        }

        return res.status(200).json(result);

    } catch (error) {
        console.error('Error syncing driver location:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * @route POST /drivers/sync-all
 * @desc Sync all available drivers from User Service to Redis
 * @access Internal service communication
 */
router.post('/sync-all', async (req, res) => {
    try {
        const result = await driverMatchingService.syncAvailableDrivers();
        return res.status(200).json(result);

    } catch (error) {
        console.error('Error syncing all drivers:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * @route GET /drivers/nearby
 * @desc Find nearby drivers for testing
 * @access Internal service communication
 */
router.get('/nearby', async (req, res) => {
    try {
        const { latitude, longitude, radius, limit } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required'
            });
        }

        const options = {
            radius: radius ? parseFloat(radius) : undefined,
            limit: limit ? parseInt(limit) : undefined
        };

        const drivers = await driverMatchingService.findNearbyDrivers(
            parseFloat(latitude),
            parseFloat(longitude),
            options
        );

        return res.status(200).json({
            success: true,
            data: drivers,
            location: {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude)
            },
            options
        });

    } catch (error) {
        console.error('Error finding nearby drivers:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

module.exports = router;