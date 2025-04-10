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

// Updated approveTokenRequest
const approveTokenRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    
    const request = await TokenRequest.findOneAndUpdate(
      { _id: requestId, status: 'pending' }, // Only approve pending requests
      { status: 'approved' },
      { new: true }
    ).populate('vendorId', 'name email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Pending token request not found'
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

// Updated rejectTokenRequest
const rejectTokenRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    
    // First find the request to get details for potential logging/notification
    const request = await TokenRequest.findOne({
      _id: requestId,
      status: 'pending'
    }).populate('vendorId', 'name email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Pending token request not found'
      });
    }

    // Delete the request from database
    await TokenRequest.deleteOne({ _id: requestId });

    

    res.status(200).json({
      success: true,
      message: 'Token request deleted successfully',
      data: {
        deletedRequest: request
      }
    });
  } catch (error) {
    console.error('Error rejecting token request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete token request',
      error: error.message
    });
  }
};

// Updated issueTokenToVendor
const issueTokenToVendor = async (req, res) => {
  const { tokenValue, meterNumber, vendorId } = req.body;
  const adminId = req.user._id;

  try {
    // 1. Validate input
    if (!tokenValue || !meterNumber) {
      return res.status(400).json({
        message: 'Token value and meter number are required'
      });
    }

    // 2. Validate token format
    if (!/^\d{16,45}$/.test(tokenValue)) {
      return res.status(400).json({
        message: 'Token must be 16-45 digits',
      });
    }

    // 3. Verify vendor exists and is approved
    const vendor = await Vendor.findById(vendorId);
    if (!vendor || !vendor.approved) {
      return res.status(403).json({ 
        message: 'Vendor not found or not approved' 
      });
    }

    // 4. Get the approved request
    const request = await TokenRequest.findOne({ 
      meterNumber,
      vendorId,
      status: 'approved' // Changed from 'pending' to 'approved'
    }).sort({ createdAt: -1 });

    if (!request) {
      return res.status(404).json({ 
        message: 'No approved request found for this meter' 
      });
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
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    await token.save();

    // 6. Update request status to completed
    const updatedRequest = await TokenRequest.findByIdAndUpdate(
      request._id, 
      { 
        status: 'completed',
        tokenId: token._id 
      },
      { new: true }
    );

    // 7. Update vendor's token balance
    await Vendor.findByIdAndUpdate(vendorId, {
      $inc: { tokenBalance: request.units }
    });

    // 8. Send notification
    await sendTokenNotification(vendor.email, {
      tokenId: token.tokenId,
      meterNumber,
      units: request.units,
      amount: request.amount,
      expiryDate: token.expiryDate
    });

    res.status(201).json({
      success: true,
      message: 'Token issued successfully',
      data: {
        token: token,
        request: updatedRequest
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