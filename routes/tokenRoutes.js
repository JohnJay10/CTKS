const express = require('express');
const router = express.Router();
const {
    getTokenRequests,
    approveTokenRequest,
    rejectTokenRequest,
    issueTokenToVendor,
    fetchTokens
  } = require('../controllers/tokenController');
const { requestToken, verifyPayment, handleFlutterwaveWebhook } = require('../controllers/tokenRequestController');
const { handlePaymentWebhook } = require('../controllers/paymentController');
const auth = require('../middleware/authMiddleware');

router.get('/admin/requests', auth(['admin']), getTokenRequests); // Get all pending requests
router.patch('/admin/approve/:requestId', auth(['admin']), approveTokenRequest); // Approve specific request
router.patch('/admin/reject/:requestId', auth(['admin']), rejectTokenRequest); // Reject specific request
router.post('/admin/issue', auth(['admin']), issueTokenToVendor); // Issue token after approval


// Fetch Token Route
router.get('/fetchtoken', auth(['vendor']), fetchTokens);

// Token request routes
router.post('/request', auth(['vendor']), requestToken);
router.get('/verify-payment/:txRef', auth(['vendor']), verifyPayment);

// Webhook route (no authentication)
router.post('/webhook', handleFlutterwaveWebhook);

module.exports = router;