const mongoose = require('mongoose');

const DiscoPricingSchema = new mongoose.Schema({
  discoName: { 
    type: String, 
    required: true,
    enum: ["ABA", "IKEDC", "IBEDC", "AEDC", "BEDC", "EEDC"]
  },
  pricePerUnit: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now }  
});

module.exports = mongoose.model('DiscoPricing', DiscoPricingSchema);