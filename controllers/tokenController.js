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
    const { status = 'pending', page = 1, limit = 5 } = req.query;
    const statuses = status.split(',');
    
    // Convert page and limit to numbers
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    
    // Calculate skip value for pagination
    const skip = (pageNumber - 1) * limitNumber;
    
    // Get total count for pagination info
    const total = await TokenRequest.countDocuments({ status: { $in: statuses } });
    
    const requests = await TokenRequest.find({ 
      status: { $in: statuses }
    })
    .populate('vendorId', 'name email approved')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNumber);

    res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber)
      }
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
      { _id: requestId, status: 'pending' },
      { 
        status: 'approved',
        approvedAt: new Date()  // Add approval timestamp
      },
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
    const { rejectionReason } = req.body;

    // Find and update the request - now includes 'approved' status
    const rejectedRequest = await TokenRequest.findOneAndUpdate(
      {
        _id: requestId,
        status: { $in: ['pending', 'approved'] } // Can reject either status
      },
      {
        status: 'rejected',
        rejectionReason,
        rejectedAt: new Date(),
        $inc: { __v: 1 }
      },
      {
        new: true,
        runValidators: true
      }
    ).populate('vendorId', 'name email');

    if (!rejectedRequest) {
      return res.status(404).json({
        success: false,
        message: 'Token request not found, already processed, or not in a rejectable state'
      });
    }

    // Additional business logic for approved requests
    if (rejectedRequest.status === 'approved') {
      // Here you might want to:
      // 1. Release any reserved funds/units
      // 2. Send specific notification for approved->rejected transition
      // 3. Log additional details
    }

    // Common notification/logging for all rejections
    await sendRejectionNotification(rejectedRequest.vendorId.email, {
      requestId: rejectedRequest._id,
      meterNumber: rejectedRequest.meterNumber,
      rejectionReason,
      rejectedAt: rejectedRequest.rejectedAt
    });

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

// Helper function example
const sendRejectionNotification = async (vendorEmail, rejectionDetails) => {
  // Implementation for sending email/notification
  try {
    await emailService.send({
      to: vendorEmail,
      subject: 'Token Request Rejected',
      template: 'request-rejected',
      data: rejectionDetails
    });
  } catch (err) {
    console.error('Failed to send rejection notification:', err);
    // Don't fail the main request if notification fails
  }
};
// Updated issueTokenToVendor
const issueTokenToVendor = async (req, res) => {
  const { tokenValue, meterNumber, vendorId, requestId } = req.body;
  const adminId = req.user._id;

  try {
    // Validate input
    if (!tokenValue || !meterNumber || !requestId) {
      return res.status(400).json({
        message: 'Token value, meter number and request ID are required'
      });
    }

    // Validate token format
    if (!/^\d{16,45}$/.test(tokenValue)) {
      return res.status(400).json({
        message: 'Token must be 16-45 digits',
      });
    }

    // Verify the request exists and is approved
    const request = await TokenRequest.findOne({
      _id: requestId,
      status: 'approved'
    });

    if (!request) {
      return res.status(404).json({ 
        message: 'Approved request not found or already processed' 
      });
    }

    // Verify vendor exists and is approved
    const vendor = await Vendor.findById(vendorId);
    if (!vendor || !vendor.approved) {
      return res.status(403).json({ 
        message: 'Vendor not found or not approved' 
      });
    }

    // Create token record
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

    // Update request status to completed and link token
    const updatedRequest = await TokenRequest.findByIdAndUpdate(
      request._id, 
      { 
        status: 'completed',
        tokenId: token._id,
        issuedAt: new Date()
      },
      { new: true }
    );

    // Update vendor's token balance
    await Vendor.findByIdAndUpdate(vendorId, {
      $inc: { tokenBalance: request.units }
    });

    // Send notification
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

const tokenrequesthistory = async (req, res) => {
  try {
    // Extract pagination parameters from query
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // Query for only pending and rejected tokens
    const tokens = await Token.find({ 
      vendorId: req.user._id,
      status: { $in: ['issued'] } // Only fetch pending or rejected tokens
    })
    .sort({ createdAt: -1 }) // Sort by newest first
    .skip(skip)
    .limit(limit)
    .select('-__v'); // exclude __v field from response

    // Get total count for pagination
    const total = await Token.countDocuments({
      vendorId: req.user._id,
      status: { $in: ['issued'] }
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
  requesthistory,
  tokenrequesthistory
};