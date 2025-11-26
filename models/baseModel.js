/**
 * Base Model Class
 * Provides common database operations for all models
 */

const sqldb = require(appRoot + '/config/db.config');
const dbUtils = require(appRoot + '/utils/db.utils');

class BaseModel {
    constructor(tableName) {
        this.tableName = tableName;
        this.pool = sqldb.MSSQLConPool;
    }

    /**
     * Execute a raw SQL query
     * @param {String} query - SQL query string
     * @param {Object} params - Optional parameters
     * @returns {Promise}
     */
    async executeQuery(query, params = null) {
        try {
            if (params) {
                return await dbUtils.execParameterizedQuery(this.pool, query, params);
            }
            return await dbUtils.execQuery(this.pool, query);
        } catch (error) {
            console.error(`[${this.tableName}] Query error:`, error);
            throw error;
        }
    }

    /**
     * Find all records
     * @param {Object} options - Query options (limit, offset, orderBy, where)
     * @returns {Promise}
     */
    async findAll(options = {}) {
        try {
            let query = `SELECT * FROM ${this.tableName}`;
            
            // Add WHERE clause
            if (options.where) {
                const whereClause = this.buildWhereClause(options.where);
                query += ` WHERE ${whereClause}`;
            }
            
            // Add ORDER BY
            if (options.orderBy) {
                query += ` ORDER BY ${options.orderBy}`;
            }
            
            // Add LIMIT and OFFSET (MySQL)
            if (options.limit) {
                query += ` LIMIT ${options.limit}`;
                if (options.offset) {
                    query += ` OFFSET ${options.offset}`;
                }
            }
            
            return await this.executeQuery(query);
        } catch (error) {
            console.error(`[${this.tableName}] findAll error:`, error);
            throw error;
        }
    }

    /**
     * Find one record by criteria
     * @param {Object} where - Where conditions
     * @returns {Promise}
     */
    async findOne(where) {
        try {
            const whereClause = this.buildWhereClause(where);
            const query = `SELECT * FROM ${this.tableName} WHERE ${whereClause} LIMIT 1`;
            const results = await this.executeQuery(query);
            return results && results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error(`[${this.tableName}] findOne error:`, error);
            throw error;
        }
    }

    /**
     * Find by primary key (ID)
     * @param {Number|String} id - Primary key value
     * @param {String} idField - Primary key field name (default: 'id')
     * @returns {Promise}
     */
    async findById(id, idField = 'id') {
        return await this.findOne({ [idField]: id });
    }

    /**
     * Create a new record
     * @param {Object} data - Record data
     * @returns {Promise}
     */
    async create(data) {
        try {
            const fields = Object.keys(data);
            const values = Object.values(data).map(v => this.pool.escape(v));
            
            const query = `
                INSERT INTO ${this.tableName} (${fields.join(', ')}) 
                VALUES (${values.join(', ')})
            `;
            
            const results = await this.executeQuery(query);
            
            // MySQL returns insertId, fetch the created record
            if (results && results.insertId) {
                // Try to find the primary key field
                const pkField = this.tableName.replace('_t', '_id');
                return await this.findById(results.insertId, pkField);
            }
            
            return results;
        } catch (error) {
            console.error(`[${this.tableName}] create error:`, error);
            throw error;
        }
    }

    /**
     * Update record(s)
     * @param {Object} data - Data to update
     * @param {Object} where - Where conditions
     * @returns {Promise}
     */
    async update(data, where) {
        try {
            const setClause = Object.keys(data)
                .map(key => `${key} = ${this.pool.escape(data[key])}`)
                .join(', ');
            
            const whereClause = this.buildWhereClause(where);
            
            const query = `
                UPDATE ${this.tableName} 
                SET ${setClause} 
                WHERE ${whereClause}
            `;
            
            return await this.executeQuery(query);
        } catch (error) {
            console.error(`[${this.tableName}] update error:`, error);
            throw error;
        }
    }

    /**
     * Delete record(s)
     * @param {Object} where - Where conditions
     * @returns {Promise}
     */
    async delete(where) {
        try {
            const whereClause = this.buildWhereClause(where);
            const query = `DELETE FROM ${this.tableName} WHERE ${whereClause}`;
            return await this.executeQuery(query);
        } catch (error) {
            console.error(`[${this.tableName}] delete error:`, error);
            throw error;
        }
    }

    /**
     * Count records
     * @param {Object} where - Optional where conditions
     * @returns {Promise}
     */
    async count(where = null) {
        try {
            let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
            
            if (where) {
                const whereClause = this.buildWhereClause(where);
                query += ` WHERE ${whereClause}`;
            }
            
            const results = await this.executeQuery(query);
            return results && results.length > 0 ? results[0].count : 0;
        } catch (error) {
            console.error(`[${this.tableName}] count error:`, error);
            throw error;
        }
    }

    /**
     * Build WHERE clause from object
     * @param {Object} where - Where conditions
     * @returns {String}
     */
    buildWhereClause(where) {
        return Object.keys(where)
            .map(key => {
                const value = where[key];
                if (value === null) {
                    return `${key} IS NULL`;
                }
                if (Array.isArray(value)) {
                    const values = value.map(v => this.pool.escape(v)).join(', ');
                    return `${key} IN (${values})`;
                }
                return `${key} = ${this.pool.escape(value)}`;
            })
            .join(' AND ');
    }

    /**
     * Execute transaction with multiple queries
     * @param {Array} queries - Array of SQL query strings
     * @returns {Promise}
     */
    async transaction(queries) {
        try {
            return await dbUtils.execTrnsctnQuery(this.pool, queries, {});
        } catch (error) {
            console.error(`[${this.tableName}] transaction error:`, error);
            throw error;
        }
    }
}

module.exports = BaseModel;
