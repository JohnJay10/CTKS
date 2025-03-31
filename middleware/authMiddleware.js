const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Vendor = require('../models/Vendor');

const auth = (roles = []) => {
    return async (req, res, next) => {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        try {
            // 1. Verify JWT
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 2. Check role permissions
            if (roles.length && !roles.includes(decoded.role)) {
                return res.status(403).json({ message: 'Unauthorized for this action' });
            }

            // 3. Fetch full user document based on role
            let user;
            if (decoded.role === 'admin') {
                user = await Admin.findById(decoded.id).select('-password');
            } else if (decoded.role === 'vendor') {
                user = await Vendor.findById(decoded.id).select('-password');
            }

            if (!user) {
                return res.status(401).json({ message: 'User not found' });
            }

            // 4. Attach full user object to request
            req.user = user;
            next();

        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired' });
            } else if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ message: 'Invalid token' });
            }
            console.error('Authentication error:', error);
            return res.status(500).json({ message: 'Authentication failed' });
        }
    };
};

module.exports = auth;