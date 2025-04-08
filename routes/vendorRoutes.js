const express = require('express');
const { loginVendor, addCustomer, getAllCustomers, getCustomerCount, getPendingRequestCount, getIssuedTokenCount, getRecentActivities,getActivityAction} = require('../controllers/vendorController');
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

//Get Issued Token Count
router.get('/getIssuedTokenCount', auth(['vendor']), getIssuedTokenCount);

//Get Recent Activities
router.get('/activities', auth(['vendor']), getRecentActivities);

//Get Activity Action

router.get('/getActivityAction/:activityId', auth(['vendor']), getActivityAction);



module.exports = router;