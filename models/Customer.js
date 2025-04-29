const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  meterNumber: { type: String, required: true, unique: true },
  disco: { 
    type: String, 
    required: true, 
    enum: ["ABA", "IKEDC", "IBEDC", "AEDC", "BEDC", "EEDC"] 
  },    
  lastToken: { type: String },
  verification: {
    KRN: { type: String },
    SGC: { type: String },  
    TI: { type: String },
    MSN: { type: String },
    MTK1: { type: String },   
    MTK2: { type: String },
    RTK1: { type: String },
    RTK2: { type: String },
    isVerified: { type: Boolean, default: false },
    rejected: { 
      type: Boolean, 
      default: false 
    },
    rejectionReason: { 
      type: String,
      validate: {
        validator: function(v) {
          // Only require rejectionReason if rejected is true
          return !this.rejected || (this.rejected && v && v.trim().length > 0);
        },
        message: 'Rejection reason is required when rejecting a customer'
      }
    },
    rejectedAt: { type: Date },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Assuming an admin/user does the rejection
  },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' }
}, { timestamps: true });

// Add a pre-save hook to automatically set rejectedAt when rejected is true
CustomerSchema.pre('save', function(next) {
  if (this.verification.rejected && this.isModified('verification.rejected')) {
    this.verification.rejectedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Customer', CustomerSchema);