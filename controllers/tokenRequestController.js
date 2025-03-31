const axios = require('axios');
const Customer = require('../models/Customer');
const TokenRequest = require('../models/TokenRequest');
const DiscoPricing = require('../models/DiscoPricing');
const { PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_API_URL, APP_URL } = process.env;

// PayPal API Helper Functions
const getPayPalAccessToken = async () => {
  try {
    const response = await axios.post(
      `${PAYPAL_API_URL}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: {
          username: PAYPAL_CLIENT_ID,
          password: PAYPAL_SECRET
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('Failed to get PayPal access token:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with PayPal');
  }
};

const createPayPalOrder = async (orderData, accessToken) => {
  try {
    const response = await axios.post(
      `${PAYPAL_API_URL}/v2/checkout/orders`,
      orderData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': orderData.purchase_units[0].reference_id
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('PayPal order creation failed:', error.response?.data || error.message);
    throw new Error('Failed to create PayPal order');
  }
};

const capturePayPalPayment = async (orderID, accessToken) => {
  try {
    const response = await axios.post(
      `${PAYPAL_API_URL}/v2/checkout/orders/${orderID}/capture`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('PayPal payment capture failed:', error.response?.data || error.message);
    throw new Error('Failed to capture PayPal payment');
  }
};

// Main Controller Functions
const requestToken = async (req, res) => {
  const { meterNumber, units, disco } = req.body;
  const vendorId = req.user._id;
  let txRef;

  try {
    // 1. Input Validation
    if (!meterNumber || !units || !disco) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: meterNumber, units, disco'
      });
    }

    // 2. Customer Verification (Optional - can be removed if not needed)
    const customer = await Customer.findOne({ meterNumber, vendorId }) || {
      meterNumber,
      disco,
      verification: { isVerified: true } // Default to verified if customer doesn't exist
    };

    if (!customer.verification.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Customer not verified'
      });
    }

    // 3. Pricing Calculation
    const pricing = await DiscoPricing.findOne({ discoName: disco });
    if (!pricing) {
      return res.status(400).json({
        success: false,
        message: 'Disco pricing not configured'
      });
    }

    const amount = units * pricing.pricePerUnit;
    txRef = `CTKS-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // 4. Create Token Request Record
    const tokenRequest = await TokenRequest.create({
      txRef,
      vendorId,
      meterNumber,
      units,
      amount,
      disco,
      status: 'payment_pending'
    });

    // 5. Create PayPal Order
    const accessToken = await getPayPalAccessToken();
    
    const order = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: txRef,
        amount: {
          currency_code: 'USD',
          value: amount.toFixed(2)
        },
        description: `Purchase of ${units} units for meter ${meterNumber}`,
        custom_id: `CTKS_TOKEN_${meterNumber}`,
      }],
      application_context: {
        brand_name: 'CTKS Token Service',
        user_action: 'PAY_NOW',
        return_url: `${APP_URL}/payment/success?txRef=${txRef}`,
        cancel_url: `${APP_URL}/payment/cancel?txRef=${txRef}`,
        shipping_preference: 'NO_SHIPPING'
      }
    };

    const paypalOrder = await createPayPalOrder(order, accessToken);
    const approvalLink = paypalOrder.links.find(link => link.rel === 'approve');

    if (!approvalLink) {
      throw new Error('No PayPal approval link found');
    }

    // 6. Update Token Request with PayPal Details
    tokenRequest.paymentDetails = {
      orderId: paypalOrder.id,
      status: paypalOrder.status
    };
    await tokenRequest.save();

    // 7. Return Success Response
    return res.status(200).json({
      success: true,
      approvalUrl: approvalLink.href,
      txRef,
      orderId: paypalOrder.id,
      amount,
      meterNumber,
      disco,
      units
    });

  } catch (error) {
    console.error('Token request failed:', error.message);
    
    // Update token request status if it was created
    if (txRef) {
      await TokenRequest.findOneAndUpdate(
        { txRef },
        { status: 'failed', error: error.message },
        { new: true }
      );
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process token request',
      error: error.response?.data || error.message
    });
  }
};

const capturePayment = async (req, res) => {
  const { orderID, txRef } = req.body;

  try {
    // 1. Validate Input
    if (!orderID || !txRef) {
      return res.status(400).json({
        success: false,
        message: 'Missing orderID or txRef'
      });
    }

    // 2. Verify Token Request Exists
    const tokenRequest = await TokenRequest.findOne({ txRef });
    if (!tokenRequest) {
      return res.status(404).json({
        success: false,
        message: 'Token request not found'
      });
    }

    // 3. Capture PayPal Payment
    const accessToken = await getPayPalAccessToken();
    const captureResult = await capturePayPalPayment(orderID, accessToken);

    // 4. Update Token Request
    if (captureResult.status === 'COMPLETED') {
      tokenRequest.status = 'payment_completed';
      tokenRequest.paymentDetails = {
        ...tokenRequest.paymentDetails,
        capture: captureResult,
        completedAt: new Date()
      };
      await tokenRequest.save();

      // Here you would typically:
      // - Generate the actual electricity token
      // - Send notification to vendor/customer
      // - Update any related records

      return res.status(200).json({
        success: true,
        status: 'completed',
        tokenRequest,
        captureData: captureResult
      });
    } else {
      throw new Error(`Payment status: ${captureResult.status}`);
    }

  } catch (error) {
    console.error('Payment capture failed:', error.message);

    // Update token request status if it exists
    if (txRef) {
      await TokenRequest.findOneAndUpdate(
        { txRef },
        { status: 'failed', error: error.message },
        { new: true }
      );
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Payment capture failed',
      error: error.response?.data || error.message
    });
  }
};

const verifyPaymentStatus = async (req, res) => {
  const { txRef } = req.params;

  try {
    // 1. Validate Input
    if (!txRef) {
      return res.status(400).json({
        success: false,
        message: 'Missing transaction reference'
      });
    }

    // 2. Find Token Request
    const tokenRequest = await TokenRequest.findOne({ txRef });
    if (!tokenRequest) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // 3. Return Status
    return res.status(200).json({
      success: true,
      status: tokenRequest.status,
      tokenRequest
    });

  } catch (error) {
    console.error('Payment verification failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
};

module.exports = {
  requestToken,
  capturePayment,
  verifyPaymentStatus,
  // Export helpers for testing if needed
  _test: {
    getPayPalAccessToken,
    createPayPalOrder,
    capturePayPalPayment
  }
};