const { DatabaseManager } = require('../../common/shared');

class TripServiceDatabase extends DatabaseManager {
    constructor() {
        super('TripService');
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

            // Trips collection indexes
            await this.createIndex('trips', { userId: 1 }, { name: 'idx_trips_user_id' });
            await this.createIndex('trips', { driverId: 1 }, { name: 'idx_trips_driver_id' });
            await this.createIndex('trips', { status: 1 }, { name: 'idx_trips_status' });
            await this.createIndex('trips', { createdAt: 1 }, { name: 'idx_trips_created_at' });
            await this.createIndex('trips', { scheduledTime: 1 }, { sparse: true, name: 'idx_trips_scheduled_time' });
            await this.createIndex('trips', { userId: 1, status: 1 }, { name: 'idx_trips_user_status_compound' });
            await this.createIndex('trips', { driverId: 1, status: 1 }, { name: 'idx_trips_driver_status_compound' });
            await this.createIndex('trips', { 'pickup.location': '2dsphere' }, { name: 'idx_trips_pickup_geo' });
            await this.createIndex('trips', { 'dropoff.location': '2dsphere' }, { name: 'idx_trips_dropoff_geo' });

            // Trip tracking collection indexes (for real-time updates)
            await this.createIndex('trip_tracking', { tripId: 1 }, { name: 'idx_tracking_trip_id' });
            await this.createIndex('trip_tracking', { 'currentLocation': '2dsphere' }, { name: 'idx_tracking_location_geo' });
            await this.createIndex('trip_tracking', { timestamp: 1 }, { expireAfterSeconds: 2592000, name: 'idx_tracking_ttl' }); // 30 days TTL
            await this.createIndex('trip_tracking', { tripId: 1, timestamp: -1 }, { name: 'idx_tracking_trip_timestamp_compound' });

            // Trip ratings collection indexes
            await this.createIndex('trip_ratings', { tripId: 1 }, { unique: true, name: 'idx_ratings_trip_id_unique' });
            await this.createIndex('trip_ratings', { userId: 1 }, { name: 'idx_ratings_user_id' });
            await this.createIndex('trip_ratings', { driverId: 1 }, { name: 'idx_ratings_driver_id' });
            await this.createIndex('trip_ratings', { rating: 1 }, { name: 'idx_ratings_rating' });
            await this.createIndex('trip_ratings', { createdAt: 1 }, { name: 'idx_ratings_created_at' });

            // Trip payments collection indexes
            await this.createIndex('trip_payments', { tripId: 1 }, { unique: true, name: 'idx_payments_trip_id_unique' });
            await this.createIndex('trip_payments', { userId: 1 }, { name: 'idx_payments_user_id' });
            await this.createIndex('trip_payments', { status: 1 }, { name: 'idx_payments_status' });
            await this.createIndex('trip_payments', { paymentMethod: 1 }, { name: 'idx_payments_method' });
            await this.createIndex('trip_payments', { createdAt: 1 }, { name: 'idx_payments_created_at' });

            console.log(`✅ ${this.serviceName} database indexes setup complete`);

        } catch (error) {
            console.error(`❌ ${this.serviceName} failed to setup indexes:`, error.message);
            // Don't throw here - indexes are important but not critical for service startup
        }
    }

    /**
     * Find trips within a geographic area
     */
    async findTripsInArea(longitude, latitude, radiusMeters, tripType = 'pickup') {
        try {
            const locationField = tripType === 'pickup' ? 'pickup.location' : 'dropoff.location';

            const trips = await this.connection.collection('trips').find({
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

            // Insert tracking record
            await this.connection.collection('trip_tracking').insertOne(trackingData);

            // Update trip's current status if needed
            if (metadata.status) {
                await this.connection.collection('trips').updateOne(
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
            const stats = await this.connection.collection('trips').aggregate([
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
            const stats = await this.connection.collection('trip_payments').aggregate([
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

            const result = await this.connection.collection('trip_tracking').deleteMany({
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

    /**
     * Health check specific to trip service
     */
    async healthCheck() {
        try {
            const isHealthy = await this.isHealthy();
            if (!isHealthy) return { status: 'unhealthy', details: 'Database connection failed' };

            // Check if we can query trips collection
            const tripCount = await this.connection.collection('trips').countDocuments();
            const activeTrips = await this.connection.collection('trips').countDocuments({
                status: { $in: ['requested', 'accepted', 'picked_up', 'in_progress'] }
            });

            // Check if geospatial indexes exist
            const indexes = await this.connection.collection('trips').listIndexes().toArray();
            const hasPickupGeoIndex = indexes.some(idx => idx.name === 'idx_trips_pickup_geo');

            return {
                status: 'healthy',
                details: {
                    tripCount,
                    activeTrips,
                    hasPickupGeoIndex,
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
const tripDatabase = new TripServiceDatabase();
module.exports = tripDatabase;