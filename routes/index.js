const express = require('express');
const router = express.Router();

// Define the routes
const adminRoutes = require('./adminRoutes');
const vendorRoutes = require('./vendorRoutes');
const tokenRoutes = require('./tokenRoutes');

// Use the routes
router.use('/admin', adminRoutes);
router.use('/vendor', vendorRoutes);
router.use('/tokens', tokenRoutes);

/**
 * Sets up the routes for the application.
 * 
 * @param {Express} app - The Express application instance.
 */
module.exports = {
  setRoutes: (app) => {
    app.use('/api', router);
    console.info('Routes set successfully.');
  },
  getRouter: () => router
}