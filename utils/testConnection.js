/**
 * Database Connection Test Utility
 * Tests the database connection and displays connection info
 */

require('dotenv').config();
const path = require('path');

// Set global appRoot
global.appRoot = path.resolve(__dirname, '..');

const sqldb = require(appRoot + '/config/db.config.auto');
const models = require(appRoot + '/models');

async function testConnection() {
    console.log('\n🔍 Testing Database Connection...\n');
    console.log('Configuration:');
    console.log('  Host:', process.env.DB_HOST);
    console.log('  Port:', process.env.DB_PORT);
    console.log('  Database:', process.env.DB_NAME);
    console.log('  User:', process.env.DB_USER);
    console.log('  Pool Size:', `${process.env.DB_MIN_POOL}-${process.env.DB_MAX_POOL}`);
    console.log('\n' + '='.repeat(50));

    try {
        // Test connection
        console.log('\n📡 Attempting to connect...');
        const pool = await sqldb.connect();
        console.log('✅ Connection successful!');

        // Test query (compatible with both MySQL and MSSQL)
        console.log('\n🔍 Testing basic query...');
        const dbPort = parseInt(process.env.DB_PORT);
        const isMSSQL = dbPort === 1433;
        const testQuery = isMSSQL 
            ? 'SELECT @@VERSION as version, DB_NAME() as database_name, GETDATE() as current_time'
            : 'SELECT VERSION() as version, DATABASE() as database_name, NOW() as current_datetime';
        const result = await sqldb.MSSQLConPool.query(testQuery);
        
        if (result && result.length > 0) {
            console.log('✅ Query successful!');
            console.log('\nDatabase Info:');
            console.log('  Database:', result[0].database_name);
            console.log('  Current Time:', result[0].current_datetime || result[0].current_time);
            console.log('  Version:', (result[0].version || '').split('\n')[0]);
        }

        // Test table access
        console.log('\n🔍 Checking table access...');
        const tableQuery = `
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        `;
        const tables = await sqldb.MSSQLConPool.query(tableQuery);
        
        if (tables && tables.length > 0) {
            console.log(`✅ Found ${tables.length} tables in database`);
            console.log('\nFirst 10 tables:');
            tables.slice(0, 10).forEach((table, index) => {
                console.log(`  ${index + 1}. ${table.TABLE_NAME}`);
            });
            if (tables.length > 10) {
                console.log(`  ... and ${tables.length - 10} more`);
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log('✅ All tests passed successfully!\n');

        // Close connection
        await sqldb.close();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Connection test failed!');
        console.error('Error:', error.message || error);
        if (error.code) {
            console.error('Error Code:', error.code);
        }
        console.log('\n' + '='.repeat(50));
        console.log('❌ Test failed!\n');
        process.exit(1);
    }
}

// Run test if this file is executed directly
if (require.main === module) {
    testConnection();
}

module.exports = testConnection;
