const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    role: {
      type: String,
      enum: ['super_admin', 'admin'],
      default: 'admin'
    },
    permissions: {
      // Existing permissions
      createVendors: { type: Boolean, default: false },
      verifyCustomers: { type: Boolean, default: false },
      discoPricing: { type: Boolean, default: false },
      tokenManagement: { type: Boolean, default: false },
      
      // NEW PERMISSIONS
      accountManagement: { type: Boolean, default: false }, // Manage admin accounts
      vendorSpace: { type: Boolean, default: false }, // Manage vendor customer limits
      vendorCustomer: { type: Boolean, default: false }, // Manage vendor-customer relationships
      viewAnalytics: { type: Boolean, default: false }, // View reports and analytics
      systemSettings: { type: Boolean, default: false } // Manage system settings
    },
    active: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match password method
adminSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Admin', adminSchema);