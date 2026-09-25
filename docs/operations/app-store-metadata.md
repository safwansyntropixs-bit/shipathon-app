# Replix App Store & Google Play Metadata Guide

**Document Version:** 1.0.0  
**Effective Date:** September 17, 2026  
**Application Name:** Replix  
**Bundle ID (iOS):** `com.skortan.replix`  
**Package Name (Android):** `com.skortan.replix`  
**Target Expo SDK:** `54.0.37` (React Native 0.81.5)  
**Primary Language:** English (US)  

---

## 1. Store Configuration & Identity Matrix

Extracted directly from [`app.config.js`](file:///d:/rs/app.config.js) and project assets:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              STORE CONFIGURATION METADATA                              │
├───────────────────┬────────────────────────────────────────────────────────────────────┤
│ Property          │ Value / Setting                                                    │
├───────────────────┼────────────────────────────────────────────────────────────────────┤
│ **App Name**      │ Replix                                                             │
│ **App Slug**      │ replix                                                             │
│ **Publisher**     │ Skortan                                                            │
│ **Current Version**│ `1.0.0` (Android `versionCode: 2`, iOS `buildNumber: 1`)            │
│ **Scheme**        │ `replix://`                                                        │
│ **Bundle ID (iOS)**│ `com.skortan.replix`                                              │
│ **Package (Android)**│ `com.skortan.replix`                                             │
│ **Primary Category**│ Health & Fitness                                                 │
│ **Secondary Category**│ Sports / Performance Tracking                                  │
│ **Age Rating**    │ 12+ (Infrequent / Mild Medical or Fitness References)               │
│ **Pricing Tier**  │ Free with In-App Purchases (Replix Pro: $4.99/mo, $29.99/yr)        │
│ **Support URL**   │ `https://replix.fit/support` (or support@replix.fit)               │
│ **Marketing URL** │ `https://replix.fit`                                               │
│ **Privacy Policy**│ `https://replix.fit/privacy`                                       │
└───────────────────┴────────────────────────────────────────────────────────────────────┘
```

---

## 2. Native Permissions & Privacy Justifications

Paste these exact justifications into **App Store Connect (App Privacy)** and **Google Play Console (App Content > Permissions)**:

### 2.1 Camera Access (`NSCameraUsageDescription` / Android `CAMERA`)
- **Exact String in `app.config.js`:**
  ```
  "Allow Replix to access your camera"
  ```
- **App Store Reviewer Justification (Paste verbatim):**
  > *"Replix uses the camera solely for on-device real-time computer vision pose estimation to track repetitions and evaluate exercise form. Video frames are processed strictly in volatile RAM (<33ms) via Google MediaPipe on the local device and are never recorded, saved to storage, or transmitted to any server over the network."*

### 2.2 Microphone Access (`NSMicrophoneUsageDescription` / Android `RECORD_AUDIO`)
- **Exact String in `app.config.js`:**
  ```
  "Allow Replix to access your microphone"
  ```
- **App Store Reviewer Justification (Paste verbatim):**
  > *"Used optionally for hands-free workout voice control and voice coaching cues during active workout sessions."*

### 2.3 Push Notifications (`POST_NOTIFICATIONS`)
- **App Store / Google Play Justification:**
  > *"Used to deliver daily workout streak reminders, morning training briefings, and friend request notifications."*

---

## 3. App Store & Google Play Store Listing Copy

### 3.1 App Store Listing (Apple iOS)

- **App Title (30 Chars max):**  
  `Replix: AI Workout Tracker` (26 / 30)

- **Subtitle (30 Chars max):**  
  `Smart Reps & Form Coaching` (26 / 30)

- **Keywords (100 Chars max, comma-separated):**  
  `workout,fitness,ai,rep counter,pushups,squats,plank,pose tracking,calisthenics,bodyweight,gym,trainer` (98 / 100)

- **Promotional Text (170 Chars max):**  
  `Transform your training with real-time AI camera tracking. Hands-free rep counting, instant form corrections, and competitive global leaderboards. 100% private & on-device.`

---

### 3.2 Google Play Store Listing (Android)

- **App Name (30 Chars max):**  
  `Replix: AI Workout Tracker` (26 / 30)

- **Short Description (80 Chars max):**  
  `Real-time AI pose tracking, smart rep counting & automated workout form coaching.` (79 / 80)

---

### 3.3 Full Store Description (Apple App Store & Google Play)

```markdown
Elevate your bodyweight training with Replix—the intelligent AI fitness tracker that watches your movement, counts every repetition, and corrects your form in real time using your phone’s camera. 

No smartwatches, sensors, or manual screen tapping required. Just prop your phone up, step back, and train.

### 🤖 REAL-TIME ON-DEVICE AI TRACKING
Powered by state-of-the-art computer vision models, Replix tracks 33 3D skeletal landmarks at 60 FPS to analyze your biomechanics instantly:
• Push-Ups: Evaluates elbow flexion, full lockouts, and back alignment.
• Squats: Enforces true parallel depth, hip tracking, and lockout extension.
• Planks: Measures real-time torso alignment and pauses if your hips sag.

### 🔊 VOICE COACHING & AUDIO CUES
Receive instant feedback during your sets just like working with a personal trainer:
• Real-time voice cues prompt you to drop lower, fix hip alignment, or lock out.
• High-accuracy rep chimes and haptic pulses keep your momentum going.

### 📈 DEEP ANALYTICS & PERSONAL RECORDS
• Track training volume, daily repetition totals, and mechanical accuracy curves.
• Celebrate all-time Personal Records (PRs) across your favorite movements.
• Interactive workout calendar and historical archive.

### 🏆 GAMIFICATION & GLOBAL LEADERBOARDS
• Earn XP for every clean rep and level up from Rookie to Olympian.
• Complete Daily & Weekly Quests to earn exclusive milestone trophies.
• Compete with friends and athletes worldwide on Weekly and Monthly leaderboards.

### 🔒 100% BIOMETRIC PRIVACY GUARANTEE
Your privacy is our highest priority:
• All computer vision inference happens 100% locally on your device.
• Camera frames are analyzed in volatile memory and immediately discarded.
• Zero video feeds or photos are ever saved or uploaded to the cloud.

---

SUBSCRIPTION INFORMATION:
Replix offers an optional Replix Pro auto-renewing subscription ($4.99/month or $29.99/year with a 7-Day Free Trial) to unlock advanced monthly analytics, global monthly leaderboards, and full history archives. Payments are charged through your Apple ID / Google Play account upon purchase confirmation and auto-renew unless cancelled at least 24 hours before the period ends.

Terms of Service: https://replix.fit/terms
Privacy Policy: https://replix.fit/privacy
Support: support@replix.fit
```

---

## 4. Release Notes / "What's New in Version 1.0.0"

```markdown
Welcome to the initial public release of Replix!
• Real-time AI pose tracking for Push-ups, Squats, and Plank Stabilizer.
• 60 FPS skeletal overlay with instant biomechanical accuracy scoring.
• Real-time voice coach audio guidance and rep confirmation sounds.
• Weekly and Monthly global leaderboards and friend challenges.
• 100% on-device vision processing for complete privacy.
```
