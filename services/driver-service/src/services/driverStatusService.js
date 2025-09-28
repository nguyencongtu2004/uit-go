const Driver = require('../models/Driver');
const locationService = require('./locationService');

class DriverStatusService {
    constructor() {
        this.STATUS = {
            OFFLINE: 'OFFLINE',
            ONLINE: 'ONLINE',
            IN_TRIP: 'IN_TRIP'
        };
    }

    /**
     * Set driver online and update location
     * Optimized for high throughput
     */
    async setDriverOnline(driverId, longitude, latitude) {
        try {
            // Update in Redis first (faster)
            await locationService.updateDriverLocation(
                driverId,
                longitude,
                latitude,
                this.STATUS.ONLINE
            );

            // Update in MongoDB (eventual consistency)
            const driver = await Driver.findOneAndUpdate(
                { userId: driverId },
                {
                    status: this.STATUS.ONLINE,
                    location: {
                        type: 'Point',
                        coordinates: [longitude, latitude]
                    }
                },
                { upsert: true, new: true }
            );

            return {
                success: true,
                driver: {
                    id: driver.userId,
                    status: driver.status,
                    location: driver.location
                }
            };
        } catch (error) {
            console.error('Error setting driver online:', error);
            throw error;
        }
    }

    /**
     * Set driver offline
     */
    async setDriverOffline(driverId) {
        try {
            // Remove from Redis tracking
            await locationService.removeDriverLocation(driverId);

            // Update MongoDB
            const driver = await Driver.findOneAndUpdate(
                { userId: driverId },
                { status: this.STATUS.OFFLINE },
                { new: true }
            );

            return {
                success: true,
                driver: {
                    id: driver?.userId || driverId,
                    status: this.STATUS.OFFLINE
                }
            };
        } catch (error) {
            console.error('Error setting driver offline:', error);
            throw error;
        }
    }

    /**
     * Set driver in trip (busy)
     */
    async setDriverInTrip(driverId) {
        try {
            // Update Redis status
            const location = await locationService.getDriverLocation(driverId);
            if (location) {
                await locationService.updateDriverLocation(
                    driverId,
                    location.longitude,
                    location.latitude,
                    this.STATUS.IN_TRIP
                );
            }

            // Update MongoDB
            const driver = await Driver.findOneAndUpdate(
                { userId: driverId },
                { status: this.STATUS.IN_TRIP },
                { new: true }
            );

            return {
                success: true,
                driver: {
                    id: driver?.userId || driverId,
                    status: this.STATUS.IN_TRIP
                }
            };
        } catch (error) {
            console.error('Error setting driver in trip:', error);
            throw error;
        }
    }

    /**
     * Update driver location (high frequency operation)
     * Optimized for 10,000+ updates per second
     */
    async updateLocation(driverId, longitude, latitude) {
        try {
            // Get current status first
            const currentLocation = await locationService.getDriverLocation(driverId);
            if (!currentLocation) {
                // Driver not in system, set as offline
                await this.setDriverOffline(driverId);
                return { success: false, error: 'Driver not found in location tracking' };
            }

            // Update only in Redis for performance (hot path)
            await locationService.updateDriverLocation(
                driverId,
                longitude,
                latitude,
                this.STATUS.ONLINE // Assume online if updating location
            );

            // Async update to MongoDB (eventual consistency)
            setImmediate(async () => {
                try {
                    await Driver.findOneAndUpdate(
                        { userId: driverId },
                        {
                            location: {
                                type: 'Point',
                                coordinates: [longitude, latitude]
                            },
                            status: this.STATUS.ONLINE
                        }
                    );
                } catch (error) {
                    console.error('Error updating MongoDB location:', error);
                }
            });

            return { success: true };
        } catch (error) {
            console.error('Error updating driver location:', error);
            throw error;
        }
    }

    /**
     * Get driver current status
     */
    async getDriverStatus(driverId) {
        try {
            // Try Redis first (faster)
            const location = await locationService.getDriverLocation(driverId);
            if (location) {
                return {
                    id: driverId,
                    status: this.STATUS.ONLINE,
                    location
                };
            }

            // Fallback to MongoDB
            const driver = await Driver.findOne({ userId: driverId });
            if (driver) {
                return {
                    id: driver.userId,
                    status: driver.status,
                    location: driver.location
                };
            }

            return null;
        } catch (error) {
            console.error('Error getting driver status:', error);
            throw error;
        }
    }

    /**
     * Find available drivers near location
     * Core function for load testing
     */
    async findAvailableDrivers(longitude, latitude, radiusKm = 5, limit = 10) {
        try {
            // Use Redis for real-time search (sub-10ms)
            const nearbyDrivers = await locationService.findNearbyDrivers(
                longitude,
                latitude,
                radiusKm,
                limit
            );

            return {
                success: true,
                drivers: nearbyDrivers,
                count: nearbyDrivers.length
            };
        } catch (error) {
            console.error('Error finding available drivers:', error);
            throw error;
        }
    }

    /**
     * Get system stats for monitoring
     */
    async getSystemStats() {
        try {
            const onlineCount = await locationService.getOnlineDriversCount();
            const totalDrivers = await Driver.countDocuments();

            return {
                onlineDrivers: onlineCount,
                totalDrivers,
                utilizationRate: totalDrivers > 0 ? (onlineCount / totalDrivers * 100).toFixed(2) : 0
            };
        } catch (error) {
            console.error('Error getting system stats:', error);
            return {
                onlineDrivers: 0,
                totalDrivers: 0,
                utilizationRate: 0
            };
        }
    }
}

module.exports = new DriverStatusService();