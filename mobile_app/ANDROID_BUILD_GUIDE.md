# Android APK Build Guide - DJT HAIKA

This guide will help you build the Android APK for **DJT HAIKA** EV Charging App using Android Studio.

## Prerequisites

1. **Android Studio** (latest version recommended)
   - Download from: https://developer.android.com/studio
   - Install Android SDK (API 33 or higher)
   - Install JDK 17 or higher

2. **Node.js and npm** (already installed)
   - Verify: `node --version` and `npm --version`

3. **Capacitor CLI** (already installed)
   - Verify: `npx cap --version`

## App Configuration

✅ **App Name**: DJT HAIKA  
✅ **Package ID**: com.djthaika.ev  
✅ **Build Output**: `out/` directory  
✅ **Capacitor Config**: Updated with app name and package ID

## Build Steps

### Step 1: Build React App

The React app has already been built. If you need to rebuild:

```bash
npm run build
```

This creates the production build in the `out/` directory.

### Step 2: Sync with Capacitor

Sync the web assets with Android:

```bash
npm run android:sync
```

Or manually:
```bash
npx cap sync android
```

### Step 3: Open in Android Studio

Open the Android project in Android Studio:

```bash
npm run android:open
```

Or manually:
```bash
npx cap open android
```

This will open Android Studio with the project.

### Step 4: Build APK in Android Studio

1. **Wait for Gradle Sync**
   - Android Studio will automatically sync Gradle dependencies
   - Wait for the sync to complete (check bottom status bar)

2. **Select Build Variant**
   - Click on `Build` → `Select Build Variant`
   - Choose `release` for production APK or `debug` for testing

3. **Build APK**
   - Click `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
   - Wait for the build to complete
   - You'll see a notification when done: "APK(s) generated successfully"

4. **Locate APK**
   - Click "locate" in the notification, or
   - Navigate to: `android/app/build/outputs/apk/release/`
   - The APK file will be named: `app-release.apk`

### Step 5: Generate Signed APK (For Production)

For production release, you need to sign the APK:

1. **Create Keystore** (if you don't have one)
   ```bash
   keytool -genkey -v -keystore djthaika-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias djthaika
   ```
   - Store the keystore file securely
   - Remember the password and alias

2. **Configure Signing in Android Studio**
   - Go to `File` → `Project Structure` → `Modules` → `app` → `Signing Configs`
   - Click `+` to add a new config
   - Fill in:
     - Name: `release`
     - Key store file: Select your `.jks` file
     - Key store password: Your keystore password
     - Key alias: `djthaika`
     - Key password: Your key password

3. **Update build.gradle** (if needed)
   - The signing config should be automatically added
   - Check `android/app/build.gradle` for signing configuration

4. **Build Signed APK**
   - `Build` → `Generate Signed Bundle / APK`
   - Select `APK`
   - Select your signing config
   - Choose `release` build variant
   - Click `Finish`

## Quick Build Commands

```bash
# Build React app
npm run build

# Sync with Capacitor
npm run android:sync

# Open in Android Studio
npm run android:open

# Or do all at once
npm run android:build
```

## Troubleshooting

### Issue: Gradle Sync Failed
- **Solution**: Check internet connection, invalidate caches (`File` → `Invalidate Caches / Restart`)
- Update Gradle wrapper if needed

### Issue: Build Errors
- **Solution**: Clean project (`Build` → `Clean Project`) then rebuild
- Check Android SDK versions in `android/build.gradle`

### Issue: Package Name Conflicts
- **Solution**: The package name has been updated to `com.djthaika.ev`
- If you see old package references, clean and rebuild

### Issue: App Name Not Showing
- **Solution**: Check `android/app/src/main/res/values/strings.xml`
- Should show: `<string name="app_name">DJT HAIKA</string>`

## File Locations

- **React Build**: `out/`
- **Android Project**: `android/`
- **APK Output**: `android/app/build/outputs/apk/release/app-release.apk`
- **Capacitor Config**: `capacitor.config.ts`
- **Android Strings**: `android/app/src/main/res/values/strings.xml`
- **MainActivity**: `android/app/src/main/java/com/djthaika/ev/MainActivity.java`

## App Information

- **App Name**: DJT HAIKA
- **Package ID**: com.djthaika.ev
- **Version**: 1.0
- **Min SDK**: 22 (Android 5.1)
- **Target SDK**: 34 (Android 14)

## Next Steps

1. ✅ App name configured: **DJT HAIKA**
2. ✅ Package ID updated: **com.djthaika.ev**
3. ✅ React app built
4. ✅ Capacitor synced
5. ⏭️ Open Android Studio and build APK
6. ⏭️ Test on device/emulator
7. ⏭️ Generate signed APK for production

---

**Ready to build!** Open Android Studio and follow Step 4 above to generate your APK.

