const axios = require('axios');
const TokenRequest = require('../models/TokenRequest');
const DiscoPricing = require('../models/DiscoPricing');

const requestToken = async (req, res) => {
  try {
    const { meterNumber, units, disco, paymentMethod } = req.body;
    const vendorId = req.user._id;

    // Validation
    if (!meterNumber || !meterNumber.toString().match(/^\d{6,20}$/)) {
      return res.status(400).json({ success: false, message: 'Valid meter number required' });
    }
    if (!["ABA", "IKEDC", "IBEDC", "AEDC", "BEDC", "EEDC"].includes(disco)) {
      return res.status(400).json({ success: false, message: 'Invalid disco' });
    }
    if (!["manual", "bankTransfer"].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Invalid payment method' });
    }

    const pricing = await DiscoPricing.findOne({ discoName: disco });
    if (!pricing?.pricePerUnit) {
      return res.status(400).json({ success: false, message: 'Pricing unavailable' });
    }

    const amount = parseFloat(units) * pricing.pricePerUnit;
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const txRef = `CTK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create token request with initiated status
    const tokenRequest = await TokenRequest.create({
      txRef,
      vendorId,
      meterNumber,
      units,
      amount,
      disco,
      status: 'initiated',
      paymentMethod
    });

    res.status(200).json({
      success: true,
      message: 'Token request created successfully',
      request: tokenRequest
    });

  } catch (error) {
    console.error('Request token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create token request',
      error: error.message
    });
  }
};

const confirmPayment = async (req, res) => {
  try {
    const { txRef, paymentDetails } = req.body;
    const userId = req.user._id;

    // Update token request to pending status
    const tokenRequest = await TokenRequest.findOneAndUpdate(
      { txRef, vendorId: userId, status: 'initiated' },
      { 
        status: 'pending',
        paymentDetails,
        paymentDate: new Date()
      },
      { new: true }
    );

    if (!tokenRequest) {
      return res.status(404).json({
        success: false,
        message: 'Token request not found or already processed'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment confirmation received. Your request is now pending admin approval.',
      request: tokenRequest
    });

  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment',
      error: error.message
    });
  }
};



module.exports = {
  requestToken,
  confirmPayment,
  
};