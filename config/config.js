/**
 * Server Configuration
 * Environment-based configuration settings
 */

// Load .env here too so standalone scripts/tests get the same values as server.js.
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

// No built-in fallback secret: a publicly known default would let anyone forge
// login tokens. Refuse to start instead.
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is missing in .env. Copy .env.example to .env and set it.');
}

module.exports = {
  // Server settings
  port: process.env.PORT || 5000,
  environment: process.env.NODE_ENV || 'development',

  // JWT settings
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '7d'
  },
  
  // OTP settings
  otp: {
    length: 4,
    expiryMinutes: 5,
    maxAttempts: 3
  },

  // QR signing (machine QR codes — app-only, HMAC-signed).
  // IMPORTANT: every QR sticker already printed was signed with this value.
  // Changing it invalidates all of them. It is QR_SECRET when set, otherwise
  // JWT_SECRET — so set QR_SECRET to the CURRENT JWT_SECRET before ever
  // rotating JWT_SECRET, and never change QR_SECRET afterwards.
  qr: {
    secret: process.env.QR_SECRET || process.env.JWT_SECRET
  },

  // OCPP settings
  ocpp: {
    // Public base a charge point uses to reach the OCPP WebSocket server.
    // Full URL becomes: <wsBaseUrl>/ocpp/<chargePointId>
    // Override with OCPP_WS_BASE_URL (e.g. ws://203.0.113.10:8080 or wss://ocpp.djthaika.com)
    wsBaseUrl: process.env.OCPP_WS_BASE_URL || `ws://localhost:${process.env.PORT || 5000}`,
    // Real command-and-control: when true, "Start" sends RequestStartTransaction
    // to the charger and requires an Accepted reply (else the hold is refunded),
    // and "Stop" sends RequestStopTransaction. Set OCPP_REMOTE_CONTROL=false to
    // fall back to DB-only sessions (for chargers that don't support remote start).
    remoteControl: process.env.OCPP_REMOTE_CONTROL !== 'false'
  }
};
