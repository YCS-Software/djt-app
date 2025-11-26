# Database Setup Guide

This project uses **Microsoft SQL Server (MSSQL)** as its database, configured similar to the APTIS project structure.

## Configuration

### Environment Variables

Database configuration is managed through environment variables in `.env`:

```env
# Database Configuration (MS SQL Server)
DB_HOST=3.109.125.59
DB_PORT=1433
DB_USER=DSCRDA
DB_PASSWORD=Dr3amCrda@123
DB_NAME=APCTDB
DB_MAX_POOL=200
DB_MIN_POOL=5
```

### Connection Pool

The application uses a connection pool for efficient database management:
- **Min Pool Size**: 5 connections
- **Max Pool Size**: 200 connections
- **Idle Timeout**: 50 seconds

## Architecture

### 1. Database Configuration (`config/db.config.js`)

Central database configuration and connection pool management based on APTIS structure:

```javascript
const sqldb = require('./config/db.config');

// Access the connection pool
const pool = sqldb.MSSQLConPool;

// Execute queries
const results = await pool.query('SELECT * FROM users_t');
```

### 2. Database Utilities (`utils/db.utils.js`)

Common database utility functions:

- `execQuery(ConPool, query, callback)` - Execute single query
- `execTrnsctnQuery(ConPool, queries, userDtls)` - Execute transaction
- `execParameterizedQuery(ConPool, query, params)` - Execute parameterized query
- `getNxtKey(handler)` - Get next sequence key
- `containsDDL(query)` - Check for DDL statements
- `extractTablesFromSQL(query)` - Extract table names
- `getOperationFromSQL(query)` - Get query operation type

### 3. Models Layer

#### Base Model (`models/baseModel.js`)

Abstract base class providing CRUD operations for all models:

```javascript
const BaseModel = require('./models/baseModel');

class MyModel extends BaseModel {
    constructor() {
        super('my_table_name');
    }
}
```

**Available Methods:**
- `findAll(options)` - Get all records with filtering
- `findOne(where)` - Get single record
- `findById(id, idField)` - Get by primary key
- `create(data)` - Insert new record
- `update(data, where)` - Update records
- `delete(where)` - Delete records
- `count(where)` - Count records
- `transaction(queries)` - Execute transaction

#### User Model (`models/userModel.js`)

Handles user-related operations:

```javascript
const { User } = require('./models');

// Find user by phone
const user = await User.findByPhoneNumber('1234567890');

// Create user
const newUser = await User.createUser({
    phoneNumber: '1234567890',
    name: 'John Doe',
    email: 'john@example.com'
});

// Update profile
await User.updateProfile(userId, { name: 'Jane Doe' });

// Search users
const results = await User.searchUsers('John');
```

#### Auth Model (`models/authModel.js`)

Handles authentication and OTP operations:

```javascript
const { Auth } = require('./models');

// Store OTP
await Auth.storeOTP('1234567890', '1234', 5);

// Verify OTP
const result = await Auth.verifyOTP('1234567890', '1234');

// Clean expired OTPs
await Auth.cleanExpiredOTPs();

// Get OTP history
const history = await Auth.getOTPHistory('1234567890', 10);
```

## Usage Examples

### Basic Query Execution

```javascript
const sqldb = require('./config/db.config');
const pool = sqldb.MSSQLConPool;

// Simple query
const users = await pool.query('SELECT * FROM users_t WHERE a_in = 1');

// Parameterized query
const { execParameterizedQuery } = require('./utils/db.utils');
const query = 'SELECT * FROM users_t WHERE usr_id = @userId';
const params = { userId: 123 };
const result = await execParameterizedQuery(pool, query, params);
```

### Using Models

```javascript
const models = require('./models');

// User operations
const activeUsers = await models.User.getActiveUsers({ limit: 10 });
const user = await models.User.findById(123, 'usr_id');

// Auth operations
const otpStored = await models.Auth.storeOTP('9876543210', '5678');
const verified = await models.Auth.verifyOTP('9876543210', '5678');
```

