# Phone Authentication Server

A Node.js/Express server for phone number authentication with OTP verification.

**Architecture:** APTIS-style modular structure

## Features

- 📱 Phone number authentication
- 🔐 OTP generation and verification
- 🔑 JWT token-based authentication
- ⏱️ OTP expiration (5 minutes)
- 🔄 OTP resend functionality
- 🛡️ Rate limiting on OTP attempts
- 🏗️ Modular APTIS architecture
- ✅ Standardized responses
- 🔒 Access control middleware

## Installation

```bash
cd server
npm install
```

## Environment Variables

Create a `.env` file in the server directory:

```env
PORT=5000
JWT_SECRET=your_jwt_secret_key_change_this_in_production
NODE_ENV=development
```

## Running the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## Server Structure

```
server/
├── api/
│   ├── modules/auth/        # Auth module
│   ├── routes/              # Route definitions
│   └── validators/          # Common validators
├── config/                  # Configuration
├── utils/                   # Utilities
└── server.js               # Main server
```

See **SERVER_STRUCTURE.md** for detailed documentation.

## API Endpoints

All endpoints follow APTIS standard response format:
```json
{
  "status": 200,
  "message": "Success message",
  "data": {},
  "errors": []
}
```

### Send OTP
```http
POST /api/auth/app/otp
Content-Type: application/json

{
  "phonenumber": "9876543210"
}
```

Response:
```json
{
  "status": 200,
  "message": "OTP sent successfully",
  "data": {
    "otpID": "uuid-here",
    "usr_id": "user_001",
    "status": "sent",
    "dev_otp": "1234"
  }
}
```

### Verify OTP
```http
POST /api/auth/app/verify/otp
Content-Type: application/json

{
  "phno": "9876543210",
  "otp": "1234",
  "otpID": "uuid-here",
  "usr_id": "user_001"
}
```

Response:
```json
{
  "status": 200,
  "message": "Login successful",
  "token": "jwt-token-here",
  "data": {
    "user": {
      "usr_id": "user_001",
      "mobile": "9876543210",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user"
    }
  }
}
```

### Get User Info (Protected)
```http
GET /api/auth/user/info
x-access-token: your-jwt-token
```

## Test Users

The server comes with pre-configured test users:

| Mobile Number | Name | Email |
|--------------|------|-------|
| 9876543210 | John Doe | john@example.com |
| 8765432109 | Jane Smith | jane@example.com |

## Development Notes

- OTP is logged to console in development mode
- In production, integrate with SMS gateway (Twilio, MSG91, etc.)
- Replace in-memory storage with database (MongoDB, PostgreSQL, etc.)
- Add rate limiting for security
- Implement proper error logging

## Security Considerations

1. Use strong JWT secret in production
2. Implement rate limiting on OTP requests
3. Add HTTPS in production
4. Store OTPs in secure database
5. Add request validation and sanitization
6. Implement proper CORS policies
