const jwt = require('jsonwebtoken');
const std = require(appRoot + '/utils/standardMessages');

/**
 * Access Control Middleware
 * Validates JWT token and checks user permissions
 */

module.exports = {
  /**
   * Verify JWT Token
   */
  verifyToken: (req, res, next) => {
    try {
      const token = req.headers['x-access-token'] || 
                   req.headers['authorization']?.split(' ')[1];

      if (!token) {
        return res.status(std.message["UNAUTHORIZED"].code).json({
          status: std.message["UNAUTHORIZED"].code,
          message: 'No token provided',
          data: null
        });
      }

      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          return res.status(std.message["UNAUTHORIZED"].code).json({
            status: std.message["UNAUTHORIZED"].code,
            message: 'Invalid or expired token',
            data: null
          });
        }
        req.user = decoded;
        next();
      });

    } catch (error) {
      console.error('Error verifying token:', error);
      res.status(std.message["INTERNAL_ERROR"].code).json({
        status: std.message["INTERNAL_ERROR"].code,
        message: 'Failed to authenticate token',
        data: null
      });
    }
  },

  /**
   * Check if user has admin role
   */
  isAdmin: (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
      next();
    } else {
      return res.status(std.message["FORBIDDEN"].code).json({
        status: std.message["FORBIDDEN"].code,
        message: 'Admin access required',
        data: null
      });
    }
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: (req, res, next) => {
    if (req.user) {
      next();
    } else {
      return res.status(std.message["UNAUTHORIZED"].code).json({
        status: std.message["UNAUTHORIZED"].code,
        message: 'Authentication required',
        data: null
      });
    }
  }
};
