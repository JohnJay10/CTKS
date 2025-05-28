const Token = require('../models/Token');
const Vendor = require('../models/Vendor');
const Customer = require('../models/Customer');
const DiscoPricing = require('../models/DiscoPricing');
const TokenRequest = require('../models/TokenRequest');
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
  const { tokenValue, meterNumber, requestId } = req.body; // Changed to use requestId
  const adminId = req.user._id;

  try {
    // 1. Validate input - now requires requestId
    if (!tokenValue || !meterNumber || !requestId) {
      return res.status(400).json({
        message: 'Token value, meter number, and request ID are required'
      });
    }

       // 2. Validate token format (updated to allow hyphens)
       const digitsOnly = tokenValue.replace(/-/g, '');
       if (!/^[\d-]+$/.test(tokenValue)) {
         return res.status(400).json({
           message: 'Token can only contain numbers and hyphens',
         });
       }
       if (digitsOnly.length < 16 || digitsOnly.length > 45) {
         return res.status(400).json({
           message: 'Token must have 16-45 digits (hyphens ignored)',
         });
       }

    // 3. Get the approved request with populated vendor data
    const request = await TokenRequest.findOne({ 
      _id: requestId,
      status: 'approved'
    })
    .populate('vendorId', 'name email approved'); // Populate vendor details

    if (!request) {
      return res.status(404).json({ 
        message: 'Approved request not found or already processed' 
      });
    }

    // 4. Verify vendor exists and is approved using the populated request
    if (!request.vendorId || !request.vendorId.approved) {
      return res.status(403).json({ 
        message: 'Vendor not found or not approved' 
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
      vendorId: request.vendorId._id, // Use vendorId from the request
      requestId: request._id, // Store reference to the original request
      issuedBy: adminId,
      status: 'issued',
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    await token.save();

    // 6. Update request status to completed
    await TokenRequest.findByIdAndUpdate(
      request._id, 
      { 
        status: 'completed',
        tokenId: token._id,
        issuedAt: new Date()
      }
    );

    // 7. Update vendor's token balance
    await Vendor.findByIdAndUpdate(request.vendorId._id, {
      $inc: { tokenBalance: request.units }
    });

    

    res.status(201).json({
      success: true,
      message: 'Token issued successfully',
      data: {
        token: token,
        request: request
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
    const meterNumber = req.query.meterNumber;

    // Build the base query for Token (issued tokens)
    const tokenQuery = {};

    if (vendorId) tokenQuery.vendorId = vendorId;
    if (meterNumber) tokenQuery.meterNumber = { $regex: meterNumber, $options: 'i' };

    // Fetch issued tokens (Token model)
    const [issuedTokens, issuedTotal] = await Promise.all([
      Token.find(tokenQuery)
        .skip(skip)
        .limit(limit)
        .populate('vendorId', 'username email name')
        .populate('issuedBy', 'name email')
        .sort({ createdAt: -1 }),
      Token.countDocuments(tokenQuery),
    ]);

    const tokenIds = issuedTokens.map(token => token.tokenId);
    const issuedMeterNumbers = issuedTokens.map(t => t.meterNumber);
    const issuedVendorIds = issuedTokens.map(t => t.vendorId?._id?.toString());

    // Find matching TokenRequests
    const tokenRequests = await TokenRequest.find({
      $or: [
        { txRef: { $in: tokenIds } },
        {
          meterNumber: { $in: issuedMeterNumbers },
          vendorId: { $in: issuedVendorIds },
        },
      ]
    }).sort({ createdAt: 1 });

    // Build lookup maps
    const tokenRequestMap = {};
    const fallbackRequestMap = {};

    tokenRequests.forEach(request => {
      if (request.txRef) {
        tokenRequestMap[request.txRef] = request; // exact txRef match
      }

      const fallbackKey = `${request.meterNumber}_${request.vendorId.toString()}`;
      if (!fallbackRequestMap[fallbackKey]) {
        fallbackRequestMap[fallbackKey] = request; // earliest one
      }
    });

    const formattedTokens = issuedTokens.map(token => {
      const tokenId = token.tokenId;
      const meter = token.meterNumber;
      const vendor = token.vendorId?._id?.toString();

      // Try exact match
      let tokenRequest = tokenRequestMap[tokenId];

      // Fallback if not found
      if (!tokenRequest && meter && vendor) {
        const fallbackKey = `${meter}_${vendor}`;
        tokenRequest = fallbackRequestMap[fallbackKey];
      }

      return {
        _id: token._id,
        tokenId: token.tokenId,
        tokenValue: token.tokenValue,
        meterNumber: token.meterNumber,
        vendor: {
          _id: token.vendorId?._id,
          username: token.vendorId?.username,
          email: token.vendorId?.email,
          name: token.vendorId?.name,
        },
        disco: token.disco,
        units: token.units,
        amount: token.amount,
        status: token.status || 'pending',
        requestDate: tokenRequest?.createdAt || null,
        issueDate: token.updatedAt,
        expiryDate: token.expiryDate,
        issuedBy: token.issuedBy,
      };
    });

    res.status(200).json({
      success: true,
      data: formattedTokens,
      total: issuedTotal,
      totalPages: Math.ceil(issuedTotal / limit),
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching token history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch token history',
    });
  }
};

// In your backend route (e.g., /tokens/fetchtoken)
const fetchTokens = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100; // Higher default limit
    
    const tokens = await Token.find({
      vendorId: req.user._id,
      status: 'issued'
    })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean(); // Better performance

    res.status(200).json({
      success: true,
      data: tokens, // Ensure this matches frontend expectation
      pagination: {
        page,
        limit,
        total: await Token.countDocuments({ vendorId: req.user._id, status: 'issued' })
      }
    });
  } catch (error) {
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


const fetchTokenByMeterNumber = async (req, res) => {
  try {
    const { meterNumber } = req.params; // Get meterNumber from URL params
    const { includeVerification = 'true' } = req.query;

    // Fetch the token
    const token = await Token.findOne({ meterNumber })
      .populate('vendorId', 'username name') // Include vendor details
      .lean();

    if (!token) {
      return res.status(404).json({
        success: false,
        message: 'Token not found'
      });
    }

    // Fetch verification details if requested
    let verificationData = {};
    if (includeVerification === 'true') {
      const customer = await Customer.findOne(
        { meterNumber },
        { verification: 1, disco: 1 }
      ).lean();
      
      verificationData = customer?.verification || {};
      token.disco = customer?.disco || token.disco;
    }

    const responseData = {
      ...token,
      verification: verificationData
    };

    res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Error fetching token details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch token details',
      error: error.message
    });
  }
};


// controllers/tokenController.js
const reissueToken = async (req, res) => {
  try {
    const { id } = req.params; // Changed from tokenId to id
    const { tokenValue, meterNumber, reason } = req.body;

    // Validate required fields
    if (!tokenValue || !meterNumber) {
      return res.status(400).json({
        success: false,
        message: 'Token value and meter number are required'
      });
    }

    // Find the existing token by _id
    const existingToken = await Token.findById(id);
    if (!existingToken) {
      return res.status(404).json({
        success: false,
        message: 'Token not found'
      });
    }

    // Validate token value format
    const digitsOnly = tokenValue.replace(/-/g, '');
    if (digitsOnly.length < 16 || digitsOnly.length > 45) {
      return res.status(400).json({
        success: false,
        message: 'Token must contain 16-45 digits'
      });
    }

    // Create new token document (don't update existing one)
    
    const newToken = new Token({
      ...existingToken.toObject(),
      _id: undefined, // Let MongoDB generate new _id
      tokenId: uuidv4(), // ← Generate new UUID for tokenId
      tokenValue,       // New token value
      status: 'issued',
      isReissued: true,
      originalToken: existingToken._id,
      reissueReason: reason,
      reissuedAt: new Date()
    });
    // Update original token status
    existingToken.status = 'issued';
    await existingToken.save();

    // Save new token
    const savedToken = await newToken.save();

    res.status(201).json({
      success: true,
      message: 'Token reissued successfully',
      data: savedToken
    });

  } catch (error) {
    console.error('Error reissuing token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reissue token',
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
  tokenrequesthistory,
  fetchTokenByMeterNumber,
  reissueToken,
};  