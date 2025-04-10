const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
    tokenId: { type: String, required: true, unique: true },
    tokenValue: { type: String, required: true },
    meterNumber: { type: String, required: true },
    units: { type: Number, required: true },
    amount: { type: Number, required: true },
    disco: { 
        type: String, 
        enum: ["ABA", "IKEDC", "IBEDC", "AEDC", "BEDC", "EEDC"],
        required: true 
    },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    status: { 
        type: String, 
        enum: ["pending", "issued", "used", "expired"],
        default: "pending"  
    },
    expiryDate: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Token', tokenSchema);