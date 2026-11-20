/**
 * MySQL Database Configuration
 *
 * Kept for backwards compatibility with db.config.auto.js. There is ONE source
 * of truth for the connection (config/db.config.js, which reads .env and has no
 * built-in defaults), so this simply re-exports it instead of opening a second
 * pool with its own fallback credentials.
 */

module.exports = require('./db.config');
