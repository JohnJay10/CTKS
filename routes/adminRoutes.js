const express = require('express');
const { registerAdmin,
     loginAdmin, 
     createVendor, 
     discoPricing,
      approveVendor,
       verifyCustomer, 
       getTokenRequestCount,
    getPendingVendorCount,
    getPendingCustomerVerificationCount, 
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
    logoutAdmin,
    getCustomersCount,
    getVerifiedCustomersCount,
    getIssuedTokenCount,
    getTotalTokensAmount,
     getDailyTokenCount,
        getMonthlyTokenCount,
        getRevenueTrends,
        getCustomerTrends,
        getTokenTrends,
        getCustomerDistribution,
        getSalesReport,
        getPendingUpgrades,
        CompleteUpgrade
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
router.get('/pending-customers-verification', auth(['admin']), getPendingCustomerVerificationCount);
router.get('/verified-customers-count', auth(['admin']), getVerifiedCustomersCount);
router.get('/issued-token-count', auth(['admin']), getIssuedTokenCount);
router.get('/total-tokens-amount', auth(['admin']), getTotalTokensAmount);

router.get('/daily-token-count', auth(['admin']), getDailyTokenCount);
router.get('/monthly-token-count', auth(['admin']), getMonthlyTokenCount);

//Trends
router.get('/revenue-trends', auth(['admin']), getRevenueTrends);
router.get('/customer-trends', auth(['admin']), getCustomerTrends);   
router.get('/token-trends', auth(['admin']), getTokenTrends);
router.get('/customer-distribution', auth(['admin']), getCustomerDistribution);


router.get('/sales-report', auth(['admin']), getSalesReport);

//Get pending upgrades
router.get('/pending-upgrades', auth(['admin']), getPendingUpgrades);

router.patch('/complete/:vendorId/:upgradeId', auth(['admin']), CompleteUpgrade);






router.get('/customers/stats', auth(['admin']), getCustomersCount);

module.exports = router;