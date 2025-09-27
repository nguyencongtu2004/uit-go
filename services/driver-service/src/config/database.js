const mongoose = require('mongoose');

class DriverServiceDatabase {
    constructor() {
        this.serviceName = 'DriverService';
        this.connection = null;
        this.isConnecting = false;
    }

    async connect() {
        try {
            if (this.connection && mongoose.connection.readyState === 1) {
                console.log(`✅ ${this.serviceName} - Already connected to MongoDB`);
                return this.connection;
            }

            if (this.isConnecting) {
                console.log(`⏳ ${this.serviceName} - Connection in progress...`);
                return new Promise((resolve) => {
                    const checkConnection = () => {
                        if (mongoose.connection.readyState === 1) {
                            resolve(this.connection);
                        } else {
                            setTimeout(checkConnection, 100);
                        }
                    };
                    checkConnection();
                });
            }

            this.isConnecting = true;

            const mongoUri = process.env.DB_URI;
            if (!mongoUri) {
                throw new Error('DB_URI environment variable is not set');
            }

            console.log(`🔗 ${this.serviceName} connecting to MongoDB...`);
            console.log(`   URI: ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`);

            // Connection options optimized for Docker environment
            const options = {
                serverSelectionTimeoutMS: 15000,    // 15 seconds to select server
                socketTimeoutMS: 45000,              // 45 seconds for socket operations
                connectTimeoutMS: 15000,             // 15 seconds to establish connection
                heartbeatFrequencyMS: 10000,         // Heartbeat every 10 seconds
                maxPoolSize: 10,
                minPoolSize: 2,
                maxIdleTimeMS: 30000,
                retryWrites: true,
                retryReads: true
            };

            // Connect to MongoDB
            this.connection = await mongoose.connect(mongoUri, options);

            console.log(`✅ ${this.serviceName} connected to MongoDB successfully!`);
            console.log(`   Database: ${this.connection.connection.db.databaseName}`);
            console.log(`   Host: ${this.connection.connection.host}:${this.connection.connection.port}`);

            // Setup basic indexes
            await this.setupIndexes();

            this.isConnecting = false;
            return this.connection;

        } catch (error) {
            this.isConnecting = false;
            console.error(`❌ ${this.serviceName} database connection failed:`, error.message);
            throw error;
        }
    }

    async setupIndexes() {
        try {
            console.log(`� ${this.serviceName} - Setting up database indexes...`);

            const db = mongoose.connection.db;

            // Drivers collection indexes
            const driversCollection = db.collection('drivers');
            const driverIndexes = [
                { key: { userId: 1 }, options: { unique: true, name: 'idx_drivers_user_id_unique' } },
                { key: { licenseNumber: 1 }, options: { unique: true, name: 'idx_license_unique' } },
                { key: { vehicleType: 1 }, options: { name: 'idx_vehicle_type' } },
                { key: { isAvailable: 1 }, options: { name: 'idx_is_available' } },
                { key: { status: 1 }, options: { name: 'idx_driver_status' } },
                { key: { rating: -1 }, options: { name: 'idx_rating_desc' } },
                { key: { createdAt: 1 }, options: { name: 'idx_created_at' } },
                { key: { 'currentLocation': '2dsphere' }, options: { name: 'idx_current_location_geo' } }
            ];

            // Driver locations collection indexes (for real-time tracking)
            const driverLocationsCollection = db.collection('driver_locations');
            const locationIndexes = [
                { key: { driverId: 1 }, options: { name: 'idx_locations_driver_id' } },
                { key: { 'location': '2dsphere' }, options: { name: 'idx_locations_geo' } },
                { key: { timestamp: 1 }, options: { expireAfterSeconds: 86400, name: 'idx_locations_ttl' } }, // 24 hours TTL
                { key: { driverId: 1, timestamp: -1 }, options: { name: 'idx_driver_timestamp_compound' } }
            ];

            // Driver sessions collection indexes
            const driverSessionsCollection = db.collection('driver_sessions');
            const sessionIndexes = [
                { key: { driverId: 1 }, options: { name: 'idx_sessions_driver_id' } },
                { key: { startTime: 1 }, options: { name: 'idx_sessions_start_time' } },
                { key: { endTime: 1 }, options: { sparse: true, name: 'idx_sessions_end_time' } },
                { key: { status: 1 }, options: { name: 'idx_sessions_status' } }
            ];

            // Driver ratings collection indexes
            const driverRatingsCollection = db.collection('driver_ratings');
            const ratingIndexes = [
                { key: { driverId: 1 }, options: { name: 'idx_ratings_driver_id' } },
                { key: { tripId: 1 }, options: { unique: true, name: 'idx_ratings_trip_id_unique' } },
                { key: { rating: 1 }, options: { name: 'idx_ratings_rating' } },
                { key: { createdAt: 1 }, options: { name: 'idx_ratings_created_at' } }
            ];

            // Create indexes for each collection
            const collections = [
                { collection: driversCollection, indexes: driverIndexes, name: 'drivers' },
                { collection: driverLocationsCollection, indexes: locationIndexes, name: 'driver_locations' },
                { collection: driverSessionsCollection, indexes: sessionIndexes, name: 'driver_sessions' },
                { collection: driverRatingsCollection, indexes: ratingIndexes, name: 'driver_ratings' }
            ];

            for (const { collection, indexes, name } of collections) {
                for (const index of indexes) {
                    try {
                        await collection.createIndex(index.key, index.options);
                        console.log(`   ✅ Created index: ${index.options.name} on ${name}`);
                    } catch (error) {
                        if (error.code === 11000 || error.codeName === 'IndexOptionsConflict') {
                            console.log(`   ℹ️ Index already exists: ${index.options.name} on ${name}`);
                        } else {
                            console.log(`   ⚠️ Failed to create index ${index.options.name} on ${name}: ${error.message}`);
                        }
                    }
                }
            }

            console.log(`✅ ${this.serviceName} - Database indexes setup completed`);

        } catch (error) {
            console.error(`❌ ${this.serviceName} - Failed to setup indexes:`, error.message);
            // Don't throw - indexes are not critical for service startup
        }
    }

