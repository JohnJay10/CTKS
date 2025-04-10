const mongoose = require('mongoose');

const tokenRequestSchema = new mongoose.Schema({
    txRef: { type: String, required: true, unique: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    meterNumber: { type: String, required: true },
    units: { type: Number, required: true },
    amount: { type: Number, required: true },
    disco: { 
        type: String, 
        enum: ["ABA", "IKEDC", "IBEDC", "AEDC", "BEDC", "EEDC"],
        required: true 
    },
    status: { 
        type: String, 
        enum: ["initiated", "pending","approved", "completed", "failed"],
        default: "initiated" 
    },
    paymentMethod: { type: String, enum: ["manual", "bankTransfer"], required:  true },
    paymentDetails: { type: String },
    paymentDate: { type: Date },
    token: { type: String },
    }, { timestamps: true });

module.exports = mongoose.model('TokenRequest', tokenRequestSchema);