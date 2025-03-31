const express = require('express');
const { loginVendor, addCustomer, getAllCustomers} = require('../controllers/vendorController');
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



router.get('/disco-pricing', auth(['vendor']), getAllDiscoPricing); 




module.exports = router;