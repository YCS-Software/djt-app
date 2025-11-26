# Mobile App White Screen Fix Guide

## Problem
The app shows a white screen when installed on a mobile device.

## Root Causes & Solutions

### 1. API URL Configuration (Most Common Issue)

The app is trying to connect to `localhost:5000` which doesn't work on mobile devices.

#### Solution: Update API URL

**Option A: Use Environment Variable (Recommended)**

1. Create a `.env` file in the root directory:
```env
VITE_API_URL=http://YOUR_COMPUTER_IP:5000/api
```

2. Find your computer's IP address:
   - **Windows**: Open Command Prompt and run `ipconfig`
   - Look for "IPv4 Address" (e.g., `192.168.1.100`)
   - **Mac/Linux**: Run `ifconfig` or `ip addr`

3. Update `.env`:
```env
VITE_API_URL=http://192.168.1.100:5000/api
```

4. Rebuild the app:
```bash
npm run build
npx cap sync android
```

**Option B: Update Directly in Code**

Edit `src/services/api/apiClient.ts` and change:
```typescript
return 'http://192.168.1.100:5000/api'; // Change to your IP
```

### 2. Server Not Accessible from Mobile

Your backend server must be running and accessible from your mobile device.

#### Steps:

1. **Start the backend server:**
```bash
cd server
npm run dev
```

2. **Check server is running:**
   - Open browser on your computer: `http://localhost:5000/api/health`
   - Should return: `{"status":200,"message":"Server is running"}`

3. **Test from mobile device:**
   - Make sure your phone is on the same WiFi network
   - Open browser on phone: `http://YOUR_IP:5000/api/health`
   - Should return the same response

4. **If it doesn't work:**
   - Check Windows Firewall: Allow port 5000
   - Check router settings: Some routers block local network access
   - Try disabling firewall temporarily for testing

### 3. Network Security Configuration

Android blocks HTTP (non-HTTPS) traffic by default. We've added `usesCleartextTraffic="true"` to allow HTTP for development.

**For Production:** Use HTTPS or configure network security properly.

### 4. Check Console Logs

To see what's happening:

1. **Enable USB Debugging** on your Android device
2. **Connect device** to computer via USB
3. **Open Chrome** on your computer
4. **Go to:** `chrome://inspect`
5. **Click "inspect"** on your device
6. **Check Console** for errors

Common errors you might see:
- `Network request failed` → API URL issue
- `CORS error` → Server CORS configuration
- `Failed to fetch` → Server not running or unreachable

### 5. Rebuild Steps

After making changes:

```bash
# 1. Build React app
npm run build

# 2. Sync with Capacitor
npx cap sync android

# 3. Open Android Studio
npx cap open android

# 4. In Android Studio:
#    - Clean Project (Build → Clean Project)
#    - Rebuild Project (Build → Rebuild Project)
#    - Build APK (Build → Build Bundle(s) / APK(s) → Build APK(s))
```

## Quick Fix Checklist

- [ ] Backend server is running on port 5000
- [ ] Server is accessible from mobile device (test in browser)
- [ ] API URL is set to your computer's IP (not localhost)
- [ ] Phone and computer are on same WiFi network
- [ ] Firewall allows port 5000
- [ ] Rebuilt app after changing API URL
- [ ] Synced with Capacitor after rebuild
- [ ] Cleaned and rebuilt in Android Studio

## Testing API Connection

### From Mobile Browser:
1. Open browser on your phone
2. Go to: `http://YOUR_IP:5000/api/health`
3. Should see: `{"status":200,"message":"Server is running"}`

### From Mobile App:
1. Install the APK
2. Open the app
3. Check Chrome DevTools console (chrome://inspect)
4. Look for API calls and errors

## Production Setup

For production, you need:

1. **Production API Server:**
   - Deploy backend to a server (AWS, Heroku, etc.)
   - Get HTTPS certificate
   - Update API URL to: `https://your-api-domain.com/api`

2. **Update Environment:**
```env
VITE_API_URL=https://api.djthaika.com/api
```

3. **Remove Cleartext Traffic:**
   - Remove `android:usesCleartextTraffic="true"` from AndroidManifest.xml
   - Use HTTPS only

## Common Issues

### Issue: Still seeing white screen
- **Check:** Open Chrome DevTools (chrome://inspect) and look for JavaScript errors
- **Check:** Verify API URL is correct in console logs
- **Check:** Ensure server is running and accessible

### Issue: Network request failed
- **Solution:** Update API URL to your computer's IP
- **Solution:** Check firewall settings
- **Solution:** Ensure same WiFi network

### Issue: CORS errors
- **Solution:** Update server CORS configuration in `server/server.js`
- **Solution:** Add your IP to allowed origins

### Issue: App crashes on startup
- **Solution:** Check Android Studio Logcat for errors
- **Solution:** Verify all Capacitor plugins are installed
- **Solution:** Clean and rebuild project

## Debug Mode

To enable debug logging, the app now logs:
- Platform detection (native vs web)
- API URL being used
- Network errors with details

Check Chrome DevTools console to see these logs.

## Next Steps

1. ✅ Update API URL to your computer's IP
2. ✅ Ensure server is running and accessible
3. ✅ Rebuild and sync the app
4. ✅ Test API connection from mobile browser first
5. ✅ Install APK and check Chrome DevTools for errors

---

**Important:** Always test the API connection from your mobile browser first before testing in the app!

