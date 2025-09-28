const User = require('../models/User');

/**
 * Bulk create users for load testing
 * POST /api/users/bulk-create
 */
const bulkCreateUsers = async (req, res) => {
    try {
        const { users, skipExisting = true } = req.body;

        if (!Array.isArray(users) || users.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid input',
                message: 'Users array is required and cannot be empty'
            });
        }

        if (users.length > 1000) {
            return res.status(400).json({
                success: false,
                error: 'Too many users',
                message: 'Maximum 1000 users per batch'
            });
        }

        const results = {
            created: [],
            skipped: [],
            errors: []
        };

        for (const userData of users) {
            try {
                // Check if user exists
                if (skipExisting) {
                    const existingUser = await User.findOne({
                        $or: [
                            { email: userData.email?.toLowerCase() },
                            { phoneNumber: userData.phoneNumber }
                        ]
                    });

                    if (existingUser) {
                        results.skipped.push({
                            email: userData.email,
                            reason: 'User already exists'
                        });
                        continue;
                    }
                }

                // Create user
                const newUser = new User({
                    ...userData,
                    email: userData.email?.toLowerCase(),
                    passwordHash: userData.password || 'password123',
                    isActive: true
                });

                await newUser.save();

                results.created.push({
                    id: newUser.id,
                    email: newUser.email,
                    fullName: newUser.fullName,
                    role: newUser.role
                });

            } catch (error) {
                results.errors.push({
                    email: userData.email,
                    error: error.message
                });
            }
        }

        const totalProcessed = results.created.length + results.skipped.length + results.errors.length;

        console.log(`Bulk user creation: ${results.created.length} created, ${results.skipped.length} skipped, ${results.errors.length} errors`);

        res.status(200).json({
            success: true,
            message: 'Bulk user creation completed',
            data: {
                summary: {
                    totalRequested: users.length,
                    totalProcessed,
                    created: results.created.length,
                    skipped: results.skipped.length,
                    errors: results.errors.length
                },
                results
            }
        });

    } catch (error) {
        console.error('Bulk create users error:', error);
        res.status(500).json({
            success: false,
            error: 'Bulk creation failed',
            message: 'Internal server error during bulk user creation'
        });
    }
};

/**
 * Generate test users data (for development)
 * POST /api/users/generate-test-data
 */
const generateTestData = async (req, res) => {
    try {
        const { passengerCount = 50, driverCount = 100 } = req.body;

        if (passengerCount > 500 || driverCount > 500) {
            return res.status(400).json({
                success: false,
                error: 'Too many users',
                message: 'Maximum 500 users per type'
            });
        }

        const users = [];

        // Generate passengers
        for (let i = 1; i <= passengerCount; i++) {
            const randomId = Math.random().toString(36).substring(7);
            users.push({
                email: `passenger${i}_${randomId}@test.uit-go.com`,
                password: 'password123',
                fullName: `Test Passenger ${i}`,
                phoneNumber: `090${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`,
                role: 'PASSENGER',
                isOnline: Math.random() > 0.5,
                rating: {
                    averageRating: Number((4 + Math.random()).toFixed(1)),
                    totalRatings: Math.floor(Math.random() * 50)
                }
            });
        }

        // Generate drivers
        const vehicleTypes = ['MOTORBIKE', 'CAR_4_SEAT', 'CAR_7_SEAT'];
        const makes = ['Toyota', 'Honda', 'Hyundai', 'Kia', 'Mazda', 'Nissan'];
        const models = ['Camry', 'Civic', 'Elantra', 'Cerato', 'CX-5', 'Altima'];
        const colors = ['White', 'Silver', 'Black', 'Blue', 'Red', 'Gray'];

        for (let i = 1; i <= driverCount; i++) {
            const randomId = Math.random().toString(36).substring(7);
            const make = makes[Math.floor(Math.random() * makes.length)];
            const model = models[Math.floor(Math.random() * models.length)];

            users.push({
                email: `driver${i}_${randomId}@test.uit-go.com`,
                password: 'password123',
                fullName: `Test Driver ${i}`,
                phoneNumber: `091${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`,
                role: 'DRIVER',
                isOnline: Math.random() > 0.3,
                rating: {
                    averageRating: Number((4 + Math.random()).toFixed(1)),
                    totalRatings: Math.floor(Math.random() * 100)
                },
                driverInfo: {
                    vehicle: {
                        licensePlate: `${Math.floor(Math.random() * 90 + 10)}A-${Math.floor(Math.random() * 900 + 100)}.${Math.floor(Math.random() * 90 + 10)}`,
                        make,
                        model,
                        year: Math.floor(Math.random() * 9) + 2015,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        vehicleType: vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)]
                    },
                    driverStatus: Math.random() > 0.5 ? 'AVAILABLE' : 'OFFLINE',
                    totalTrips: Math.floor(Math.random() * 100),
                    lastLocationUpdate: new Date()
                }
            });
        }

        res.status(200).json({
            success: true,
            message: 'Test data generated successfully',
            data: {
                users,
                summary: {
                    totalUsers: users.length,
                    passengers: passengerCount,
                    drivers: driverCount
                }
            }
        });

    } catch (error) {
        console.error('Generate test data error:', error);
        res.status(500).json({
            success: false,
            error: 'Test data generation failed',
            message: 'Internal server error'
        });
    }
};

