const mongoose = require('mongoose');

const DiscoPricingSchema = new mongoose.Schema({
  discoName: { 
    type: String, 
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50,
 
  },
  pricePerUnit: { 
    type: Number, 
    required: true,
    min: 0
  },
   disabled: {  // 👈 New field
    type: Boolean,
    default: false 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }  
}, { 
  collation: { locale: 'en', strength: 2 }  // Case-insensitive collation
});

// EITHER use this (recommended approach):
DiscoPricingSchema.index({ discoName: 1 }, { 
  unique: true,
  collation: { locale: 'en', strength: 2 }  // Case-insensitive uniqueness
});

// OR use the index: true in the schema definition, but NOT both

module.exports = mongoose.model('DiscoPricing', DiscoPricingSchema);