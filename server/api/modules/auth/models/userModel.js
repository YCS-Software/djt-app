/**
 * User Model
 * Handles user data operations (currently in-memory, ready for database integration)
 */

// In-memory storage (replace with database in production)
const userStore = new Map();

// Initialize test users
const initializeUsers = () => {
  userStore.set('9666476298', {
    usr_id: 'user_001',
    mobile: '9666476298',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'user',
    created_at: new Date().toISOString()
  });
  
  userStore.set('8500382863', {
    usr_id: 'user_002',
    mobile: '8500382863',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'user',
    created_at: new Date().toISOString()
  });
};

// Initialize users
initializeUsers();

/**
 * User Model Methods
 */
module.exports = {
  /**
   * Find user by mobile number
   */
  findByMobile: (mobile) => {
    return userStore.get(mobile);
  },

  /**
   * Find user by user ID
   */
  findById: (usr_id) => {
    for (let [key, user] of userStore.entries()) {
      if (user.usr_id === usr_id) {
        return user;
      }
    }
    return null;
  },

  /**
   * Create new user
   */
  create: (userData) => {
    const user = {
      usr_id: `user_${Date.now()}`,
      mobile: userData.mobile,
      name: userData.name,
      email: userData.email,
      role: userData.role || 'user',
      created_at: new Date().toISOString()
    };
    
    userStore.set(userData.mobile, user);
    return user;
  },

  /**
   * Update user
   */
  update: (mobile, updateData) => {
    const user = userStore.get(mobile);
    if (!user) return null;

    const updatedUser = {
      ...user,
      ...updateData,
      updated_at: new Date().toISOString()
    };

    userStore.set(mobile, updatedUser);
    return updatedUser;
  },

  /**
   * Delete user
   */
  delete: (mobile) => {
    return userStore.delete(mobile);
  },

  /**
   * Get all users
   */
  findAll: () => {
    return Array.from(userStore.values());
  },

  /**
   * Check if user exists
   */
  exists: (mobile) => {
    return userStore.has(mobile);
  },

  /**
   * Count total users
   */
  count: () => {
    return userStore.size;
  }
};
