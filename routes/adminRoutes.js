const express = require('express');
const { 
    registerAdmin,
    loginAdmin, 
    createVendor, 
    discoPricing,
    approveVendor,
    verifyCustomer, 
    getTokenRequestCount,
    getPendingVendorCount,
    getPendingCustomerVerificationCount, 
    getAllDiscoPricing, 
    disableDisco,
    enableDisco,
    getActiveDiscos,
    getAllVendors, 
    getAllCustomers,
    updateVerifiedCustomer,
    deleteCustomer,
    editVendor,
    deleteVendor,
    deactivateVendor,
    editDiscoPricing,
    deleteDiscoPricing,
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
    CompleteUpgrade,
    rejectUpgrade,
    toggleVendorCustomerAddition,
    getVendorAdditionStatus,
    // NEW ADMIN MANAGEMENT FUNCTIONS
    getAdmins,
    getAdminById,
    updateAdmin,
    toggleAdminStatus,
    deleteAdmin,
    getAdminProfile,
    updateAdminPermissions,
    registerAdminWithPermissions,
    addCustomerSpaceToVendor,
    reduceCustomerSpaceFromVendor,
    setCustomerLimitForVendor
} = require('../controllers/adminController');

const auth = require('../middleware/authMiddleware');
const router = express.Router();

// Define helpers directly in routes file
const superAdminOnly = (req, res, next) => {
    console.log('🔐 superAdminOnly check - User role:', req.admin?.role);
    if (req.admin && req.admin.role === 'super_admin') {
        console.log('✅ Super admin access granted');
        next();
    } else {
        console.log('❌ Super admin access denied');
        res.status(403).json({ message: 'Access denied. Super admin privileges required.' });
    }
};

const checkPermission = (permission) => {
    return (req, res, next) => {
        console.log('🔐 checkPermission - Permission:', permission);
        console.log('  - User role:', req.admin?.role);
        console.log('  - User permissions:', req.admin?.permissions);
        
        if (req.admin.role === 'super_admin') {
            console.log('✅ Super admin - all permissions granted');
            return next();
        }
        
        if (!req.admin.permissions || !req.admin.permissions[permission]) {
            console.log(`❌ Permission denied - missing: ${permission}`);
            return res.status(403).json({ 
                message: `Access denied. You don't have permission to ${permission}.` 
            });
        }
        
        console.log(`✅ Permission granted: ${permission}`);
        next();
    };
};

/**
 * Public Routes
 */
router.post('/login', loginAdmin);

/**
 * Protected Admin Routes
 */

// Apply auth middleware to all routes below - ALLOW BOTH ROLES
router.use(auth(['admin', 'super_admin'])); // ← FIX THIS LINE

// Admin Profile
router.get('/profile', getAdminProfile);

// Admin Management Routes (Super Admin Only)
router.get('/admins', superAdminOnly, getAdmins);
router.post('/admins/register', superAdminOnly, registerAdminWithPermissions);
router.get('/admins/:id', superAdminOnly, getAdminById);
router.patch('/admins/:id/edit', superAdminOnly, updateAdmin);
router.patch('/admins/:id/toggle-status', superAdminOnly, toggleAdminStatus);
router.delete('/admins/:id/delete', superAdminOnly, deleteAdmin);
router.patch('/admins/:id/permissions', superAdminOnly, updateAdminPermissions);


// In your adminRoutes.js, add these new routes:

// Customer space management routes
router.patch(
    '/vendors/:vendorId/add-customer-space',
    checkPermission('createVendors'),
    addCustomerSpaceToVendor
);

router.patch(
    '/vendors/:vendorId/reduce-customer-space',
    checkPermission('createVendors'),
    reduceCustomerSpaceFromVendor
);

router.patch(
    '/vendors/:vendorId/set-customer-limit',
    checkPermission('createVendors'),
    setCustomerLimitForVendor
);

// Vendor Management Routes (with specific permissions)
router.post('/vendors', checkPermission('createVendors'), createVendor);
router.get('/vendors', checkPermission('createVendors'), getAllVendors);
router.patch('/vendors/:vendorId/approve', checkPermission('createVendors'), approveVendor);
router.patch('/vendors/:vendorId/edit', checkPermission('createVendors'), editVendor);
router.delete('/vendors/:vendorId/delete', checkPermission('createVendors'), deleteVendor);
router.patch('/vendors/:vendorId/deactivate', checkPermission('createVendors'), deactivateVendor);

// Vendor Customer Addition Control
router.patch(
    '/vendors/:vendorId/toggle-customer-addition', 
    checkPermission('createVendors'), 
    toggleVendorCustomerAddition
);

router.get(
    '/vendors/:vendorId/customer-addition-status',
    checkPermission('createVendors'),
    getVendorAdditionStatus
);

// Disco Pricing Routes (with specific permissions)
router.post('/disco-pricing', checkPermission('discoPricing'), discoPricing);
router.get('/disco-pricing', checkPermission('discoPricing'), getAllDiscoPricing); 
router.patch('/disco-pricing/:discoName', checkPermission('discoPricing'), editDiscoPricing);
router.delete('/disco-pricing/:discoName', checkPermission('discoPricing'), deleteDiscoPricing);
router.patch('/disco-pricing/:discoName/disable', checkPermission('discoPricing'), disableDisco);
router.patch('/disco-pricing/:discoName/enable', checkPermission('discoPricing'), enableDisco);

// Customer Verification Routes (with specific permissions)
router.get('/customers', checkPermission('verifyCustomers'), getAllCustomers);
router.put('/customers/:customerId/verify', checkPermission('verifyCustomers'), verifyCustomer);
router.put('/customers/:customerId/update', checkPermission('verifyCustomers'), updateVerifiedCustomer);
router.delete('/customers/:customerId/delete', checkPermission('verifyCustomers'), deleteCustomer);
router.put('/customers/:customerId/reject', checkPermission('verifyCustomers'), rejectCustomer);

// Token Management Routes (with specific permissions)
router.get('/token-request-count', checkPermission('tokenManagement'), getTokenRequestCount); 
router.get('/issued-token-count', checkPermission('tokenManagement'), getIssuedTokenCount);
router.get('/total-tokens-amount', checkPermission('tokenManagement'), getTotalTokensAmount);
router.get('/daily-token-count', checkPermission('tokenManagement'), getDailyTokenCount);
router.get('/monthly-token-count', checkPermission('tokenManagement'), getMonthlyTokenCount);

// Analytics & Reports (Available to all admins with any permission)
// Remove duplicate auth middleware from these routes
router.get('/pending-vendor-count', getPendingVendorCount);
router.get('/pending-customers-verification', getPendingCustomerVerificationCount);
router.get('/verified-customers-count', getVerifiedCustomersCount);
router.get('/revenue-trends', getRevenueTrends);
router.get('/customer-trends', getCustomerTrends);   
router.get('/token-trends', getTokenTrends);
router.get('/customer-distribution', getCustomerDistribution);
router.get('/sales-report', getSalesReport);

// Upgrade Management (Available to all admins with any permission)
router.get('/pending-upgrades', getPendingUpgrades);
router.patch('/complete/:vendorId/:upgradeId', CompleteUpgrade);
router.patch('/reject/:vendorId/:upgradeId', rejectUpgrade);

// Customer Stats (Available to all admins with any permission)
router.get('/customers/stats', getCustomersCount);

// Logout
router.post('/logout', logoutAdmin);

// Public route for active DISCOs (used during customer registration)
router.get('/discos/active', getActiveDiscos);

module.exports = router;