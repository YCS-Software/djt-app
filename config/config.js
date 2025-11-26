/**
 * Server Configuration
 * Environment-based configuration settings
 */

module.exports = {
  // Server settings
  port: process.env.PORT || 5000,
  environment: process.env.NODE_ENV || 'development',
  
  // JWT settings
  jwt: {
    secret: process.env.JWT_SECRET || 'your_jwt_secret_key',
    expiresIn: '7d'
  },
  
  // OTP settings
  otp: {
    length: 4,
    expiryMinutes: 5,
    maxAttempts: 3
  },
  
  // CORS settings
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  },
  
  // Database settings (for future use)
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'phone_auth_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || ''
  },
  
  // SMS Gateway settings (for future integration)
  sms: {
    provider: process.env.SMS_PROVIDER || 'mock',
    apiKey: process.env.SMS_API_KEY || '',
    senderId: process.env.SMS_SENDER_ID || 'PHAUTH'
  }
};
