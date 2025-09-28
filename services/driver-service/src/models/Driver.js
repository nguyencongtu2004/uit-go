const mongoose = require('mongoose');
const { Schema } = mongoose;

const driverSchema = new Schema({
    // Essential fields only for PoC load testing
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    // Trạng thái hoạt động của tài xế - core for load testing
    status: {
        type: String,
        enum: ['OFFLINE', 'ONLINE', 'IN_TRIP'],
        default: 'OFFLINE',
        index: true,
    },
    // Vị trí để truy vấn geospatial - core for performance testing
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            default: [0, 0],
        },
    },
    // Simplified approval status
    isApproved: {
        type: Boolean,
        default: true, // Auto-approve for PoC testing
    },
    // Basic vehicle info - minimal for testing
    vehicleInfo: {
        type: String,
        default: 'Test Vehicle',
    },
}, {
    timestamps: true,
});

// Tạo index tối ưu cho load testing
driverSchema.index({ location: '2dsphere' });
driverSchema.index({ status: 1, isApproved: 1 });

// Simplified instance methods for PoC
driverSchema.methods.updateLocation = function (longitude, latitude) {
    this.location = {
        type: 'Point',
        coordinates: [longitude, latitude]
    };
    return this.save();
};

driverSchema.methods.setStatus = function (newStatus) {
    this.status = newStatus;
    return this.save();
};

// Optimized static methods for geospatial queries
driverSchema.statics.findNearby = function (longitude, latitude, maxDistanceMeters = 5000) {
    return this.find({
        status: 'ONLINE',
        isApproved: true,
        location: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [longitude, latitude],
                },
                $maxDistance: maxDistanceMeters,
            },
        },
    }).limit(50); // Limit for performance
};

driverSchema.statics.findByUserId = function (userId) {
    return this.findOne({ userId });
};

const Driver = mongoose.model('Driver', driverSchema);

module.exports = Driver;