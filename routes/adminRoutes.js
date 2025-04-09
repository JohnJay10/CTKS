const express = require('express');
const { registerAdmin,
     loginAdmin, 
     createVendor, 
     discoPricing,
      approveVendor,
       verifyCustomer, 
       getTokenRequestCount,
    getPendingVendorCount,
    getCustomerVerificationCount, 
    getAllDiscoPricing, 
    getAllVendors, 
    getAllCustomers
} = require('../controllers/adminController');
const auth = require('../middleware/authMiddleware');
const router = express.Router();

/**
 * Public Routes
 */
router.post('/register', registerAdmin);
router.post('/login', loginAdmin);




//Protected admin Routes 
router.post('/vendors', auth(['admin']), createVendor);
router.get('/vendors', auth(['admin']), getAllVendors);

router.post('/disco-pricing', auth(['admin']), discoPricing);
router.get('/disco-pricing', auth(['admin']), getAllDiscoPricing); 


//Approve Vendor 
router.patch('/vendors/:vendorId/approve', auth(['admin']), approveVendor);


//Verify Customers
  
router.get('/customers', auth(['admin']), getAllCustomers);

router.put('/customers/:customerId/verify', auth(['admin']), verifyCustomer);



//Counts 

router.get('/token-request-count', auth(['admin']), getTokenRequestCount); 
router.get('/pending-vendor-count', auth(['admin']), getPendingVendorCount);
router.get('/customer-verification-count', auth(['admin']), getCustomerVerificationCount);

module.exports = router;