var express = require('express');
var router = express.Router();
var std = require(appRoot + '/utils/standardMessages');

/**
 * Main API Routes
 * Structure inspired by APTIS server architecture
 */

// Health check
router.get('/health', (req, res) => {
  res.status(std.message["SUCCESS"].code).json({
    status: std.message["SUCCESS"].code,
    message: 'Server is running',
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// Session info (for testing)
router.get('/session-info', (req, res) => {
  res.send('---Phone Auth API Running---');
});

// Authentication routes
router.use('/auth', require('./auth/authAppRtr'));

// Wallet routes
router.use('/wallet', require('./wallet/walletRtr'));

// Charging station routes
router.use('/stations', require('./stations/stationRtr'));

// Charging session routes
router.use('/sessions', require('./sessions/sessionRtr'));

// Dashboard routes
router.use('/dashboard', require('./dashboard/dashboardRtr'));

// Catch-all for invalid routes
router.all('**', (req, res) => {
  res.status(std.message["INVALID_ROUTE"].code).json({
    status: std.message["INVALID_ROUTE"].code,
    message: std.message["INVALID_ROUTE"].message,
    data: null,
    errors: []
  });
});

module.exports = router;
