const { DatabaseManager } = require('../../common/shared');

class UserServiceDatabase extends DatabaseManager {
    constructor() {
        super('UserService');
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

            // Users collection indexes
            await this.createIndex('users', { email: 1 }, { unique: true, name: 'idx_email_unique' });
            await this.createIndex('users', { phone: 1 }, { unique: true, sparse: true, name: 'idx_phone_unique' });
            await this.createIndex('users', { role: 1 }, { name: 'idx_role' });
            await this.createIndex('users', { isActive: 1 }, { name: 'idx_is_active' });
            await this.createIndex('users', { createdAt: 1 }, { name: 'idx_created_at' });
            await this.createIndex('users', { email: 1, role: 1 }, { name: 'idx_email_role_compound' });

            // Sessions collection indexes
            await this.createIndex('sessions', { userId: 1 }, { name: 'idx_sessions_user_id' });
            await this.createIndex('sessions', { tokenId: 1 }, { unique: true, name: 'idx_sessions_token_id_unique' });
            await this.createIndex('sessions', { expiresAt: 1 }, { expireAfterSeconds: 0, name: 'idx_sessions_ttl' });
            await this.createIndex('sessions', { isBlacklisted: 1 }, { name: 'idx_sessions_blacklisted' });

            // User profiles collection indexes
            await this.createIndex('user_profiles', { userId: 1 }, { unique: true, name: 'idx_profiles_user_id_unique' });
            await this.createIndex('user_profiles', { 'location': '2dsphere' }, { name: 'idx_profiles_location_geo' });

            console.log(`✅ ${this.serviceName} database indexes setup complete`);

        } catch (error) {
            console.error(`❌ ${this.serviceName} failed to setup indexes:`, error.message);
            // Don't throw here - indexes are important but not critical for service startup
        }
    }

    /**
     * Get user statistics
     */
    async getUserStats() {
        try {
            const stats = await this.connection.collection('users').aggregate([
                {
                    $group: {
                        _id: '$role',
                        count: { $sum: 1 },
                        active: {
                            $sum: {
                                $cond: [{ $eq: ['$isActive', true] }, 1, 0]
                            }
                        }
                    }
                }
            ]).toArray();

            return stats;
        } catch (error) {
            console.error(`❌ ${this.serviceName} failed to get user stats:`, error.message);
            return [];
        }
    }

    /**
     * Clean expired sessions
     */
    async cleanExpiredSessions() {
        try {
            const result = await this.connection.collection('sessions').deleteMany({
                expiresAt: { $lt: new Date() }
            });

            if (result.deletedCount > 0) {
                console.log(`🧹 ${this.serviceName} cleaned ${result.deletedCount} expired sessions`);
            }

            return result.deletedCount;
        } catch (error) {
            console.error(`❌ ${this.serviceName} failed to clean expired sessions:`, error.message);
            return 0;
        }
    }

    /**
     * Health check specific to user service
     */
    async healthCheck() {
        try {
            const isHealthy = await this.isHealthy();
            if (!isHealthy) return { status: 'unhealthy', details: 'Database connection failed' };

            // Check if we can query users collection
            const userCount = await this.connection.collection('users').countDocuments();

            // Check if critical indexes exist
            const indexes = await this.connection.collection('users').listIndexes().toArray();
            const hasEmailIndex = indexes.some(idx => idx.name === 'idx_email_unique');

            return {
                status: 'healthy',
                details: {
                    userCount,
                    hasEmailIndex,
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
const userDatabase = new UserServiceDatabase();
module.exports = userDatabase;