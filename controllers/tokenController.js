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
    const { rejectionReason } = req.body; // Get reason from request body

    // Find and update the request
    const rejectedRequest = await TokenRequest.findOneAndUpdate(
      {
        _id: requestId,
        status: 'pending' // Only reject pending requests
      },
      {
        status: 'rejected',
        rejectionReason,
        rejectedAt: new Date(),
        $inc: { __v: 1 } // Optional: increment version if you're using optimistic concurrency
      },
      {
        new: true, // Return the updated document
        runValidators: true // Run schema validations on update
      }
    ).populate('vendorId', 'name email');

    if (!rejectedRequest) {
      return res.status(404).json({
        success: false,
        message: 'Pending token request not found or already processed'
      });
    }

    // Here you might want to:
    // 1. Send notification to vendor
    // 2. Log the rejection
    // 3. Trigger any other business logic

    res.status(200).json({
      success: true,
      message: 'Token request rejected successfully',
      data: rejectedRequest
    });
  } catch (error) {
    console.error('Error rejecting token request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject token request',
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


const getPaymentTransactionHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;
    const vendorId = req.query.vendorId;
    const meterNumber = req.query.meterNumber; // New meterNumber search parameter

    // Build the base query
    const query = {};

    // If vendorId is provided, add to query
    if (vendorId) {
      query.vendorId = vendorId;
    }

    // If meterNumber is provided, add to query with case-insensitive regex search
    if (meterNumber) {
      query.meterNumber = { $regex: meterNumber, $options: 'i' };
    }

    // Fetch tokens with pagination and filtering
    const [tokens, total] = await Promise.all([
      Token.find(query)
        .skip(skip)
        .limit(limit)
        .populate('vendorId', 'username email name')
        .populate('issuedBy', 'name email')
        .sort({ createdAt: -1 }),
      Token.countDocuments(query)
    ]);

    // Format the response
    const formattedTokens = tokens.map(token => ({
      _id: token._id,
      tokenId: token.tokenId,
      meterNumber: token.meterNumber,
      vendor: {
        _id: token.vendorId?._id,
        username: token.vendorId?.username,
        email: token.vendorId?.email,
        name: token.vendorId?.name
      },
      disco: token.disco,
      units: token.units,
      amount: token.amount,
      status: token.status || 'pending',
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
      expiryDate: token.expiryDate,
      issuedBy: token.issuedBy
    }));

    res.status(200).json({
      success: true,
      data: formattedTokens,
      total,
      totalPages: Math.ceil(total / limit),
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching token history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch token history'
    });
  }
};
const fetchTokens = async (req, res) => {
  try {
    const tokens = await Token.find({ vendorId: req.user._id })
      .sort({ createdAt: -1 })
      .select('-__v'); // exclude __v field from response

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

const requesthistory = async (req, res) => {
  try {
    // Extract pagination parameters from query
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // Query for only pending and rejected tokens
    const tokens = await TokenRequest.find({ 
      vendorId: req.user._id,
      status: { $in: ['pending', 'rejected'] } // Only fetch pending or rejected tokens
    })
    .sort({ createdAt: -1 }) // Sort by newest first
    .skip(skip)
    .limit(limit)
    .select('-__v'); // exclude __v field from response

    // Get total count for pagination
    const total = await TokenRequest.countDocuments({
      vendorId: req.user._id,
      status: { $in: ['pending', 'rejected'] }
    });

    res.status(200).json({
      success: true,
      data: tokens,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
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
  getIssuedTokenCount,
  getPaymentTransactionHistory,
  requesthistory
};