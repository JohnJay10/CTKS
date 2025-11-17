const Vendor = require('../models/Vendor');
const Customer = require('../models/Customer');
const TokenRequest = require('../models/TokenRequest');
const Token = require('../models/Token');
const generateToken = require('../utils/generateToken');
const ActivityLog = require('../models/ActivityLog');
const BankAccount = require('../models/BankAccount');

const loginVendor = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Input validation
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const vendor = await Vendor.findOne({ email });
        if (!vendor) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (!vendor.approved) {
            return res.status(403).json({ 
                message: 'Account pending admin approval' 
            });
        }

        const isPasswordCorrect = await vendor.comparePassword(password);
        if (!isPasswordCorrect) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate token with proper error handling
        let token;
        try {
            token = generateToken(vendor._id, 'vendor');
        } catch (tokenError) {
            console.error('Token generation error:', tokenError);
            return res.status(500).json({ 
                message: 'Authentication failed',
                error: tokenError.message 
            });
        }

        return res.status(200).json({
            _id: vendor._id,
            email: vendor.email,
            username: vendor.username,
            role: 'vendor',
            approved: vendor.approved,
            token
        });

    } catch (error) {
        console.error('Vendor login error:', error);
        return res.status(500).json({ 
            message: 'Login failed',
            error: error.message 
        });
    }
};



//Add Customers (Vendor Only )
const addCustomer = async (req, res) => {
    try {
        const { meterNumber, disco, lastToken } = req.body;
        const vendorId = req.user._id;

        // Input validation
        if (!meterNumber || !disco) {
            return res.status(400).json({ 
                message: 'Meter number and disco are required',
                requiredFields: ['meterNumber', 'disco']
            });   
        }

        // Verify vendor exists and is approved
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor account not found' });
        }

        // Check if vendor is approved
        if (!vendor.approved) {
            return res.status(403).json({ message: 'Vendor account not approved' });
        }

        // Check if vendor is allowed to add customers
        if (vendor.canAddCustomers === false) {
            return res.status(403).json({
                message: 'Account Restricted',
                code: 'CUSTOMER_ADDITION_RESTRICTED',
                restriction: {
                    active: true,
                    since: vendor.lastUpdatedBy?.at,
                    reason: vendor.lastUpdatedBy?.reason || 'Administrative restriction'
                }
            });
        }

        // Check customer limit (automatically applies any pending upgrades)
        const customerCount = await Customer.countDocuments({ vendorId });
        const effectiveLimit = vendor.getEffectiveCustomerLimit();

        if (customerCount >= effectiveLimit) {
            // Check if there are pending approved upgrades that need to be applied
            const hasPendingUpgrades = vendor.completedUpgrades.some(u => u.status === 'completed');
            
            if (hasPendingUpgrades) {
                await vendor.applyUpgrades();
                return addCustomer(req, res); // Retry after applying upgrades
            }

            return res.status(403).json({
                message: `You've reached your limit of ${effectiveLimit} customers`,
                code: 'CUSTOMER_LIMIT_REACHED',
                currentCount: customerCount,
                limit: effectiveLimit,
                requiresUpgrade: true
            });
        }

        // Check for duplicate meter number
        const existingCustomer = await Customer.findOne({ meterNumber });
        if (existingCustomer) {
            return res.status(409).json({
                message: 'Meter number already exists in system',
                existingCustomer: {
                    vendorId: existingCustomer.vendorId,
                    createdAt: existingCustomer.createdAt
                }
            });
        }

        // Create customer
        const customer = new Customer({
            meterNumber,
            disco,
            lastToken,
            vendorId,
            verification: { isVerified: false }
        });

        await customer.save();

        // Return success response
        return res.status(201).json({
            message: 'Customer registered successfully',
            customer: {
                _id: customer._id,
                meterNumber: customer.meterNumber,
                disco: customer.disco,
                status: customer.verification.isVerified ? 'verified' : 'pending',
                vendorId: customer.vendorId,
                createdAt: customer.createdAt
            },
            customerCount: customerCount + 1,
            customerLimit: vendor.customerLimit
        });

    } catch (error) {
        console.error('Customer registration error:', error);
        
        if (error.code === 11000 && error.keyPattern.meterNumber) {
            return res.status(409).json({
                message: 'Meter number must be unique across all vendors',
                field: 'meterNumber'
            });
        }

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: 'Validation failed',
                errors
            });
        }

        return res.status(500).json({
            message: 'Customer registration failed',
            error: error.message
        });
    }
};


