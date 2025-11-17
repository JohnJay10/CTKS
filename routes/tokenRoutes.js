const express = require('express');
const router = express.Router();
const {
    getTokenRequests,
    approveTokenRequest,
    rejectTokenRequest,
    issueTokenToVendor,
    fetchTokens,
    getIssuedTokenCount,
    getPaymentTransactionHistory,
    requesthistory,
    tokenrequesthistory,     
    fetchTokenByMeterNumber,
    reissueToken
    
} = require('../controllers/tokenController');
const { requestToken,confirmPayment,cancelPayment   } = require('../controllers/tokenRequestController');
const auth = require('../middleware/authMiddleware');

// Define permission middleware for token management
const checkTokenPermission = (req, res, next) => {
    console.log('🔐 Token Permission Check:');
    console.log('  - User role:', req.admin?.role);
    console.log('  - User permissions:', req.admin?.permissions);
    
    // Super admin has all permissions
    if (req.admin?.role === 'super_admin') {
        console.log('✅ Super admin - token access granted');
        return next();
    }
    
    // Check if admin has tokenManagement permission
    if (req.admin?.permissions?.tokenManagement) {
        console.log('✅ Token management permission granted');
        return next();
    }
    
    console.log('❌ Token management permission denied');
    return res.status(403).json({ 
        message: 'Access denied. You need token management permissions.' 
    });
};

// Admin routes with token management permissions
router.get('/admin/requests', auth(['admin', 'super_admin']), checkTokenPermission, getTokenRequests);
router.patch('/admin/approve/:requestId', auth(['admin', 'super_admin']), checkTokenPermission, approveTokenRequest);
router.patch('/admin/reject/:requestId', auth(['admin', 'super_admin']), checkTokenPermission, rejectTokenRequest);
router.post('/admin/issue', auth(['admin', 'super_admin']), checkTokenPermission, issueTokenToVendor);   
router.get('/admin/all-tokens', auth(['admin', 'super_admin']), checkTokenPermission, getPaymentTransactionHistory);
router.get('/admin/token/:meterNumber', auth(['admin', 'super_admin']), checkTokenPermission, fetchTokenByMeterNumber);
router.put('/admin/reissue/:id', auth(['admin', 'super_admin']), checkTokenPermission, reissueToken);  

// Vendor routes (no changes needed)
router.get('/fetchtoken', auth(['vendor']), fetchTokens);
router.get('/issuedtokencount', auth(['vendor']), getIssuedTokenCount);
router.get('/requesthistory', auth(['vendor']), requesthistory);
router.get('/tokenrequesthistory', auth(['vendor']), tokenrequesthistory);
router.post('/request', auth(['vendor']), requestToken);
router.post('/confirm-payment', auth(['vendor']), confirmPayment);

// Public routes (no authentication needed for payment callbacks)
router.post('/cancel-payment', cancelPayment);

module.exports = router;