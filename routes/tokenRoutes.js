const express = require('express');
const router = express.Router();
const { issueTokenToVendor, fetchTokens } = require('../controllers/tokenController');

const { requestToken, capturePayment, verifyPaymentStatus } = require('../controllers/tokenRequestController');
const { handlePaymentWebhook } = require('../controllers/paymentController');
const auth = require('../middleware/authMiddleware');

// POST /api/tokens/issue
router.post('/issue', auth(['admin']), issueTokenToVendor);

//Fet Token Route 

router.get('/fetchtoken', auth(['vendor']), fetchTokens);    




// Vendor requests token
router.post('/request', auth(['vendor']), requestToken);

// Capture payment  
  
router.post('/capture', auth(['vendor']), capturePayment);

//VerifyPayment
router.post('/status/:txRef', auth(['vendor']), verifyPaymentStatus);



module.exports = router;