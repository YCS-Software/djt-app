# Deprecated Files

The following files are from the old structure and are no longer used. They can be deleted.

## Old Structure (Deprecated)

```
server/
├── controllers/
│   └── authController.js      ❌ DEPRECATED
└── routes/
    └── authRoutes.js          ❌ DEPRECATED
```

## New Structure (Current)

```
server/
└── api/
    ├── modules/
    │   └── auth/
    │       ├── controllers/
    │       │   └── authAppCtrl.js      ✅ USE THIS
    │       └── validators/
    │           └── accessCtrl.js       ✅ USE THIS
    └── routes/
        ├── auth/
        │   └── authAppRtr.js          ✅ USE THIS
        └── apiRoutes.js               ✅ USE THIS
```

## Migration Complete

All functionality has been moved to the new APTIS-style structure:

- **authController.js** → **authAppCtrl.js**
- **authRoutes.js** → **authAppRtr.js**
- Added **accessCtrl.js** for JWT validation
- Added **commonVld.js** for input validation
- Added **standardMessages.js** for response codes
- Added **config.js** for centralized configuration

## Safe to Delete

You can safely delete these old files:
- `server/controllers/authController.js`
- `server/routes/authRoutes.js`
- `server/controllers/` folder (if empty)
- `server/routes/` folder (if empty)

## Benefits of New Structure

1. ✅ Matches APTIS architecture
2. ✅ Better code organization
3. ✅ Standardized responses
4. ✅ Centralized configuration
5. ✅ Reusable validators
6. ✅ Middleware separation
7. ✅ Easier to scale and maintain
