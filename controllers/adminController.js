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

// @desc    Register a new admin (Super Admin only) - UPDATED VERSION
const registerAdmin = async (req, res) => {
    const { username, password, role, permissions } = req.body;
    
    try {
        // Check if admin already exists
        const adminExists = await Admin.findOne({ username });
        if (adminExists) {
            return res.status(400).json({ message: 'Admin already exists' });
        }

        // Only super admin can create other admins
        if (req.admin && req.admin.role !== 'super_admin') {
            return res.status(403).json({ 
                message: 'Access denied. Only super admin can create admins.' 
            });
        }

        // Create a new admin with permissions
        const admin = await Admin.create({
            username, 
            password, 
            role: role || 'admin',
            permissions: permissions || {
                createVendors: false,
                verifyCustomers: false,
                discoPricing: false,
                tokenManagement: false
            },
            createdBy: req.admin ? req.admin._id : null // Set to null if created during setup
        });

        if (admin) {
            return res.status(201).json({
                _id: admin._id,
                username: admin.username,
                role: admin.role,
                permissions: admin.permissions,
                active: admin.active,
                createdAt: admin.createdAt,
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
    
    console.log('🔐 LOGIN ATTEMPT =================================');
    console.log('Username provided:', username);
    console.log('Password length:', password ? password.length : 'undefined');
    
    try {
        // Try multiple search methods
        let admin;
        
        // Method 1: Exact match (original behavior)
        admin = await Admin.findOne({ username });
        console.log('1. Exact match search:', admin ? 'FOUND' : 'NOT FOUND');
        
        // Method 2: Case insensitive search
        if (!admin) {
            admin = await Admin.findOne({ 
                username: { $regex: new RegExp(`^${username}$`, 'i') } 
            });
            console.log('2. Case insensitive search:', admin ? 'FOUND' : 'NOT FOUND');
        }
        
        // Method 3: Direct database query as fallback
        if (!admin) {
            const db = mongoose.connection.db;
            const rawAdmin = await db.collection('admins').findOne({ 
                username: { $regex: new RegExp(`^${username}$`, 'i') } 
            });
            if (rawAdmin) {
                console.log('3. Raw database query: FOUND');
                // Convert to Mongoose document
                admin = new Admin(rawAdmin);
            } else {
                console.log('3. Raw database query: NOT FOUND');
            }
        }
        
        if (!admin) {
            console.log('❌ ADMIN NOT FOUND WITH ANY SEARCH METHOD');
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        console.log('✅ ADMIN FOUND:');
        console.log('  - ID:', admin._id);
        console.log('  - Username:', admin.username);
        console.log('  - Role:', admin.role);
        console.log('  - Active:', admin.active);

        // Check if admin is active
        if (admin.active === false) {
            console.log('❌ ACCOUNT DEACTIVATED');
            return res.status(401).json({ message: 'Account is deactivated' });
        }

        // Test password comparison
        console.log('🔄 TESTING PASSWORD...');
        const isPasswordCorrect = await admin.comparePassword(password);
        console.log('  Password match:', isPasswordCorrect);

        if (!isPasswordCorrect) {
            console.log('❌ PASSWORD MISMATCH');
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        console.log('✅ LOGIN SUCCESSFUL');
        
        // Generate token
        const token = generateToken(admin._id, admin.role);
        
        return res.status(200).json({
            _id: admin._id,
            username: admin.username,
            role: admin.role,
            permissions: admin.permissions || {},
            active: admin.active,
            token: token
        });
        
    } catch (error) {
        console.error('💥 LOGIN ERROR:', error);
        return res.status(500).json({ message: 'Login failed' });
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


// Add these new functions to your existing adminController

// @desc    Get all admins (Super Admin only)
const getAdmins = async (req, res) => {
  try {
    const admins = await Admin.find()
      .select('-password')
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: admins,
      count: admins.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get admin by ID (Super Admin only)
const getAdminById = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id)
      .select('-password')
      .populate('createdBy', 'username');

    if (admin) {
      res.json({
        success: true,
        data: admin
      });
    } else {
      res.status(404).json({ message: 'Admin not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update admin (Super Admin only)
const updateAdmin = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Prevent super admin from being demoted
    if (admin.role === 'super_admin' && req.body.role === 'admin') {
      return res.status(400).json({ message: 'Cannot demote super admin' });
    }

    const { username, role, permissions, password } = req.body;

    admin.username = username || admin.username;
    admin.role = role || admin.role;
    
    if (permissions) {
      admin.permissions = { ...admin.permissions, ...permissions };
    }

    if (password && password.trim() !== '') {
      admin.password = password;
    }

    const updatedAdmin = await admin.save();

    res.json({
      success: true,
      data: {
        _id: updatedAdmin._id,
        username: updatedAdmin.username,
        role: updatedAdmin.role,
        permissions: updatedAdmin.permissions,
        active: updatedAdmin.active,
        updatedAt: updatedAdmin.updatedAt
      },
      message: 'Admin updated successfully'
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Username already exists' });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
};

// @desc    Toggle admin status (Super Admin only)
const toggleAdminStatus = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Prevent deactivating super admin
    if (admin.role === 'super_admin' && !req.body.active) {
      return res.status(400).json({ message: 'Cannot deactivate super admin' });
    }

    admin.active = req.body.active;
    const updatedAdmin = await admin.save();

    res.json({
      success: true,
      data: {
        _id: updatedAdmin._id,
        username: updatedAdmin.username,
        active: updatedAdmin.active
      },
      message: `Admin ${updatedAdmin.active ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete admin (Super Admin only)
const deleteAdmin = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Prevent deleting super admin
    if (admin.role === 'super_admin') {
      return res.status(400).json({ message: 'Cannot delete super admin' });
    }

    // Prevent deleting yourself
    if (admin._id.toString() === req.admin._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    await Admin.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Admin deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current admin profile
const getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('-password');
    
    res.json({
      success: true,
      data: admin
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update admin permissions (Super Admin only)
// @desc    Update admin permissions (Super Admin only)
const updateAdminPermissions = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Cannot update super admin permissions
    if (admin.role === 'super_admin') {
      return res.status(400).json({ message: 'Cannot update super admin permissions' });
    }

    const { 
      createVendors, 
      verifyCustomers, 
      discoPricing, 
      tokenManagement,
      accountManagement,
      vendorSpace,
      vendorCustomer,
      viewAnalytics,
      systemSettings
    } = req.body;

    admin.permissions = {
      createVendors: createVendors || false,
      verifyCustomers: verifyCustomers || false,
      discoPricing: discoPricing || false,
      tokenManagement: tokenManagement || false,
      accountManagement: accountManagement || false,
      vendorSpace: vendorSpace || false,
      vendorCustomer: vendorCustomer || false,
      viewAnalytics: viewAnalytics || false,
      systemSettings: systemSettings || false
    };

    const updatedAdmin = await admin.save();

    res.json({
      success: true,
      data: {
        _id: updatedAdmin._id,
        username: updatedAdmin.username,
        permissions: updatedAdmin.permissions
      },
      message: 'Admin permissions updated successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create admin with permissions (Super Admin only)
// In your adminController.js - update registerAdminWithPermissions
const registerAdminWithPermissions = async (req, res) => {
  const { username, password, role, permissions } = req.body;
  
  console.log('👨‍💼 Creating new admin:', { username, role, permissions });
  
  try {
    // Check if admin already exists
    const adminExists = await Admin.findOne({ username });
    if (adminExists) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    // Create a new admin with all permissions
    const admin = await Admin.create({
      username,
      password,
      role: role || 'admin',
      permissions: permissions || {
        // Existing permissions
        createVendors: false,
        verifyCustomers: false,
        discoPricing: false,
        tokenManagement: false,
        // New permissions
        accountManagement: false,
        vendorSpace: false,
        vendorCustomer: false,
        viewAnalytics: false,
        systemSettings: false
      },
      createdBy: req.admin._id
    });

    if (admin) {
      console.log('✅ Admin created successfully:', admin.username);
      
      // Generate token with proper error handling
      let token;
      try {
        token = generateToken(admin._id, admin.role);
        console.log('✅ Token generated for new admin');
      } catch (tokenError) {
        console.error('❌ Token generation failed:', tokenError.message);
        // Still return success but without token
        return res.status(201).json({
          _id: admin._id,
          username: admin.username,
          role: admin.role,
          permissions: admin.permissions,
          active: admin.active,
          createdAt: admin.createdAt,
          message: 'Admin created successfully but token generation failed'
        });
      }

      // Return success with token
      res.status(201).json({
        _id: admin._id,
        username: admin.username,
        role: admin.role,
        permissions: admin.permissions,
        active: admin.active,
        createdAt: admin.createdAt,
        token: token
      });
    } else {
      res.status(400).json({ message: 'Invalid admin data' });
    }
  } catch (error) {
    console.error('❌ Admin creation error:', error);
    res.status(500).json({ message: error.message });
  }
};

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


// Toggle vendor's ability to add customers
const toggleVendorCustomerAddition = async (req, res) => {
    const { vendorId } = req.params;
    const { canAddCustomers, reason } = req.body; // reason is optional
    
    try {
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        // Update the flag
        vendor.canAddCustomers = canAddCustomers;
        
        // Optional: Track who made the change and why
        vendor.lastUpdatedBy = {
            user: req.user._id,
            at: new Date(),
            reason: reason || (canAddCustomers ? 'Restriction lifted' : 'Restriction applied')
        };

        await vendor.save();

        return res.status(200).json({
            message: `Vendor ${vendor.username} can ${vendor.canAddCustomers ? 'now' : 'no longer'} add customers`,
            canAddCustomers: vendor.canAddCustomers,
            updatedAt: vendor.updatedAt
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Get vendor's customer addition status
const getVendorAdditionStatus = async (req, res) => {
    const { vendorId } = req.params;
    
    try {
        const vendor = await Vendor.findById(vendorId)
            .select('username email canAddCustomers customerLimit lastUpdatedBy');
            
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        // Get current customer count
        const customerCount = await mongoose.model('Customer').countDocuments({ vendorId });
        const effectiveLimit = vendor.getEffectiveCustomerLimit();

        return res.status(200).json({
            vendorId: vendor._id,
            username: vendor.username,
            email: vendor.email,
            canAddCustomers: vendor.canAddCustomers,
            customerCount,
            customerLimit: effectiveLimit,
            canAddMore: customerCount < effectiveLimit,
            lastUpdated: vendor.lastUpdatedBy
        });
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
    const { customerId } = req.params;
    const { KRN, SGC, TI, MSN, MTK1, MTK2, RTK1, RTK2 } = req.body;

    try {
        // 1. Find the customer and validate existence
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        // 2. Validate DISCO exists in DiscoPricing
        const DiscoPricing = mongoose.model('DiscoPricing');
        const validDisco = await DiscoPricing.exists({ 
            discoName: customer.disco.toUpperCase() // Case-insensitive check
        });

        if (!validDisco) {
            return res.status(400).json({
                message: 'Invalid DISCO - not found in system records',
                providedDisco: customer.disco,
                validDiscos: await DiscoPricing.distinct('discoName')
            });
        }

        // 3. Check if already verified
        if (customer.verification.isVerified) {
            return res.status(400).json({ 
                message: 'Customer already verified',
                verifiedAt: customer.verification.verifiedAt 
            });
        }

        // 4. Validate required fields (unchanged)
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

        // 5. Update verification (unchanged)
        customer.verification = {
            ...customer.verification,
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
            verifiedBy: req.user._id
        };

        await customer.save();

        // 6. Return success
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

    // Validate input
    if (!discoName || !pricePerUnit) {
        return res.status(400).json({ 
            success: false,
            message: 'Both discoName and pricePerUnit are required' 
        });
    }

    if (isNaN(Number(pricePerUnit))) {  // <-- This line had the syntax error
        return res.status(400).json({ 
            success: false,
            message: 'pricePerUnit must be a valid number' 
        });
    }

    try {
        // Trim and format the discoName
        const formattedDiscoName = discoName.trim();
        const numericPrice = Number(pricePerUnit);

        // Check if price is negative
        if (numericPrice < 0) {
            return res.status(400).json({
                success: false,
                message: 'Price cannot be negative'
            });
        }

        // Find existing pricing (case-insensitive)
        const existingPricing = await DiscoPricing.findOne({ 
            discoName: { $regex: new RegExp(`^${formattedDiscoName}$`, 'i') }
        });

        if (existingPricing) {
            // Update existing record
            existingPricing.pricePerUnit = numericPrice;
            existingPricing.updatedAt = Date.now();
            await existingPricing.save();
            
            return res.status(200).json({ 
                success: true,
                message: 'Disco pricing updated successfully',
                data: existingPricing
            });
        } else {
            // Create new record
            const newPricing = new DiscoPricing({
                discoName: formattedDiscoName,
                pricePerUnit: numericPrice
            });
            await newPricing.save();
            
            return res.status(201).json({ 
                success: true,
                message: 'Disco pricing created successfully',
                data: newPricing
            });
        }
    } catch (error) {
        console.error('Error in discoPricing:', error);
        
        // Handle duplicate key error (case-insensitive)
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'A DISCO with this name already exists (case-insensitive)'
            });
        }
        
        return res.status(500).json({ 
            success: false,
            message: error.message || 'Internal server error'
        });
    }
};

//edit Disco Pricing

const editDiscoPricing = async (req, res) => {
    const { discoName } = req.params; // Get name from URL params
    const { pricePerUnit } = req.body; // Only price can be updated

    // Validate inputs
    if (!discoName || !discoName.trim()) {
        return res.status(400).json({ 
            success: false,
            message: 'DISCO name is required' 
        });
    }

    if (!pricePerUnit || isNaN(Number(pricePerUnit))) {
        return res.status(400).json({ 
            success: false,
            message: 'Valid pricePerUnit is required' 
        });
    }

    try {
        // Find by name (case-insensitive exact match)
        const existingPricing = await DiscoPricing.findOne({
            discoName: { $regex: new RegExp(`^${discoName.trim()}$`, 'i') }
        });

        if (!existingPricing) {
            return res.status(404).json({ 
                success: false,
                message: 'DISCO pricing not found' 
            });
        }

        const numericPrice = Number(pricePerUnit);
        if (numericPrice < 0) {
            return res.status(400).json({
                success: false,
                message: 'Price cannot be negative'
            });
        }

        // Update only the price
        const updatedPricing = await DiscoPricing.findByIdAndUpdate(
            existingPricing._id,
            { 
                pricePerUnit: numericPrice,
                updatedAt: new Date() 
            },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: 'DISCO price updated successfully',
            data: updatedPricing
        });

    } catch (error) {
        console.error('Update error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update DISCO pricing',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


//DELETE ALL 

const deleteDiscoPricing = async (req, res) => {
    const { discoName } = req.params;

    if (!discoName || !discoName.trim()) {
        return res.status(400).json({
            success: false,
            message: 'DISCO name is required'
        });
    }

    try {
        // Find and delete by name (case-sensitive exact match)
        const deletedPricing = await DiscoPricing.findOneAndDelete({
            discoName: discoName.trim()
        });

        if (!deletedPricing) {
            return res.status(404).json({
                success: false,
                message: 'DISCO pricing not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'DISCO pricing deleted successfully',
            data: deletedPricing
        });

    } catch (error) {
        console.error('Delete error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete DISCO pricing',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


// Fetch All Disco Price

const getAllDiscoPricing = async (req, res) => {
  try {
    const { enabledOnly } = req.query;

    // This line filters in both:
    // - discos where disabled is false
    // - and discos where disabled is missing
    const filter = enabledOnly === 'true'
      ? { $or: [{ disabled: false }, { disabled: { $exists: false } }] }
      : {};

    const pricing = await DiscoPricing.find(filter);

    return res.status(200).json({
      success: true,
      data: pricing.map(item => ({
        _id: item._id,
        discoName: item.discoName,
        pricePerUnit: item.pricePerUnit,
        updatedAt: item.updatedAt,
        disabled: item.disabled ?? false // Treat missing as false
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
const disableDisco = async (req, res) => {
    const { discoName } = req.params;
    
    const disco = await DiscoPricing.findOneAndUpdate(
        { discoName: { $regex: new RegExp(`^${discoName}$`, 'i') } },
        { disabled: true },
        { new: true }
    );

    if (!disco) {
        return res.status(404).json({ message: 'DISCO not found' });
    }

    res.json({ 
        message: `${disco.discoName} disabled`,
        disabled: true 
    });
};

const enableDisco = async (req, res) => {
    const { discoName } = req.params;
    
    const disco = await DiscoPricing.findOneAndUpdate(
        { discoName: { $regex: new RegExp(`^${discoName}$`, 'i') } },
        { disabled: false },
        { new: true }
    );

    if (!disco) {
        return res.status(404).json({ message: 'DISCO not found' });
    }

    res.json({ 
        message: `${disco.discoName} enabled`,
        disabled: false 
    });
};
// Get active DISCOs for customer registration
const getActiveDiscos = async (req, res) => {
  try {
    const discos = await DiscoPricing.find({ disabled: false })
      .select('discoName pricePerUnit')
      .sort('discoName');
    
    res.json({
      success: true,
      data: discos
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch DISCOs'
    });
  }
};

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
        // ✅ 1. Authentication check
        if (!req.user || !req.user._id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication credentials missing'
            });
        }

        // ✅ 2. Aggregate all pending upgrades
        const vendorsWithPendingUpgrades = await Vendor.aggregate([
            { $match: { "pendingUpgrades.0": { $exists: true } } },
            { $unwind: "$pendingUpgrades" },
            { $match: { "pendingUpgrades.status": "pending" } },
            {
                $project: {
                    vendorId: "$_id",
                    businessName: 1,
                    email: 1,
                    username: 1,
                    role: 1,
                    upgrade: "$pendingUpgrades",
                    _id: 0
                }
            }
        ]);

        // ✅ 3. Format each upgrade with vendor info
        const pendingUpgrades = vendorsWithPendingUpgrades.map(item => ({
            ...item.upgrade,
            vendorInfo: {
                id: item.vendorId,
                businessName: item.businessName,
                email: item.email,
                username: item.username,
                role: item.role
            }
        }));

        return res.status(200).json({
            success: true,
            count: pendingUpgrades.length,
            data: pendingUpgrades
        });

    } catch (error) {
        console.error("Controller error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
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

        if (!mongoose.Types.ObjectId.isValid(upgradeId)) {
            return res.status(400).json({ message: 'Invalid upgrade ID format' });
        }

        const vendor = await Vendor.findById(vendorId).session(session);
        if (!vendor) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Vendor not found' });
        }

        const upgrade = vendor.pendingUpgrades.id(upgradeId);
        if (!upgrade) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Upgrade not found in vendor\'s pending list' });
        }

        if (upgrade.status !== 'pending') {
            await session.abortTransaction();
            return res.status(400).json({ message: `Upgrade is not in pending state (found: ${upgrade.status})` });
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


//Reject Upgrade

// PATCH /admin/reject/:vendorId/:upgradeId
const rejectUpgrade = async (req, res) => {
  const { vendorId, upgradeId } = req.params;

  try {
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const upgrade = vendor.pendingUpgrades.id(upgradeId);
    if (!upgrade) {
      return res.status(404).json({ message: 'Upgrade not found' });
    }

    if (upgrade.status !== 'pending') {
      return res.status(400).json({ message: 'Upgrade is not in pending state' });
    }

    upgrade.status = 'rejected';
    await vendor.save();

    return res.status(200).json({ message: 'Upgrade rejected successfully' });
  } catch (error) {
    console.error('Reject upgrade error:', error);
    return res.status(500).json({ message: 'Failed to reject upgrade' });
  }
};


// Add customer space to vendor directly (Admin function)
const addCustomerSpaceToVendor = async (req, res) => {
    const { vendorId } = req.params;
    const { additionalCustomers, reason } = req.body;
    
    try {
        // Validate input
        if (!additionalCustomers || additionalCustomers <= 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Additional customers must be a positive number' 
            });
        }

        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ 
                success: false,
                message: 'Vendor not found' 
            });
        }

        // Calculate new customer limit
        const newCustomerLimit = vendor.customerLimit + parseInt(additionalCustomers);
        
        // Update vendor's customer limit
        vendor.customerLimit = newCustomerLimit;
        
        // Record the upgrade in completed upgrades
        vendor.completedUpgrades.push({
            additionalCustomers: parseInt(additionalCustomers),
            amount: 0, // Free upgrade by admin
            approvedAt: new Date(),
            approvedBy: req.user._id,
            status: 'completed',
            reason: reason || 'Admin granted additional customer space',
            type: 'admin_granted' // Distinguish from paid upgrades
        });

        // Update last modified info
        vendor.lastUpdatedBy = {
            user: req.user._id,
            at: new Date(),
            reason: reason || `Admin granted ${additionalCustomers} additional customer slots`
        };

        await vendor.save();

        return res.status(200).json({
            success: true,
            message: `Successfully added ${additionalCustomers} customer slots to ${vendor.username}`,
            data: {
                vendorId: vendor._id,
                vendorName: vendor.username,
                previousCustomerLimit: vendor.customerLimit - additionalCustomers,
                newCustomerLimit: vendor.customerLimit,
                totalAdded: parseInt(additionalCustomers),
                grantedAt: new Date()
            }
        });

    } catch (error) {
        console.error('Add customer space error:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Failed to add customer space to vendor',
            error: error.message 
        });
    }
};

// Reduce customer space from vendor (Admin function)
const reduceCustomerSpaceFromVendor = async (req, res) => {
    const { vendorId } = req.params;
    const { reduceCustomers, reason } = req.body;
    
    try {
        // Validate input
        if (!reduceCustomers || reduceCustomers <= 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Reduce customers must be a positive number' 
            });
        }

        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ 
                success: false,
                message: 'Vendor not found' 
            });
        }

        // Check if reduction is possible
        const currentCustomerCount = await mongoose.model('Customer').countDocuments({ vendorId });
        const proposedNewLimit = vendor.customerLimit - parseInt(reduceCustomers);
        
        if (proposedNewLimit < currentCustomerCount) {
            return res.status(400).json({
                success: false,
                message: `Cannot reduce customer limit to ${proposedNewLimit}. Vendor currently has ${currentCustomerCount} customers.`,
                currentCustomerCount,
                proposedNewLimit,
                minimumAllowed: currentCustomerCount
            });
        }

        if (proposedNewLimit < 0) {
            return res.status(400).json({
                success: false,
                message: 'Customer limit cannot be negative'
            });
        }

        // Update vendor's customer limit
        const previousLimit = vendor.customerLimit;
        vendor.customerLimit = proposedNewLimit;
        
        // Record the reduction
        vendor.completedUpgrades.push({
            additionalCustomers: -parseInt(reduceCustomers), // Negative to indicate reduction
            amount: 0,
            approvedAt: new Date(),
            approvedBy: req.user._id,
            status: 'completed',
            reason: reason || 'Admin reduced customer space',
            type: 'admin_reduced'
        });

        // Update last modified info
        vendor.lastUpdatedBy = {
            user: req.user._id,
            at: new Date(),
            reason: reason || `Admin reduced customer limit by ${reduceCustomers} slots`
        };

        await vendor.save();

        return res.status(200).json({
            success: true,
            message: `Successfully reduced ${reduceCustomers} customer slots from ${vendor.username}`,
            data: {
                vendorId: vendor._id,
                vendorName: vendor.username,
                previousCustomerLimit: previousLimit,
                newCustomerLimit: vendor.customerLimit,
                totalReduced: parseInt(reduceCustomers),
                currentCustomerCount,
                reducedAt: new Date()
            }
        });

    } catch (error) {
        console.error('Reduce customer space error:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Failed to reduce customer space from vendor',
            error: error.message 
        });
    }
};

// Set specific customer limit for vendor (Admin function)
const setCustomerLimitForVendor = async (req, res) => {
    const { vendorId } = req.params;
    const { newCustomerLimit, reason } = req.body;
    
    try {
        // Validate input
        if (!newCustomerLimit || newCustomerLimit < 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Customer limit must be a non-negative number' 
            });
        }

        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ 
                success: false,
                message: 'Vendor not found' 
            });
        }

        // Check if new limit is acceptable
        const currentCustomerCount = await mongoose.model('Customer').countDocuments({ vendorId });
        
        if (newCustomerLimit < currentCustomerCount) {
            return res.status(400).json({
                success: false,
                message: `Cannot set customer limit to ${newCustomerLimit}. Vendor currently has ${currentCustomerCount} customers.`,
                currentCustomerCount,
                proposedNewLimit: newCustomerLimit,
                minimumAllowed: currentCustomerCount
            });
        }

        // Calculate the difference
        const difference = newCustomerLimit - vendor.customerLimit;
        const previousLimit = vendor.customerLimit;
        
        // Update vendor's customer limit
        vendor.customerLimit = newCustomerLimit;
        
        // Record the change
        vendor.completedUpgrades.push({
            additionalCustomers: difference,
            amount: 0,
            approvedAt: new Date(),
            approvedBy: req.user._id,
            status: 'completed',
            reason: reason || `Admin set customer limit to ${newCustomerLimit}`,
            type: difference >= 0 ? 'admin_set_increase' : 'admin_set_decrease'
        });

        // Update last modified info
        vendor.lastUpdatedBy = {
            user: req.user._id,
            at: new Date(),
            reason: reason || `Admin set customer limit from ${previousLimit} to ${newCustomerLimit}`
        };

        await vendor.save();

        return res.status(200).json({
            success: true,
            message: `Successfully set customer limit for ${vendor.username} to ${newCustomerLimit}`,
            data: {
                vendorId: vendor._id,
                vendorName: vendor.username,
                previousCustomerLimit: previousLimit,
                newCustomerLimit: vendor.customerLimit,
                difference: difference,
                currentCustomerCount,
                action: difference >= 0 ? 'increased' : 'decreased',
                setAt: new Date()
            }
        });

    } catch (error) {
        console.error('Set customer limit error:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Failed to set customer limit for vendor',
            error: error.message 
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
    disableDisco,
    enableDisco,
    getActiveDiscos,
    getTokenRequestCount,
    getPendingVendorCount,
    getPendingCustomerVerificationCount,
    updateVerifiedCustomer,
    deleteCustomer,
    editVendor,
    deleteVendor,
    deactivateVendor,
    editDiscoPricing,
    deleteDiscoPricing,
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
    CompleteUpgrade,
    rejectUpgrade,
    toggleVendorCustomerAddition,
    getVendorAdditionStatus,
    // NEW ADMIN MANAGEMENT FUNCTIONS
    getAdmins,
    getAdminById,
    updateAdmin,
    toggleAdminStatus,
    deleteAdmin,
    getAdminProfile,
    updateAdminPermissions,
    registerAdminWithPermissions,
    addCustomerSpaceToVendor,
    reduceCustomerSpaceFromVendor,
    setCustomerLimitForVendor


     };