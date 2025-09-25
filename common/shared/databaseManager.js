/**
 * Database connection utilities and patterns for MongoDB
 */

const mongoose = require('mongoose');

class DatabaseManager {
    constructor(serviceName) {
        this.serviceName = serviceName;
        this.connection = null;
        this.isConnected = false;
    }

    /**
     * Connect to MongoDB with optimized settings
     * @param {string} connectionString - MongoDB connection string
     * @param {object} options - Additional connection options
     */
    async connect(connectionString, options = {}) {
        try {
            const defaultOptions = {
                // Connection pool settings
                maxPoolSize: 10, // Maximum number of connections
                minPoolSize: 2,  // Minimum number of connections
                maxIdleTimeMS: 30000, // Close connections after 30s of inactivity
                serverSelectionTimeoutMS: 5000, // How long to try to connect

                // Buffering settings
                bufferCommands: false,

                // Other settings
                retryWrites: true,
                retryReads: true,
                readPreference: 'primaryPreferred',

                // Monitoring
                heartbeatFrequencyMS: 10000,
                ...options
            };

            this.connection = await mongoose.createConnection(connectionString, defaultOptions);

            // Connection event handlers
            this.connection.on('connected', () => {
                this.isConnected = true;
                console.log(`✅ ${this.serviceName} - MongoDB connected successfully`);
                console.log(`   Database: ${this.connection.db.databaseName}`);
                console.log(`   Host: ${this.connection.host}:${this.connection.port}`);
            });

            this.connection.on('error', (error) => {
                this.isConnected = false;
                console.error(`❌ ${this.serviceName} - MongoDB connection error:`, error.message);
            });

            this.connection.on('disconnected', () => {
                this.isConnected = false;
                console.log(`⚠️ ${this.serviceName} - MongoDB disconnected`);
            });

            this.connection.on('reconnected', () => {
                this.isConnected = true;
                console.log(`✅ ${this.serviceName} - MongoDB reconnected`);
            });

            // Wait for connection to be established
            if (this.connection.readyState === 1) {
                this.isConnected = true;
            } else {
                await new Promise((resolve) => {
                    this.connection.on('connected', resolve);
                });
            }

            return this.connection;

        } catch (error) {
            console.error(`❌ ${this.serviceName} - Failed to connect to MongoDB:`, error.message);
            throw error;
        }
    }

    /**
     * Disconnect from MongoDB
     */
    async disconnect() {
        if (this.connection) {
            try {
                await this.connection.close();
                this.isConnected = false;
                console.log(`✅ ${this.serviceName} - MongoDB disconnected gracefully`);
            } catch (error) {
                console.error(`❌ ${this.serviceName} - Error disconnecting from MongoDB:`, error.message);
            }
        }
    }

    /**
     * Get connection health status
     */
    getHealthStatus() {
        if (!this.connection) {
            return {
                status: 'disconnected',
                readyState: null,
                host: null,
                database: null
            };
        }

        const readyStates = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };

        return {
            status: readyStates[this.connection.readyState] || 'unknown',
            readyState: this.connection.readyState,
            host: this.connection.host,
            database: this.connection.db?.databaseName
        };
    }

    /**
     * Check if database is connected and healthy
     */
    async isHealthy() {
        if (!this.connection || this.connection.readyState !== 1) {
            return false;
        }

        try {
            // Perform a simple ping to check connection
            await this.connection.db.admin().ping();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get database statistics
     */
    async getStats() {
        if (!this.connection || this.connection.readyState !== 1) {
            throw new Error('Database not connected');
        }

        try {
            const stats = await this.connection.db.stats();
            return {
                database: stats.db,
                collections: stats.collections,
                dataSize: stats.dataSize,
                storageSize: stats.storageSize,
                indexes: stats.indexes,
                objects: stats.objects
            };
        } catch (error) {
            throw new Error(`Failed to get database stats: ${error.message}`);
        }
    }

    /**
     * Create an index on a collection with conflict handling
     * @param {string} collectionName - Name of the collection
     * @param {object} indexSpec - Index specification
     * @param {object} options - Index options
     */
    async createIndex(collectionName, indexSpec, options = {}) {
        try {
            const collection = this.connection.collection(collectionName);

            // Check if index already exists with same fields
            const existingIndexes = await collection.listIndexes().toArray();
            const indexFields = Object.keys(indexSpec);

            const existingIndex = existingIndexes.find(index => {
                if (index.name === '_id_') return false; // Skip default _id index

                const existingFields = Object.keys(index.key);
                return indexFields.length === existingFields.length &&
                    indexFields.every(field => existingFields.includes(field)) &&
                    existingFields.every(field => indexFields.includes(field));
            });

            if (existingIndex) {
                // If index exists with different name, drop it first
                if (options.name && existingIndex.name !== options.name) {
                    console.log(`🔄 ${this.serviceName} - Dropping existing index ${existingIndex.name} to recreate as ${options.name}`);
                    await collection.dropIndex(existingIndex.name);
                } else {
                    console.log(`ℹ️ ${this.serviceName} - Index already exists on ${collectionName}: ${existingIndex.name}`);
                    return existingIndex.name;
                }
            }

            const result = await collection.createIndex(indexSpec, options);
            console.log(`✅ ${this.serviceName} - Index created on ${collectionName}: ${result}`);
            return result;
        } catch (error) {
            console.error(`❌ ${this.serviceName} - Failed to create index on ${collectionName}:`, error.message);
            throw error;
        }
    }

    /**
     * Setup common indexes for geospatial and performance optimization
     */
    async setupCommonIndexes() {
        // This method should be overridden by specific services
        console.log(`📝 ${this.serviceName} - No common indexes defined`);
    }

    /**
     * Get the mongoose connection instance
     */
    getConnection() {
        return this.connection;
    }

    /**
     * Wrapper for graceful shutdown
     */
    async gracefulShutdown(signal) {
        console.log(`📝 ${this.serviceName} - Received ${signal}. Starting graceful shutdown...`);
        await this.disconnect();
    }
}

module.exports = DatabaseManager;