const mongoose = require('mongoose');

class DatabaseConnection {
    constructor() {
        this.connection = null;
    }

    async connect() {
        try {
            const mongoUri = process.env.MONGODB_URI;

            if (!mongoUri) {
                throw new Error('MONGODB_URI environment variable is not set');
            }

            console.log('Connecting to MongoDB:', mongoUri.replace(/\/\/.*@/, '//***:***@')); // Hide credentials in logs

            this.connection = await mongoose.connect(mongoUri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                bufferCommands: false
            });

            console.log('✅ Trip Service connected to MongoDB database: uitgo_trips');

            // Handle connection events
            mongoose.connection.on('disconnected', () => {
                console.log('❌ Trip Service MongoDB disconnected');
            });

            mongoose.connection.on('error', (error) => {
                console.error('❌ Trip Service MongoDB connection error:', error);
            });

            mongoose.connection.on('reconnected', () => {
                console.log('✅ Trip Service MongoDB reconnected');
            });

            return this.connection;
        } catch (error) {
            console.error('❌ Trip Service MongoDB connection failed:', error.message);
            throw error;
        }
    }

    async disconnect() {
        if (this.connection) {
            await mongoose.connection.close();
            console.log('Trip Service MongoDB connection closed');
        }
    }

    getConnection() {
        return this.connection;
    }

    isConnected() {
        return mongoose.connection.readyState === 1;
    }
}

// Create singleton instance
const dbConnection = new DatabaseConnection();

module.exports = dbConnection;