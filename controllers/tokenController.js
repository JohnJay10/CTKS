const Token = require('../models/Token');
const Vendor = require('../models/Vendor');
const Customer = require('../models/Customer');
const DiscoPricing = require('../models/DiscoPricing');
const TokenRequest = require('../models/TokenRequest');
const { sendTokenNotification } = require('../services/notificationService');
const { v4: uuidv4 } = require('uuid');

// Admin: Get all pending token requests
const getTokenRequests = async (req, res) => {
  try {
    const requests = await TokenRequest.find({ status: 'pending' })
      .populate('vendorId', 'name email approved')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching token requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch token requests'
    });
  }
};

// Admin: Approve token request
const approveTokenRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    
    const request = await TokenRequest.findByIdAndUpdate(
      requestId,
      { status: 'approved' },
      { new: true }
    ).populate('vendorId', 'name email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Token request not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Token request approved',
      data: request
    });
  } catch (error) {
    console.error('Error approving token request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve token request'
    });
  }
};

// Admin: Reject token request
const rejectTokenRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    
    const request = await TokenRequest.findByIdAndUpdate(
      requestId,
      { status: 'rejected' },
      { new: true }
    ).populate('vendorId', 'name email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Token request not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Token request rejected',
      data: request
    });
  } catch (error) {
    console.error('Error rejecting token request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject token request'
    });
  }
};

// Admin: Issue token to vendor (after approval)
const issueTokenToVendor = async (req, res) => {
  const { tokenValue, meterNumber, vendorId } = req.body;
  const adminId = req.user._id;

  try {
    // 1. Validate input - Only require tokenValue and meterNumber
    if (!tokenValue || !meterNumber) {
      return res.status(400).json({
        message: 'Token value and meter number are required',
        requiredFields: ['tokenValue', 'meterNumber']
      });
    }

    // 2. Validate token format (16-20 digits)
    if (!/^\d{16,45}$/.test(tokenValue)) {
      return res.status(400).json({
        message: 'Token must be 16-45 digits',
      });
    }

    // 3. Verify vendor exists and is approved
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    if (!vendor.approved) {
      return res.status(403).json({ message: 'Vendor account not approved' });
    }

    // 4. Get the original request to get other details
    const request = await TokenRequest.findOne({ 
      meterNumber,
      vendorId,
      status: 'pending'
    }).sort({ createdAt: -1 });

    if (!request) {
      return res.status(404).json({ message: 'No pending request found for this meter' });
    }

    // 5. Create token record
    const token = new Token({
      tokenId: uuidv4(),
      tokenValue,
      meterNumber,
      units: request.units,
      amount: request.amount,
      disco: request.disco,
      vendorId,
      issuedBy: adminId,
      status: 'issued',
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });

    await token.save();

    // 6. Update request status
    await TokenRequest.findByIdAndUpdate(request._id, { 
      status: 'completed',
      tokenId: token._id 
    });

    // 7. Update vendor's token balance (optional)
    vendor.tokenBalance += request.units;
    await vendor.save();

    // 8. Send notification
    await sendTokenNotification(vendor.email, {
      tokenId: token.tokenId,
      meterNumber,
      units: request.units,
      amount: request.amount,
      expiryDate: token.expiryDate
    });

    // 9. Return response
    res.status(201).json({
      success: true,
      message: 'Token issued successfully',
      data: {
        id: token._id,
        tokenId: token.tokenId,
        tokenValue,
        units: request.units,
        amount: request.amount,
        disco: request.disco,
        issuedAt: token.createdAt,
        expiryDate: token.expiryDate,
        status: 'issued'
      }
    });

  } catch (error) {
    console.error('Token issuance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to issue token',
      error: error.message
    });
  }
};
// Vendor: Fetch tokens (for specific vendor)
const fetchTokens = async (req, res) => {
  try {
    const tokens = await Token.find({ vendorId: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: tokens
    });
  } catch (error) {
    console.error('Error fetching tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tokens'
    });
  }
};


//Get Issued Token Count 
const getIssuedTokenCount = async (req, res) => {
  try {
      const vendorId = req.user._id; // Get vendor ID from authenticated user
      
      // Count tokens issued to this vendor with status 'issued'
      const issuedTokenCount = await Token.countDocuments({
          vendorId: vendorId,
          status: 'issued'
      });
      
      res.status(200).json({
          success: true,
          count: issuedTokenCount
      });
      
  } catch (error) {
      console.error('Error fetching issued token count:', error);
      res.status(500).json({
          success: false,
          message: 'Server error while fetching issued token count',
          error: error.message
      });
  }
};

// Helper function to generate electricity token
function generateElectricityToken() {
  const randomPart = Math.floor(100000000000 + Math.random() * 900000000000);
  return `${randomPart}${Date.now().toString().slice(-8)}`.slice(0, 20);
}

module.exports = {
  getTokenRequests,
  approveTokenRequest,
  rejectTokenRequest,
  issueTokenToVendor,
  fetchTokens,
  getIssuedTokenCount
};