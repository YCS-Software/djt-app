/**
 * Auto Database Configuration
 * Automatically selects MySQL or MSSQL based on DB_PORT in .env
 */

const dbPort = parseInt(process.env.DB_PORT) || 3306;

// Detect database type by port
const isMSSQL = dbPort === 1433;
const isMySQL = dbPort === 3306 || dbPort === 3307;

let dbConfig;

if (isMSSQL) {
    console.log('📊 Detected MSSQL database (port 1433)');
    dbConfig = require('./db.config');
} else if (isMySQL) {
    console.log('📊 Detected MySQL database (port 3306)');
    dbConfig = require('./db.config.mysql');
} else {
    console.warn('⚠️  Unknown database port:', dbPort);
    console.warn('Defaulting to MySQL configuration');
    dbConfig = require('./db.config.mysql');
}

module.exports = dbConfig;
