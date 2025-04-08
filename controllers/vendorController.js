const Vendor = require('../models/Vendor');
const Customer = require('../models/Customer');
const TokenRequest = require('../models/TokenRequest');
const Token = require('../models/Token');
const generateToken = require('../utils/generateToken');
const ActivityLog = require('../models/ActivityLog');

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

        // 1. Input validation (matches model requirements)
        if (!meterNumber || !disco) { // lastToken is not required in model
            return res.status(400).json({ 
                message: 'Meter number and disco are required',
                requiredFields: ['meterNumber', 'disco']
            });   
        }

        // 2. Verify vendor exists and is approved
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor account not found' });
        }
        if (!vendor.approved) {
            return res.status(403).json({ message: 'Vendor account not approved' });
        }

        // 3. Check customer limit (5 per vendor)
        const customerCount = await Customer.countDocuments({ vendorId });
        if (customerCount >= 10) {
            return res.status(403).json({
                message: 'Maximum of 5 customers per vendor',
                currentCount: customerCount,
                limit: 5
            });
        }

        // 4. Check for duplicate meter number (globally unique per model)
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

        // 5. Create customer (aligned with model schema)
        const customer = new Customer({
            meterNumber,
            disco,
            lastToken, // optional based on model
            vendorId,
            verification: { // Initialize verification fields
                isVerified: false 
            }
        });

        await customer.save();

        // 6. Return response (excluding sensitive fields)
        return res.status(201).json({
            message: 'Customer registered successfully',
            customer: {
                _id: customer._id,
                meterNumber: customer.meterNumber,
                disco: customer.disco,
                status: customer.verification.isVerified ? 'verified' : 'pending',
                vendorId: customer.vendorId,
                createdAt: customer.createdAt
            }
        });

    } catch (error) {
        console.error('Customer registration error:', error);

        // Handle duplicate key error separately
        if (error.code === 11000 && error.keyPattern.meterNumber) {
            return res.status(409).json({
                message: 'Meter number must be unique across all vendors',
                field: 'meterNumber'
            });
        }

        // Handle validation errors
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


module.exports = {
     loginVendor,
     addCustomer,
     getAllCustomers,
     getCustomerCount,
     getPendingRequestCount,
     getIssuedTokenCount,
     getRecentActivities,
      getActivityAction
    
    };     