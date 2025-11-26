/**
 * Database Utility Functions
 * Based on APTIS db.utils.js structure
 */

const sqldb = require(appRoot + '/config/db.config');
const sql = sqldb.sql;

/**
 * Execute a single SQL query
 * @param {Object} ConPool - Connection pool object
 * @param {String} Qry - SQL query string
 * @param {Function} callback - Optional callback function
 * @returns {Promise} - Promise resolving to query results
 */
const execQuery = function(ConPool, Qry, callback) {
    const queryType = Qry.trim().split(' ')[0].toUpperCase();
    
    if (callback && typeof callback === "function") {
        // Callback-based execution
        ConPool.query(Qry)
            .then(rows => {
                callback(false, rows);
            })
            .catch(err => {
                console.error(`[DB] Connection error (${queryType}):`, err);
                callback(true, null);
            });
    } else {
        // Promise-based execution
        return new Promise(function(resolve, reject) {
            // Check for DDL statements
            if (containsDDL(Qry)) {
                console.error('[DB] DDL Statement found in query. Rejecting for security reasons.');
                reject({ 
                    err_status: 600, 
                    err_message: 'DDL Statement not allowed' 
                });
                return;
            }
            
            try {
                const qry_str = removeExtraSpacesExceptWithinQuotes(Qry);
                const operation = getOperationFromSQL(qry_str);
                
                // Execute the query
                ConPool.query(Qry)
                    .then(rows => {
                        resolve(rows);
                    })
                    .catch(err => {
                        console.error('[DB] Query error:', err);
                        console.error('[DB] Failed query:', Qry.substring(0, 200));
                        reject({ 
                            err_status: 700, 
                            err_message: err.message || 'Database query error' 
                        });
                    });
            } catch (err) {
                console.error('[DB] Error processing query:', err);
                reject({ 
                    err_status: 700, 
                    err_message: 'Error processing query: ' + (err.message || err) 
                });
            }
        });
    }
};

/**
 * Check if query contains DDL statements
 * @param {String} sqlQuery - SQL query string
 * @returns {Boolean}
 */
const containsDDL = function(sqlQuery) {
    const ddlKeywords = ['CREATE', 'DROP', 'ALTER', 'TRUNCATE'];
    const regex = new RegExp('\\b(' + ddlKeywords.join('|') + ')\\b', 'ig');
    
    // Remove strings from the SQL query
    const cleanSqlQuery = sqlQuery.replace(/'(?:[^'\\]|\\.)*'/g, '');
    
    // Check if any DDL keywords are present after removing strings
    return regex.test(cleanSqlQuery);
};

/**
 * Extract table names from SQL query
 * @param {String} sql - SQL query string
 * @returns {Array} - Array of table names
 */
const extractTablesFromSQL = function(sql) {
    const tableNames = new Set();
    const tableRegex = /(?:FROM|JOIN|UPDATE|INTO)\s+([^\s]+)/ig;
    
    let match;
    while ((match = tableRegex.exec(sql)) !== null) {
        tableNames.add(match[1]);
    }
    
    return Array.from(tableNames);
};

/**
 * Get operation type from SQL query
 * @param {String} sqlQuery - SQL query string
 * @returns {String} - Operation type
 */
const getOperationFromSQL = function(sqlQuery) {
    const lowercaseQuery = sqlQuery.toLowerCase();
    
    if (lowercaseQuery.includes('insert into')) {
        return 'INSERT';
    } else if (lowercaseQuery.includes('update')) {
        return 'UPDATE';
    } else if (lowercaseQuery.includes('delete from')) {
        return 'DELETE';
    } else if (lowercaseQuery.includes('select ')) {
        return 'SELECT';
    } else if (lowercaseQuery.includes('create ') || lowercaseQuery.includes('alter ') || lowercaseQuery.includes('drop ')) {
        return 'DDL';
    } else if (lowercaseQuery.includes('truncate ')) {
        return 'TRUNCATE';
    } else {
        return 'UNKNOWN';
    }
};

/**
 * Remove extra spaces from query except within quotes
 * @param {String} str - SQL query string
 * @returns {String} - Cleaned SQL query
 */
