/**
 * MySQL Database Configuration
 * Alternative to MSSQL configuration for MySQL databases
 */

const mysql = require('mysql2/promise');

// MySQL Configuration
const USER = process.env.DB_USER || 'root';
const PWD = process.env.DB_PASSWORD || '';
const DATABASE = process.env.DB_NAME || 'DJTDB'; 
const DB_HOST_NAME = process.env.DB_HOST || 'localhost';
const PORT = parseInt(process.env.DB_PORT) || 3306;
const MAX_POOL_SIZE = parseInt(process.env.DB_MAX_POOL) || 200;

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
    keepAliveInitialDelay: 0
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
    MSSQLConPool: MySQLConPool, // Alias for compatibility
    pool: pool,
    config: config,
    connect: async () => {
        try {
            // Test connection
            const connection = await pool.getConnection();
            await connection.ping();
            connection.release();
            console.log('✅ MySQL Database connected successfully');
            return pool;
        } catch (err) {
            console.error('❌ Error connecting to MySQL database:', err);
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
