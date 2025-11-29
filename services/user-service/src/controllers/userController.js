const User = require('../models/User');
const axios = require('axios');

/**
 * Get all users with pagination and filtering
 * GET /api/users
 */
const getUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, role, isOnline, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

        // Build filter object
        const filter = { isActive: true };

        if (role) {
            filter.role = role;
        }

        if (isOnline !== undefined) {
            filter.isOnline = isOnline === 'true';
        }

        // Build sort object
        const sortObj = {};
        sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Execute query
        const [users, totalUsers] = await Promise.all([
            User.find(filter)
                .select('-passwordHash')
                .sort(sortObj)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            User.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(totalUsers / parseInt(limit));

        res.json({
            success: true,
            message: 'Users retrieved successfully',
            data: {
                users,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalUsers,
                    hasNext: parseInt(page) < totalPages,
                    hasPrev: parseInt(page) > 1
                }
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve users',
            message: 'Internal server error'
        });
    }
};

/**
 * Get user by ID
 * GET /api/users/:id
 */
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findOne({ _id: id, isActive: true })
            .select('-passwordHash')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                message: 'User does not exist or has been deactivated'
            });
        }

        res.json({
            success: true,
            message: 'User retrieved successfully',
            data: {
                user
            }
        });

    } catch (error) {
        console.error('Get user by ID error:', error);

        // Handle invalid ObjectId
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID',
                message: 'The provided user ID is not valid'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to retrieve user',
            message: 'Internal server error'
        });
    }
};

/**
 * Update user profile
 * PUT /api/users/:id
 */
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Remove fields that shouldn't be updated directly
        const forbiddenFields = ['email', 'passwordHash', 'role', 'isActive', 'createdAt', 'updatedAt'];
        forbiddenFields.forEach(field => delete updates[field]);

        // Special handling for driver info updates
        if (updates.driverInfo && req.user.role === 'DRIVER') {
            // Only allow certain fields to be updated
            const allowedDriverFields = ['vehicle'];
            const filteredDriverInfo = {};

            allowedDriverFields.forEach(field => {
                if (updates.driverInfo[field]) {
                    filteredDriverInfo[field] = updates.driverInfo[field];
                }
            });

            if (Object.keys(filteredDriverInfo).length > 0) {
                Object.keys(filteredDriverInfo).forEach(field => {
                    updates[`driverInfo.${field}`] = filteredDriverInfo[field];
                });
            }
            delete updates.driverInfo;
        }

        const updatedUser = await User.findOneAndUpdate(
            { _id: id, isActive: true },
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-passwordHash');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                message: 'User does not exist or has been deactivated'
            });
        }

        console.log(`User updated: ${updatedUser.email}`);

        res.json({
            success: true,
            message: 'User updated successfully',
            data: {
                user: updatedUser
            }
        });

    } catch (error) {
        console.error('Update user error:', error);

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

        // Handle duplicate key error
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            return res.status(400).json({
                success: false,
                error: 'Duplicate field',
                message: `${field} already exists`
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to update user',
            message: 'Internal server error'
        });
    }
};

/**
 * Update user location
 * PUT /api/users/:id/location
 */
const updateLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const { coordinates, address } = req.body;

        const locationUpdate = {
            location: {
                type: 'Point',
                coordinates: coordinates,
                address: address
            }
        };

        // For drivers, also update lastLocationUpdate timestamp
        if (req.user.role === 'DRIVER') {
            locationUpdate['driverInfo.lastLocationUpdate'] = new Date();
        }

        const updatedUser = await User.findOneAndUpdate(
            { _id: id, isActive: true },
            { $set: locationUpdate },
            { new: true, runValidators: true }
        ).select('location driverInfo.lastLocationUpdate');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                message: 'User does not exist or has been deactivated'
            });
        }

        res.json({
            success: true,
            message: 'Location updated successfully',
            data: {
                location: updatedUser.location,
                lastLocationUpdate: updatedUser.driverInfo?.lastLocationUpdate
            }
        });

    } catch (error) {
        console.error('Update location error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update location',
            message: 'Internal server error'
        });
    }
};

/**
 * Update driver status (DRIVER only)
 * PUT /api/users/:id/driver-status
 */
const updateDriverStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { driverStatus, location } = req.body; // location có thể { latitude, longitude, address? }

        console.log('req.body: ', req.body);
        // Check role
        if (req.user.role !== 'DRIVER') {
            return res.status(403).json({
                success: false,
                error: 'Access forbidden',
                message: 'Only drivers can update driver status'
            });
        }

        const currentUser = await User.findOne({ _id: id, role: 'DRIVER', isActive: true })
            .select('location driverInfo');

        if (!currentUser) {
            return res.status(404).json({
                success: false,
                error: 'Driver not found',
                message: 'Driver does not exist or has been deactivated'
            });
        }

        // Validate incoming location (numbers, range)
        const hasValidBodyLocation = location &&
            !Number.isNaN(Number(location.latitude)) &&
            !Number.isNaN(Number(location.longitude)) &&
            Math.abs(Number(location.latitude)) <= 90 &&
            Math.abs(Number(location.longitude)) <= 180;

        // Build $set payload — **SET GeoJSON shape** khi lưu
        const setObj = {
            'driverInfo.driverStatus': driverStatus,
            'driverInfo.lastLocationUpdate': new Date()
        };

        if (hasValidBodyLocation) {
            const lat = Number(location.latitude);
            const lon = Number(location.longitude);
            setObj.location = {
                type: 'Point',
                coordinates: [lon, lat],
                address: location.address || undefined
            };
        }

        // Run validators (important) and return new doc
        const updatedUser = await User.findOneAndUpdate(
            { _id: id, role: 'DRIVER', isActive: true },
            { $set: setObj },
            { new: true, runValidators: true, context: 'query' } // context:'query' giúp validators chạy đúng khi dùng update
        ).select('driverInfo location');

        console.log('updatedUser: ', updatedUser);

        // Update isOnline
        const isOnline = ['AVAILABLE', 'BUSY', 'IN_TRIP'].includes(driverStatus);
        await User.findByIdAndUpdate(id, { isOnline });

        // Decide location to sync: ưu tiên DB GeoJSON, fallback body location
        let locToSync = null;
        if (updatedUser && updatedUser.location && Array.isArray(updatedUser.location.coordinates) && updatedUser.location.coordinates.length === 2) {
            locToSync = {
                latitude: updatedUser.location.coordinates[1],
                longitude: updatedUser.location.coordinates[0]
            };
        } else if (hasValidBodyLocation) {
            // fallback: use request body location
            locToSync = { latitude: Number(location.latitude), longitude: Number(location.longitude) };
        }

        // Sync to Trip Service if have location
        try {
            const tripServiceUrl = process.env.TRIP_SERVICE_URL || 'http://trip-service:3000';
            if (locToSync) {
                await axios.post(`${tripServiceUrl}/drivers/location/sync`, {
                    driverId: id,
                    latitude: locToSync.latitude,
                    longitude: locToSync.longitude,
                    status: driverStatus
                }, {
                    timeout: 5000,
                    headers: { 'Content-Type': 'application/json' }
                });

                console.log(`Driver location synced to Trip Service: ${id} -> ${driverStatus}`);
            } else {
                console.warn(`Driver ${id} status updated but no location available for sync`);
            }
        } catch (syncError) {
            console.error(`Failed to sync driver location with Trip Service: ${syncError.message}`);
        }

        console.log(`Driver status updated: ${req.user.email} -> ${driverStatus}`);

        res.json({
            success: true,
            message: 'Driver status updated successfully',
            data: {
                driverStatus: updatedUser.driverInfo.driverStatus,
                isOnline,
                lastLocationUpdate: updatedUser.driverInfo.lastLocationUpdate,
                locationSynced: !!locToSync
            }
        });

    } catch (error) {
        console.error('Update driver status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update driver status',
            message: 'Internal server error'
        });
    }
};

/**
 * Get available drivers (for trip matching)
 * GET /api/users/drivers/available
 */
const getAvailableDrivers = async (req, res) => {
    try {
        const { vehicleType, lat, lng, radius = 5000 } = req.query; // radius in meters

        const filter = {
            role: 'DRIVER',
            isActive: true,
            isOnline: true,
            'driverInfo.driverStatus': 'AVAILABLE'
        };

        // Add vehicle type filter if provided
        if (vehicleType) {
            filter['driverInfo.vehicle.vehicleType'] = vehicleType;
        }

        let query = User.find(filter)
            .select('fullName phoneNumber location rating driverInfo.vehicle driverInfo.driverStatus driverInfo.totalTrips');

        // Add geospatial query if coordinates provided
        if (lat && lng) {
            query = query.where('location').near({
                center: {
                    type: 'Point',
                    coordinates: [parseFloat(lng), parseFloat(lat)]
                },
                maxDistance: parseInt(radius)
            });
        }

        const drivers = await query.limit(50).lean(); // Limit to 50 for performance

        res.json({
            success: true,
            message: 'Available drivers retrieved successfully',
            data: {
                drivers,
                count: drivers.length,
                searchCriteria: {
                    vehicleType,
                    center: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
                    radius: parseInt(radius)
                }
            }
        });

    } catch (error) {
        console.error('Get available drivers error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve available drivers',
            message: 'Internal server error'
        });
    }
};

/**
 * Deactivate user (soft delete)
 * DELETE /api/users/:id
 */
const deactivateUser = async (req, res) => {
    try {
        const { id } = req.params;

        const updatedUser = await User.findByIdAndUpdate(
            id,
            {
                $set: {
                    isActive: false,
                    isOnline: false,
                    'driverInfo.driverStatus': 'OFFLINE'
                }
            },
            { new: true }
        ).select('email role isActive');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                message: 'User does not exist'
            });
        }

        console.log(`User deactivated: ${updatedUser.email}`);

        res.json({
            success: true,
            message: 'User deactivated successfully',
            data: {
                user: {
                    id: updatedUser._id,
                    email: updatedUser.email,
                    role: updatedUser.role,
                    isActive: updatedUser.isActive
                }
            }
        });

    } catch (error) {
        console.error('Deactivate user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to deactivate user',
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getUsers,
    getUserById,
    updateUser,
    updateLocation,
    updateDriverStatus,
    getAvailableDrivers,
    deactivateUser
};