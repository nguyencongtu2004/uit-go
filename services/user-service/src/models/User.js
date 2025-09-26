const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+\@.+\..+/, 'Please fill a valid email address'],
    },
    passwordHash: {
        type: String,
        required: true,
        select: false
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
    },
    phoneNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    // Phân biệt vai trò của người dùng trong hệ thống
    role: {
        type: String,
        enum: ['PASSENGER', 'DRIVER'],
        required: true,
    },
    // location - chỉ tạo khi có coordinates
    location: {
        type: {
            type: String,
            enum: ['Point']
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            validate: {
                validator: function (coords) {
                    if (!coords || coords.length === 0) return true;
                    return coords.length === 2 &&
                        coords[0] >= -180 && coords[0] <= 180 &&
                        coords[1] >= -90 && coords[1] <= 90;
                },
                message: 'Invalid coordinates'
            }
        },
        address: String
    },
    // state (in trip, isOnline...)
    isOnline: {
        type: Boolean,
        default: false
    },
    inTrip: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Rating system for both passengers and drivers
    rating: {
        averageRating: {
            type: Number,
            default: 5.0,
            min: 1.0,
            max: 5.0
        },
        totalRatings: {
            type: Number,
            default: 0
        }
    },

    // Driver-specific fields (when role = 'DRIVER')
    driverInfo: {
        // Vehicle information
        vehicle: {
            licensePlate: String,
            make: String,      // Toyota, Honda, etc.
            model: String,     // Camry, Civic, etc.
            year: Number,
            color: String,
            vehicleType: {
                type: String,
                enum: ['MOTORBIKE', 'CAR_4_SEAT', 'CAR_7_SEAT'],
                default: 'CAR_4_SEAT'
            }
        },

        // Driver status for trip matching
        driverStatus: {
            type: String,
            enum: ['OFFLINE', 'AVAILABLE', 'BUSY', 'IN_TRIP'],
            default: 'OFFLINE'
        },

        // Earnings tracking (minimal for PoC)
        totalTrips: {
            type: Number,
            default: 0
        },

        // Last location update timestamp (for cleanup)
        lastLocationUpdate: {
            type: Date,
            default: Date.now
        }
    },

    // Device info for real-time communication
    deviceInfo: {
        fcmToken: String,     // For push notifications
        deviceId: String,     // Unique device identifier
        platform: {
            type: String,
            enum: ['WEB', 'ANDROID', 'IOS'],
            default: 'WEB'
        }
    }
}, {
    timestamps: true, // Tự động thêm createdAt và updatedAt
    versionKey: false,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            delete ret._id;
            delete ret.passwordHash;
            return ret;
        }
    }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ phoneNumber: 1 });
userSchema.index({ role: 1 });
userSchema.index({ location: '2dsphere' });
userSchema.index({ 'driverInfo.driverStatus': 1 });
userSchema.index({ 'driverInfo.vehicle.vehicleType': 1 });
userSchema.index({ 'driverInfo.lastLocationUpdate': 1 });
userSchema.index({ 'rating.averageRating': -1 });
userSchema.index({ role: 1, isOnline: 1, 'driverInfo.driverStatus': 1 }); // Compound index for driver search

// Pre-save middleware để hash password và xử lý location
userSchema.pre('save', async function (next) {
    // Hash password nếu được modify
    if (this.isModified('passwordHash')) {
        try {
            const salt = await bcrypt.genSalt(12);
            this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
        } catch (error) {
            return next(error);
        }
    }

    // Xử lý location field - chỉ set nếu có coordinates hợp lệ
    if (this.isModified('location')) {
        if (this.location && (!this.location.coordinates || this.location.coordinates.length !== 2)) {
            // Nếu location được set nhưng không có coordinates hợp lệ, xóa location
            this.location = undefined;
        } else if (this.location && this.location.coordinates) {
            // Đảm bảo type được set
            this.location.type = 'Point';
        }
    }

    next();
});

// Instance methods
userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.passwordHash);
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};

// Add method to update driver location timestamp
userSchema.methods.updateLocationTimestamp = function () {
    if (this.role === 'DRIVER') {
        this.driverInfo.lastLocationUpdate = new Date();
        return this.save();
    }
};

// Static methods
userSchema.statics.findByEmail = function (email) {
    return this.findOne({ email: email.toLowerCase(), isActive: true });
};

userSchema.statics.findByEmailWithPassword = function (email) {
    return this.findOne({ email: email.toLowerCase(), isActive: true }).select('+passwordHash');
};

// Static method to find available drivers
userSchema.statics.findAvailableDrivers = function () {
    return this.find({
        role: 'DRIVER',
        isActive: true,
        isOnline: true,
        'driverInfo.driverStatus': 'AVAILABLE'
    });
};

const User = mongoose.model('User', userSchema);

module.exports = User;