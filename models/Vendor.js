const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const VendorSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    username: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['vendor', 'admin'], default: 'vendor' },
    approved: { type: Boolean, default: false },
    tokenAvailable: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

VendorSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

VendorSchema.methods.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('Vendor', VendorSchema);