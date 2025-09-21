const mongoose = require('mongoose');
const { Schema } = mongoose;

const pointSchema = new Schema({
    address: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
}, { _id: false });

const tripSchema = new Schema({
    passengerId: {
        type: Schema.Types.ObjectId, // _id từ document User trong UserService
        required: true,
        index: true,
    },
    driverId: {
        type: Schema.Types.ObjectId, // _id từ document User trong UserService
        index: true,
        default: null,
    },
    origin: {
        type: pointSchema,
        required: true,
    },
    destination: {
        type: pointSchema,
        required: true,
    },
    status: {
        type: String,
        enum: ['REQUESTED', 'SEARCHING', 'ACCEPTED', 'DRIVER_ARRIVING', 'PICKED_UP', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
        default: 'REQUESTED',
        index: true,
    },
    estimatedFare: {
        type: Number,
        required: true,
    },
    actualFare: {
        type: Number,
    },
    // Lưu trữ đánh giá của chuyến đi
    rating: {
        type: Number,
        min: 1,
        max: 5,
    },
    comment: {
        type: String,
    },
    // Thêm timestamps cho từng trạng thái
    requestedAt: {
        type: Date,
        default: Date.now,
    },
    acceptedAt: {
        type: Date,
    },
    pickedUpAt: {
        type: Date,
    },
    completedAt: {
        type: Date,
    },
    cancelledAt: {
        type: Date,
    },
}, {
    timestamps: true, // Tự động thêm createdAt và updatedAt
});

// Indexes for performance
tripSchema.index({ passengerId: 1, status: 1 });
tripSchema.index({ driverId: 1, status: 1 });
tripSchema.index({ status: 1, createdAt: -1 });
tripSchema.index({ createdAt: -1 });

// Instance methods
tripSchema.methods.accept = function (driverId) {
    this.driverId = driverId;
    this.status = 'ACCEPTED';
    this.acceptedAt = new Date();
    return this.save();
};

tripSchema.methods.pickUp = function () {
    this.status = 'PICKED_UP';
    this.pickedUpAt = new Date();
    return this.save();
};

tripSchema.methods.startTrip = function () {
    this.status = 'IN_PROGRESS';
    return this.save();
};

tripSchema.methods.complete = function (actualFare) {
    this.status = 'COMPLETED';
    this.actualFare = actualFare || this.estimatedFare;
    this.completedAt = new Date();
    return this.save();
};

tripSchema.methods.cancel = function () {
    this.status = 'CANCELLED';
    this.cancelledAt = new Date();
    return this.save();
};

tripSchema.methods.addRating = function (rating, comment) {
    this.rating = rating;
    if (comment) this.comment = comment;
    return this.save();
};

// Static methods
tripSchema.statics.findByPassenger = function (passengerId) {
    return this.find({ passengerId }).sort({ createdAt: -1 });
};

tripSchema.statics.findByDriver = function (driverId) {
    return this.find({ driverId }).sort({ createdAt: -1 });
};

tripSchema.statics.findActiveTrips = function () {
    return this.find({
        status: {
            $in: ['REQUESTED', 'SEARCHING', 'ACCEPTED', 'DRIVER_ARRIVING', 'PICKED_UP', 'IN_PROGRESS']
        }
    });
};

tripSchema.statics.findCompletedTrips = function () {
    return this.find({ status: 'COMPLETED' }).sort({ completedAt: -1 });
};

tripSchema.statics.getTripStats = function () {
    return this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalFare: { $sum: '$actualFare' }
            }
        }
    ]);
};

const Trip = mongoose.model('Trip', tripSchema);

module.exports = Trip;