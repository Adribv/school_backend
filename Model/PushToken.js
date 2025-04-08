const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Schema for student information
const studentSchema = new mongoose.Schema({
    studentId: {
        type: String,
        required: [true, 'Student ID is required'],
        trim: true
    },
    studentName: {
        type: String,
        required: [true, 'Student name is required'],
        trim: true
    },
    className: {
        type: String,
        default: 'Class Not Specified',
        trim: true
    },
    schoolId: {
        type: String,
        required: [true, 'School ID is required'],
        trim: true
    },
    notificationsEnabled: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Main schema for parent/guardian information
const pushTokenSchema = new mongoose.Schema({
    parentId: {
        type: String,
        required: [true, 'Parent ID is required'],
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters long']
    },
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        unique: true,
        trim: true,
        validate: {
            validator: function(v) {
                // Basic phone number validation - can be customized based on your needs
                return /^\d{10}$/.test(v);
            },
            message: props => `${props.value} is not a valid phone number! Must be 10 digits.`
        }
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long']
    },
    pushToken: {
        type: String,
        required: [true, 'Push token is required'],
        trim: true
    },
    schoolId: {
        type: String,
        required: [true, 'School ID is required'],
        trim: true
    },
    students: [studentSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

// Middleware to hash password before saving
pushTokenSchema.pre('save', async function(next) {
    try {
        // Only hash the password if it has been modified (or is new)
        if (!this.isModified('password')) return next();
        
        // Generate salt and hash password
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password for login
pushTokenSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Method to update last login time
pushTokenSchema.methods.updateLastLogin = async function() {
    this.lastLogin = new Date();
    return this.save();
};

// Virtual for getting student count
pushTokenSchema.virtual('studentCount').get(function() {
    return this.students.length;
});

// Ensure virtuals are included in JSON output
pushTokenSchema.set('toJSON', {
    virtuals: true,
    transform: function(doc, ret) {
        delete ret.__v;  // Remove version key
        delete ret.password;  // Remove password from JSON output
        return ret;
    }
});

// Create indexes for better query performance
pushTokenSchema.index({ phoneNumber: 1 });
pushTokenSchema.index({ parentId: 1 });
pushTokenSchema.index({ 'students.studentId': 1 });

const PushToken = mongoose.model('PushToken', pushTokenSchema);

module.exports = PushToken;
