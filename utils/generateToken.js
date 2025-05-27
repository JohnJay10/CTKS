const jwt = require('jsonwebtoken');
require('dotenv').config();

const generateToken = (userId, role) => {
    // Validate inputs
    if (!userId || !role) {
        throw new Error('Missing required arguments for token generation');
    }

    // Verify JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in environment variables');
    }

    return jwt.sign(
        {
            id: userId.toString(), // Ensure ID is string
            role: role.toLowerCase() // Normalize role case
        },
        process.env.JWT_SECRET,
        { expiresIn: '30d' } // Token expiration
    );
};

module.exports = generateToken;   