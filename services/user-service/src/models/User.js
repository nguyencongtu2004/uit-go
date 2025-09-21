const mongoose = require('mongoose');
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
}, {
    timestamps: true, // Tự động thêm createdAt và updatedAt
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ phoneNumber: 1 });
userSchema.index({ role: 1 });

// Instance methods
userSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.passwordHash; // Don't expose password hash
    return user;
};

userSchema.methods.isPassenger = function () {
    return this.role === 'PASSENGER';
};

userSchema.methods.isDriver = function () {
    return this.role === 'DRIVER';
};

// Static methods
userSchema.statics.findByEmail = function (email) {
    return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByPhoneNumber = function (phoneNumber) {
    return this.findOne({ phoneNumber });
};

userSchema.statics.findDrivers = function () {
    return this.find({ role: 'DRIVER' });
};

userSchema.statics.findPassengers = function () {
    return this.find({ role: 'PASSENGER' });
};

const User = mongoose.model('User', userSchema);

module.exports = User;