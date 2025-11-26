/**
 * Date Format Utility
 * Response formatting utilities based on dflower.utils.js pattern
 */

const std = require(appRoot + '/utils/standardMessages');

/**
 * Format Success Response
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Object} data - Response data
 * @param {String} cntxtDtls - Context details (controller name)
 * @param {String} fnm - Function name
 * @param {Object} options - Additional options
 * @returns {Object} - Formatted response
 */
exports.formatSucessRes = function(req, res, data, cntxtDtls, fnm, options) {
    const response = {
        status: std.message["SUCCESS"].code || 200,
        message: options.message || 'Success',
        data: data
    };
    
    console.log(`[${cntxtDtls}] ${fnm} - Success`);
    return res.status(response.status).json(response);
};

/**
 * Format Error Response
 * @param {Object} res - Response object
 * @param {Object} error - Error object
 * @param {String} cntxtDtls - Context details (controller name)
 * @param {String} fnm - Function name
 * @param {Object} options - Additional options
 * @returns {Object} - Formatted error response
 */
exports.formatErrorRes = function(res, error, cntxtDtls, fnm, options) {
    console.error(`[${cntxtDtls}] ${fnm} - Error:`, error);
    
    const errorStatus = error.err_status || error.status || std.message["INTERNAL_ERROR"].code || 500;
    const errorMessage = error.err_message || error.message || 'Internal Server Error';
    
    const response = {
        status: errorStatus,
        message: errorMessage,
        data: null
    };
    
    // Include error details in development
    if (process.env.NODE_ENV === 'development' && error.stack) {
        response.error = error.stack;
    }
    
    return res.status(errorStatus).json(response);
};

/**
 * Format date to MySQL datetime format
 * @param {Date} date - Date object
 * @returns {String} - Formatted date string
 */
exports.formatMySQLDate = function(date) {
    if (!date) return null;
    const d = new Date(date);
    return d.toISOString().slice(0, 19).replace('T', ' ');
};

/**
 * Format date to display format
 * @param {Date} date - Date object
 * @returns {String} - Formatted date string
 */
exports.formatDisplayDate = function(date) {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

/**
 * Get current timestamp for MySQL
 * @returns {String} - Current timestamp
 */
exports.getCurrentTimestamp = function() {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
};

/**
 * Parse date from various formats
 * @param {String|Date} dateInput - Date input
 * @returns {Date} - Parsed date object
 */
exports.parseDate = function(dateInput) {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return dateInput;
    return new Date(dateInput);
};

/**
 * Add days to date
 * @param {Date} date - Base date
 * @param {Number} days - Number of days to add
 * @returns {Date} - New date
 */
exports.addDays = function(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

/**
 * Add minutes to date
 * @param {Date} date - Base date
 * @param {Number} minutes - Number of minutes to add
 * @returns {Date} - New date
 */
exports.addMinutes = function(date, minutes) {
    const result = new Date(date);
    result.setMinutes(result.getMinutes() + minutes);
    return result;
};

/**
 * Check if date is expired
 * @param {Date|String} expiryDate - Expiry date
 * @returns {Boolean} - True if expired
 */
exports.isExpired = function(expiryDate) {
    if (!expiryDate) return true;
    return new Date(expiryDate) < new Date();
};

/**
 * Get date difference in days
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {Number} - Difference in days
 */
exports.getDaysDifference = function(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Format duration in minutes to readable format
 * @param {Number} minutes - Duration in minutes
 * @returns {String} - Formatted duration
 */
exports.formatDuration = function(minutes) {
    if (minutes < 60) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
};

/**
 * Validate date format
 * @param {String} dateString - Date string to validate
 * @returns {Boolean} - True if valid
 */
exports.isValidDate = function(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
};