    async disconnect() {
        try {
            if (this.connection) {
                await mongoose.disconnect();
                this.connection = null;
                console.log(`✅ ${this.serviceName} - Disconnected from MongoDB`);
            }
        } catch (error) {
            console.error(`❌ ${this.serviceName} - Disconnect error:`, error.message);
        }
    }

    isConnected() {
        return mongoose.connection.readyState === 1;
    }

    getConnectionState() {
        const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
        return {
            state: states[mongoose.connection.readyState] || 'unknown',
            readyState: mongoose.connection.readyState
        };
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

            const db = mongoose.connection.db;

            // Insert new location record
            await db.collection('driver_locations').insertOne(locationData);

            // Update driver's current location
            await db.collection('drivers').updateOne(
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

            const db = mongoose.connection.db;
            const drivers = await db.collection('drivers')
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
            const db = mongoose.connection.db;
            const stats = await db.collection('drivers').aggregate([
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

            const db = mongoose.connection.db;
            const result = await db.collection('driver_locations').deleteMany({
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

    async healthCheck() {
        try {
            if (!this.isConnected()) {
                return {
                    status: 'unhealthy',
                    message: 'Database not connected',
                    details: this.getConnectionState()
                };
            }

            // Test database operation
            const result = await mongoose.connection.db.admin().ping();

            if (result.ok !== 1) {
                return {
                    status: 'unhealthy',
                    message: 'Database ping failed',
                    details: result
                };
            }

            // Get basic stats
            const db = mongoose.connection.db;
            const driverCount = await db.collection('drivers').countDocuments();
            const availableCount = await db.collection('drivers').countDocuments({ isAvailable: true });

            // Check if geospatial indexes exist
            const indexes = await db.collection('drivers').listIndexes().toArray();
            const hasGeoIndex = indexes.some(idx => idx.name === 'idx_current_location_geo');

            return {
                status: 'healthy',
                message: 'Database connection is healthy',
                details: {
                    connectionState: this.getConnectionState(),
                    driverCount,
                    availableDrivers: availableCount,
                    hasGeoIndex,
                    indexCount: indexes.length,
                    database: mongoose.connection.db.databaseName,
                    host: `${mongoose.connection.host}:${mongoose.connection.port}`
                }
            };

        } catch (error) {
            return {
                status: 'unhealthy',
                message: `Health check failed: ${error.message}`,
                details: this.getConnectionState()
            };
        }
    }
}

// Export singleton instance
const database = new DriverServiceDatabase();

// Handle MongoDB connection events
mongoose.connection.on('connected', () => {
    console.log('📡 MongoDB connection established');
});

mongoose.connection.on('error', (error) => {
    console.error('❌ MongoDB connection error:', error.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('📡 MongoDB disconnected');
});

// Handle process termination
process.on('SIGINT', async () => {
    console.log('⚠️  SIGINT received. Closing MongoDB connection...');
    await database.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('⚠️  SIGTERM received. Closing MongoDB connection...');
    await database.disconnect();
    process.exit(0);
});

module.exports = database;