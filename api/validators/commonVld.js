/**
 * Common Validators
 * Reusable validation functions for request parameters
 */

const std = require(appRoot + '/utils/standardMessages');

module.exports = {
  /**
   * Validate mobile number
   */
  validateMobile: (mobile) => {
    if (!mobile) {
      return { valid: false, message: 'Mobile number is required' };
    }
    
    if (typeof mobile !== 'string' || mobile.length !== 10) {
      return { valid: false, message: 'Mobile number must be 10 digits' };
    }
    
    if (!/^\d{10}$/.test(mobile)) {
      return { valid: false, message: 'Mobile number must contain only digits' };
    }
    
    return { valid: true };
  },

  /**
   * Validate OTP
   */
  validateOTP: (otp) => {
    if (!otp) {
      return { valid: false, message: 'OTP is required' };
    }
    
    if (typeof otp !== 'string' || otp.length !== 4) {
      return { valid: false, message: 'OTP must be 4 digits' };
    }
    
    if (!/^\d{4}$/.test(otp)) {
      return { valid: false, message: 'OTP must contain only digits' };
    }
    
    return { valid: true };
  },

  /**
   * Validate email
   */
  validateEmail: (email) => {
    if (!email) {
      return { valid: false, message: 'Email is required' };
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, message: 'Invalid email format' };
    }
    
    return { valid: true };
  },

  /**
   * Sanitize input string
   */
  sanitizeString: (str) => {
    if (typeof str !== 'string') return '';
    return str.trim().replace(/[<>]/g, '');
  },

  /**
   * Validate required fields
   */
  validateRequiredFields: (data, fields) => {
    const missing = [];
    
    fields.forEach(field => {
      if (!data[field] || data[field] === '') {
        missing.push(field);
      }
    });
    
    if (missing.length > 0) {
      return {
        valid: false,
        message: `Missing required fields: ${missing.join(', ')}`
      };
    }
    
    return { valid: true };
  }
};
