const express = require('express');
const driverStatusService = require('../services/driverStatusService');

const router = express.Router();

/**
 * GET /location/nearby
 * Core endpoint for finding nearby drivers - optimized for sub-3s response
 * This is the most critical endpoint for load testing
 */
router.get('/nearby', async (req, res) => {
    try {
        const { longitude, latitude, radius = 5, limit = 10 } = req.query;

        // Fast validation
        const lng = parseFloat(longitude);
        const lat = parseFloat(latitude);
        const radiusKm = Math.min(parseFloat(radius) || 5, 50); // Max 50km radius
        const limitNum = Math.min(parseInt(limit) || 10, 100); // Max 100 drivers

        if (isNaN(lng) || isNaN(lat)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid longitude or latitude'
            });
        }

        // Validate coordinate ranges
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
            return res.status(400).json({
                success: false,
                error: 'Coordinates out of valid range'
            });
        }

        const result = await driverStatusService.findAvailableDrivers(
            lng,
            lat,
            radiusKm,
            limitNum
        );

        res.status(200).json({
            success: true,
            location: {
                longitude: lng,
                latitude: lat,
                searchRadius: radiusKm
            },
            ...result
        });
    } catch (error) {
        console.error('Find nearby drivers error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to find nearby drivers'
        });
    }
});

/**
 * POST /location/batch-nearby
 * Batch search for multiple locations - for load testing
 * Allows testing multiple concurrent searches
 */
router.post('/batch-nearby', async (req, res) => {
    try {
        const { locations, radius = 5, limit = 10 } = req.body;

        if (!Array.isArray(locations) || locations.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Locations array is required'
            });
        }

        if (locations.length > 50) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 50 locations per batch'
            });
        }

        const radiusKm = Math.min(parseFloat(radius) || 5, 50);
        const limitNum = Math.min(parseInt(limit) || 10, 50);

        const results = await Promise.all(
            locations.map(async (location, index) => {
                try {
                    const { longitude, latitude } = location;
                    const lng = parseFloat(longitude);
                    const lat = parseFloat(latitude);

                    if (isNaN(lng) || isNaN(lat)) {
                        return {
                            index,
                            success: false,
                            error: 'Invalid coordinates'
                        };
                    }

                    const result = await driverStatusService.findAvailableDrivers(
                        lng, lat, radiusKm, limitNum
                    );

                    return {
                        index,
                        location: { longitude: lng, latitude: lat },
                        ...result
                    };
                } catch (error) {
                    return {
                        index,
                        success: false,
                        error: error.message
                    };
                }
            })
        );

        res.status(200).json({
            success: true,
            batchResults: results,
            totalQueries: locations.length
        });
    } catch (error) {
        console.error('Batch nearby search error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process batch search'
        });
    }
});

/**
 * GET /location/stats
 * Get location system statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await driverStatusService.getSystemStats();

        res.status(200).json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get system stats'
        });
    }
});

module.exports = router;