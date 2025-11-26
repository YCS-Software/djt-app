# Server Structure - APTIS Architecture

This server follows the APTIS server architecture pattern with modular organization.

## Directory Structure

```
server/
├── api/
│   ├── modules/
│   │   └── auth/
│   │       ├── controllers/
│   │       │   └── authAppCtrl.js      # Authentication logic
│   │       └── validators/
│   │           └── accessCtrl.js       # JWT & access control
│   ├── routes/
│   │   ├── auth/
│   │   │   └── authAppRtr.js          # Auth route definitions
│   │   └── apiRoutes.js               # Main API router
│   └── validators/
│       └── commonVld.js               # Common validation functions
├── config/
│   └── config.js                      # Configuration settings
├── utils/
│   └── standardMessages.js            # Standard HTTP messages
├── .env                               # Environment variables
├── package.json
└── server.js                          # Main server file
```

## Key Concepts

### 1. Global appRoot Variable
```javascript
global.appRoot = path.resolve(__dirname);
```
Used throughout the application for absolute path resolution:
```javascript
require(appRoot + '/utils/standardMessages')
```

### 2. Modular Structure

#### Controllers (`api/modules/auth/controllers/`)
- Business logic implementation
- Database operations
- Response formatting

#### Validators (`api/modules/auth/validators/`)
- Input validation
- Access control
- JWT verification

#### Routes (`api/routes/`)
- Route definitions
- Middleware application
- Controller mapping

### 3. Standard Messages
All responses use standardized messages from `utils/standardMessages.js`:
```javascript
const std = require(appRoot + '/utils/standardMessages');

res.status(std.message["SUCCESS"].code).json({
  status: std.message["SUCCESS"].code,
  message: 'Operation successful',
  data: result
});
```

### 4. Response Format
All API responses follow this structure:
```json
{
  "status": 200,
  "message": "Success message",
  "data": {},
  "errors": []
}
```

## API Endpoints

### Authentication Routes
Base URL: `/api/auth`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/app/otp` | Send OTP | No |
| POST | `/app/verify/otp` | Verify OTP | No |
| POST | `/app/resend/otp` | Resend OTP | No |
| GET | `/user/info` | Get user info | Yes |

### Health Check
```
GET /api/health
```

## Adding New Modules

### 1. Create Module Structure
```
api/modules/[module-name]/
├── controllers/
│   └── [module]Ctrl.js
├── validators/
│   └── [module]Vld.js
└── models/
    └── [module]Model.js
```

### 2. Create Router
```javascript
// api/routes/[module]/[module]Rtr.js
var express = require('express');
var router = express.Router();
var moduleCtrl = require('../../modules/[module]/controllers/[module]Ctrl');

router.get('/list', moduleCtrl.getList);
router.post('/create', moduleCtrl.create);

module.exports = router;
```

### 3. Register in apiRoutes.js
```javascript
router.use('/[module]', require('./[module]/[module]Rtr'));
```

## Environment Variables

Create `.env` file:
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your_secret_key_here
CORS_ORIGIN=*

# Database (future)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=phone_auth_db
DB_USER=postgres
DB_PASSWORD=

# SMS Gateway (future)
SMS_PROVIDER=twilio
SMS_API_KEY=
SMS_SENDER_ID=PHAUTH
```

## Configuration

Access configuration via:
```javascript
const config = require(appRoot + '/config/config');

const jwtSecret = config.jwt.secret;
const otpExpiry = config.otp.expiryMinutes;
```

## Validators

Use common validators:
```javascript
const commonVld = require(appRoot + '/api/validators/commonVld');

// Validate mobile
const mobileCheck = commonVld.validateMobile(req.body.mobile);
if (!mobileCheck.valid) {
  return res.status(400).json({
    status: 400,
    message: mobileCheck.message
  });
}
```

## Access Control

Protect routes with middleware:
```javascript
const checkUser = require('../../modules/auth/validators/accessCtrl');

// Require authentication
router.get('/protected', checkUser.verifyToken, controller.method);

// Require admin role
router.post('/admin', 
  checkUser.verifyToken, 
  checkUser.isAdmin, 
  controller.adminMethod
);
```

## Error Handling

Use standardized error responses:
```javascript
const std = require(appRoot + '/utils/standardMessages');

// Bad request
res.status(std.message["BAD_REQUEST"].code).json({
  status: std.message["BAD_REQUEST"].code,
  message: 'Invalid input',
  data: null
});

// Internal error
res.status(std.message["INTERNAL_ERROR"].code).json({
  status: std.message["INTERNAL_ERROR"].code,
  message: 'Something went wrong',
  data: null
});
```

## Best Practices

1. **Always use appRoot for requires**
   ```javascript
   require(appRoot + '/utils/standardMessages')
   ```

2. **Use standard message codes**
   ```javascript
   std.message["SUCCESS"].code  // 200
   std.message["BAD_REQUEST"].code  // 400
   ```

3. **Validate all inputs**
   ```javascript
   const validation = commonVld.validateMobile(mobile);
   if (!validation.valid) {
     return res.status(400).json({ message: validation.message });
   }
   ```

4. **Protect sensitive routes**
   ```javascript
   router.get('/sensitive', checkUser.verifyToken, controller.method);
   ```

5. **Log errors properly**
   ```javascript
   console.error('Error in operation:', error);
   ```

## Migration from Old Structure

The old structure:
```
server/
├── controllers/
│   └── authController.js
└── routes/
    └── authRoutes.js
```

Has been reorganized to APTIS pattern:
```
server/
└── api/
    ├── modules/
    │   └── auth/
    │       ├── controllers/
    │       │   └── authAppCtrl.js
    │       └── validators/
    │           └── accessCtrl.js
    └── routes/
        ├── auth/
        │   └── authAppRtr.js
        └── apiRoutes.js
```

## Testing

Test the API:
```bash
# Health check
curl http://localhost:5000/api/health

# Send OTP
curl -X POST http://localhost:5000/api/auth/app/otp \
  -H "Content-Type: application/json" \
  -d '{"phonenumber": "9876543210"}'

# Verify OTP
curl -X POST http://localhost:5000/api/auth/app/verify/otp \
  -H "Content-Type: application/json" \
  -d '{"phno":"9876543210","otp":"1234","otpID":"uuid","usr_id":"user_001"}'
```

## Next Steps

1. Integrate database (PostgreSQL/MongoDB)
2. Add SMS gateway integration
3. Implement rate limiting
4. Add request logging middleware
5. Create additional modules as needed
6. Add automated tests