### Transactions

```javascript
const { execTrnsctnQuery } = require('./utils/db.utils');
const pool = sqldb.MSSQLConPool;

const queries = [
    "INSERT INTO users_t (nm_tx, phn_nmbr_tx) VALUES ('John', '1234567890')",
    "INSERT INTO auth_otp_t (phn_nmbr_tx, otp_tx) VALUES ('1234567890', '1234')"
];

const results = await execTrnsctnQuery(pool, queries, { user_id: 1 });
```

### Custom Model

```javascript
const BaseModel = require('./models/baseModel');

class ProductModel extends BaseModel {
    constructor() {
        super('products_t');
    }

    async findActiveProducts() {
        const query = `
            SELECT * FROM ${this.tableName}
            WHERE a_in = 1
            ORDER BY i_ts DESC
        `;
        return await this.executeQuery(query);
    }

    async findByCategory(categoryId) {
        return await this.findAll({
            where: { ctgry_id: categoryId, a_in: 1 },
            orderBy: 'nm_tx ASC'
        });
    }
}

module.exports = new ProductModel();
```

## Testing Connection

### Install Dependencies

```bash
cd server
npm install
```

### Test Database Connection

```bash
node utils/testConnection.js
```

This will:
1. Connect to the database
2. Display database info
3. List available tables
4. Verify connection pool

### Start Server

```bash
npm start
# or for development
npm run dev
```

## Database Naming Conventions (APTIS Style)

- Tables end with `_t` (e.g., `users_t`, `auth_otp_t`)
- Fields use abbreviated names with `_` separators
- Common fields:
  - `_id` - Primary key (e.g., `usr_id`, `otp_id`)
  - `_tx` - Text fields (e.g., `nm_tx`, `eml_tx`)
  - `_nbr` - Number fields (e.g., `phn_nmbr_tx`, `attmpts_nbr`)
  - `_ts` - Timestamp fields (e.g., `i_ts`, `u_ts`, `d_ts`)
  - `_in` - Indicator/boolean (e.g., `a_in` for active)

Common timestamp fields:
- `i_ts` - Insert timestamp
- `u_ts` - Update timestamp
- `d_ts` - Delete timestamp
- `insrt_usr_id` - User who inserted
- `updte_usr_id` - User who updated

## Error Handling

All database operations return errors in this format:

```javascript
{
    err_status: 700,  // Error code
    err_message: "Error description"
}
```

Common error codes:
- `600` - DDL statement not allowed
- `700` - Database query/connection error

## Security Features

1. **DDL Prevention**: Automatic rejection of CREATE, DROP, ALTER statements
2. **SQL Injection Protection**: Parameterized queries and escape functions
3. **Connection Pooling**: Efficient resource management
4. **Transaction Support**: ACID compliance for multi-query operations

## Performance Tips

1. Use parameterized queries for better performance
2. Implement proper indexing on frequently queried fields
3. Use transactions for multiple related operations
4. Monitor connection pool usage
5. Clean up expired records periodically

## Troubleshooting

### Connection Issues

1. Verify database credentials in `.env`
2. Check network connectivity to database server
3. Ensure SQL Server is running and accessible
4. Verify firewall rules allow connection on port 1433

### Query Errors

1. Check query syntax for MSSQL compatibility
2. Verify table and field names match database schema
3. Use `testConnection.js` to verify database access
4. Enable query logging for debugging

### Pool Exhaustion

If you see pool exhaustion errors:
1. Check for unclosed connections
2. Increase `DB_MAX_POOL` size
3. Review application for connection leaks
4. Monitor active connection count

## Next Steps

1. ✅ Database configuration complete
2. ✅ Connection pooling configured
3. ✅ Base models created
4. ✅ Utility functions ready
5. 🔄 Create your custom models as needed
6. 🔄 Implement your API endpoints using models
7. 🔄 Add database migrations if required
