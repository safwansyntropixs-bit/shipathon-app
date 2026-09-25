# Developer Onboarding & Local Environment Setup Guide

This guide details the complete process for setting up, compiling, and running the **Replix** mobile codebase locally on development workstations and physical test devices.

---

## 1. Prerequisites & Tooling Requirements

Because Replix utilizes custom native modules (`modules/pose-landmarker`), Google MediaPipe Tasks Vision (C++ / GPU binary), and React Native's New Architecture (`newArchEnabled=true`), **the app cannot be run in generic Expo Go**. You must run a full native development build via `npx expo run:android` or `npx expo run:ios`.

### 1.1 System Runtimes & Package Managers
- **Node.js**: `v20.x` LTS recommended (Minimum: `v18.18.0+`)
- **Package Manager**: `npm` (`v10.x+`) or `yarn` (A lockfile `package-lock.json` is maintained in the repository)
- **Git**: `2.38+`
- **Expo CLI**: Bundled with project (`npx expo`)

### 1.2 Android Toolchain (Windows / macOS / Linux)
- **Java Development Kit (JDK)**: **OpenJDK 17** (Mandatory for Gradle 8.x and React Native 0.81). *Do not use JDK 21+ as it causes Gradle class compatibility errors.*
- **Android Studio**: Ladybug / Meerkat or later
- **Android SDK Components** (Install via Android Studio SDK Manager):
  - **Android SDK Build-Tools**: `34.0.0` or `35.0.0`
  - **Android SDK Command-line Tools (latest)**
  - **Android SDK Platform-Tools**
  - **Android SDK Platforms**: API Level 34 (`Android 14.0`) and API Level 35 (`Android 15.0`)
  - **Android NDK**: `26.1.10909125` (Required for C++ / MediaPipe GPU compilation)
  - **CMake**: `3.22.1+`
- **Environment Variables**:
  - `ANDROID_HOME`: Path to your Android SDK (e.g., `%LOCALAPPDATA%\Android\Sdk` on Windows or `$HOME/Library/Android/sdk` on macOS).
  - Add to `PATH`: `%ANDROID_HOME%\platform-tools`, `%ANDROID_HOME%\tools`, `%ANDROID_HOME%\cmdline-tools\latest\bin`.
  - `JAVA_HOME`: Path to JDK 17 (e.g., `C:\Program Files\Eclipse Adoptium\jdk-17...`).

### 1.3 iOS Toolchain (macOS Only)
- **macOS**: Sonoma 14+ or Sequoia 15+
- **Xcode**: `15.4+` or `16.x`
- **Command Line Tools**: Installed via `xcode-select --install`
- **CocoaPods**: `1.14.0+` (`sudo gem install cocoapods` or `brew install cocoapods`)
- **Ruby**: System Ruby or Ruby `3.2+` managed via `rbenv` / `rvm`

### 1.4 Hardware Requirements for AI Tracking
- **Physical Device (Highly Recommended)**:
  - **Android**: Physical device with Android 10+ (API 29+), Camera with $\ge 2.0$ Megapixels, and OpenGL ES 3.0+ hardware acceleration.
  - **iOS**: iPhone 11 or newer running iOS 15.1+.
- **Emulators / Simulators**:
  - Emulators can run the UI, authentication, social leaderboards, and settings.
  - For camera tracking in the Android Emulator: Go to *Virtual Device Settings > Camera > Front Camera / Back Camera* and set to **Webcam0** (Live PC camera pass-through).

---

## 2. Setup & Installation

### Step 1: Clone the Repository
```bash
git clone https://github.com/skortan/repsync-app.git
cd repsync-app
```

### Step 2: Install NPM Dependencies
Install the exact version-pinned dependencies from `package-lock.json`:
```bash
npm install
```

> [!IMPORTANT]
> Notice the local dependency in `package.json`: `"pose-landmarker": "file:./modules/pose-landmarker"`. `npm install` automatically links this in-tree native module.

### Step 3: Configure Environment Variables
Copy `.env.example` to create your local `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill in the required API keys:
- `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase Project URL (`https://xyz.supabase.co`).
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase public anonymous API key.
- `EXPO_PUBLIC_POSTHOG_API_KEY`: PostHog analytics key (or placeholder string for offline dev).
- `EXPO_PUBLIC_POSTHOG_HOST`: `https://us.i.posthog.com`
- `EXPO_PUBLIC_REVENUECAT_APPLE_KEY`: RevenueCat iOS public key.
- `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY`: RevenueCat Android public key (`goog_...`).

### Step 4: Verify Native Assets & Google Services
- **Android**: Ensure `google-services.json` exists in the project root directory (referenced in `app.config.js`).
- **MediaPipe Task Asset**: The `pose_landmarker_lite.task` model file is bundled inside `modules/pose-landmarker/android/src/main/assets/pose_landmarker_lite.task`.

