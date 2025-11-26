# Phone Authentication System

A modern, animated phone authentication system with OTP verification built with React, Node.js, and Capacitor for Android.

## 🎯 Features

- 📱 **Phone Number Authentication** - Secure login with mobile number
- 🔐 **OTP Verification** - 4-digit OTP with auto-focus and paste support
- 🎨 **Modern UI** - Beautiful gradient design with smooth animations
- ⏱️ **Timer & Resend** - 60-second countdown with resend functionality
- 📲 **Android Ready** - Built with Capacitor for native Android app
- 🔄 **Real-time Validation** - Instant feedback on inputs
- ✨ **Smooth Animations** - Professional transitions and micro-interactions

## 🚀 Quick Start

### 1. Install Server Dependencies

```bash
cd server
npm install
```

### 2. Start the Server

```bash
cd server
npm run dev
```

Server will run on `http://localhost:5000`

### 3. Install Frontend Dependencies (if not already installed)

```bash
npm install
```

### 4. Start the Development Server

```bash
npm run dev
```

Frontend will run on `http://localhost:3000`

## 📱 Testing

### Test Phone Numbers

Use these pre-configured numbers for testing:

- **9876543210** - John Doe
- **8765432109** - Jane Smith

### OTP Testing

In development mode, the OTP is logged to the server console for easy testing.

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **Login Page** - Mobile number entry with validation
- **OTP Page** - 4-digit OTP input with animations
- **Home Page** - User dashboard after successful login
- **Modern CSS** - Gradient backgrounds, smooth transitions

### Backend (Node.js + Express) - APTIS Architecture
- **Modular Structure** - APTIS-style organization
- **OTP Generation** - Random 4-digit OTP
- **JWT Authentication** - Secure token-based auth
- **Standard Responses** - Unified API format
- **Access Control** - Middleware-based validation
- **In-Memory Storage** - For development (replace with database)
- **OTP Expiration** - 5-minute validity
- **Rate Limiting** - Max 3 attempts per OTP

**See:** `server/SERVER_STRUCTURE.md` for detailed architecture documentation

## 📂 Project Structure

```
project-4100124/
├── src/
│   ├── pages/
│   │   ├── Login.tsx          # Login component with OTP
│   │   ├── Login.css          # Login styles
│   │   ├── Home.tsx           # Home dashboard
│   │   └── Home.css           # Home styles
│   ├── router.tsx             # Route configuration
│   └── App.tsx                # Main app component
├── server/                     # ⭐ APTIS Architecture
│   ├── api/
│   │   ├── modules/auth/      # Auth module
│   │   ├── routes/            # Route definitions
│   │   └── validators/        # Common validators
│   ├── config/                # Configuration
│   ├── utils/                 # Utilities
│   ├── server.js              # Main server
│   └── .env                   # Environment variables
└── android/                    # Capacitor Android project
```

## 🔧 Configuration

### Server Environment Variables

Create `server/.env`:

```env
PORT=5000
JWT_SECRET=your_secret_key_here
NODE_ENV=development
```

### API Configuration

The frontend is configured to connect to `http://localhost:5000/api`

For production, update the `API_URL` in `src/pages/Login.tsx`

## 📱 Android Build

### Build for Android

```bash
# Build React app
npm run build

# Sync with Android
npm run android:sync

# Open in Android Studio
npm run android:open
```

### Build APK

1. Open in Android Studio
2. Go to Build > Build Bundle(s) / APK(s) > Build APK(s)
3. APK will be in `android/app/build/outputs/apk/`

## 🎨 UI Features

### Login Page
- Animated gradient background
- Floating icons animation
- Smooth input transitions
- Mobile number validation
- Real-time error messages

### OTP Page
- 4-digit individual inputs
- Auto-focus next input
- Paste OTP support
- Timer countdown
- Resend OTP functionality
- Success/error animations

### Design Inspired By
- GST Campaign App (Angular/Ionic)
- Modern material design principles
- Smooth micro-interactions

## 🔐 Security Features

- JWT token authentication
- OTP expiration (5 minutes)
- Maximum 3 attempts per OTP
- Secure token storage
- Input validation and sanitization

## 🚧 Production Checklist

- [ ] Replace in-memory storage with database
- [ ] Integrate real SMS gateway (Twilio, MSG91, etc.)
- [ ] Add rate limiting middleware
- [ ] Implement proper error logging
- [ ] Add HTTPS
- [ ] Update CORS policies
- [ ] Use strong JWT secrets
- [ ] Add request validation
- [ ] Implement user registration
- [ ] Add password recovery

## 📚 API Documentation

### Send OTP
```
POST /api/auth/app/otp
Body: { "phonenumber": "9876543210" }
```

### Verify OTP
```
POST /api/auth/app/verify/otp
Body: {
  "phno": "9876543210",
  "otp": "1234",
  "otpID": "uuid",
  "usr_id": "user_001"
}
```

### Get User Info
```
GET /api/auth/user/info
Headers: { "x-access-token": "jwt-token" }
```

## 🎯 Next Steps

1. **Database Integration** - MongoDB/PostgreSQL for user and OTP storage
2. **SMS Gateway** - Integrate Twilio/MSG91 for real SMS
3. **User Registration** - Add signup flow
4. **Profile Management** - Edit user details
5. **Push Notifications** - Firebase Cloud Messaging
6. **Analytics** - Track login attempts and success rates

## 🤝 Credits

- Inspired by APTIS server architecture
- UI design based on GST Campaign app
- Modern animations and interactions

## 📝 License

This project is for educational and development purposes.
