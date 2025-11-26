# Module Structure Guide

Every module in the `api/modules/` folder follows a standard structure with three main components:

## Standard Module Structure

```
api/modules/[module-name]/
├── controllers/
│   └── [module]Ctrl.js      # Business logic & request handling
├── models/
│   └── [module]Model.js     # Data operations & storage
└── validators/
    └── [module]Vld.js       # Validation & access control
```

## Example: Auth Module

```
api/modules/auth/
├── controllers/
│   └── authAppCtrl.js       # Authentication logic
├── models/
│   ├── userModel.js         # User data operations
│   └── otpModel.js          # OTP data operations
└── validators/
    └── accessCtrl.js        # JWT validation & access control
```

## Component Responsibilities

### 1. Controllers (`controllers/`)
**Purpose:** Handle HTTP requests and responses

**Responsibilities:**
- Receive request data
- Call model methods
- Apply business logic
- Format responses
- Handle errors

**Example:**
```javascript
// controllers/authAppCtrl.js
const userModel = require('../models/userModel');
const std = require(appRoot + '/utils/standardMessages');

exports.sendOTP = async (req, res) => {
  const { phonenumber } = req.body;
  
  // Use model to find user
  const user = userModel.findByMobile(phonenumber);
  
  if (!user) {
    return res.status(std.message["NOT_FOUND"].code).json({
      status: std.message["NOT_FOUND"].code,
      message: 'User not found',
      data: null
    });
  }
  
  // Business logic here...
};
```

### 2. Models (`models/`)
**Purpose:** Handle data operations

**Responsibilities:**
- Data storage/retrieval
- Database queries
- Data validation
- CRUD operations
- Business data logic

**Example:**
```javascript
// models/userModel.js
const userStore = new Map(); // Or database connection

module.exports = {
  findByMobile: (mobile) => {
    return userStore.get(mobile);
  },
  
  create: (userData) => {
    const user = { ...userData, usr_id: generateId() };
    userStore.set(userData.mobile, user);
    return user;
  },
  
  update: (mobile, data) => {
    // Update logic
  },
  
  delete: (mobile) => {
    return userStore.delete(mobile);
  }
};
```

### 3. Validators (`validators/`)
**Purpose:** Validate inputs and control access

**Responsibilities:**
- Input validation
- JWT verification
- Role-based access control
- Permission checks
- Middleware functions

**Example:**
```javascript
// validators/accessCtrl.js
const jwt = require('jsonwebtoken');

module.exports = {
  verifyToken: (req, res, next) => {
    const token = req.headers['x-access-token'];
    
    if (!token) {
      return res.status(401).json({ message: 'No token' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: 'Invalid token' });
      }
      req.user = decoded;
      next();
    });
  },
  
  isAdmin: (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }
    next();
  }
};
```

## Data Flow

```
Request → Route → Validator → Controller → Model → Database
                     ↓            ↓          ↓
                  Validate     Business    Data
                  Access       Logic       Operations
                     ↓            ↓          ↓
Response ← Route ← Controller ← Model ← Database
```

## Creating a New Module

### Step 1: Create Module Structure
```bash
mkdir -p api/modules/[module-name]/controllers
mkdir -p api/modules/[module-name]/models
mkdir -p api/modules/[module-name]/validators
```

### Step 2: Create Model
```javascript
// api/modules/[module]/models/[module]Model.js
module.exports = {
  findAll: () => { /* ... */ },
  findById: (id) => { /* ... */ },
  create: (data) => { /* ... */ },
  update: (id, data) => { /* ... */ },
  delete: (id) => { /* ... */ }
};
```

### Step 3: Create Controller
```javascript
// api/modules/[module]/controllers/[module]Ctrl.js
const model = require('../models/[module]Model');
const std = require(appRoot + '/utils/standardMessages');

exports.getAll = async (req, res) => {
  try {
    const items = model.findAll();
    res.json({
      status: std.message["SUCCESS"].code,
      message: 'Success',
      data: items
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: 'Error',
      data: null
    });
  }
};
```

