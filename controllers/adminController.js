const Admin = require('../models/Admin');
const Vendor = require('../models/Vendor');
const Customer = require('../models/Customer');
const DiscoPricing = require('../models/DiscoPricing');
const TokenRequest = require('../models/TokenRequest');
const generateToken = require('../utils/generateToken');
const Token = require('../models/Token');
const moment = require('moment');
const mongoose = require('mongoose');



//Register an Admin

const registerAdmin = async (req, res) => {
    const { username, password, role } = req.body;
    try {
        //check if admin already exists
        const adminExists = await Admin.findOne({ username });
        if (adminExists) {
            return res.status(400).json({ message: 'Admin already exists' });
        }

        //create a new admin
        const admin = await Admin.create({ username, password, role });

        if (admin) {
            return res.status(201).json({
                _id: admin._id,
                username: admin.username,
                role: admin.role,
                token: generateToken(admin._id)
            });
        } else {
            return res.status(400).json({ message: 'Invalid admin data' });
        }
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }


    //Login an Admin
    const loginAdmin = async (req, res) => {
        const { username, password } = req.body;
        try {
            const admin = await Admin.findOne({username});
            if (!admin) {
                return res.status(401).json({ message: 'Invalid username or password' });
            }
    
            // Check if password is correct
            const isPasswordCorrect = await admin.comparePassword(password);
            if (!isPasswordCorrect) {
                return res.status(401).json({ message: 'Invalid username or password' });
            }
    
            // Return the admin data with token 
            return res.status(200).json({
                _id: admin._id,
                username: admin.username,
                role: admin.role,
                token: generateToken(admin._id, admin.role)  // Pass the role here
            });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }


    //Logout Admin
  const logoutAdmin = async (req, res) => {
    try {
        // Invalidate the token (if using a token-based system, you might want to blacklist it)
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to logout' });
            }
            res.clearCookie('token');
            res.status(200).json({ message: 'Logged out successfully' });
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


//create Vendor 

const createVendor = async (req, res) => {
    const { email, username, password, role } = req.body;

    try {
        //check if vendor already exists
        const vendorExists = await Vendor.findOne({ email });  
        if (vendorExists) {
            return res.status(400).json({ message: 'Vendor already exists' });
        }

        //create a new vendor
        const vendor = await Vendor.create({ email, username, password, role });
        return res.status(201).json({ message: 'Vendor created successfully' });
    }
    catch (error) {
        return res.status(500).json({ message: error.message });
    }
}


//Approve Vendor 

const approveVendor = async (req, res) => {
    try {
        const { vendorId } = req.params;

        // Find Vendor 
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        // Check if already approved
        if (vendor.approved) {
            return res.status(400).json({ message: 'Vendor already approved' });
        }

        // Approve Vendor 
        vendor.approved = true;
        vendor.approvedAt = new Date();
     

        await vendor.save();

        return res.status(200).json({
            message: 'Vendor approved successfully',
            data: {
                _id: vendor._id,
                email: vendor.email,
                approved: vendor.approved,
                approvedAt: vendor.approvedAt,
            }
        });
    } catch (error) {
        console.error('Approval error:', error);
        return res.status(500).json({ message: error.message });
    }
};



//Get All Vendor
const getAllVendors = async (req, res) => {  
    try {
        const vendors = await Vendor.find();
        return res.status(200).json({ data: vendors });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Edit Vendor
const editVendor = async (req, res) => {
    const { vendorId } = req.params;
    const updates = req.body;

    try {
        // 1. Validate required fields
        if (!updates.email || !updates.username) {
            return res.status(400).json({
                success: false,
                message: 'Email and username are required fields'
            });
        }

        // 2. Prepare update object
        const updateData = {
            email: updates.email,
            username: updates.username,
            updatedAt: new Date()
        };

        // 3. Only update password if provided and not empty
        if (updates.password && updates.password.trim() !== '') {
            updateData.password = updates.password;
        }

        // 4. Update approval status if provided
        if (typeof updates.approved === 'boolean') {
            updateData.approved = updates.approved;
            updateData.approvedAt = updates.approved ? new Date() : null;
        }

        // 5. Perform the update
        const updatedVendor = await Vendor.findByIdAndUpdate(
            vendorId,
            { $set: updateData },
            { 
                new: true,
                runValidators: true,
                context: 'query'
            }
        ).select('-password -__v').lean(); // Exclude sensitive fields

        if (!updatedVendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        // 6. Return success response
        return res.status(200).json({
            success: true,
            message: 'Vendor updated successfully',
            data: updatedVendor
        });

    } catch (error) {
        console.error('Vendor update error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update vendor',
            error: error.message,
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    }
};

  
 // Delete Vendor
const deleteVendor = async (req, res) => {
    const { vendorId } = req.params; // Get vendor ID from URL parameters
    try {
        const vendor = await Vendor.findById(vendorId); // Find vendor by ID
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' }); // If vendor not found, return 404
        }
        await Vendor.findByIdAndDelete(vendorId); // Delete vendor by ID
        return res.status(200).json({ message: 'Vendor deleted successfully' }); // Return success message
    } catch (error) {
        console.error('Deletion error:', error); // Log the error
        return res.status(500).json({ message: 'Vendor deletion failed', error: error.message });
    } // Return error message
};

//Deactivate Vendor
const deactivateVendor = async (req, res) => {
    const { vendorId } = req.params; // Get vendor ID from URL parameters
    try {
        const vendor = await Vendor.findById(vendorId); // Find vendor by ID
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' }); // If vendor not found, return 404
        }
        vendor.approved = false; // Deactivate vendor
        await vendor.save(); // Save changes to the database
        return res.status(200).json({ message: 'Vendor deactivated successfully' }); // Return success message
    } catch (error) {
        console.error('Deactivation error:', error); // Log the error
        return res.status(500).json({ message: 'Vendor deactivation failed', error: error.message });
    } // Return error message
};
  


// Get All Customers

const getAllCustomers = async (req, res) => {  
    try {
        const customers = await Customer.find();  
        return res.status(200).json({ data: customers });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};


//Get All Customers Count

const getCustomersCount = async (req, res) => {
    try {
        const count = await Customer.countDocuments();
        return res.status(200).json({ count });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const verifyCustomer = async (req, res) => {
    const { customerId } = req.params; // Get from URL parameters
    const { KRN, SGC, TI, MSN, MTK1, MTK2, RTK1, RTK2 } = req.body;

    try {
        // 1. Find the customer first
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        // 2. Check if already verified
        if (customer.verification.isVerified) {
            return res.status(400).json({ 
                message: 'Customer already verified',
                verifiedAt: customer.verification.verifiedAt 
            });
        }

        // 3. Validate required fields
        const requiredFields = { KRN, SGC, TI, MSN, MTK1, MTK2, RTK1, RTK2 };
        const missingFields = Object.entries(requiredFields)
            .filter(([_, value]) => !value)
            .map(([key]) => key);

        if (missingFields.length > 0) {
            return res.status(400).json({
                message: 'Missing required verification fields',
                missingFields,
                requiredFields: ['KRN', 'SGC', 'TI', 'MSN','RTK1','RTK2','MTK1','MTK2'] 
            });
        }

        // 4. Update verification
        customer.verification = {
            ...customer.verification, // Preserve existing data
            KRN,
            SGC,
            TI,
            MSN,
            MTK1,
            MTK2,
            RTK1,
            RTK2,
            isVerified: true,  
            verifiedAt: new Date(),
            verifiedBy: req.user._id // Admin who verified
        };

        await customer.save();

        // 5. Return success
        return res.status(200).json({
            message: 'Customer verified successfully',
            customerId: customer._id,
            meterNumber: customer.meterNumber,
            disco: customer.disco,
            verificationStatus: 'verified'
        });

    } catch (error) {
        console.error('Verification error:', error);
        return res.status(500).json({
            message: 'Customer verification failed',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};


const updateVerifiedCustomer = async (req, res) => {
    const { customerId } = req.params;
    const updates = req.body;

    try {
        // 1. Validate required basic fields
        if (!updates.meterNumber || !updates.disco) {
            return res.status(400).json({
                success: false,
                message: 'Meter number and DISCO are required fields'
            });
        }

        // 2. Prepare the update object
        const updateData = {
            meterNumber: updates.meterNumber,
            disco: updates.disco,
            lastToken: updates.lastToken || null,
            updatedAt: new Date()
        };

        // 3. Handle verification updates if they exist
        if (updates.verification) {
            updateData.verification = {
                ...updates.verification,
                verifiedAt: updates.verification.isVerified ? new Date() : null,
                verifiedBy: updates.verification.isVerified ? req.user._id : null,
                isVerified: updates.verification.isVerified || false
            };
        }

        // 4. Perform the update with proper error handling
        const updatedCustomer = await Customer.findByIdAndUpdate(
            customerId,
            { $set: updateData },
            { 
                new: true,
                runValidators: true,
                context: 'query' // Ensures proper validation context
            }
        ).lean(); // Use lean() for better performance

        if (!updatedCustomer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // 5. Format the response data
        const responseData = {
            _id: updatedCustomer._id,
            meterNumber: updatedCustomer.meterNumber,
            disco: updatedCustomer.disco,
            lastToken: updatedCustomer.lastToken,
            verification: updatedCustomer.verification || null,
            createdAt: updatedCustomer.createdAt,
            updatedAt: updatedCustomer.updatedAt
        };

        // 6. Return success response
        return res.status(200).json({
            success: true,
            message: 'Customer updated successfully',
            data: responseData
        });

    } catch (error) {
        console.error('Update error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update customer',
            error: error.message,
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    }
};

//Delete Customer
const deleteCustomer = async (req, res) => {
    const { customerId } = req.params; // Get from URL parameters

    try {
        // 1. Find the customer first
        const customer = await Customer.findById(customerId);
        if (!customer) { 
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }
        await Customer.findByIdAndDelete(customerId);
        return res.status(200).json({ success: true, message: 'Customer deleted successfully' });
    } catch (error) {
        console.error('Deletion error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete customer',
            error: error.message,
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    }
};


//Get Disco   

//Set Disco Pricing

const discoPricing = async (req, res) => {
    const { discoName, pricePerUnit } = req.body;


      // Add validation
      if (!discoName || !pricePerUnit) {
        return res.status(400).json({ 
            message: 'Both discoName and pricePerUnit are required' 
        });
    }


    try {
        let pricing = await DiscoPricing.findOne({ discoName });
        
        if (pricing) {
          pricing.pricePerUnit = pricePerUnit;
        } else {
          pricing = new DiscoPricing({ discoName, pricePerUnit });
        }
    
        await pricing.save();
        return res.status(201).json({ message: 'Disco pricing updated successfully' });
        }
    catch (error) {
        return res.status(500).json({ message: error.message });
    }

}

//edit Disco Pricing
const editDiscoPricing = async (req, res) => {
    const { discoName, pricePerUnit } = req.body;
    const { discoId } = req.params; // Get from URL parameters

    try {
        const pricing = await DiscoPricing.findById(discoId);
        if (!pricing) {
            return res.status(404).json({ message: 'Disco pricing not found' });
        }

        pricing.discoName = discoName || pricing.discoName;
        pricing.pricePerUnit = pricePerUnit || pricing.pricePerUnit;
        await pricing.save();

        return res.status(200).json({ message: 'Disco pricing updated successfully' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Fetch All Disco Price

const getAllDiscoPricing = async (req, res) => {
    try {
        const pricing = await DiscoPricing.find();
        return res.status(200).json({ 
            success: true,
            data: pricing.map(item => ({
                discoName: item.discoName,
                pricePerUnit: item.pricePerUnit,
                updatedAt: item.updatedAt
            })) 
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
};

//Fetch All Disco



const  getPendingVendorCount = async (req, res) => {
    try {
        const pendingVendors = await Vendor.countDocuments({ approved: false });
        return res.status(200).json({ count: pendingVendors });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getPendingCustomerVerificationCount = async (req, res) => {
    try {
        const { status = 'pending' } = req.query;
        
        let query = {};
        if (status === 'pending') {
            query = { "verification.isVerified": false };
        } else if (status === 'verified') {
            query = { "verification.isVerified": true };
        } else {
            return res.status(400).json({ message: 'Invalid status parameter. Use "pending" or "verified"' });
        }

        const count = await Customer.countDocuments(query);
        return res.status(200).json({ count });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};


//Get Verified Customers Count 
const getVerifiedCustomersCount = async (req, res) => {
    try {
        const verifiedCount = await Customer.countDocuments({ 
            "verification.isVerified": true 
        });
        
        return res.status(200).json({ 
            count: verifiedCount 
        });
    } catch (error) {
        return res.status(500).json({ 
            message: error.message || "Failed to get verified customer count" 
        });
    }
};


const getTokenRequestCount = async (req, res) => {
    try {
        // Count only documents with status 'pending'
        const pendingTokenRequests = await TokenRequest.countDocuments({ status: 'pending' });
        return res.status(200).json({ count: pendingTokenRequests });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}; 

//Get Issued Token Count 
const getIssuedTokenCount = async (req, res) => {
    try {
        // Count only documents with status 'issued'
        const issuedTokenRequests = await Token.countDocuments({ status: 'issued' });
        return res.status(200).json({ count: issuedTokenRequests });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};


//Get Count for daily revenue based on Amount 
const getTotalTokensAmount = async (req, res) => {
    try {
      // Using MongoDB aggregation pipeline
      const aggregationResult = await Token.aggregate([
        {
          $match: { 
            status: 'issued',
            // Add any other filters you need
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalTokens: { $sum: 1 }
          }
        }
      ]);
  
      // Extract results or default to 0
      const result = aggregationResult.length > 0 
        ? aggregationResult[0] 
        : { totalAmount: 0, totalTokens: 0 };
  
      res.status(200).json({
        success: true,
        data: {
          totalAmount: result.totalAmount,
          totalTokens: result.totalTokens,
          // You can add formatted versions here if needed
          formattedAmount: `₦${result.totalAmount.toLocaleString()}`,
        }
      });
  
    } catch (error) {
      console.error('Error calculating token amounts:', error);
      res.status(500).json({
        success: false,
        message: 'Error calculating token statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };                    


  // Daily token count
const getDailyTokenCount = async (req, res) => {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0); // Start of today
  
      const result = await Token.aggregate([
        {
          $match: {
            status: 'issued',
            createdAt: { $gte: startOfDay }
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);
  
      const data = result.length > 0 ? result[0] : { count: 0, totalAmount: 0 };
  
      res.status(200).json({
        success: true,
        data: {
          count: data.count,
          totalAmount: data.totalAmount,
          formattedAmount: `${data.totalAmount.toLocaleString()}`
        }
      });
  
    } catch (error) {
      console.error('Error fetching daily tokens:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching daily token count'
      });
    }
  };
  
  // Monthly token count
  const getMonthlyTokenCount = async (req, res) => {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1); // First day of current month
      startOfMonth.setHours(0, 0, 0, 0);
  
      const result = await Token.aggregate([
        {
          $match: {
            status: 'issued',
            createdAt: { $gte: startOfMonth }
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);
  
      const data = result.length > 0 ? result[0] : { count: 0, totalAmount: 0 };
  
      res.status(200).json({
        success: true,
        data: {
          count: data.count,
          totalAmount: data.totalAmount,
          formattedAmount: `${data.totalAmount.toLocaleString()}`
        }
      });
  
    } catch (error) {
      console.error('Error fetching monthly tokens:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching monthly token count'
      });
    }
  };


        

const rejectCustomer = async (req, res) => {
    try {
      const { customerId } = req.params;
      const { rejectionReason } = req.body;
      const rejectedBy = req.user._id; // Assuming the rejecting user is authenticated
  
      // 1. Find the customer
      const customer = await Customer.findById(customerId);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
  
      // 2. Check if customer is already verified
      if (customer.verification.isVerified) {
        return res.status(400).json({ 
          message: 'Cannot reject an already verified customer' 
        });
      }
  
      // 3. Check if customer is already rejected
      if (customer.verification.rejected) {
        return res.status(400).json({ 
          message: 'Customer is already rejected' 
        });
      }
  
      // 4. Update the customer with rejection details
      customer.verification.rejected = true;
      customer.verification.rejectionReason = rejectionReason;
      customer.verification.rejectedBy = rejectedBy;
      // rejectedAt will be automatically set by the pre-save hook
  
      await customer.save();
  
      // 5. Return response
      return res.status(200).json({
        success: true,  // Ensure this field exists
        message: 'Customer rejected successfully',
        customer: {
          _id: customer._id,
          meterNumber: customer.meterNumber,
          status: 'rejected',
          rejectionReason: customer.verification.rejectionReason,
          rejectedAt: customer.verification.rejectedAt
        }
      });
  
    } catch (error) {
      console.error('Customer rejection error:', error);
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          message: 'Validation failed',
          errors
        });
      }
  
      return res.status(500).json({
        message: 'Customer rejection failed',
        error: error.message
      });
    }
  };
    
  
  const getRevenueTrends = async (req, res) => {
    try {
      const { range: period } = req.query; // 'day', 'week', or 'month'
      
      let groupBy, dateFormat, startDate;
      
      // Set parameters based on period
      switch (period) {
        case 'day':
          startDate = moment().subtract(30, 'days').toDate(); // Last 30 days
          groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
          dateFormat = 'MMM D';
          break;
          
        case 'week':
          startDate = moment().subtract(12, 'weeks').toDate(); // Last 12 weeks
          groupBy = { 
            year: { $year: '$createdAt' },
            week: { $week: '$createdAt' }
          };
          dateFormat = 'MMM D';
          break;
          
        case 'month':
          startDate = moment().subtract(12, 'months').toDate(); // Last 12 months
          groupBy = { 
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          };
          dateFormat = 'MMM YYYY';
          break;
          
        default:
          return res.status(400).json({ 
            success: false,
            message: 'Invalid period specified'
          });
      }
  
      const pipeline = [
        {
          $match: {
            status: 'issued',
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: groupBy,
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { '_id': 1 }
        }
      ];
  
      const results = await Token.aggregate(pipeline);
  
      // Format the results for the chart
      const formattedResults = results.map(item => {
        let periodLabel;
        
        if (period === 'week') {
          periodLabel = moment()
            .year(item._id.year)
            .week(item._id.week)
            .startOf('week')
            .format(dateFormat);
        } else if (period === 'month') {
          periodLabel = moment()
            .year(item._id.year)
            .month(item._id.month - 1)
            .format(dateFormat);
        } else {
          periodLabel = moment(item._id).format(dateFormat);
        }
        
        return {
          period: periodLabel,
          amount: item.totalAmount,
          count: item.count
        };
      });
  
      res.status(200).json({
        success: true,
        data: formattedResults
      });
  
    } catch (error) {
      console.error('Error fetching revenue trends:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching revenue trends',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
};



const getCustomerTrends = async (req, res) => {
    try {
        const { range: period } = req.query; // 'day', 'week', or 'month'
        
        if (!['day', 'week', 'month'].includes(period)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid period specified. Use day, week, or month'
            });
        }

        // Calculate date ranges
        const dateRanges = {
            day: {
                startDate: moment().subtract(30, 'days').toDate(),
                groupBy: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                dateFormat: 'MMM D'
            },
            week: {
                startDate: moment().subtract(12, 'weeks').toDate(),
                groupBy: { 
                    year: { $year: '$createdAt' },
                    week: { $week: '$createdAt' }
                },
                dateFormat: 'MMM D'
            },
            month: {
                startDate: moment().subtract(12, 'months').toDate(),
                groupBy: { 
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                },
                dateFormat: 'MMM YYYY'
            }
        };

        const { startDate, groupBy, dateFormat } = dateRanges[period];

        const pipeline = [
            {
                $match: {
                    createdAt: { $gte: startDate }
                }
            },
            {
                $facet: {
                    totalCustomers: [
                        {
                            $group: {
                                _id: groupBy,
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { '_id': 1 } }
                    ],
                    verifiedCustomers: [
                        {
                            $match: {
                                isVerified: true
                            }
                        },
                        {
                            $group: {
                                _id: groupBy,
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { '_id': 1 } }
                    ]
                }
            }
        ];

        const results = await Customer.aggregate(pipeline);

        // Format results for chart
        const formattedResults = results[0].totalCustomers.map((totalItem, index) => {
            let periodLabel;
            
            if (period === 'week') {
                periodLabel = moment()
                    .year(totalItem._id.year)
                    .week(totalItem._id.week)
                    .startOf('week')
                    .format(dateFormat);
            } else if (period === 'month') {
                periodLabel = moment()
                    .year(totalItem._id.year)
                    .month(totalItem._id.month - 1)
                    .format(dateFormat);
            } else {
                periodLabel = moment(totalItem._id).format(dateFormat);
            }
            
            const verifiedItem = results[0].verifiedCustomers[index] || { count: 0 };
            
            return {
                period: periodLabel,
                total: totalItem.count,
                verified: verifiedItem.count
            };
        });

        res.status(200).json({
            success: true,
            period,
            data: formattedResults
        });

    } catch (error) {
        console.error('Error fetching customer trends:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching customer trends',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};



const getTokenTrends = async (req, res) => {
    try {
        const { range: period } = req.query; // 'day', 'week', or 'month'
        
        if (!['day', 'week', 'month'].includes(period)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid period specified. Use day, week, or month'
            });
        }

        // Calculate date ranges
        const dateRanges = {
            day: {
                startDate: moment().subtract(30, 'days').toDate(),
                groupBy: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                dateFormat: 'MMM D'
            },
            week: {
                startDate: moment().subtract(12, 'weeks').toDate(),
                groupBy: { 
                    year: { $year: '$createdAt' },
                    week: { $week: '$createdAt' }
                },
                dateFormat: 'MMM D'
            },
            month: {
                startDate: moment().subtract(12, 'months').toDate(),
                groupBy: { 
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                },
                dateFormat: 'MMM YYYY'
            }
        };

        const { startDate, groupBy, dateFormat } = dateRanges[period];

        const pipeline = [
            {
                $match: {
                    createdAt: { $gte: startDate }
                }
            },
            {
                $facet: {
                    issuedTokens: [
                        {
                            $match: { status: 'issued' }
                        },
                        {
                            $group: {
                                _id: groupBy,
                                count: { $sum: 1 },
                                totalAmount: { $sum: '$amount' }
                            }
                        },
                        { $sort: { '_id': 1 } }
                    ],
                    pendingTokens: [
                        {
                            $match: { status: 'pending' }
                        },
                        {
                            $group: {
                                _id: groupBy,
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { '_id': 1 } }
                    ]
                }
            }
        ];

        const results = await Token.aggregate(pipeline);

        // Format results for chart
        const formattedResults = results[0].issuedTokens.map((issuedItem, index) => {
            let periodLabel;
            
            if (period === 'week') {
                periodLabel = moment()
                    .year(issuedItem._id.year)
                    .week(issuedItem._id.week)
                    .startOf('week')
                    .format(dateFormat);
            } else if (period === 'month') {
                periodLabel = moment()
                    .year(issuedItem._id.year)
                    .month(issuedItem._id.month - 1)
                    .format(dateFormat);
            } else {
                periodLabel = moment(issuedItem._id).format(dateFormat);
            }
            
            const pendingItem = results[0].pendingTokens[index] || { count: 0 };
            
            return {
                period: periodLabel,
                issued: issuedItem.count,
                issuedAmount: issuedItem.totalAmount,
                pending: pendingItem.count
            };
        });

        res.status(200).json({
            success: true,
            period,
            data: formattedResults
        });

    } catch (error) {
        console.error('Error fetching token trends:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching token trends',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


const getCustomerDistribution = async (req, res) => {
    try {
        const results = await Customer.aggregate([
            {
                $facet: {
                    verifiedCustomers: [
                        {
                            $match: { isVerified: true }
                        },
                        {
                            $count: "count"
                        }
                    ],
                    pendingCustomers: [
                        {
                            $match: { isVerified: false }
                        },
                        {
                            $count: "count"
                        }
                    ],
                    totalCustomers: [
                        {
                            $count: "count"
                        }
                    ]
                }
            },
            {
                $project: {
                    verified: { $ifNull: [{ $arrayElemAt: ["$verifiedCustomers.count", 0] }, 0] },
                    pending: { $ifNull: [{ $arrayElemAt: ["$pendingCustomers.count", 0] }, 0] },
                    total: { $ifNull: [{ $arrayElemAt: ["$totalCustomers.count", 0] }, 0] }
                }
            }
        ]);

        const distribution = results[0] || { verified: 0, pending: 0, total: 0 };

        res.status(200).json({
            success: true,
            data: {
                verified: distribution.verified,
                pending: distribution.pending,
                total: distribution.total,
                verifiedPercentage: distribution.total > 0 
                    ? Math.round((distribution.verified / distribution.total) * 100) 
                    : 0,
                pendingPercentage: distribution.total > 0 
                    ? Math.round((distribution.pending / distribution.total) * 100) 
                    : 0
            }
        });

    } catch (error) {
        console.error('Error fetching customer distribution:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching customer distribution',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


//Get Sales Report

const getSalesReport = async (req, res) => {
    try {
        const { type = 'daily' } = req.query;
        
        let startDate, endDate, groupBy;
           
        // Set date ranges and grouping based on report type
        switch (type.toLowerCase()) {
          case 'weekly':
            startDate = moment().startOf('week').toDate();
            endDate = moment().endOf('week').toDate();
            groupBy = { $dayOfWeek: '$createdAt' };
            break;
          case 'monthly':
            startDate = moment().startOf('month').toDate();
            endDate = moment().endOf('month').toDate();
            groupBy = { $dayOfMonth: '$createdAt' };
            break;
          default: // daily
            startDate = moment().startOf('day').toDate();
            endDate = moment().endOf('day').toDate();
            groupBy = { $hour: '$createdAt' };
        }
    
        const reportData = await Token.aggregate([
          {
            $match: {
              status: 'issued', // Only successful transactions
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: groupBy,
              date: { $first: '$createdAt' },
              tokensIssued: { $sum: 1 },
              totalAmount: { $sum: '$amount' },
              successfulTransactions: { $sum: 1 },
              failedTransactions: { 
                $sum: { 
                  $cond: [{ $ne: ['$status', 'success'] }, 1, 0] 
                } 
              }
            }
          },
          {
            $project: {
              _id: 0,
              date: {
                $dateToString: {
                  format: type === 'monthly' ? '%Y-%m-%d' : 
                         type === 'weekly' ? '%Y-%m-%d' : '%Y-%m-%d %H:%M',
                  date: '$date'
                }
              },
              tokensIssued: 1,
              totalAmount: 1,
              successfulTransactions: 1,
              failedTransactions: 1
            }
          },
          { $sort: { date: 1 } }
        ]);
    
        // Format the response
        const formattedData = reportData.map(item => ({
          ...item,
          totalAmount: item.totalAmount,
          formattedAmount: `₦${item.totalAmount.toLocaleString()}`
        }));
    
        res.status(200).json({
          success: true,
          data: formattedData
        });
      } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to generate sales report'
        });
      }
}


//Get Pending Upgrades 
const getPendingUpgrades = async (req, res) => {
    try {
        // 1. Verify authentication
        if (!req.user || !req.user._id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication credentials missing'
            });
        }

        // 2. Find all vendors with pending upgrades (admin view)
        const vendorsWithUpgrades = await Vendor.aggregate([
            { $match: { 'pendingUpgrades.0': { $exists: true } } }, // Vendors with at least one upgrade
            { $unwind: '$pendingUpgrades' },
            { $match: { 'pendingUpgrades.status': 'pending' } },
            { $project: {
                vendorId: '$_id',
                businessName: 1,
                email: 1,
                upgrade: '$pendingUpgrades',
                _id: 0
            }}
        ]);

        // 3. Format the response
        const pendingUpgrades = vendorsWithUpgrades.map(item => ({
            ...item.upgrade,
            vendorInfo: {
                id: item.vendorId,
                businessName: item.businessName,
                email: item.email
            }
        }));

        return res.status(200).json({
            success: true,
            count: pendingUpgrades.length,
            data: pendingUpgrades
        });

    } catch (error) {
        console.error('Controller error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            systemError: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                stack: error.stack
            } : undefined
        });
    }
};
//Complete Upgrade

const CompleteUpgrade = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { vendorId, upgradeId } = req.params;
        const adminId = req.user._id;

        const vendor = await Vendor.findById(vendorId).session(session);
        if (!vendor) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Vendor not found' });
        }

        const upgrade = vendor.pendingUpgrades.id(upgradeId);
        if (!upgrade || upgrade.status !== 'pending_verification') {
            await session.abortTransaction();
            return res.status(400).json({ message: 'Invalid upgrade request' });
        }

        // Move to completed upgrades
        vendor.completedUpgrades.push({
            additionalCustomers: upgrade.additionalCustomers,
            amount: upgrade.amount,
            approvedAt: new Date(),
            approvedBy: adminId,
            status: 'completed'
        });

        // Remove from pending
        vendor.pendingUpgrades.pull(upgrade._id);

        await vendor.save({ session });
        await session.commitTransaction();

        return res.status(200).json({
            success: true,
            message: 'Upgrade completed successfully',
            newCustomerLimit: vendor.customerLimit + upgrade.additionalCustomers
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Upgrade completion error:', error);
        return res.status(500).json({ message: 'Failed to complete upgrade' });
    } finally {
        session.endSession();
    }
};



module.exports = { 
    registerAdmin,
     loginAdmin,
    createVendor,
    verifyCustomer,
    discoPricing,
    approveVendor,
    getAllVendors,
    getAllCustomers,
    getAllDiscoPricing,
    getTokenRequestCount,
    getPendingVendorCount,
    getPendingCustomerVerificationCount,
    updateVerifiedCustomer,
    deleteCustomer,
    editVendor,
    deleteVendor,
    deactivateVendor,
    editDiscoPricing,
    rejectCustomer,
    logoutAdmin,
    getCustomersCount,
    getVerifiedCustomersCount,
    getIssuedTokenCount,
    getTotalTokensAmount,
    getDailyTokenCount,
    getMonthlyTokenCount,
    getRevenueTrends,
    getCustomerTrends,
    getTokenTrends,
    getCustomerDistribution,
    getSalesReport,
    getPendingUpgrades,
    CompleteUpgrade


     };