//Get Count of Customers by vendor
// controllers/vendorController.js
const getVendorLimits = async (req, res) => {
    try {
        const vendorId = req.user._id;
        const vendor = await Vendor.findById(vendorId)
            .select('customerLimit pendingUpgrades completedUpgrades');

        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        const customerCount = await Customer.countDocuments({ vendorId });
        const effectiveLimit = vendor.getEffectiveCustomerLimit();

        return res.status(200).json({
            data: {  // Add this wrapper to match your frontend expectation
                customerLimit: effectiveLimit,  // Return effectiveLimit instead of customerLimit
                customerCount,
                pendingUpgrade: vendor.pendingUpgrades && vendor.pendingUpgrades.length > 0
            }
        });

    } catch (error) {
        console.error('Get vendor limits error:', error);
        return res.status(500).json({ message: 'Failed to get vendor limits' });
    }
};


// upgrade.controller.js
const initiateUpgrade = async (req, res) => {
    try {
        const { additionalCustomers } = req.body;
        const vendorId = req.user._id;

        // ✅ Validate upgrade input
        if (
            !additionalCustomers ||
            additionalCustomers % 500 !== 0 ||
            additionalCustomers < 500 ||
            additionalCustomers > 5000
        ) {
            return res.status(400).json({
                message: 'Upgrade must be in increments of 500 customers (min: 500, max: 5000)'
            });
        }

        // ✅ Correct pricing logic: ₦50,000 per 500 customers
        const amount = (additionalCustomers / 500) * 50000;
        const reference = `UPG-${Date.now()}-${vendorId.toString().slice(-4)}`;

        // ✅ Push new pending upgrade request
        const vendor = await Vendor.findByIdAndUpdate(
            vendorId,
            {
                $push: {
                    pendingUpgrades: {
                        additionalCustomers,
                        amount,
                        reference,
                        status: 'pending' // Make sure this matches the admin filter
                    }
                }
            },
            { new: true }
        );

        // ✅ Respond with payment instructions
        return res.status(200).json({
            message: 'Upgrade request submitted successfully',
            instructions: {
                amount,
                bank: 'Zenith Bank',
                accountName: 'PowerPay Solutions',
                accountNumber: '1234567890',
                reference,
                note: 'Use this reference when making the payment'
            }
        });

    } catch (error) {
        console.error('Upgrade initiation error:', error);
        return res.status(500).json({ message: 'Failed to initiate upgrade' });
    }
};


  //
  
  
  const submitPaymentProof = async (req, res) => {
    try {
      const vendorId = req.user._id;
      const { requestId, paymentProof } = req.body;
  
      if (!requestId || !paymentProof) {
        return res.status(400).json({
          message: 'Request ID and payment proof are required',
          requiredFields: ['requestId', 'paymentProof']
        });
      }
  
      const vendor = await Vendor.findOneAndUpdate(
        { 
          _id: vendorId,
          'pendingUpgrades._id': requestId 
        },
        { 
          $set: { 
            'pendingUpgrades.$.paymentProof': paymentProof,
            'pendingUpgrades.$.status': 'pending_verification' 
          } 
        },
        { new: true }
      );
  
      if (!vendor) {
        return res.status(404).json({ message: 'Upgrade request not found' });
      }
  
      return res.status(200).json({
        message: 'Payment proof submitted successfully',
        status: 'pending_verification'
      });
  
    } catch (error) {
      console.error('Payment proof submission error:', error);
      return res.status(500).json({
        message: 'Failed to submit payment proof',
        error: error.message
      });
    }
  };