### Step 4: Create Validator (if needed)
```javascript
// api/modules/[module]/validators/[module]Vld.js
module.exports = {
  validateInput: (req, res, next) => {
    // Validation logic
    next();
  }
};
```

### Step 5: Create Router
```javascript
// api/routes/[module]/[module]Rtr.js
const express = require('express');
const router = express.Router();
const ctrl = require('../../modules/[module]/controllers/[module]Ctrl');
const vld = require('../../modules/[module]/validators/[module]Vld');

router.get('/list', ctrl.getAll);
router.post('/create', vld.validateInput, ctrl.create);

module.exports = router;
```

### Step 6: Register Route
```javascript
// api/routes/apiRoutes.js
router.use('/[module]', require('./[module]/[module]Rtr'));
```

## Best Practices

### 1. Keep Controllers Thin
- Controllers should orchestrate, not implement
- Complex logic goes in models
- Use models for all data operations

### 2. Models Handle All Data
- Never access storage directly in controllers
- All database queries in models
- Return clean data objects

### 3. Validators Stay Pure
- Only validation and access control
- No business logic
- Return clear error messages

### 4. Consistent Naming
```
Module: user
├── controllers/userCtrl.js
├── models/userModel.js
└── validators/userVld.js

Router: api/routes/user/userRtr.js
```

### 5. Error Handling
```javascript
// Controller
try {
  const data = model.findById(id);
  if (!data) {
    return res.status(404).json({
      status: 404,
      message: 'Not found',
      data: null
    });
  }
  // Success response
} catch (error) {
  console.error('Error:', error);
  res.status(500).json({
    status: 500,
    message: 'Internal error',
    data: null
  });
}
```

## Complete Module Example

### User Module Structure
```
api/modules/user/
├── controllers/
│   └── userCtrl.js
├── models/
│   └── userModel.js
└── validators/
    └── userVld.js
```

### User Model
```javascript
// models/userModel.js
const users = new Map();

module.exports = {
  findAll: () => Array.from(users.values()),
  findById: (id) => users.get(id),
  create: (data) => {
    const user = { id: Date.now(), ...data };
    users.set(user.id, user);
    return user;
  },
  update: (id, data) => {
    const user = users.get(id);
    if (!user) return null;
    const updated = { ...user, ...data };
    users.set(id, updated);
    return updated;
  },
  delete: (id) => users.delete(id)
};
```

### User Controller
```javascript
// controllers/userCtrl.js
const userModel = require('../models/userModel');
const std = require(appRoot + '/utils/standardMessages');

exports.getAll = async (req, res) => {
  try {
    const users = userModel.findAll();
    res.json({
      status: std.message["SUCCESS"].code,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: 'Error fetching users'
    });
  }
};

exports.create = async (req, res) => {
  try {
    const user = userModel.create(req.body);
    res.json({
      status: std.message["CREATED"].code,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: 'Error creating user'
    });
  }
};
```

### User Validator
```javascript
// validators/userVld.js
module.exports = {
  validateCreate: (req, res, next) => {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({
        status: 400,
        message: 'Name and email required'
      });
    }
    
    next();
  }
};
```

### User Router
```javascript
// routes/user/userRtr.js
const express = require('express');
const router = express.Router();
const ctrl = require('../../modules/user/controllers/userCtrl');
const vld = require('../../modules/user/validators/userVld');
const checkUser = require('../../modules/auth/validators/accessCtrl');

router.get('/list', checkUser.verifyToken, ctrl.getAll);
router.post('/create', checkUser.verifyToken, vld.validateCreate, ctrl.create);

module.exports = router;
```

## Summary

✅ **Every module has 3 folders:**
- `controllers/` - Business logic
- `models/` - Data operations
- `validators/` - Validation & access

✅ **Benefits:**
- Clear separation of concerns
- Easy to test each component
- Reusable code
- Scalable architecture
- Team-friendly structure

✅ **Remember:**
- Controllers call models
- Models handle data
- Validators check inputs
- Routes connect everything
