const jwt = require('jsonwebtoken');
require('dotenv').config();

const generateToken = (id, role) => {
  console.log('🎫 Generating token for:', { id, role });
  
  // Validate required arguments
  if (!id) {
    throw new Error('Missing user ID for token generation');
  }
  
  if (!role) {
    throw new Error('Missing role for token generation');
  }
  
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  try {
    const token = jwt.sign(
      { 
        id, 
        role 
      }, 
      process.env.JWT_SECRET, 
      {
        expiresIn: '30d',
      }
    );
    
    console.log('✅ Token generated successfully');
    return token;
    
  } catch (error) {
    console.error('❌ Token generation failed:', error.message);
    throw new Error('Failed to generate token: ' + error.message);
  }
};

module.exports = generateToken;   