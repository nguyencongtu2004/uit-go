const mongoose = require('mongoose');

class TripServiceDatabase {
    constructor() {
        this.serviceName = 'TripService';
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

            // Trips collection indexes
            const tripsCollection = db.collection('trips');
            const tripIndexes = [
                { key: { userId: 1 }, options: { name: 'idx_trips_user_id' } },
                { key: { driverId: 1 }, options: { name: 'idx_trips_driver_id' } },
                { key: { status: 1 }, options: { name: 'idx_trips_status' } },
                { key: { createdAt: 1 }, options: { name: 'idx_trips_created_at' } },
                { key: { scheduledTime: 1 }, options: { sparse: true, name: 'idx_trips_scheduled_time' } },
                { key: { userId: 1, status: 1 }, options: { name: 'idx_trips_user_status_compound' } },
                { key: { driverId: 1, status: 1 }, options: { name: 'idx_trips_driver_status_compound' } },
                { key: { 'pickup.location': '2dsphere' }, options: { name: 'idx_trips_pickup_geo' } },
                { key: { 'dropoff.location': '2dsphere' }, options: { name: 'idx_trips_dropoff_geo' } }
            ];

            // Trip tracking collection indexes (for real-time updates)
            const tripTrackingCollection = db.collection('trip_tracking');
            const trackingIndexes = [
                { key: { tripId: 1 }, options: { name: 'idx_tracking_trip_id' } },
                { key: { 'currentLocation': '2dsphere' }, options: { name: 'idx_tracking_location_geo' } },
                { key: { timestamp: 1 }, options: { expireAfterSeconds: 2592000, name: 'idx_tracking_ttl' } }, // 30 days TTL
                { key: { tripId: 1, timestamp: -1 }, options: { name: 'idx_tracking_trip_timestamp_compound' } }
            ];

            // Trip ratings collection indexes
            const tripRatingsCollection = db.collection('trip_ratings');
            const ratingIndexes = [
                { key: { tripId: 1 }, options: { unique: true, name: 'idx_ratings_trip_id_unique' } },
                { key: { userId: 1 }, options: { name: 'idx_ratings_user_id' } },
                { key: { driverId: 1 }, options: { name: 'idx_ratings_driver_id' } },
                { key: { rating: 1 }, options: { name: 'idx_ratings_rating' } },
                { key: { createdAt: 1 }, options: { name: 'idx_ratings_created_at' } }
            ];

            // Trip payments collection indexes
            const tripPaymentsCollection = db.collection('trip_payments');
            const paymentIndexes = [
                { key: { tripId: 1 }, options: { unique: true, name: 'idx_payments_trip_id_unique' } },
                { key: { userId: 1 }, options: { name: 'idx_payments_user_id' } },
                { key: { status: 1 }, options: { name: 'idx_payments_status' } },
                { key: { paymentMethod: 1 }, options: { name: 'idx_payments_method' } },
                { key: { createdAt: 1 }, options: { name: 'idx_payments_created_at' } }
            ];

            // Create indexes for each collection
            const collections = [
                { collection: tripsCollection, indexes: tripIndexes, name: 'trips' },
                { collection: tripTrackingCollection, indexes: trackingIndexes, name: 'trip_tracking' },
                { collection: tripRatingsCollection, indexes: ratingIndexes, name: 'trip_ratings' },
                { collection: tripPaymentsCollection, indexes: paymentIndexes, name: 'trip_payments' }
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
     * Find trips within a geographic area
     */
    async findTripsInArea(longitude, latitude, radiusMeters, tripType = 'pickup') {
        try {
            const locationField = tripType === 'pickup' ? 'pickup.location' : 'dropoff.location';

            const db = mongoose.connection.db;
            const trips = await db.collection('trips').find({
                [locationField]: {
                    $near: {
                        $geometry: {
                            type: 'Point',
                            coordinates: [longitude, latitude]
                        },
                        $maxDistance: radiusMeters
                    }
                }
            }).toArray();

            return trips;
        } catch (error) {
            console.error(`❌ ${this.serviceName} failed to find trips in area:`, error.message);
            return [];
        }
    }

    /**
     * Update trip tracking with location data
     */
    async updateTripTracking(tripId, latitude, longitude, metadata = {}) {
        try {
            const trackingData = {
                tripId,
                currentLocation: {
                    type: 'Point',
                    coordinates: [longitude, latitude] // GeoJSON format: [lng, lat]
                },
                timestamp: new Date(),
                ...metadata
            };

            const db = mongoose.connection.db;

            // Insert tracking record
            await db.collection('trip_tracking').insertOne(trackingData);

            // Update trip's current status if needed
            if (metadata.status) {
                await db.collection('trips').updateOne(
                    { _id: tripId },
                    {
                        $set: {
                            status: metadata.status,
                            lastUpdated: trackingData.timestamp
                        }
                    }
                );
            }

            return trackingData;
        } catch (error) {
            console.error(`❌ ${this.serviceName} failed to update trip tracking:`, error.message);
            throw error;
        }
    }

    /**
     * Get trip statistics
     */
    async getTripStats() {
        try {
            const db = mongoose.connection.db;
            const stats = await db.collection('trips').aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        avgFare: { $avg: '$fare.total' },
                        avgDistance: { $avg: '$distance' },
                        avgDuration: { $avg: '$duration' }
                    }
                }
            ]).toArray();

            return stats;
        } catch (error) {
            console.error(`❌ ${this.serviceName} failed to get trip stats:`, error.message);
            return [];
        }
    }

    /**
     * Get revenue statistics
     */
    async getRevenueStats(startDate, endDate) {
        try {
            const db = mongoose.connection.db;
            const stats = await db.collection('trip_payments').aggregate([
                {
                    $match: {
                        status: 'completed',
                        createdAt: {
                            $gte: startDate,
                            $lte: endDate
                        }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' },
                            day: { $dayOfMonth: '$createdAt' }
                        },
                        totalRevenue: { $sum: '$amount' },
                        tripCount: { $sum: 1 },
                        avgTripValue: { $avg: '$amount' }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
            ]).toArray();

            return stats;
        } catch (error) {
            console.error(`❌ ${this.serviceName} failed to get revenue stats:`, error.message);
            return [];
        }
    }

    /**
     * Clean old tracking records
     */
    async cleanOldTrackingRecords(olderThanDays = 60) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

            const db = mongoose.connection.db;
            const result = await db.collection('trip_tracking').deleteMany({
                timestamp: { $lt: cutoffDate }
            });

            if (result.deletedCount > 0) {
                console.log(`🧹 ${this.serviceName} cleaned ${result.deletedCount} old tracking records`);
            }

            return result.deletedCount;
        } catch (error) {
            console.error(`❌ ${this.serviceName} failed to clean old tracking records:`, error.message);
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
            const tripCount = await db.collection('trips').countDocuments();
            const activeTrips = await db.collection('trips').countDocuments({
                status: { $in: ['requested', 'accepted', 'picked_up', 'in_progress'] }
            });

            // Check if geospatial indexes exist
            const indexes = await db.collection('trips').listIndexes().toArray();
            const hasPickupGeoIndex = indexes.some(idx => idx.name === 'idx_trips_pickup_geo');

            return {
                status: 'healthy',
                message: 'Database connection is healthy',
                details: {
                    connectionState: this.getConnectionState(),
                    tripCount,
                    activeTrips,
                    hasPickupGeoIndex,
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
const database = new TripServiceDatabase();

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