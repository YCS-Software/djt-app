/**
 * MySQL Database Configuration
 * For EV Charging Station Application
 */

const mysql = require('mysql2/promise');

// MySQL Configuration
const USER = "root";
const PWD = "Djt@2026#";
const DATABASE = "DJT_POWERTECH_DEV"; 
const DB_HOST_NAME = '3.110.84.196';
const PORT = 3306;
const MAX_POOL_SIZE = 200;

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
    multipleStatements: true,
    // Interpret DB DATE/TIME values in this zone. MUST match the MySQL server's
    // time_zone (set default-time-zone='+05:30' on the server). IST by default.
    timezone: process.env.DB_TIMEZONE || '+05:30'
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
