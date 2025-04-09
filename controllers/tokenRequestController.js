const axios = require('axios');
const TokenRequest = require('../models/TokenRequest');
const DiscoPricing = require('../models/DiscoPricing');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

const requestToken = async (req, res) => {
  try {
    const { meterNumber, units, disco, email } = req.body;
    const vendorId = req.user._id;
    const validDiscos = ['IKEDC', 'AEDC', 'EEDC', 'BEDC', 'KEDCO', 'ABA'];

    // Validation
    if (!meterNumber || !meterNumber.toString().match(/^\d{6,20}$/)) {
      return res.status(400).json({ success: false, message: 'Valid meter number required' });
    }
    if (!validDiscos.includes(disco)) {
      return res.status(400).json({ success: false, message: 'Invalid disco' });
    }

    const pricing = await DiscoPricing.findOne({ discoName: disco });
    if (!pricing?.pricePerUnit) {
      return res.status(400).json({ success: false, message: 'Pricing unavailable' });
    }

    const amountNGN = parseFloat(units) * pricing.pricePerUnit;
    if (isNaN(amountNGN) || amountNGN <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const amountKobo = Math.round(amountNGN * 100);
    const txRef = `CTK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create token request with pending status
    const tokenRequest = await TokenRequest.create({
      txRef,
      vendorId,
      meterNumber,
      units,
      amount: amountNGN,
      disco,
      status: 'initiated', // Initial status
      customerEmail: email
    });

    // Initialize Paystack payment
    const paymentData = {
      email: email || 'customer@example.com',
      amount: amountKobo,
      reference: txRef,
      callback_url: `${APP_URL}/api/tokens/verify?txRef=${txRef}`,
      metadata: {
        meterNumber,
        disco,
        units,
        vendorId,
        txRef,
        tokenRequestId: tokenRequest._id
      }
    };

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      paymentData,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' } }
    );

    if (!response.data.status) {
      await TokenRequest.findByIdAndUpdate(tokenRequest._id, { status: 'payment_failed' });
      throw new Error('Failed to initialize payment');
    }

    res.status(200).json({
      success: true,
      paymentLink: response.data.data.authorization_url,
      reference: txRef,
      amount: amountNGN
    });

  } catch (error) {
    console.error('Request token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
      error: error.message
    });
  }
};




const verifyPayment = async (req, res) => {
  try {
    const { txRef } = req.query;

     // First clean up any expired initiated requests for this txRef
     await TokenRequest.deleteMany({
      txRef,
      status: 'initiated',
      expiresAt: { $lt: new Date() }
    });

    // Verify payment with Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${txRef}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );

    const paymentData = response.data.data;
    if (paymentData.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Payment not successful',
        status: paymentData.status
      });
    }

    // Update token request to pending (admin will approve later)
    const tokenRequest = await TokenRequest.findOneAndUpdate(
      { txRef },
      { 
        status: 'pending', 
        paystackReference: paymentData.reference,
        paymentVerifiedAt: new Date()
      },
      { new: true }
    );

    if (!tokenRequest) {
      return res.status(404).json({
        success: false,
        message: 'Token request not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified. Token request is pending admin approval.',
      request: tokenRequest
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
};

const handlePaystackWebhook = async (req, res) => {
  try {
    const event = req.body;

    if (event.event === 'charge.success') {
      const data = event.data;
      const txRef = data.metadata?.txRef || data.reference;

      // Update token request to pending
      await TokenRequest.findOneAndUpdate(
        { txRef },
        {
          status: 'pending',
          paystackReference: data.reference,
          paymentVerifiedAt: new Date()
        }
      );
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
};

const cancelPayment = async (req, res) => {
  try {
    const { txRef } = req.body;
    const tokenRequest = await TokenRequest.findOneAndUpdate(
      { txRef, status: 'payment_pending' },
      { status: 'cancelled' },
      { new: true }
    );

    if (!tokenRequest) {
      return res.status(404).json({
        success: false,
        message: 'Pending transaction not found or already processed'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment canceled successfully'
    });
  } catch (error) {
    console.error('Cancel payment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel payment',
      error: error.message
    });
  }
};

module.exports = {
  requestToken,
  verifyPayment,
  handlePaystackWebhook,
  cancelPayment
};