const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Vendor = require('../models/Vendor');

const auth = (roles = []) => {
    return async (req, res, next) => {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        console.log('🔐 BACKEND AUTH MIDDLEWARE ======================');
        console.log('  - Path:', req.path);
        console.log('  - Required roles:', roles);
        console.log('  - Token provided:', !!token);

        if (!token) {
            console.log('❌ No token provided');
            return res.status(401).json({ message: 'No token provided' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('  - Decoded token role:', decoded.role);

            // Check role permissions
            if (roles.length && !roles.includes(decoded.role)) {
                console.log(`❌ Role ${decoded.role} not in required roles: ${roles}`);
                return res.status(403).json({ message: 'Unauthorized for this action' });
            }

            // Fetch user
            const user = await Admin.findById(decoded.id).select('-password');
            console.log('  - User found:', user?.username);
            console.log('  - User role:', user?.role);
            console.log('  - User permissions:', user?.permissions);

            if (!user) {
                console.log('❌ User not found');
                return res.status(401).json({ message: 'User not found' });
            }

            console.log('✅ Auth successful');
            req.user = user;
            req.admin = user;
            next();

        } catch (error) {
            console.error('💥 Auth error:', error.message);
            return res.status(401).json({ message: 'Token invalid' });
        }
    };
};

module.exports = auth;