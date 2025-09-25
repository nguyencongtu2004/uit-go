const { DatabaseManager } = require('../../common/shared');

class DriverServiceDatabase extends DatabaseManager {
    constructor() {
        super('DriverService');
    }

    async connect() {
        try {
            const mongoUri = process.env.DB_URI;

            if (!mongoUri) {
                throw new Error('DB_URI environment variable is not set');
            }

            console.log(`🔗 ${this.serviceName} connecting to MongoDB...`);
            console.log(`   URI: ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials

            await super.connect(mongoUri);

            // Setup service-specific indexes
            await this.setupIndexes();

            return this.connection;

        } catch (error) {
            console.error(`❌ ${this.serviceName} database connection failed:`, error.message);
            throw error;
        }
    }

    /**
     * Setup indexes for optimal query performance
     */
    async setupIndexes() {
        try {
            console.log(`📋 ${this.serviceName} setting up database indexes...`);

            // Drivers collection indexes
            await this.createIndex('drivers', { userId: 1 }, { unique: true, name: 'idx_drivers_user_id_unique' });
            await this.createIndex('drivers', { licenseNumber: 1 }, { unique: true, name: 'idx_license_unique' });
            await this.createIndex('drivers', { vehicleType: 1 }, { name: 'idx_vehicle_type' });
            await this.createIndex('drivers', { isAvailable: 1 }, { name: 'idx_is_available' });
            await this.createIndex('drivers', { status: 1 }, { name: 'idx_driver_status' });
            await this.createIndex('drivers', { rating: -1 }, { name: 'idx_rating_desc' });
            await this.createIndex('drivers', { createdAt: 1 }, { name: 'idx_created_at' });
            await this.createIndex('drivers', { 'currentLocation': '2dsphere' }, { name: 'idx_current_location_geo' });

            // Driver locations collection indexes (for real-time tracking)
            await this.createIndex('driver_locations', { driverId: 1 }, { name: 'idx_locations_driver_id' });
            await this.createIndex('driver_locations', { 'location': '2dsphere' }, { name: 'idx_locations_geo' });
            await this.createIndex('driver_locations', { timestamp: 1 }, { expireAfterSeconds: 86400, name: 'idx_locations_ttl' }); // 24 hours TTL
            await this.createIndex('driver_locations', { driverId: 1, timestamp: -1 }, { name: 'idx_driver_timestamp_compound' });

            // Driver sessions collection indexes
            await this.createIndex('driver_sessions', { driverId: 1 }, { name: 'idx_sessions_driver_id' });
            await this.createIndex('driver_sessions', { startTime: 1 }, { name: 'idx_sessions_start_time' });
            await this.createIndex('driver_sessions', { endTime: 1 }, { sparse: true, name: 'idx_sessions_end_time' });
            await this.createIndex('driver_sessions', { status: 1 }, { name: 'idx_sessions_status' });

            // Driver ratings collection indexes
            await this.createIndex('driver_ratings', { driverId: 1 }, { name: 'idx_ratings_driver_id' });
            await this.createIndex('driver_ratings', { tripId: 1 }, { unique: true, name: 'idx_ratings_trip_id_unique' });
            await this.createIndex('driver_ratings', { rating: 1 }, { name: 'idx_ratings_rating' });
            await this.createIndex('driver_ratings', { createdAt: 1 }, { name: 'idx_ratings_created_at' });

            console.log(`✅ ${this.serviceName} database indexes setup complete`);

        } catch (error) {
            console.error(`❌ ${this.serviceName} failed to setup indexes:`, error.message);
            // Don't throw here - indexes are important but not critical for service startup
        }
    }

    /**
     * Update driver location with geospatial data
     */
    async updateDriverLocation(driverId, latitude, longitude, metadata = {}) {
        try {
            const locationData = {
                driverId,
                location: {
                    type: 'Point',
                    coordinates: [longitude, latitude] // GeoJSON format: [lng, lat]
                },
                timestamp: new Date(),
                ...metadata
            };

            // Insert new location record
            await this.connection.collection('driver_locations').insertOne(locationData);

            // Update driver's current location
            await this.connection.collection('drivers').updateOne(
                { _id: driverId },
                {
                    $set: {
                        currentLocation: locationData.location,
                        lastLocationUpdate: locationData.timestamp
                    }
                }
            );

            return locationData;
        } catch (error) {
            console.error(`❌ ${this.serviceName} failed to update driver location:`, error.message);
            throw error;
        }
    }

    /**
     * Find nearby available drivers
     */
    async findNearbyDrivers(longitude, latitude, radiusMeters = 5000, vehicleType = null, limit = 10) {
        try {
            const query = {
                isAvailable: true,
                status: 'active',
                currentLocation: {
                    $near: {
                        $geometry: {
                            type: 'Point',
                            coordinates: [longitude, latitude]
                        },
                        $maxDistance: radiusMeters
                    }
                }
            };

            if (vehicleType) {
                query.vehicleType = vehicleType;
            }

            const drivers = await this.connection.collection('drivers')
                .find(query)
                .limit(limit)
                .toArray();

            return drivers;
        } catch (error) {
            console.error(`❌ ${this.serviceName} failed to find nearby drivers:`, error.message);
            return [];
        }
    }

    /**
     * Get driver statistics
     */
    async getDriverStats() {
        try {
            const stats = await this.connection.collection('drivers').aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        avgRating: { $avg: '$rating' },
                        available: {
                            $sum: {
                                $cond: [{ $eq: ['$isAvailable', true] }, 1, 0]
                            }
                        }
                    }
                }
            ]).toArray();

            return stats;
        } catch (error) {
            console.error(`❌ ${this.serviceName} failed to get driver stats:`, error.message);
            return [];
        }
    }

    /**
     * Clean old location records
     */
    async cleanOldLocations(olderThanHours = 48) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

            const result = await this.connection.collection('driver_locations').deleteMany({
                timestamp: { $lt: cutoffDate }
            });

            if (result.deletedCount > 0) {
                console.log(`🧹 ${this.serviceName} cleaned ${result.deletedCount} old location records`);
            }

            return result.deletedCount;
        } catch (error) {
            console.error(`❌ ${this.serviceName} failed to clean old locations:`, error.message);
            return 0;
        }
    }

    /**
     * Health check specific to driver service
     */
    async healthCheck() {
        try {
            const isHealthy = await this.isHealthy();
            if (!isHealthy) return { status: 'unhealthy', details: 'Database connection failed' };

            // Check if we can query drivers collection
            const driverCount = await this.connection.collection('drivers').countDocuments();
            const availableCount = await this.connection.collection('drivers').countDocuments({ isAvailable: true });

            // Check if geospatial indexes exist
            const indexes = await this.connection.collection('drivers').listIndexes().toArray();
            const hasGeoIndex = indexes.some(idx => idx.name === 'idx_current_location_geo');

            return {
                status: 'healthy',
                details: {
                    driverCount,
                    availableDrivers: availableCount,
                    hasGeoIndex,
                    indexCount: indexes.length,
                    connectionState: this.getHealthStatus()
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                details: `Health check failed: ${error.message}`
            };
        }
    }
}

// Export singleton instance
const driverDatabase = new DriverServiceDatabase();
module.exports = driverDatabase;