const removeExtraSpacesExceptWithinQuotes = function(str) {
    let result = '';
    let inQuotes = false;
    let quoteChar = '';
    let prevChar = '';
    
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        
        if ((char === '"' || char === "'") && prevChar !== '\\') {
            if (!inQuotes) {
                inQuotes = true;
                quoteChar = char;
            } else if (char === quoteChar) {
                inQuotes = false;
                quoteChar = '';
            }
        }
        
        if (!inQuotes && char === ' ' && prevChar === ' ') {
            continue;
        }
        
        result += char;
        prevChar = char;
    }
    
    return result.trim();
};

/**
 * Execute multiple queries in a transaction
 * @param {Object} ConPool - Connection pool object
 * @param {Array} Qry - Array of SQL query strings
 * @param {Object} userDtls - User details object
 * @returns {Promise} - Promise resolving to array of query results
 */
const execTrnsctnQuery = function(ConPool, Qry, userDtls) {
    let qry_rslts = [];
    const len = Qry.length;
    
    if (len === 1) {
        // Single Query
        return new Promise((resolve, reject) => {
            execQuery(ConPool, Qry[0])
                .then(results => {
                    resolve([results]);
                })
                .catch(err => {
                    reject(err);
                });
        });
    } else {
        // Multiple queries in transaction
        return new Promise(async (resolve, reject) => {
            try {
                // Get the pool
                const pool = await sqldb.connect();
                const transaction = new sql.Transaction(pool);
                
                // Begin the transaction
                await transaction.begin();
                
                try {
                    // Execute each query in the transaction
                    for (const query of Qry) {
                        const request = new sql.Request(transaction);
                        const result = await request.query(query);
                        qry_rslts.push(result.recordset || result.rowsAffected);
                    }
                    
                    // Commit the transaction
                    await transaction.commit();
                    resolve(qry_rslts);
                } catch (error) {
                    // Rollback on error
                    await transaction.rollback();
                    console.error('[DB] Transaction error:', error);
                    reject({ 
                        err_status: 700, 
                        err_message: 'Transaction failed: ' + error.message 
                    });
                }
            } catch (err) {
                console.error('[DB] Transaction connection error:', err);
                reject({ 
                    err_status: 700, 
                    err_message: 'Database connection error' 
                });
            }
        });
    }
};

/**
 * Get next key value from sequence table
 * @param {String} hndlr_tx - Key handler text
 * @returns {Promise} - Promise resolving to next key value
 */
const getNxtKey = function(hndlr_tx) {
    return new Promise((resolve, reject) => {
        const QRY_TO_EXEC = [
            `SELECT ky_id FROM ky_sqnce_dtl_t WITH (XLOCK, ROWLOCK) WHERE ky_hndlr_tx = '${hndlr_tx}'`,
            `UPDATE ky_sqnce_dtl_t SET ky_id = ky_id + 1 WHERE ky_hndlr_tx = '${hndlr_tx}'`
        ];
        
        execTrnsctnQuery(sqldb.MSSQLConPool, QRY_TO_EXEC, { user_id: null })
            .then(function(results) {
                if (results && results.length && results[0] && results[0].length) {
                    resolve(results[0][0].ky_id);
                } else {
                    reject("Key not found");
                }
            })
            .catch(function(error) {
                reject(error);
            });
    });
};

/**
 * Execute a parameterized query
 * @param {Object} ConPool - Connection pool object
 * @param {String} query - SQL query with @param placeholders
 * @param {Object} params - Object with parameter values
 * @returns {Promise} - Promise resolving to query results
 */
const execParameterizedQuery = async function(ConPool, query, params) {
    try {
        const request = await ConPool.getRequest();
        
        // Add parameters to the request
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                // Determine SQL type based on value type
                let sqlType = sql.NVarChar;
                if (typeof value === 'number') {
                    sqlType = Number.isInteger(value) ? sql.Int : sql.Decimal;
                } else if (typeof value === 'boolean') {
                    sqlType = sql.Bit;
                } else if (value instanceof Date) {
                    sqlType = sql.DateTime;
                }
                request.input(key, sqlType, value);
            });
        }
        
        const result = await request.query(query);
        return result.recordset || result.rowsAffected;
    } catch (err) {
        console.error('[DB] Parameterized query error:', err);
        console.error('[DB] Query:', query.substring(0, 200));
        throw { err_status: 700, err_message: err.message };
    }
};

// Export functions
module.exports = {
    execQuery,
    execTrnsctnQuery,
    execParameterizedQuery,
    getNxtKey,
    containsDDL,
    extractTablesFromSQL,
    getOperationFromSQL,
    removeExtraSpacesExceptWithinQuotes
};
