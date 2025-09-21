const mongoose = require('mongoose');
const { Schema } = mongoose;

const driverSchema = new Schema({
    // Liên kết với User bên UserService thông qua _id của User
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User', // Tham chiếu đến model User nếu cần populate
        required: true,
        unique: true,
        index: true,
    },
    licensePlate: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
    },
    vehicleModel: {
        type: String,
        required: true,
        trim: true,
    },
    vehicleColor: {
        type: String,
        required: false,
        trim: true,
    },
    // Trạng thái hoạt động của tài xế
    status: {
        type: String,
        enum: ['OFFLINE', 'ONLINE', 'IN_TRIP'],
        default: 'OFFLINE',
        index: true,
    },
    isApproved: {
        type: Boolean,
        default: false,
        comment: 'Tài khoản đã được xét duyệt hay chưa',
    },
    // Lưu trữ vị trí để truy vấn geospatial
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
    // Thông tin bổ sung
    rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0,
    },
    totalTrips: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});

// Tạo một chỉ mục 2dsphere trên trường location để tối ưu truy vấn vị trí
driverSchema.index({ location: '2dsphere' });
driverSchema.index({ status: 1, isApproved: 1 });
driverSchema.index({ userId: 1 });

// Instance methods
driverSchema.methods.updateLocation = function (longitude, latitude) {
    this.location = {
        type: 'Point',
        coordinates: [longitude, latitude]
    };
    return this.save();
};

driverSchema.methods.goOnline = function () {
    if (this.isApproved) {
        this.status = 'ONLINE';
        return this.save();
    }
    throw new Error('Driver must be approved to go online');
};

driverSchema.methods.goOffline = function () {
    this.status = 'OFFLINE';
    return this.save();
};

driverSchema.methods.startTrip = function () {
    this.status = 'IN_TRIP';
    return this.save();
};

// Static methods
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
    });
};

driverSchema.statics.findOnlineDrivers = function () {
    return this.find({
        status: 'ONLINE',
        isApproved: true
    });
};

driverSchema.statics.findByUserId = function (userId) {
    return this.findOne({ userId });
};

const Driver = mongoose.model('Driver', driverSchema);

module.exports = Driver;