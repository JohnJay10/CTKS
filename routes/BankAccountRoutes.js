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


router.get('/fetch', auth(['admin']), getAllAccounts);


router.get('/accountno', auth(['vendor']), getActiveBankAccount);

router.post('/create', auth(['admin']), createAccount);
router.put('/update/:id', auth(['admin']), updateAccount);
router.delete('/delete/:id', auth(['admin']), deleteAccount);




module.exports = router;