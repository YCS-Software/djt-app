# Date Format Utility - Created ✅

## 🔧 Problem Fixed

**Error:** `Cannot find module 'dateFormatUtil'`

**Solution:** Created `server/utils/dateFormatUtil.js` based on the `dflower.utils.js` pattern.

---

## 📁 File Created

**`server/utils/dateFormatUtil.js`** ✅

Location: `C:\Users\user\Downloads\project-4100124\server\utils\dateFormatUtil.js`

---

## 🎯 Core Functions (Used in Controllers)

### 1. **formatSucessRes** (Main Success Response)
```javascript
exports.formatSucessRes = function(req, res, data, cntxtDtls, fnm, options) {
    const response = {
        status: 200,
        message: options.message || 'Success',
        data: data
    };
    
    console.log(`[${cntxtDtls}] ${fnm} - Success`);
    return res.status(response.status).json(response);
};
```

**Usage in Controllers:**
```javascript
return df.formatSucessRes(req, res, {
    usr_id: user.usr_id,
    phone: user.phn_nmbr_tx,
    name: user.nm_tx
}, cntxtDtls, fnm, {});
```

---

### 2. **formatErrorRes** (Main Error Response)
```javascript
exports.formatErrorRes = function(res, error, cntxtDtls, fnm, options) {
    console.error(`[${cntxtDtls}] ${fnm} - Error:`, error);
    
    const errorStatus = error.err_status || error.status || 500;
    const errorMessage = error.err_message || error.message || 'Internal Server Error';
    
    return res.status(errorStatus).json({
        status: errorStatus,
        message: errorMessage,
        data: null
    });
};
```

**Usage in Controllers:**
```javascript
.catch(function(error) {
    return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
});
```

---

## 📅 Date Utility Functions

### Date Formatting:
```javascript
df.formatMySQLDate(date)           // → '2025-11-20 10:55:00'
df.formatDisplayDate(date)         // → 'Nov 20, 2025, 10:55 AM'
df.getCurrentTimestamp()           // → Current MySQL timestamp
```

### Date Manipulation:
```javascript
df.addDays(date, 5)                // Add 5 days
df.addMinutes(date, 30)            // Add 30 minutes
df.getDaysDifference(date1, date2) // Get difference in days
```

### Date Validation:
```javascript
df.isExpired(expiryDate)           // Check if date is past
df.isValidDate(dateString)         // Validate date string
df.parseDate(dateInput)            // Parse various date formats
```

### Helpers:
```javascript
df.formatDuration(90)              // → '1 hour 30 minutes'
```

---

## 🔄 How It's Used in Controllers

### Example from authAppCtrl.js:
```javascript
const df = require(appRoot + '/utils/dateFormatUtil');
const cntxtDtls = "authAppCtrl";

exports.sendOTP = function(req, res) {
    var fnm = "sendOTP";
    
    authAppMdl.storeOTPMdl(data)
        .then(function(results) {
            // ✅ Success response
            return df.formatSucessRes(req, res, {
                otpID: results.insertId,
                status: 'sent'
            }, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            // ❌ Error response
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};
```

---

## 📊 Response Format

### Success Response:
```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "usr_id": 123,
    "phone": "9666476298",
    "name": "John Doe"
  }
}
```

### Error Response:
```json
{
  "status": 500,
  "message": "Internal Server Error",
  "data": null
}
```

---

## ✅ Files Using This Utility

1. **`server/api/modules/auth/controllers/authAppCtrl.js`**
   - `sendOTP` ✅
   - `verifyOTP` ✅
   - `getUserInfo` ✅

2. **`server/api/modules/auth/controllers/registerCtrl.js`**
   - `register` ✅
   - `updateProfile` ✅

---

## 🎯 Key Features

### 1. **Standard Response Formatting**
- Consistent JSON structure
- Automatic status code handling
- Error logging with context

### 2. **Context Tracking**
- `cntxtDtls`: Controller name (e.g., "authAppCtrl")
- `fnm`: Function name (e.g., "sendOTP")
- Console logging for debugging

### 3. **Error Handling**
- Extracts error status and message
- Shows stack trace in development
- Handles multiple error formats

### 4. **Date Utilities**
- MySQL-compatible date formatting
- Date manipulation helpers
- Validation functions

---

## 🔍 Function Reference

| Function | Purpose | Returns |
|----------|---------|---------|
| `formatSucessRes` | Format success response | JSON response |
| `formatErrorRes` | Format error response | JSON response |
| `formatMySQLDate` | MySQL datetime format | String |
| `formatDisplayDate` | Display-friendly format | String |
| `getCurrentTimestamp` | Current MySQL timestamp | String |
| `parseDate` | Parse date string | Date object |
| `addDays` | Add days to date | Date object |
| `addMinutes` | Add minutes to date | Date object |
| `isExpired` | Check if date expired | Boolean |
| `getDaysDifference` | Days between dates | Number |
| `formatDuration` | Format minutes to text | String |
| `isValidDate` | Validate date string | Boolean |

---

## 📝 Examples

### Format MySQL Date:
```javascript
const now = new Date();
const mysqlDate = df.formatMySQLDate(now);
// → '2025-11-20 10:55:00'
```

### Add Expiry Time:
```javascript
const now = new Date();
const expiryDate = df.addMinutes(now, 5);
const mysqlExpiry = df.formatMySQLDate(expiryDate);
// → '2025-11-20 11:00:00'
```

### Check if OTP Expired:
```javascript
const otpExpiry = '2025-11-20 10:00:00';
if (df.isExpired(otpExpiry)) {
    console.log('OTP has expired');
}
```

### Format Duration:
```javascript
const sessionDuration = 90; // minutes
const formatted = df.formatDuration(sessionDuration);
// → '1 hour 30 minutes'
```

---

## 🚀 Usage Pattern

**Standard Controller Pattern:**
```javascript
// 1. Import utility
const df = require(appRoot + '/utils/dateFormatUtil');
const cntxtDtls = "yourController";

// 2. Use in functions
exports.yourFunction = function(req, res) {
    var fnm = "yourFunction";
    
    yourModel.yourMethodMdl(data)
        .then(function(results) {
            // Success
            return df.formatSucessRes(req, res, results, cntxtDtls, fnm, {});
        })
        .catch(function(error) {
            // Error
            return df.formatErrorRes(res, error, cntxtDtls, fnm, {});
        });
};
```

---

## ✅ Summary

**Created:** `server/utils/dateFormatUtil.js`

**Functions:**
- ✅ 2 Response formatters (success/error)
- ✅ 10 Date utility functions

**Used By:**
- ✅ Auth controllers
- ✅ Registration controllers
- ✅ Any controller following your pattern

**Benefits:**
- Consistent response format
- Easy error handling
- Date manipulation utilities
- Console logging with context
- Development error details

---

**Your server should now start without the `dateFormatUtil` error!** 🎉

Test it:
```bash
cd server
npm start
```
