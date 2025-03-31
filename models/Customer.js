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
    isVerified: { type: Boolean, default: false }
  },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' }
});

module.exports = mongoose.model('Customer', CustomerSchema);