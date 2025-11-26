/**
 * OTP Model
 * Handles OTP storage and operations (currently in-memory, ready for database integration)
 */

// In-memory storage (replace with database in production)
const otpStore = new Map();

/**
 * OTP Model Methods
 */
module.exports = {
  /**
   * Create new OTP
   */
  create: (otpData) => {
    const otpRecord = {
      otpID: otpData.otpID,
      otp: otpData.otp,
      phonenumber: otpData.phonenumber,
      usr_id: otpData.usr_id,
      expiresAt: otpData.expiresAt,
      attempts: 0,
      created_at: new Date().toISOString()
    };

    otpStore.set(otpData.otpID, otpRecord);
    return otpRecord;
  },

  /**
   * Find OTP by ID
   */
  findById: (otpID) => {
    return otpStore.get(otpID);
  },

  /**
   * Update OTP attempts
   */
  incrementAttempts: (otpID) => {
    const otpRecord = otpStore.get(otpID);
    if (!otpRecord) return null;

    otpRecord.attempts += 1;
    otpRecord.updated_at = new Date().toISOString();
    
    otpStore.set(otpID, otpRecord);
    return otpRecord;
  },

  /**
   * Delete OTP
   */
  delete: (otpID) => {
    return otpStore.delete(otpID);
  },

  /**
   * Find OTP by mobile number
   */
  findByMobile: (phonenumber) => {
    for (let [key, otp] of otpStore.entries()) {
      if (otp.phonenumber === phonenumber) {
        return otp;
      }
    }
    return null;
  },

  /**
   * Check if OTP is expired
   */
  isExpired: (otpRecord) => {
    return Date.now() > otpRecord.expiresAt;
  },

  /**
   * Check if max attempts reached
   */
  maxAttemptsReached: (otpRecord, maxAttempts = 3) => {
    return otpRecord.attempts >= maxAttempts;
  },

  /**
   * Delete expired OTPs (cleanup)
   */
  deleteExpired: () => {
    let deletedCount = 0;
    for (let [key, otp] of otpStore.entries()) {
      if (Date.now() > otp.expiresAt) {
        otpStore.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  },

  /**
   * Get all OTPs (for admin/debugging)
   */
  findAll: () => {
    return Array.from(otpStore.values());
  },

  /**
   * Count total OTPs
   */
  count: () => {
    return otpStore.size;
  },

  /**
   * Clear all OTPs (for testing/reset)
   */
  clear: () => {
    otpStore.clear();
    return true;
  }
};
