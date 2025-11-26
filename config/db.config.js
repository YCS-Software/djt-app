/**
 * MySQL Database Configuration
 * For EV Charging Station Application
 */

const mysql = require('mysql2/promise');

// MySQL Configuration
const USER = "root";
const PWD = "YcsPass@2025";
const DATABASE = "DJTDB"; 
const DB_HOST_NAME = '13.202.34.243';
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
    keepAliveInitialDelay: 0,
    multipleStatements: true
};

// Create connection pool
const pool = mysql.createPool(config);

// MySQL Connection Pool Interface
const MySQLConPool = {
    query: async function(sql_query, values) {
        try {
            const [rows] = await pool.execute(sql_query, values);
            return rows;
        } catch (err) {
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
    connect: async () => {
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
            console.error('❌ Error connecting to MySQL database:', err);
            console.error(`   Host: ${DB_HOST_NAME}:${PORT}`);
            console.error(`   Database: ${DATABASE}`);
            throw err;
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
