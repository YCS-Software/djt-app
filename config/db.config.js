/**
 * MySQL Database Configuration
 * For EV Charging Station Application
 */

const path = require('path');
const mysql = require('mysql2/promise');

// Connection details come ONLY from the environment (.env at the project root).
// Nothing sensitive is hardcoded here. Loading dotenv again is harmless when
// server.js has already done it, and makes standalone scripts/tests work too.
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const REQUIRED_ENV = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length) {
    throw new Error(
        `Database configuration missing in .env: ${missingEnv.join(', ')}. ` +
        'Copy .env.example to .env and fill in the values.'
    );
}

// MySQL Configuration
const USER = process.env.DB_USER;
const PWD = process.env.DB_PASSWORD;
const DATABASE = process.env.DB_NAME;
const DB_HOST_NAME = process.env.DB_HOST;
const PORT = parseInt(process.env.DB_PORT, 10) || 3306;
const MAX_POOL_SIZE = parseInt(process.env.DB_MAX_POOL, 10) || 200;

// MySQL Pool Configuration
const config = {
    host: DB_HOST_NAME,
    user: USER,
    password: PWD,
    database: DATABASE,
    port: PORT,
    waitForConnections: true,
    connectionLimit: MAX_POOL_SIZE,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,        // Start keepalive after 10 seconds
    idleTimeout: 60000,                   // Close idle connections after 60 seconds
    connectTimeout: 20000,                // Connection timeout 20 seconds
    multipleStatements: true
};

// Create connection pool
const pool = mysql.createPool(config);

// Transient error codes that should trigger a retry
const TRANSIENT_ERRORS = ['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'ECONNREFUSED'];

// MySQL Connection Pool Interface
const MySQLConPool = {
    query: async function(sql_query, values, retries = 2) {
        try {
            const [rows] = await pool.execute(sql_query, values);
            return rows;
        } catch (err) {
            // Retry on transient connection errors
            if (retries > 0 && TRANSIENT_ERRORS.includes(err.code)) {
                console.warn(`[DB] Transient error (${err.code}), retrying... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay before retry
                return this.query(sql_query, values, retries - 1);
            }
            console.error('Error executing query:', err);
            console.error('Query:', sql_query.substring(0, 200));
            throw { err_status: 700, err_message: err.message };
        }
    },
    
    getPool: function() {
        return pool;
    },
    
    escape: function(value) {
        if (typeof value === 'string') {
            return "'" + value.replace(/'/g, "''") + "'";
        }
        if (value === null || value === undefined) {
            return 'NULL';
        }
        return value;
    },
    
    // Get a connection from pool
    getConnection: async function() {
        try {
            return await pool.getConnection();
        } catch (err) {
            console.error('Error getting connection:', err);
            throw { err_status: 700, err_message: err.message };
        }
    }
};

// Export
module.exports = {
    MySQLConPool: MySQLConPool,
    MSSQLConPool: MySQLConPool, // Alias for compatibility with old code
    pool: pool,
    config: config,
    connect: async (retries = 5, delayMs = 3000) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                // Test connection
                const connection = await pool.getConnection();
                await connection.ping();
                connection.release();
                console.log('✅ MySQL Database connected successfully');
                console.log(`   Host: ${DB_HOST_NAME}:${PORT}`);
                console.log(`   Database: ${DATABASE}`);
                return pool;
            } catch (err) {
                const transient = TRANSIENT_ERRORS.includes(err.code);
                console.error(`❌ Error connecting to MySQL database (attempt ${attempt}/${retries}):`, err.code || err.message);
                console.error(`   Host: ${DB_HOST_NAME}:${PORT}`);
                console.error(`   Database: ${DATABASE}`);
                // Retry only on transient connectivity errors with attempts remaining
                if (transient && attempt < retries) {
                    console.warn(`   Transient error — retrying in ${delayMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    continue;
                }
                throw err;
            }
        }
    },
    close: async () => {
        try {
            await pool.end();
            console.log('MySQL Database connection closed');
        } catch (err) {
            console.error('Error closing MySQL database connection:', err);
            throw err;
        }
    }
};
