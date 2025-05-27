const express = require('express');
const { loginVendor, addCustomer, getAllCustomers, getCustomerCount, getPendingRequestCount,getVendorLimits, getPendingVerifications, getIssuedTokenCount, getRecentActivities,getActivityAction, getAllAccounts, initiateUpgrade,
        submitPaymentProof} = require('../controllers/vendorController');
const {getAllDiscoPricing } = require('../controllers/adminController');

const auth = require('../middleware/authMiddleware');
const router = express.Router();

/**
 * Public Routes
 */

router.post('/login', loginVendor);


//Private Routes 
router.post('/addCustomer', auth(['vendor']), addCustomer);

//Get All Customers 

router.get('/getAllCustomers', auth(['vendor']), getAllCustomers);

//Get Customer Count
router.get('/getCustomerCount', auth(['vendor']), getCustomerCount);

router.get('/disco-pricing', auth(['vendor']), getAllDiscoPricing); 

//Get Pending Request Count
router.get('/getPendingRequestCount', auth(['vendor']), getPendingRequestCount);

//Get Pending Verifications
router.get('/getPendingVerifications', auth(['vendor']), getPendingVerifications);

//Get Issued Token Count
router.get('/getIssuedTokenCount', auth(['vendor']), getIssuedTokenCount);

//Get Recent Activities
router.get('/activities', auth(['vendor']), getRecentActivities);

//Get Activity Action

router.get('/getActivityAction/:activityId', auth(['vendor']), getActivityAction);



//Get All Bank Accounts 
router.get('/default', auth(['vendor']), getAllAccounts);


//Get Vendor Limits
router.get('/getVendorLimits', auth(['vendor']), getVendorLimits);

//Initiate Upgrade
router.post('/initiateUpgrade', auth(['vendor']), initiateUpgrade);
//Submit Payment Proof
router.post('/submitPaymentProof/:upgradeId', auth(['vendor']), submitPaymentProof);



module.exports = router;