// migration/add-permissions.js
const mongoose = require('mongoose');
require('dotenv').config();

const migratePermissions = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Update all admins with new permissions
    const result = await mongoose.connection.collection('admins').updateMany(
      {},
      {
        $set: {
          "permissions.accountManagement": false,
          "permissions.vendorSpace": false,
          "permissions.vendorCustomer": false,
          "permissions.viewAnalytics": false,
          "permissions.systemSettings": false
        }
      }
    );

    console.log(`Updated ${result.modifiedCount} admin documents`);

    // Update super admin to have all permissions
    const superAdminResult = await mongoose.connection.collection('admins').updateMany(
      { "role": "super_admin" },
      {
        $set: {
          "permissions.accountManagement": true,
          "permissions.vendorSpace": true,
          "permissions.vendorCustomer": true,
          "permissions.viewAnalytics": true,
          "permissions.systemSettings": true
        }
      }
    );

    console.log(`Updated ${superAdminResult.modifiedCount} super admin documents`);
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migratePermissions();