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
    getAllCustomers,
    updateVerifiedCustomer,
    deleteCustomer,
    editVendor ,
    deleteVendor,
    deactivateVendor,
    editDiscoPricing,
    rejectCustomer,
    logoutAdmin
} = require('../controllers/adminController');
const auth = require('../middleware/authMiddleware');
const router = express.Router();

/**
 * Public Routes
 */
router.post('/register', registerAdmin);
router.post('/login', loginAdmin);
router.post('/logout', auth(['admin']), logoutAdmin);




//Protected admin Routes 
router.post('/vendors', auth(['admin']), createVendor);
router.get('/vendors', auth(['admin']), getAllVendors);

router.post('/disco-pricing', auth(['admin']), discoPricing);
router.get('/disco-pricing', auth(['admin']), getAllDiscoPricing); 
router.patch('/disco-pricing/:discoName', auth(['admin']), editDiscoPricing);


//Approve Vendor 
router.patch('/vendors/:vendorId/approve', auth(['admin']), approveVendor);

router.patch('/vendors/:vendorId/edit', auth(['admin']), editVendor);
router.delete('/vendors/:vendorId/delete', auth(['admin']), deleteVendor);

router.patch('/vendors/:vendorId/deactivate', auth(['admin']), deactivateVendor);


//Verify Customers
  
router.get('/customers', auth(['admin']), getAllCustomers);

router.put('/customers/:customerId/verify', auth(['admin']), verifyCustomer);
router.put('/customers/:customerId/update', auth(['admin']), updateVerifiedCustomer);
router.delete('/customers/:customerId/delete', auth(['admin']), deleteCustomer);

router.put('/customers/:customerId/reject', auth(['admin']), rejectCustomer);





//Counts 

router.get('/token-request-count', auth(['admin']), getTokenRequestCount); 
router.get('/pending-vendor-count', auth(['admin']), getPendingVendorCount);
router.get('/customer-verification-count', auth(['admin']), getCustomerVerificationCount);

module.exports = router;