// Get all customers
const getAllCustomers = async (req, res) => {
    try {
      // Get vendorId from authenticated vendor (assuming you're using JWT/auth middleware)
      const vendorId = req.user._id; // Adjust based on your auth setup
      
      // Find customers belonging to this vendor
      const customers = await Customer.find({ vendorId })
      // Sort by newest first
      
      res.status(200).json({
        success: true,
        count: customers.length,
        data: customers
      });
      
    } catch (error) {
      console.error('Error fetching customers:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching customers'
      });
    }
  };

 // Get Customer Count
 const getCustomerCount = async (req, res) => {
  try {
    // Get vendorId from authenticated vendor (assuming you're using JWT/auth middleware)
    const vendorId = req.user._id; // Adjust based on your auth setup
    
    // Find customers belonging to this vendor
    const customerCount = await Customer.countDocuments({ vendorId });
    
    res.status(200).json({
      success: true,
      count: customerCount
    });
    
  } catch (error) {
    console.error('Error fetching customer count:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching customer count'
    });
  }
}


const getPendingVerifications = async (req, res) => {
    try {
        const vendorId = req.user._id;

        // 1. Get unverified customers (both pending and rejected)
        const customers = await Customer.find({
            vendorId,
            'verification.isVerified': false
        })
        .select('_id meterNumber disco lastToken createdAt verification')
        .sort({ createdAt: -1 });

        // 2. Get pending/rejected token requests (if needed)
        const tokenRequests = await TokenRequest.find({   
            vendorId,
            status: { $in: ['pending', 'rejected'] }
        })
        .select('_id status createdAt meterNumber disco lastToken rejectionReason')
        .sort({ createdAt: -1 });

        // 3. Transform and combine data
        const responseData = [
            ...customers.map(customer => ({
                type: 'customer_verification',
                _id: customer._id,
                meterNumber: customer.meterNumber,
                disco: customer.disco,
                lastToken: customer.lastToken,
                status: customer.verification.rejected ? 'rejected' : 'pending',
                rejectionReason: customer.verification.rejectionReason,
                rejectedAt: customer.verification.rejectedAt,
                createdAt: customer.createdAt,
                verification: customer.verification
            })),
            ...tokenRequests.map(request => ({
                type: 'token_request',
                _id: request._id,
                meterNumber: request.meterNumber,
                disco: request.disco,
                lastToken: request.lastToken,
                status: request.status, // 'pending' or 'rejected'
                rejectionReason: request.rejectionReason,
                createdAt: request.createdAt
            }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Sort all by newest first

        return res.status(200).json({
            success: true,
            count: responseData.length,
            data: responseData
        });

    } catch (error) {
        console.error('Error fetching pending verifications:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch pending verifications',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get Pending Request Count 
const getPendingRequestCount = async (req, res) => {
    try {
        const vendorId = req.user._id; // Adjust based on your auth setup
        
        // Find customers belonging to this vendor
        const pendingRequestCount = await TokenRequest.countDocuments({ vendorId, status: 'pending' });
        
        res.status(200).json({
            success: true,
            count: pendingRequestCount
        });
        
    } catch (error) {
        console.error('Error fetching pending request count:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching pending request count'
        });
    }
}


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



// Get recent activities (for dashboard)
const getRecentActivities = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const limit = parseInt(req.query.limit) || 5;
    
    const activities = await ActivityLog.find({ vendor: vendorId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    
    const formattedActivities = activities.map(activity => ({
      id: activity._id,
      action: getActivityAction(activity.type),
      time: formatDistanceToNow(activity.createdAt, { addSuffix: true }),
      status: activity.status,
      type: activity.type
    }));
    
    res.json({ success: true, activities: formattedActivities });
  } catch (error) {
    handleError(res, error, 'Failed to get recent activities');
  }
};

// Helper function to get activity action text
const getActivityAction = (type) => {
  switch (type) {
    case 'customer_added': return 'Customer Added';
    case 'token_requested': return 'Token Requested';
    case 'payment_received': return 'Payment Received';
    case 'token_issued': return 'Tokens Issued';
    default: return 'Activity';
  }
};


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


module.exports = {
     loginVendor,
     addCustomer,
     getAllCustomers,
     getCustomerCount,
     getPendingRequestCount,
     getIssuedTokenCount,
     getRecentActivities,
      getActivityAction,
      getPendingVerifications,
      getAllAccounts,
        getVendorLimits,
        initiateUpgrade,
        submitPaymentProof

    
    };     