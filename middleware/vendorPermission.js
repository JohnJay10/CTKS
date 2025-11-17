const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');

const checkVendorCustomerAddition = async (req, res, next) => {
    try {
        const vendor = await Vendor.findById(req.user._id);
        
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        if (!vendor.canAddCustomers) {
            return res.status(403).json({ 
                message: 'Your account is currently restricted from adding new customers. Please contact support.',
                restriction: {
                    active: true,
                    since: vendor.lastUpdatedBy?.at,
                    reason: vendor.lastUpdatedBy?.reason || 'Administrative restriction'
                }
            });
        }

        // Also check if they've reached their customer limit
        const canAdd = await vendor.canAddCustomer();
        if (!canAdd) {
            const customerCount = await mongoose.model('Customer').countDocuments({ vendorId: vendor._id });
            const limit = vendor.getEffectiveCustomerLimit();
            
            return res.status(403).json({
                message: `You've reached your customer limit (${customerCount}/${limit}). Please upgrade your account.`,
                limitReached: true,
                currentCount: customerCount,
                limit: limit
            });
        }

        next();
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {
    checkVendorCustomerAddition
};