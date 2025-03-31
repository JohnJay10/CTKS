const axios = require('axios');
const TokenRequest = require('../models/TokenRequest');
const Vendor = require('../models/Vendor');
const Customer = require('../models/Customer');
const { PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_API_URL } = process.env;

// Function to get PayPal access token
const getPayPalAccessToken = async () => {
    try {
        const auth = await axios.post(
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
        return auth.data.access_token;
    } catch (error) {
        console.error('PayPal access token error:', error.response?.data || error.message);
        throw error;
    }
};

// Create PayPal order
exports.createPayPalOrder = async (req, res) => {
    try {
        const { txRef, meterNumber, units, disco } = req.body;
        const vendorId = req.user._id; // Assuming vendor is authenticated

        // Get vendor to verify disco pricing
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        // Get disco price from vendor's pricing
        const discoPrice = vendor.discoPricing[disco];
        if (!discoPrice) {
            return res.status(400).json({ error: 'Invalid disco or pricing not set' });
        }

        // Calculate total amount
        const amount = units * discoPrice;

        // Create token request record
        const tokenRequest = new TokenRequest({
            txRef,
            vendorId,
            meterNumber,
            units,
            amount,
            disco,
            status: 'pending'
        });

        await tokenRequest.save();

        // Create PayPal order
        const order = {
            intent: 'CAPTURE',
            purchase_units: [
                {
                    reference_id: txRef,
                    amount: {
                        currency_code: 'USD',
                        value: amount.toFixed(2)
                    },
                    description: `Purchase of ${units} units for meter ${meterNumber}`
                }
            ],
            application_context: {
                brand_name: 'CTKs Token Service',
                user_action: 'PAY_NOW',
                return_url: `${process.env.APP_URL}/payment/success?txRef=${txRef}`,
                cancel_url: `${process.env.APP_URL}/payment/cancel?txRef=${txRef}`
            }
        };

        // Get PayPal access token
        const accessToken = await getPayPalAccessToken();

        // Create PayPal order
        const response = await axios.post(
            `${PAYPAL_API_URL}/v2/checkout/orders`,
            order,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json(response.data);

    } catch (error) {
        console.error('PayPal order creation error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to create PayPal order' });
    }
};

// Capture PayPal payment
exports.capturePayPalPayment = async (req, res) => {
    try {
        const { orderID, txRef } = req.body;

        // Get PayPal access token
        const accessToken = await getPayPalAccessToken();

        // Capture payment
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

        // Update token request status
        if (response.data.status === 'COMPLETED') {
            await TokenRequest.findOneAndUpdate(
                { txRef },
                { status: 'completed', paymentDetails: response.data },
                { new: true }
            );

            // Here you would typically generate and send the token to the vendor
            // This would involve calling your token generation service
            // For now, we'll just mark it as completed
        }

        res.json(response.data);

    } catch (error) {
        console.error('PayPal payment capture error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to capture PayPal payment' });
    }
};

// Verify payment status
exports.verifyPayment = async (req, res) => {
    try {
        const { txRef } = req.params;

        const tokenRequest = await TokenRequest.findOne({ txRef });
        if (!tokenRequest) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json({
            status: tokenRequest.status,
            paymentDetails: tokenRequest.paymentDetails,
            tokenRequest
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
};