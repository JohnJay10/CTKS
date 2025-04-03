const axios = require('axios');
const Flutterwave = require('flutterwave-node-v3');
const TokenRequest = require('../models/TokenRequest');
const DiscoPricing = require('../models/DiscoPricing');

// Environment variables
const FLW_PUBLIC_KEY = process.env.FLW_PUBLIC_KEY;
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;
const FLW_ENCRYPTION_KEY = process.env.FLW_ENCRYPTION_KEY;
const FLW_WEBHOOK_HASH = process.env.FLW_WEBHOOK_HASH;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Initialize Flutterwave
const flw = new Flutterwave(FLW_PUBLIC_KEY, FLW_SECRET_KEY);

const requestToken = async (req, res) => {
  try {
    const { meterNumber, units, disco } = req.body;
    const vendorId = req.user._id;
    const validDiscos = ['IKEDC', 'AEDC', 'EEDC', 'BEDC', 'KEDCO', 'ABA'];

    // Validation
    if (!meterNumber || !meterNumber.toString().match(/^\d{6,20}$/)) {
      return res.status(400).json({ success: false, message: 'Valid meter number required' });
    }
    if (!validDiscos.includes(disco)) {
      return res.status(400).json({ success: false, message: 'Invalid disco' });
    }

    // Get pricing
    const pricing = await DiscoPricing.findOne({ discoName: disco });
    if (!pricing?.pricePerUnit) {
      return res.status(400).json({ success: false, message: 'Pricing unavailable' });
    }

    // Calculate amount
    const amountNGN = parseFloat(units) * pricing.pricePerUnit;
    if (isNaN(amountNGN) || amountNGN <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    // Generate transaction reference
    const txRef = `CTK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Prepare payment data
    const paymentData = {
      tx_ref: txRef,
      amount: amountNGN,
      currency: 'NGN',
      payment_options: 'card,account,ussd,banktransfer',
      redirect_url: `${APP_URL}/payment/verify?txRef=${txRef}`,
      customer: {
        email: req.user.email || 'customer@example.com',
        name: `Customer ${meterNumber}`,
        phone_number: req.user.phone || '08012345678'
      },
      customizations: {
        title: 'CTKS Token Service',
        description: `Electricity Token for ${disco}`,
        logo: `${APP_URL}/logo.png`
      },
      meta: {
        meterNumber,
        disco,
        units,
        vendorId
      }
    };

    // Make Flutterwave API request
    const response = await axios.post(
      'https://api.flutterwave.com/v3/payments',
      paymentData,
      { headers: { Authorization: `Bearer ${FLW_SECRET_KEY}`, 'Content-Type': 'application/json' } }
    );

    if (!response.data || response.data.status !== 'success') {
      throw new Error('Failed to generate payment link');
    }

    // Save transaction to database
    await TokenRequest.create({ txRef, vendorId, meterNumber, units, amount: amountNGN, disco, status: 'pending' });

    return res.status(200).json({ success: true, paymentLink: response.data.data.link, txRef });
  } catch (error) {
    console.error('Error processing token:', error);
    return res.status(500).json({ success: false, message: 'Payment processing failed', error: error.message });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { txRef } = req.query;
    const response = await flw.Transaction.verify({ tx_ref: txRef });

    if (!response.data || response.data.status !== 'successful') {
      return res.status(400).json({ success: false, message: 'Payment not successful' });
    }

    const tokenRequest = await TokenRequest.findOneAndUpdate(
      { txRef },
      { status: 'completed', token: `TKN-${Date.now().toString(36).toUpperCase()}`, flutterwaveReference: response.data.flw_ref },
      { new: true }
    );

    if (!tokenRequest) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    return res.status(200).json({ success: true, token: tokenRequest.token, details: tokenRequest });
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({ success: false, message: 'Verification failed', error: error.message });
  }
};

const handleFlutterwaveWebhook = async (req, res) => {
  try {
    if (req.headers['verif-hash'] !== FLW_WEBHOOK_HASH) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    const { tx_ref, status, flw_ref } = req.body;
    const update = { flutterwaveReference: flw_ref, status: status === 'successful' ? 'completed' : 'failed' };
    if (status === 'successful') update.token = `TKN-${Date.now().toString(36).toUpperCase()}`;

    await TokenRequest.findOneAndUpdate({ txRef: tx_ref }, update);
    return res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ status: 'error', message: 'Webhook processing failed' });
  }
};

module.exports = { requestToken, verifyPayment, handleFlutterwaveWebhook };
