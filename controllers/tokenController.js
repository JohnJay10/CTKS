
const Token = require('../models/Token');
const Vendor = require('../models/Vendor');
const Customer = require('../models/Customer');
const DiscoPricing = require('../models/DiscoPricing');
const TokenRequest = require('../models/TokenRequest');
const { sendTokenNotification } = require('../services/notificationService');

const issueTokenToVendor = async (req, res) => {
    const { vendorId, meterNumber, units } = req.body;
    const adminId = req.user._id; // Admin approving the request

    try {
        // 1. Validate input
        if (!vendorId || !meterNumber || !units) {
            return res.status(400).json({
                message: 'Vendor ID, meter number, and units are required',
                requiredFields: ['vendorId', 'meterNumber', 'units']
            });
        }

        // 2. Verify vendor exists and is approved
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }
        if (!vendor.approved) {
            return res.status(403).json({ message: 'Vendor account not approved' });
        }

        // 3. Verify customer exists and is verified
        const customer = await Customer.findOne({ meterNumber, vendorId });
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found for this vendor' });
        }
        if (!customer.verification.isVerified) {
            return res.status(403).json({ message: 'Customer not verified' });
        }

        // 4. Get disco pricing
        const discoPricing = await DiscoPricing.findOne({ discoName: customer.disco });
        if (!discoPricing) {
            return res.status(400).json({ message: 'Disco pricing not configured' });
        }

        // 5. Calculate amount and generate token
        const amount = units * discoPricing.pricePerUnit;
        const tokenValue = generateElectricityToken(); // Custom function

        // 6. Create token record
        const token = new Token({
            tokenId: uuidv4(),
            tokenValue,
            meterNumber,
            units,
            amount,
            disco: customer.disco,
            vendorId,
            issuedBy: adminId,
            status: 'issued',
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        });

        await token.save();

        // 7. Update vendor's token balance (optional)
        vendor.tokenBalance += units;
        await vendor.save();

        // 8. Send notification
        await sendTokenNotification(vendor.email, {
            tokenId: token.tokenId,
            meterNumber,
            units,
            amount,
            tokenValue,
            expiryDate: token.expiryDate
        });

        // 9. Return response
        res.status(201).json({
            message: 'Token issued successfully',
            token: {
                id: token._id,
                tokenId: token.tokenId,
                units,
                amount,
                disco: token.disco,
                issuedAt: token.createdAt,
                expiryDate: token.expiryDate
                // Note: Don't return actual tokenValue in response
            }
        });

    } catch (error) {
        console.error('Token issuance error:', error);
        res.status(500).json({
            message: 'Failed to issue token',
            error: error.message
        });
    }
};


//Fetch Tokens 

const fetchTokens = async (req, res) => {
    try {
        // 1. Find all tokens
        const tokens = await Token.find();
        // 2. Return response
        res.status(200).json(tokens);
        } catch (error) {
            console.error('Error fetching tokens:', error);
            res.status(500).json({
                message: 'Failed to fetch tokens',
                error: error.message
            });
            } 
            };


// Helper function to generate electricity token
function generateElectricityToken() {
    // Implement your token generation algorithm here
    // Example: 20-digit STS compliant token
    const randomPart = Math.floor(100000000000 + Math.random() * 900000000000);
    return `${randomPart}${Date.now().toString().slice(-8)}`.slice(0, 20);
}




module.exports = { 
    issueTokenToVendor,
    fetchTokens
  

 };