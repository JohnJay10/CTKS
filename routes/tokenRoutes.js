const express = require('express');
const router = express.Router();
const {
    getTokenRequests,
    approveTokenRequest,
    rejectTokenRequest,
    issueTokenToVendor,
    fetchTokens,
    getIssuedTokenCount
} = require('../controllers/tokenController');
const { requestToken, verifyPayment, handlePaystackWebhook, cancelPayment } = require('../controllers/tokenRequestController');
const auth = require('../middleware/authMiddleware');

// Admin routes
router.get('/admin/requests', auth(['admin']), getTokenRequests);
router.patch('/admin/approve/:requestId', auth(['admin']), approveTokenRequest);
router.patch('/admin/reject/:requestId', auth(['admin']), rejectTokenRequest);
router.post('/admin/issue', auth(['admin']), issueTokenToVendor);

// Vendor routes
router.get('/fetchtoken', auth(['vendor']), fetchTokens);
router.get('/issuedtokencount', auth(['vendor']), getIssuedTokenCount);
router.post('/request', auth(['vendor']), requestToken);

// Payment verification route (remove auth for Paystack callback)
router.get('/verify-payment/:txRef', verifyPayment); // Removed auth middleware

// Cancel payment route (remove auth for Paystack callback)
router.post('/cancel-payment', cancelPayment); // Removed auth middleware

// Webhook route (no authentication)
router.post('/webhook', handlePaystackWebhook);

module.exports = router;