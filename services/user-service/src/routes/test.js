const express = require('express');
const { bulkCreateUsers, generateTestData, cleanTestData, getTestStats } = require('../controllers/testController');

const router = express.Router();

// Development/Testing endpoints
// These should be disabled in production

/**
 * POST /api/test/bulk-create-users
 * Create multiple users at once for load testing
 */
router.post('/bulk-create-users', bulkCreateUsers);

/**
 * POST /api/test/bulk-login
 * Login multiple users and return tokens
 */
router.post('/bulk-login', async (req, res) => {
    try {
        const { credentials } = req.body;

        if (!Array.isArray(credentials)) {
            return res.status(400).json({
                success: false,
                error: 'Credentials array is required'
            });
        }

        const jwt = require('jsonwebtoken');
        const User = require('../models/User');
        const results = [];

        for (const cred of credentials) {
            try {
                const user = await User.findByEmailWithPassword(cred.email);

                if (user && await user.comparePassword(cred.password)) {
                    const token = jwt.sign(
                        {
                            userId: user.id,
                            email: user.email,
                            role: user.role
                        },
                        process.env.JWT_SECRET,
                        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
                    );

                    results.push({
                        success: true,
                        user: {
                            id: user.id,
                            email: user.email,
                            fullName: user.fullName,
                            role: user.role
                        },
                        token: token
                    });
                } else {
                    results.push({
                        success: false,
                        email: cred.email,
                        error: 'Invalid credentials'
                    });
                }
            } catch (error) {
                results.push({
                    success: false,
                    email: cred.email,
                    error: error.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;

        res.json({
            success: true,
            message: `Bulk login completed: ${successCount}/${credentials.length} successful`,
            data: {
                summary: {
                    total: credentials.length,
                    successful: successCount,
                    failed: credentials.length - successCount
                },
                results: results
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Bulk login failed',
            message: error.message
        });
    }
});

/**
 * POST /api/test/generate-test-data  
 * Generate structured test data
 */
router.post('/generate-test-data', generateTestData);

/**
 * DELETE /api/test/clean-test-data
 * Remove all test data (development only)
 */
router.delete('/clean-test-data', cleanTestData);

/**
 * GET /api/test/stats
 * Get statistics about test data
 */
router.get('/stats', getTestStats);

module.exports = router;