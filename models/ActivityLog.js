const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'customer_added',
      'customer_updated',
      'token_requested',
      'token_issued',
      'token_used',
      'payment_received',
      'login',
      'logout',
      'profile_updated'
    ],
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  description: {
    type: String,
    required: function() {
      return this.type === 'other';
    }
  },
  metadata: {
    // Flexible field to store additional data
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    tokenId: { type: mongoose.Schema.Types.ObjectId, ref: 'Token' },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'TokenRequest' },
    meterNumber: String,
    units: Number,
    amount: Number,
    disco: String,
    ipAddress: String,
    userAgent: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for frequently queried fields
activityLogSchema.index({ vendor: 1, type: 1, status: 1 });
activityLogSchema.index({ createdAt: -1 });

// Virtual for formatted activity type
activityLogSchema.virtual('action').get(function() {
  const actions = {
    'customer_added': 'Added Customer',
    'customer_updated': 'Updated Customer',
    'token_requested': 'Requested Tokens',
    'token_issued': 'Issued Tokens',
    'token_used': 'Used Tokens',
    'payment_received': 'Received Payment',
    'login': 'Logged In',
    'logout': 'Logged Out',
    'profile_updated': 'Updated Profile'
  };
  return actions[this.type] || this.description || 'Performed Action';
});

// Pre-save hook to update timestamps
activityLogSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);