const User = require('../models/User');
const { generateToken } = require('../middlewares/auth');

/**
 * Register new user (passenger or driver)
 * POST /api/auth/register
 */
const register = async (req, res) => {
    try {
        const { email, password, fullName, phoneNumber, role, driverInfo } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [
                { email: email.toLowerCase() },
                { phoneNumber }
            ]
        });

        if (existingUser) {
            if (existingUser.email === email.toLowerCase()) {
                return res.status(400).json({
                    success: false,
                    error: 'User exists',
                    message: 'Email already registered'
                });
            }
            if (existingUser.phoneNumber === phoneNumber) {
                return res.status(400).json({
                    success: false,
                    error: 'User exists',
                    message: 'Phone number already registered'
                });
            }
        }

        // Create new user
        const userData = {
            email: email.toLowerCase(),
            passwordHash: password, // Will be hashed by pre-save middleware
            fullName,
            phoneNumber,
            role,
            isActive: true
        };

        // Add driver info if role is DRIVER
        if (role === 'DRIVER' && driverInfo) {
            userData.driverInfo = {
                ...driverInfo,
                driverStatus: 'OFFLINE',
                totalTrips: 0,
                lastLocationUpdate: new Date()
            };
        }

        const newUser = new User(userData);
        await newUser.save();

        // Generate JWT token
        const token = generateToken(newUser);

        // Prepare response (exclude sensitive data)
        const userResponse = {
            id: newUser.id,
            email: newUser.email,
            fullName: newUser.fullName,
            phoneNumber: newUser.phoneNumber,
            role: newUser.role,
            isOnline: newUser.isOnline,
            rating: newUser.rating,
            createdAt: newUser.createdAt
        };

        // Add driver info to response if applicable
        if (newUser.role === 'DRIVER' && newUser.driverInfo) {
            userResponse.driverInfo = {
                vehicle: newUser.driverInfo.vehicle,
                driverStatus: newUser.driverInfo.driverStatus,
                totalTrips: newUser.driverInfo.totalTrips
            };
        }

        console.log(`New ${role.toLowerCase()} registered: ${email}`);

        res.status(201).json({
            success: true,
            message: `${role.toLowerCase()} registered successfully`,
            data: {
                user: userResponse,
                token,
                tokenType: 'Bearer'
            }
        });

    } catch (error) {
        console.error('Registration error:', error);

        // Handle MongoDB duplicate key error
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            return res.status(400).json({
                success: false,
                error: 'Duplicate field',
                message: `${field} already exists`
            });
        }

        // Handle validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => ({
                field: err.path,
                message: err.message
            }));

            return res.status(400).json({
                success: false,
                error: 'Validation error',
                message: 'Invalid user data',
                details: validationErrors
            });
        }

        res.status(500).json({
            success: false,
            error: 'Registration failed',
            message: 'Internal server error during registration'
        });
    }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user with password field included
        const user = await User.findByEmailWithPassword(email);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials',
                message: 'Email or password is incorrect'
            });
        }

        // Verify password
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials',
                message: 'Email or password is incorrect'
            });
        }

        // Update user as online
        await User.findByIdAndUpdate(user._id, {
            isOnline: true,
            'deviceInfo.lastLogin': new Date()
        });

        // Generate JWT token
        const token = generateToken(user);

        // Prepare response
        const userResponse = {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            phoneNumber: user.phoneNumber,
            role: user.role,
            isOnline: true,
            inTrip: user.inTrip,
            rating: user.rating,
            location: user.location
        };

        // Add driver info if applicable
        if (user.role === 'DRIVER' && user.driverInfo) {
            userResponse.driverInfo = {
                vehicle: user.driverInfo.vehicle,
                driverStatus: user.driverInfo.driverStatus,
                totalTrips: user.driverInfo.totalTrips
            };
        }

        console.log(`User logged in: ${email} (${user.role})`);

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: userResponse,
                token,
                tokenType: 'Bearer',
                expiresIn: '24h'
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed',
            message: 'Internal server error during login'
        });
    }
};

/**
 * Logout user
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
    try {
        const userId = req.userId;

        // Update user as offline
        await User.findByIdAndUpdate(userId, {
            isOnline: false,
            'deviceInfo.lastLogout': new Date()
        });

        // For drivers, set status to OFFLINE
        const user = await User.findById(userId);
        if (user.role === 'DRIVER') {
            await User.findByIdAndUpdate(userId, {
                'driverInfo.driverStatus': 'OFFLINE'
            });
        }

        console.log(`User logged out: ${user.email}`);

        res.json({
            success: true,
            message: 'Logout successful'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed',
            message: 'Internal server error during logout'
        });
    }
};

/**
 * Get current user profile
 * GET /api/auth/profile
 */
const getProfile = async (req, res) => {
    try {
        const user = req.user;

        const userResponse = {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            phoneNumber: user.phoneNumber,
            role: user.role,
            isOnline: user.isOnline,
            inTrip: user.inTrip,
            isActive: user.isActive,
            rating: user.rating,
            location: user.location,
            deviceInfo: user.deviceInfo,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };

        // Add driver info if applicable
        if (user.role === 'DRIVER' && user.driverInfo) {
            userResponse.driverInfo = user.driverInfo;
        }

        res.json({
            success: true,
            message: 'Profile retrieved successfully',
            data: {
                user: userResponse
            }
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Profile retrieval failed',
            message: 'Internal server error'
        });
    }
};

/**
 * Verify token (middleware endpoint)
 * GET /api/auth/verify
 */
const verifyToken = async (req, res) => {
    try {
        // Token đã được verify bởi authenticateToken middleware
        const user = req.user;

        res.json({
            success: true,
            message: 'Token is valid',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.fullName,
                    role: user.role,
                    isOnline: user.isOnline
                },
                tokenValid: true
            }
        });

    } catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Token verification failed',
            message: 'Internal server error'
        });
    }
};

/**
 * Change password
 * PUT /api/auth/change-password
 */
const changePassword = async (req, res) => {
    try {
        const userId = req.userId;
        const { currentPassword, newPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Missing fields',
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Invalid password',
                message: 'New password must be at least 6 characters long'
            });
        }

        // Get user with password
        const user = await User.findById(userId).select('+passwordHash');
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                message: 'User does not exist'
            });
        }

        // Verify current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid password',
                message: 'Current password is incorrect'
            });
        }

        // Update password (will be hashed by pre-save middleware)
        user.passwordHash = newPassword;
        await user.save();

        console.log(`Password changed for user: ${user.email}`);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            error: 'Password change failed',
            message: 'Internal server error'
        });
    }
};

module.exports = {
    register,
    login,
    logout,
    getProfile,
    verifyToken,
    changePassword
};