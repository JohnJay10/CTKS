// routes/bankAccountRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getActiveBankAccount
} = require('../controllers/BankAccountController');
const auth = require('../middleware/authMiddleware');

// Define permission middleware for bank account management
const checkBankAccountPermission = (req, res, next) => {
    console.log('🔐 Bank Account Permission Check:');
    console.log('  - User role:', req.admin?.role);
    console.log('  - User permissions:', req.admin?.permissions);
    
    // Super admin has all permissions
    if (req.admin?.role === 'super_admin') {
        console.log('✅ Super admin - bank account access granted');
        return next();
    }
    
    // Check if admin has tokenManagement permission (since bank accounts are related to tokens/payments)
    // Or create a separate permission like 'manageBankAccounts' if you prefer
    if (req.admin?.permissions?.tokenManagement) {
        console.log('✅ Token management permission granted for bank accounts');
        return next();
    }
    
    console.log('❌ Bank account management permission denied');
    return res.status(403).json({ 
        message: 'Access denied. You need token management permissions to access bank accounts.' 
    });
};

// Admin routes with bank account permissions
router.get('/fetch', auth(['admin', 'super_admin']), checkBankAccountPermission, getAllAccounts);
router.post('/create', auth(['admin', 'super_admin']), checkBankAccountPermission, createAccount);
router.put('/update/:id', auth(['admin', 'super_admin']), checkBankAccountPermission, updateAccount);
router.delete('/delete/:id', auth(['admin', 'super_admin']), checkBankAccountPermission, deleteAccount);

// Vendor routes (no changes needed - vendors should be able to see active account)
router.get('/accountno', auth(['vendor']), getActiveBankAccount);

module.exports = router;