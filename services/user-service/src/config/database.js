const mongoose = require('mongoose');

class UserServiceDatabase {
    constructor() {
        this.serviceName = 'UserService';
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
                // bufferMaxEntries: 0,              // Removed - not supported
                // bufferCommands: false,            // Removed - not supported
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
            console.log(`📊 ${this.serviceName} - Setting up database indexes...`);

            const db = mongoose.connection.db;
            const usersCollection = db.collection('users');

            // Create indexes
            const indexes = [
                { key: { email: 1 }, options: { unique: true, name: 'idx_email_unique' } },
                { key: { phoneNumber: 1 }, options: { unique: true, name: 'idx_phone_unique' } },
                { key: { role: 1 }, options: { name: 'idx_role' } },
                { key: { isActive: 1 }, options: { name: 'idx_is_active' } },
                { key: { isOnline: 1 }, options: { name: 'idx_is_online' } },
                { key: { location: '2dsphere' }, options: { name: 'idx_location_geo', sparse: true } }, // sparse cho geospatial
                { key: { 'driverInfo.driverStatus': 1 }, options: { name: 'idx_driver_status' } },
                { key: { 'driverInfo.vehicle.vehicleType': 1 }, options: { name: 'idx_vehicle_type' } },
                { key: { createdAt: -1 }, options: { name: 'idx_created_at' } },
                { key: { role: 1, isActive: 1, isOnline: 1 }, options: { name: 'idx_role_active_online' } }
            ];

            // Create indexes one by one to avoid conflicts
            for (const index of indexes) {
                try {
                    await usersCollection.createIndex(index.key, index.options);
                    console.log(`   ✅ Created index: ${index.options.name}`);
                } catch (error) {
                    if (error.code === 11000 || error.codeName === 'IndexOptionsConflict') {
                        console.log(`   ℹ️ Index already exists: ${index.options.name}`);
                    } else {
                        console.log(`   ⚠️ Failed to create index ${index.options.name}: ${error.message}`);
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
            const userCount = await mongoose.connection.db.collection('users').countDocuments();

            return {
                status: 'healthy',
                message: 'Database connection is healthy',
                details: {
                    connectionState: this.getConnectionState(),
                    userCount,
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
const database = new UserServiceDatabase();

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