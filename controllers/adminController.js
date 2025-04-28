const Admin = require('../models/Admin');
const Vendor = require('../models/Vendor');
const Customer = require('../models/Customer');
const DiscoPricing = require('../models/DiscoPricing');
const TokenRequest = require('../models/TokenRequest');
const generateToken = require('../utils/generateToken');


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

const getCustomerVerificationCount = async (req, res) => {
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

const getTokenRequestCount = async (req, res) => {
    try {
        // Count only documents with status 'pending'
        const pendingTokenRequests = await TokenRequest.countDocuments({ status: 'pending' });
        return res.status(200).json({ count: pendingTokenRequests });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}; 


const rejectCustomerVerification = async (req, res) => {
    try {
      const { rejectionReason } = req.body;
      
      const customer = await Customer.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            'verification.isVerified': false,
            'verification.rejected': true,
            'verification.rejectionReason': rejectionReason,
            'verification.rejectedAt': new Date(),
            'verification.rejectedBy': req.user.id
          }
        },
        { new: true }
      ).populate('vendorId', 'name email'); // Optional: populate vendor info
  
      // Optional: Notify vendor here via email or notification system
  
      res.json({
        success: true,
        data: customer
      });
    } catch (error) {
      console.error('Rejection error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject verification'
      });
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
    getCustomerVerificationCount,
    updateVerifiedCustomer,
    deleteCustomer,
    editVendor,
    deleteVendor,
    deactivateVendor,
    editDiscoPricing,
    rejectCustomerVerification,
    logoutAdmin
     };