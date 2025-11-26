# 🚀 Getting Started Guide

Complete setup instructions for the Phone Authentication System with Android support.

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Android Studio (for Android development)
- Git

## 🔧 Step-by-Step Setup

### Step 1: Verify Installation

All dependencies are already installed! Verify by checking:

```bash
# Check if node_modules exists
dir node_modules

# Check server dependencies
dir server\node_modules
```

### Step 2: Start the Backend Server

Open **Terminal 1** (PowerShell):

```powershell
cd server
npm run dev
```

You should see:
```
🚀 Server running on port 5000
📱 Auth API available at http://localhost:5000/api/auth
🏥 Health check at http://localhost:5000/api/health
```

### Step 3: Start the Frontend

Open **Terminal 2** (PowerShell):

```powershell
npm run dev
```

The app will open at `http://localhost:3000`

### Step 4: Test the Application

1. **Open browser**: Go to `http://localhost:3000`
2. **Enter mobile number**: Use test number `9876543210`
3. **Click "Send OTP"**
4. **Check server console**: OTP will be displayed in Terminal 1
   ```
   📱 OTP for 9876543210: 1234
   ```
5. **Enter OTP**: Type the 4-digit code
6. **Click "Verify & Login"**
7. **Success!**: You'll be redirected to the home page

## 📱 Android Build & Sync

### Build for Android

```powershell
# 1. Build the React app
npm run build

# 2. Sync code with Android Studio
npm run android:sync

# 3. Open in Android Studio
npm run android:open
```

### In Android Studio

1. Wait for Gradle sync to complete
2. Select your device/emulator
3. Click **Run** (green play button)
4. App will install and launch on your Android device

### Update API URL for Android

When building for Android, update the API URL in `src/pages/Login.tsx`:

```typescript
// For local testing with Android emulator
const API_URL = 'http://10.0.2.2:5000/api';

// For physical device (use your computer's IP)
const API_URL = 'http://192.168.1.XXX:5000/api';

// For production
const API_URL = 'https://your-api-domain.com/api';
```

## 🧪 Test Users

| Mobile Number | Name | Email |
|--------------|------|-------|
| 9876543210 | John Doe | john@example.com |
| 8765432109 | Jane Smith | jane@example.com |

## 🎯 Quick Commands Reference

### Development
```powershell
# Start backend server (Terminal 1)
npm run server:dev

# Start frontend (Terminal 2)
npm run dev

# Build for production
npm run build
```

### Android
```powershell
# Sync with Android
npm run android:sync

# Open Android Studio
npm run android:open

# Complete build and sync
npm run android:build
```

## 🔍 Troubleshooting

### Server not starting?
```powershell
# Check if port 5000 is available
netstat -ano | findstr :5000

# If port is busy, change PORT in server/.env
```

### Frontend not loading?
```powershell
# Clear cache and restart
rm -r node_modules/.vite
npm run dev
```

### Android build errors?
```powershell
# Clean and rebuild
cd android
./gradlew clean
cd ..
npm run android:build
```

### OTP not appearing?
- Check Terminal 1 (server console) for the OTP
- OTP format: 4 digits (e.g., 1234)
- OTP expires in 5 minutes

### Network errors?
- Ensure server is running on port 5000
- Check firewall settings
- For Android: Use correct IP address (10.0.2.2 for emulator)

## 📝 Development Workflow

### Daily Development
1. Start server: `npm run server:dev`
2. Start frontend: `npm run dev`
3. Make changes to code
4. Save - Hot reload will update automatically

### Testing on Android
1. Make changes to code
2. Build: `npm run build`
3. Sync: `npm run android:sync`
4. Run from Android Studio

### Before Deploying
1. Update API_URL to production
2. Build: `npm run build`
3. Test on device
4. Generate signed APK in Android Studio

## 🎨 UI Components Overview

### Login Page (`src/pages/Login.tsx`)
- Mobile number input with validation
- OTP entry with 4 separate inputs
- Auto-focus and paste support
- Timer countdown for resend
- Smooth animations

### Home Page (`src/pages/Home.tsx`)
- User profile display
- Secure logout
- Modern card design

### Styles
- `Login.css` - Login page animations
- `Home.css` - Dashboard styles
- Gradient backgrounds
- Smooth transitions

## 🔐 Security Notes

- OTP expires in 5 minutes
- Maximum 3 attempts per OTP
- JWT tokens expire in 7 days
- Always use HTTPS in production

## 📞 Support

If you encounter issues:
1. Check server console (Terminal 1) for errors
2. Check browser console (F12) for frontend errors
3. Verify both terminals are running
4. Ensure correct test phone numbers

## 🎉 Success Checklist

- [x] Server running on port 5000
- [x] Frontend running on port 3000
- [x] Can send OTP
- [x] OTP appears in server console
- [x] Can verify OTP and login
- [x] Can view home page
- [x] Android project synced
- [x] Can open in Android Studio

## 🚀 You're All Set!

Your phone authentication system is ready to use. Start developing and testing!

**Next**: Open two terminals and run:
1. `npm run server:dev`
2. `npm run dev`

Then visit `http://localhost:3000` and login with `9876543210`
