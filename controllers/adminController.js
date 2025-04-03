const Admin = require('../models/Admin');
const Vendor = require('../models/Vendor');
const Customer = require('../models/Customer');
const DiscoPricing = require('../models/DiscoPricing');
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
        const requiredFields = { KRN, SGC, TI, MSN };
        const missingFields = Object.entries(requiredFields)
            .filter(([_, value]) => !value)
            .map(([key]) => key);

        if (missingFields.length > 0) {
            return res.status(400).json({
                message: 'Missing required verification fields',
                missingFields,
                requiredFields: ['KRN', 'SGC', 'TI', 'MSN'] 
            });
        }

        // 4. Update verification
        customer.verification = {
            ...customer.verification, // Preserve existing data
            KRN,
            SGC,
            TI,
            MSN,
            MTK1: MTK1 || customer.verification.MTK1,
            MTK2: MTK2 || customer.verification.MTK2,
            RTK1: RTK1 || customer.verification.RTK1,
            RTK2: RTK2 || customer.verification.RTK2,
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


const  getPendingVendorCount = async (req, res) => {
    try {
        const pendingVendors = await Vendor.countDocuments({ approved: false });
        return res.status(200).json({ count: pendingVendors });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const  getCustomerVerificationCount = async (req, res) => {
    try {
        const pendingCustomers = await Customer.countDocuments({ verification: { $ne: { isVerified: true } } });
        return res.status(200).json({ count: pendingCustomers });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getTokenRequestCount = async (req, res) => {
    try {
        const tokenRequests = await TokenRequest.countDocuments();
        return res.status(200).json({ count: tokenRequests });
    } catch (error) {
        return res.status(500).json({ message: error.message });
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
    getCustomerVerificationCount
     };