---

## 3. Running Locally

### 3.1 Android Build & Run

#### A. Physical Device (USB / Wireless Debugging)
1. Enable **Developer Options** and **USB Debugging** on your Android device.
2. Connect the device via USB and confirm connection:
   ```bash
   adb devices
   ```
3. Compile and launch the development build:
   ```bash
   npm run android
   # or
   npx expo run:android
   ```
4. This command compiles the native Android Gradle project, builds the C++ / Kotlin `pose-landmarker` TurboModule, installs the APK, and starts the Metro bundler.

#### B. Android Studio Emulator
1. Launch an AVD (Android Virtual Device) with API 34+.
2. Run:
   ```bash
   npx expo run:android
   ```

---

### 3.2 iOS Build & Run (macOS Only)

#### A. iOS Simulator
1. Ensure Xcode Simulator is open.
2. Run:
   ```bash
   npm run ios
   # or
   npx expo run:ios
   ```

#### B. Physical iPhone
1. Connect iPhone via USB.
2. Open `ios/replix.xcworkspace` in Xcode (after generating via `npx expo prebuild`).
3. Select your **Personal Team** in *Signing & Capabilities*.
4. Run via terminal:
   ```bash
   npx expo run:ios --device
   ```

---

### 3.3 Clean Rebuilds & Prebuild Regeneration
If you modify native files in `modules/pose-landmarker`, `app.config.js`, or native Android/iOS dependencies, regenerate the native projects cleanly:

```bash
# Clean prebuild and start compilation
npx expo prebuild --clean
npx expo run:android
```

---

## 4. Testing Camera & AI Tracking Locally

1. **Permissions Request**: When launching the app, accept the Camera and Microphone system permissions.
2. **Device Orientation**:
   - Pushups and Planks are optimized for **Landscape** tracking with the device resting against a stable surface.
   - Squats can be tracked in **Portrait** or **Landscape**.
3. **Anti-Cheat Validation Testing**:
   - Stand sideways to the camera for pushups; if you face frontally, the engine triggers a form warning.
   - Performing knee-bent pushups will not count as reps due to kinematic knee angle rules ($< 140^\circ$).

---

## 5. Common Troubleshooting & Build Errors

### 1. `PoseLandmarkerView` Native View Manager Load Error
- **Symptom**: Red screen or console error: `"Failed to load PoseLandmarker native module"`.
- **Cause**: The app was launched using generic Expo Go rather than a native Development Client build.
- **Fix**: Run `npx expo run:android` or `npx expo run:ios`. Expo Go cannot load in-tree C++/Kotlin native modules.

---

### 2. `Unsupported class file major version 65` (Java Version Mismatch)
- **Symptom**: Gradle compilation fails with class version errors during `:app:compileDebugJavaWithJavac`.
- **Cause**: Gradle 8.8 does not support JDK 21 or JDK 22.
- **Fix**: Install OpenJDK 17 and configure `JAVA_HOME`:
  ```bash
  # Windows PowerShell
  $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.10.7-hotspot"
  
  # macOS / Linux
  export JAVA_HOME=$(/usr/libexec/java_home -v 17)
  ```

---

### 3. Low Camera Resolution Warning (`onCameraWarning`)
- **Symptom**: In-app banner: `"Your camera resolution (~1.2MP) is below recommended 2.0MP"`.
- **Cause**: The Android device or emulator's active camera sensor resolution is below the 2.0 MP accuracy threshold in `PoseLandmarkerView.kt`.
- **Fix**: Switch camera facing from front to back, or on emulators, increase the virtual camera resolution in AVD Manager.

---

### 4. `PGRST303` JWT Clock Skew Error on Supabase Queries
- **Symptom**: Auth requests fail with token expiration or clock skew warnings.
- **Cause**: Development workstation or emulator clock has drifted from UTC time.
- **Fix**:
  1. The app features built-in 3x automatic retry via `customFetch` in `utils/supabase.ts`.
  2. Permanently resolve by enabling "Set time automatically" in your OS and mobile device settings.

---

### 5. RevenueCat Fallback Plans Rendered in UI
- **Symptom**: Subscriptions screen displays fallback `$29.99` and `$4.99` plans instead of live offerings.
- **Cause**: Missing or unconfigured `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` / `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY` in `.env`.
- **Fix**: The codebase includes intentional graceful fallbacks in `premiumService.ts` for offline and demo development. To test live sandbox purchases, provide active RevenueCat API keys and use a Google Play License Tester or Apple Sandbox account.

---

### 6. Android Build Cache & Metro Cache Reset
If encountering unresolved bundling errors after updating dependencies:
```bash
# Reset Metro cache
npx expo start --clear

# Clean Android Gradle cache
cd android
./gradlew clean
cd ..
npx expo run:android
```
