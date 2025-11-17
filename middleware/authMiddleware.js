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
            console.log('  - Decoded token ID:', decoded.id);

            // Check role permissions
            if (roles.length && !roles.includes(decoded.role)) {
                console.log(`❌ Role ${decoded.role} not in required roles: ${roles}`);
                return res.status(403).json({ message: 'Unauthorized for this action' });
            }

            let user;

            // Fetch user based on role
            if (decoded.role === 'vendor') {
                console.log('🔍 Looking for VENDOR...');
                user = await Vendor.findById(decoded.id).select('-password');
                console.log('  - Vendor found:', user ? 'YES' : 'NO');
                
                if (user) {
                    console.log('  - Vendor approved:', user.approved);
                    console.log('  - Vendor active:', user.active);
                    
                    // Check if vendor is approved and active
                    if (!user.approved || !user.active) {
                        console.log('❌ Vendor not approved or inactive');
                        return res.status(401).json({ 
                            message: 'Vendor account not approved or inactive' 
                        });
                    }
                }
            } else if (decoded.role === 'admin' || decoded.role === 'super_admin') {
                console.log('🔍 Looking for ADMIN...');
                user = await Admin.findById(decoded.id).select('-password');
                console.log('  - Admin found:', user ? 'YES' : 'NO');
                
                if (user) {
                    console.log('  - Admin active:', user.active);
                    
                    if (!user.active) {
                        console.log('❌ Admin inactive');
                        return res.status(401).json({ 
                            message: 'Admin account inactive' 
                        });
                    }
                }
            }

            if (!user) {
                console.log('❌ User not found for role:', decoded.role);
                return res.status(401).json({ message: 'User not found' });
            }

            console.log('✅ Auth successful - User:', user.username || user.email);
            req.user = user;
            
            // Set role-specific properties for backward compatibility
            if (decoded.role === 'vendor') {
                req.vendor = user;
            } else if (decoded.role === 'admin' || decoded.role === 'super_admin') {
                req.admin = user;
            }
            
            next();

        } catch (error) {
            console.error('💥 Auth error:', error.message);
            return res.status(401).json({ message: 'Token invalid' });
        }
    };
};

module.exports = auth;