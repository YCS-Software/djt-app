# Android APK Build Guide - API URL Configuration

This guide explains how to build Android APK with different API URLs for different environments.

## 📋 Table of Contents
1. [Quick Start](#quick-start)
2. [Environment Variables](#environment-variables)
3. [Build Variants](#build-variants)
4. [Building APK](#building-apk)
5. [Changing API URL](#changing-api-url)

---

## 🚀 Quick Start

### Build APK with Default URL
```bash
# Build for production
npm run build
npx cap sync android
cd android
./gradlew assembleProductionRelease
```

### Build APK with Custom URL
1. Edit `.env.production` file
2. Set `VITE_API_URL=your-api-url`
3. Build APK

---

## 🔧 Environment Variables

### Available Environment Files

1. **`.env.development`** - For development builds
2. **`.env.staging`** - For staging builds  
3. **`.env.production`** - For production builds

### Setting API URL

Edit the corresponding `.env` file:

```bash
# .env.production
VITE_API_URL=http://your-production-api.com/api

# .env.staging
VITE_API_URL=http://your-staging-api.com/api

# .env.development
VITE_API_URL=http://your-dev-api.com/api
```

---

## 🏗️ Build Variants

The Android app supports three build variants:

### 1. Development
- **Application ID**: `com.djthaika.ev.dev`
- **Version**: `1.0-dev`
- **API URL**: Set in `.env.development` or `build.gradle`

### 2. Staging
- **Application ID**: `com.djthaika.ev.staging`
- **Version**: `1.0-staging`
- **API URL**: Set in `.env.staging` or `build.gradle`

### 3. Production
- **Application ID**: `com.djthaika.ev`
- **Version**: `1.0`
- **API URL**: Set in `.env.production` or `build.gradle`

---

## 📦 Building APK

### Method 1: Using Environment Variables (Recommended)

#### Step 1: Set Environment Variable
```bash
# For production
export VITE_API_URL=http://your-api-url.com/api

# Or create/edit .env.production file
echo "VITE_API_URL=http://your-api-url.com/api" > .env.production
```

#### Step 2: Build Web Assets
```bash
npm run build
```

#### Step 3: Sync with Capacitor
```bash
npx cap sync android
```

#### Step 4: Build APK
```bash
cd android
./gradlew assembleProductionRelease
```

The APK will be generated at:
```
android/app/build/outputs/apk/production/release/app-production-release.apk
```

### Method 2: Using Build Variants

#### Build Development APK
```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDevelopmentDebug
```

#### Build Staging APK
```bash
npm run build
npx cap sync android
cd android
./gradlew assembleStagingRelease
```

#### Build Production APK
```bash
npm run build
npx cap sync android
cd android
./gradlew assembleProductionRelease
```

---

## 🔄 Changing API URL

### Option 1: Edit Environment File (Recommended)

1. **For Production Build:**
   ```bash
   # Edit .env.production
   VITE_API_URL=http://your-new-api-url.com/api
   ```

2. **Build:**
   ```bash
   npm run build
   npx cap sync android
   cd android
   ./gradlew assembleProductionRelease
   ```

### Option 2: Edit build.gradle

1. **Open:** `android/app/build.gradle`

2. **Find the production flavor:**
   ```gradle
   production {
       dimension "environment"
       buildConfigField "String", "API_BASE_URL", '"http://your-api-url.com/api"'
       resValue "string", "api_base_url", "http://your-api-url.com/api"
   }
   ```

3. **Change the URL:**
   ```gradle
   production {
       dimension "environment"
       buildConfigField "String", "API_BASE_URL", '"http://new-api-url.com/api"'
       resValue "string", "api_base_url", "http://new-api-url.com/api"
   }
   ```

4. **Build:**
   ```bash
   cd android
   ./gradlew assembleProductionRelease
   ```

### Option 3: Command Line (One-time Build)

```bash
# Set environment variable and build
VITE_API_URL=http://your-api-url.com/api npm run build
npx cap sync android
cd android
./gradlew assembleProductionRelease
```

---

## 📝 Build Scripts

Add these scripts to `package.json` for easier building:

```json
{
  "scripts": {
    "build:dev": "vite build --mode development",
    "build:staging": "vite build --mode staging",
    "build:prod": "vite build --mode production",
    "android:build:dev": "npm run build:dev && npx cap sync android && cd android && ./gradlew assembleDevelopmentDebug",
    "android:build:staging": "npm run build:staging && npx cap sync android && cd android && ./gradlew assembleStagingRelease",
    "android:build:prod": "npm run build:prod && npx cap sync android && cd android && ./gradlew assembleProductionRelease"
  }
}
```

Then use:
```bash
npm run android:build:prod
```

---

## 🔍 Verify API URL in APK

### Method 1: Check Build Output
The API URL is embedded during build. Check the build logs for:
```
VITE_API_URL=http://your-api-url.com/api
```

### Method 2: Check in App
Add a debug screen in your app to display the current API URL:
```typescript
console.log('API URL:', import.meta.env.VITE_API_URL);
```

---

## ⚠️ Important Notes

1. **Always rebuild** after changing API URL
2. **Clear build cache** if URL doesn't update:
   ```bash
   cd android
   ./gradlew clean
   ```

3. **For production**, use HTTPS URLs:
   ```
   VITE_API_URL=https://api.yourdomain.com/api
   ```

4. **For local testing** on physical device:
   - Use your computer's local IP (e.g., `192.168.1.100`)
   - Not `localhost` or `127.0.0.1`

5. **For Android emulator**:
   - Use `10.0.2.2` instead of `localhost`

---

## 🐛 Troubleshooting

### API URL Not Changing

1. **Clear build cache:**
   ```bash
   rm -rf android/app/build
   cd android
   ./gradlew clean
   ```

2. **Rebuild from scratch:**
   ```bash
   npm run build
   npx cap sync android
   cd android
   ./gradlew clean
   ./gradlew assembleProductionRelease
   ```

### Build Fails

1. **Check Gradle version:**
   ```bash
   cd android
   ./gradlew --version
   ```

2. **Sync project:**
   ```bash
   npx cap sync android
   ```

---

## 📱 Example Build Commands

### Production Build with Custom URL
```bash
# 1. Set API URL
echo "VITE_API_URL=https://api.production.com/api" > .env.production

# 2. Build
npm run build
npx cap sync android

# 3. Generate APK
cd android
./gradlew assembleProductionRelease
```

### Development Build
```bash
# 1. Set API URL
echo "VITE_API_URL=http://192.168.1.100:5001/api" > .env.development

# 2. Build
npm run build --mode development
npx cap sync android

# 3. Generate APK
cd android
./gradlew assembleDevelopmentDebug
```

---

## 📚 Additional Resources

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Capacitor Android Guide](https://capacitorjs.com/docs/android)
- [Gradle Build Variants](https://developer.android.com/studio/build/build-variants)

---

## ✅ Quick Reference

| Environment | File | Build Command |
|------------|------|---------------|
| Development | `.env.development` | `npm run build:dev` |
| Staging | `.env.staging` | `npm run build:staging` |
| Production | `.env.production` | `npm run build:prod` |

| Variant | APK Location |
|---------|-------------|
| Development | `android/app/build/outputs/apk/development/debug/` |
| Staging | `android/app/build/outputs/apk/staging/release/` |
| Production | `android/app/build/outputs/apk/production/release/` |