/**
 * Clean test data (development only)
 * DELETE /api/users/clean-test-data
 */
const cleanTestData = async (req, res) => {
    try {
        // Only allow in development
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({
                success: false,
                error: 'Operation not allowed',
                message: 'Cannot clean test data in production'
            });
        }

        const { confirm = false } = req.body;

        if (!confirm) {
            return res.status(400).json({
                success: false,
                error: 'Confirmation required',
                message: 'Set confirm: true to proceed with data deletion'
            });
        }

        // Delete all test users
        const result = await User.deleteMany({
            email: { $regex: /@test\.uit-go\.com$/ }
        });

        console.log(`Cleaned ${result.deletedCount} test users`);

        res.status(200).json({
            success: true,
            message: 'Test data cleaned successfully',
            data: {
                deletedCount: result.deletedCount
            }
        });

    } catch (error) {
        console.error('Clean test data error:', error);
        res.status(500).json({
            success: false,
            error: 'Test data cleaning failed',
            message: 'Internal server error'
        });
    }
};

/**
 * Get test data statistics
 * GET /api/users/test-stats
 */
const getTestStats = async (req, res) => {
    try {
        const testUsers = await User.find({
            email: { $regex: /@test\.uit-go\.com$/ }
        });

        const passengers = testUsers.filter(user => user.role === 'PASSENGER');
        const drivers = testUsers.filter(user => user.role === 'DRIVER');
        const onlineUsers = testUsers.filter(user => user.isOnline);

        const driverStats = {
            total: drivers.length,
            online: drivers.filter(d => d.isOnline).length,
            available: drivers.filter(d => d.driverInfo?.driverStatus === 'AVAILABLE').length,
            inTrip: drivers.filter(d => d.driverInfo?.driverStatus === 'IN_TRIP').length,
            offline: drivers.filter(d => d.driverInfo?.driverStatus === 'OFFLINE').length
        };

        res.status(200).json({
            success: true,
            message: 'Test statistics retrieved successfully',
            data: {
                summary: {
                    totalTestUsers: testUsers.length,
                    passengers: passengers.length,
                    drivers: drivers.length,
                    onlineUsers: onlineUsers.length,
                    utilizationRate: testUsers.length > 0 ?
                        Number((onlineUsers.length / testUsers.length * 100).toFixed(2)) : 0
                },
                driverStats,
                recentUsers: testUsers
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 10)
                    .map(user => ({
                        id: user.id,
                        email: user.email,
                        role: user.role,
                        isOnline: user.isOnline,
                        createdAt: user.createdAt
                    }))
            }
        });

    } catch (error) {
        console.error('Get test stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Test stats retrieval failed',
            message: 'Internal server error'
        });
    }
};

module.exports = {
    bulkCreateUsers,
    generateTestData,
    cleanTestData,
    getTestStats
};