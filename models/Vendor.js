const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const VendorSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    username: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['vendor', 'admin'], default: 'vendor' },
    approved: { type: Boolean, default: false },
    active: { type: Boolean, default: true }, 
    tokenAvailable: { type: Boolean, default: false },
    businessName: { type: String },
    customerLimit: { type: Number, default: 1000 },
      canAddCustomers: { 
        type: Boolean, 
        default: true 
    },
    
    // Upgrade tracking
    pendingUpgrades: [{
        date: { type: Date, default: Date.now },
        additionalCustomers: { type: Number, required: true },
        amount: { type: Number, required: true },
        paymentProof: { type: String },
        reference: { type: String },
        status: { 
            type: String, 
            enum: ['pending', 'pending_verification', 'approved', 'rejected'], 
            default: 'pending' 
        },
        adminNotes: { type: String }
    }],
    
    completedUpgrades: [{
        date: { type: Date, default: Date.now },
        additionalCustomers: { type: Number, required: true },
        amount: { type: Number, required: true },
        approvedAt: { type: Date },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
        status: { type: String, enum: ['completed', 'applied'], default: 'completed' }
    }],
    
    lastUpdatedBy: { 
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
        at: { type: Date }
    }
}, { timestamps: true });

// Password hashing middleware
// Existing pre-save hook for password hashing
VendorSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

// Existing method for password comparison
VendorSchema.methods.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

// Method to check if vendor can add more customers
VendorSchema.methods.canAddCustomer = async function() {
    // First check if vendor is allowed to add customers at all
    if (!this.canAddCustomers) {
        return false;
    }
    
    // Then check customer limit
    const customerCount = await mongoose.model('Customer').countDocuments({ vendorId: this._id });
    const effectiveLimit = this.getEffectiveCustomerLimit();
    return customerCount < effectiveLimit;
};
// Method to get effective customer limit (including approved upgrades)
VendorSchema.methods.getEffectiveCustomerLimit = function() {
    // Base limit is now 1000
    let effectiveLimit = this.customerLimit;
    
    // Add all completed upgrades (500 increments)
    const appliedUpgrades = this.completedUpgrades
        .filter(u => u.status === 'applied')
        .reduce((sum, u) => sum + u.additionalCustomers, 0);
    
    const pendingApprovedUpgrades = this.completedUpgrades
        .filter(u => u.status === 'completed')
        .reduce((sum, u) => sum + u.additionalCustomers, 0);
    
    return effectiveLimit + appliedUpgrades + pendingApprovedUpgrades;
};

// Method to apply pending upgrades
// Method to apply pending upgrades
VendorSchema.methods.applyUpgrades = async function() {
    const pendingUpgrades = this.completedUpgrades.filter(u => u.status === 'completed');
    
    if (pendingUpgrades.length > 0) {
        const totalAdditional = pendingUpgrades.reduce((sum, u) => sum + u.additionalCustomers, 0);
        this.customerLimit += totalAdditional;
        
        // Mark upgrades as applied
        pendingUpgrades.forEach(u => u.status = 'applied');
        await this.save();
    }
    
    return this.customerLimit;
};

// Static method to process upgrade approval
VendorSchema.statics.approveUpgrade = async function(vendorId, upgradeId, adminId) {
    const vendor = await this.findById(vendorId);
    if (!vendor) throw new Error('Vendor not found');
    
    const upgradeIndex = vendor.pendingUpgrades.findIndex(u => u._id.equals(upgradeId));
    if (upgradeIndex === -1) throw new Error('Upgrade not found');
    
    const upgrade = vendor.pendingUpgrades[upgradeIndex];
    
    // Validate the upgrade is in 500 increments
    if (upgrade.additionalCustomers % 500 !== 0) {
        throw new Error('Upgrade must be in increments of 500');
    }
    
    // Move to completed upgrades
    vendor.completedUpgrades.push({
        additionalCustomers: upgrade.additionalCustomers,
        amount: upgrade.amount,
        approvedAt: new Date(),
        approvedBy: adminId,
        status: 'completed'
    });
    
    // Remove from pending
    vendor.pendingUpgrades.splice(upgradeIndex, 1);
    
    await vendor.save();
    return vendor;
};
// Static method to process upgrade approval
VendorSchema.statics.calculateUpgradePrice = function(additionalCustomers) {
    if (additionalCustomers % 500 !== 0) {
        throw new Error('Additional customers must be in increments of 500');
    }
    // ₦100 per additional customer (500 * 100 = ₦50,000)
    return additionalCustomers * 100;
};

module.exports = mongoose.model('Vendor', VendorSchema);