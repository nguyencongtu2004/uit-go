const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;
const { Validator } = require('../../common/shared');

const UserSchema = new Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: (email) => Validator.isEmail(email),
            message: 'Please provide a valid email address'
        },
        index: true
    },

    phone: {
        type: String,
        sparse: true,
        trim: true,
        validate: {
            validator: function (phone) {
                return !phone || Validator.isPhoneNumber(phone);
            },
            message: 'Please provide a valid phone number'
        },
        index: true
    },

    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters long'],
        select: false
    },

    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        maxlength: [50, 'First name cannot exceed 50 characters']
    },

    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        maxlength: [50, 'Last name cannot exceed 50 characters']
    },

    dateOfBirth: {
        type: Date,
        validate: {
            validator: function (date) {
                if (!date) return true;
                const age = new Date().getFullYear() - new Date(date).getFullYear();
                return age >= 18 && age <= 100;
            },
            message: 'User must be between 18 and 100 years old'
        }
    },

    gender: {
        type: String,
        enum: {
            values: ['male', 'female', 'other', 'prefer_not_to_say'],
            message: '{VALUE} is not a valid gender option'
        }
    },

    role: {
        type: String,
        enum: {
            values: ['passenger', 'driver', 'admin'],
            message: '{VALUE} is not a valid role'
        },
        default: 'passenger',
        index: true
    },

    isActive: {
        type: Boolean,
        default: true,
        index: true
    },

    isVerified: {
        type: Boolean,
        default: false,
        index: true
    },

    emailVerified: {
        type: Boolean,
        default: false
    },

    phoneVerified: {
        type: Boolean,
        default: false
    },

    defaultLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
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
        address: String,
        city: String,
        country: String
    },

    preferences: {
        language: { type: String, default: 'en' },
        currency: { type: String, default: 'USD' },
        notifications: {
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: true },
            push: { type: Boolean, default: true }
        }
    },

    twoFactorEnabled: {
        type: Boolean,
        default: false
    },

    twoFactorSecret: {
        type: String,
        select: false
    },

    passwordChangedAt: {
        type: Date,
        default: Date.now
    },

    loginAttempts: {
        count: { type: Number, default: 0 },
        lastAttempt: Date,
        lockedUntil: Date
    },

    lastLoginAt: Date,
    lastActiveAt: Date,

    stats: {
        totalTrips: { type: Number, default: 0 },
        totalSpent: { type: Number, default: 0 },
        averageRating: { type: Number, default: 5.0, min: 1, max: 5 },
        totalRatings: { type: Number, default: 0 }
    }
}, {
    timestamps: true,
    versionKey: false,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            delete ret._id;
            delete ret.password;
            delete ret.twoFactorSecret;
            delete ret.loginAttempts;
            return ret;
        }
    }
});

// Indexes
UserSchema.index({ email: 1, isActive: 1 });
UserSchema.index({ phone: 1 }, { sparse: true });
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ 'defaultLocation': '2dsphere' });

// Virtuals
UserSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

UserSchema.virtual('isAccountLocked').get(function () {
    return this.loginAttempts.lockedUntil && this.loginAttempts.lockedUntil > Date.now();
});

// Pre-save middleware
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        this.passwordChangedAt = new Date();
        next();
    } catch (error) {
        next(error);
    }
});

// Instance methods
UserSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};

UserSchema.methods.incrementLoginAttempts = function () {
    const updates = {
        $inc: { 'loginAttempts.count': 1 },
        $set: { 'loginAttempts.lastAttempt': new Date() }
    };

    if (this.loginAttempts.count + 1 >= 5) {
        updates.$set['loginAttempts.lockedUntil'] = new Date(Date.now() + 30 * 60 * 1000);
    }

    return this.updateOne(updates);
};

UserSchema.methods.resetLoginAttempts = function () {
    return this.updateOne({
        $unset: {
            'loginAttempts.count': 1,
            'loginAttempts.lastAttempt': 1,
            'loginAttempts.lockedUntil': 1
        }
    });
};

// Static methods
UserSchema.statics.findByEmail = function (email) {
    return this.findOne({ email: email.toLowerCase(), isActive: true });
};

UserSchema.statics.findByEmailWithPassword = function (email) {
    return this.findOne({ email: email.toLowerCase(), isActive: true }).select('+password +loginAttempts');
};

const User = mongoose.model('User', UserSchema);
module.exports = User;