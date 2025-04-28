// controllers/bankAccountController.js
const BankAccount = require('../models/BankAccount');

// Controller functions
const getAllAccounts = async (req, res) => {
  try {
    const accounts = await BankAccount.find();
    res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bank accounts'
    });
  }
};

// controllers/bankAccountController.js
const getActiveBankAccount = async (req, res) => {
  try {
    const account = await BankAccount.findOne({ isActive: true });
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'No active bank account found'
      });
    }
    res.json({
      success: true,
      data: {
        accountNumber: account.accountNumber,
        bankName: account.bankName,
        accountName: account.accountName,
        isActive: account.isActive
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bank account details'
    });
  }
};



const createAccount = async (req, res) => {
  try {
    const { accountNumber, bankName, accountName } = req.body;
    
    const existingAccount = await BankAccount.findOne({ accountNumber });
    if (existingAccount) {
      return res.status(400).json({
        success: false,
        message: 'Account number already exists'
      });
    }

    const newAccount = new BankAccount({
      accountNumber,
      bankName,
      accountName
    });

    await newAccount.save();
    res.json({
      success: true,
      data: newAccount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create bank account'
    });
  }
};

const updateAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { accountNumber, bankName, accountName } = req.body;

    const updatedAccount = await BankAccount.findByIdAndUpdate(
      id,
      { accountNumber, bankName, accountName },
      { new: true }
    );

    if (!updatedAccount) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    res.json({
      success: true,
      data: updatedAccount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update bank account'
    });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedAccount = await BankAccount.findByIdAndDelete(id);

    if (!deletedAccount) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete bank account'
    });
  }
};

// Export all controller functions at once
module.exports = {
  getAllAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getActiveBankAccount

};