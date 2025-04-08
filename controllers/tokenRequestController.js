const axios = require('axios');
const TokenRequest = require('../models/TokenRequest');
const DiscoPricing = require('../models/DiscoPricing');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

const requestToken = async (req, res) => {
  try {
    const { meterNumber, units, disco } = req.body;
    const vendorId = req.user._id;
    const validDiscos = ['IKEDC', 'AEDC', 'EEDC', 'BEDC', 'KEDCO', 'ABA'];

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

    // Calculate the amount in NGN (Naira)
    const amountNGN = parseFloat(units) * pricing.pricePerUnit;
    if (isNaN(amountNGN) || amountNGN <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    // Convert the amount to kobo (100 kobo = 1 naira)
    const amountKobo = amountNGN * 100;

    // Generate a unique transaction reference
    const txRef = `CTK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Save transaction first to avoid duplicate reference issues
    await TokenRequest.create({ txRef, vendorId, meterNumber, units, amount: amountNGN, disco, status: 'pending' });

    // Payment data to send to Paystack
    const paymentData = {
      email: req.user.email || 'customer@example.com',
      amount: amountKobo, // Send amount in kobo
      reference: txRef,
      callback_url: `${APP_URL}/payment/verify?txRef=${txRef}`,
      metadata: {
        meterNumber,
        disco,
        units,
        vendorId
      }
    };

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      paymentData,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' } }
    );

    if (response.data.status !== true) {
      throw new Error('Failed to initialize payment');
    }

    return res.status(200).json({ success: true, paymentLink: response.data.data.authorization_url, txRef });
  } catch (error) {
    console.error('Request token error:', error);
    return res.status(500).json({ success: false, message: 'Failed to initiate payment', error: error.message });
  }
};



const cancelPayment = async (req, res) => {
  try {
    const { txRef } = req.body;
    const tokenRequest = await TokenRequest.findOneAndDelete({ txRef, status: 'pending' });

    if (!tokenRequest) {
      return res.status(404).json({ success: false, message: 'Pending transaction not found' });
    }

    return res.status(200).json({ success: true, message: 'Payment canceled successfully' });
  } catch (error) {
    console.error('Cancel payment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to cancel payment', error: error.message });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { txRef } = req.query;

    const response = await axios.get(`https://api.paystack.co/transaction/verify/${txRef}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
    });

    const paymentData = response.data.data;
    if (paymentData.status !== 'success') {
      return res.status(400).json({ success: false, message: 'Payment not successful' });
    }

    const tokenRequest = await TokenRequest.findOneAndUpdate(
      { txRef },
      {
        status: 'completed',
        token: `TKN-${Date.now().toString(36).toUpperCase()}`,
        paystackReference: paymentData.reference
      },
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

const handlePaystackWebhook = async (req, res) => {
  try {
    const event = req.body;

    if (event.event === 'charge.success') {
      const data = event.data;
      const txRef = data.reference;

      const update = {
        paystackReference: data.reference,
        status: 'completed',
        token: `TKN-${Date.now().toString(36).toUpperCase()}`
      };

      await TokenRequest.findOneAndUpdate({ txRef }, update);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
};

module.exports = { requestToken, verifyPayment, handlePaystackWebhook, cancelPayment };
