# Privacy Policy

**Effective Date:** September 17, 2026  
**Last Updated:** September 17, 2026  
**Application:** Replix Mobile Application (iOS & Android)  
**Company / Operator:** Replix Team ("Replix", "we", "us", or "our")  
**Contact Email:** [privacy@replix.fit](mailto:privacy@replix.fit) | [support@replix.fit](mailto:support@replix.fit)

---

## 1. Introduction & Core Privacy Principles

Welcome to **Replix**. We believe that world-class fitness tracking and artificial intelligence should never compromise personal privacy. Our platform is built from the ground up around four foundational commitments:

1. **Zero Cloud Video Ingestion**: Your camera video frames and visual imagery are processed **100% on your device** and are **never** transmitted to the cloud or stored on external servers.
2. **Biometric Privacy by Design**: We extract real-time skeletal coordinate geometry strictly in temporary device RAM to calculate workout reps and form accuracy. We do not perform facial recognition, iris scanning, or permanent biometric fingerprinting.
3. **No Selling of Personal Data**: We do not sell, rent, or monetize your personal data, fitness activity, or biometric metrics to third-party data brokers or advertisers.
4. **Transparent User Control**: You maintain complete ownership over your data, including the right to export your workout history or permanently delete your account at any time.

---

## 2. Information We Collect

We collect only the minimum information necessary to authenticate your account, compute your fitness progression, deliver real-time kinematic coaching, and manage subscriptions.

### 2.1 Account & Identity Information
When you create an account or authenticate via Supabase Auth, we collect:
- **Email Address**: Used for account authentication, password recovery, and transactional security notices.
- **Full Name & Username**: Displayed on your public profile, social leaderboards, and friend requests.
- **Profile Avatar**: Optional profile image uploaded by you and stored securely in our private Supabase Storage bucket.
- **Authentication Identifiers**: Secure user IDs generated during email signup or Apple/Google OAuth sign-in.

### 2.2 Physical & Self-Reported Metrics (Optional)
To provide accurate fitness coaching and progress tracking, you may optionally provide:
- **Body Metrics**: Body weight (kg), height (cm), age, and gender.
- **Workout Preferences**: Exercise targets (e.g. daily pushup target, squat goal, plank duration) and voice coach settings.

### 2.3 Workout & Gamification Telemetry
When you complete an AI-tracked workout, we record only the resulting scalar workout data:
- **Exercise Metrics**: Exercise type (pushups, squats, planks), repetition count, duration in seconds, completed sets, and average biomechanical form accuracy percentage.
- **Gamification Progress**: Current workout streak, longest streak, total volume, RPG level, earned XP points, unlocked quest badges, and leaderboard podium trophies.

### 2.4 Device & Push Notification Data
- **Device Information**: Operating system (iOS or Android), app version, and IANA timezone (e.g. `America/New_York` or `Asia/Karachi`) to ensure daily workout streaks calculate accurately at local midnight.
- **Push Notification Tokens**: Device push tokens (via Expo Push / Apple Push Notification service / Firebase Cloud Messaging) to alert you when friends send requests or when you achieve milestone streak badges.

---

## 3. Camera Data & On-Device AI Processing (Crucial Disclosure)

Replix uses your device's camera to power our real-time AI fitness tracking engine. **Please read this section carefully:**

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             ON-DEVICE CAMERA PRIVACY MODEL                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Local Processing Only: Video frames captured by CameraX (Android) or AVFoundation   │
│    (iOS) are fed directly into Google MediaPipe Tasks Vision on your local hardware.   │
│                                                                                        │
│ 2. Volatile RAM Execution: Live frames exist exclusively in temporary memory buffers   │
│    for sub-millisecond inference and are IMMEDIATELY OVERWRITTEN.                      │
│                                                                                        │
│ 3. Zero Cloud Video Streaming: At NO POINT are video recordings, photos, or raw camera │
│    images saved to your disk, uploaded to cloud servers, or shared with third parties. │
│                                                                                        │
│ 4. Scalar Data Extraction: Only mathematical coordinate arrays (33 landmark points)    │
│    are evaluated in memory. Only the final numerical rep count, elapsed seconds, and   │
│    form score (e.g., "15 Reps, 92% Accuracy") are saved to your account database.      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Camera Permission**: The app requests camera access solely when you launch an active workout session. You can revoke camera permissions at any time in your device's system settings.
- **Microphone Permission**: The app requests microphone access solely for optional voice feedback interaction and sound effects during workouts. Audio is processed locally and is never recorded or streamed to servers.

---

## 4. How We Use Your Information

We use collected information solely for legitimate operational and product purposes:
1. **Delivering Real-Time Coaching**: Calculating real-time repetition cadence, angular joint depth, and audible voice feedback during exercise.
2. **Account Management & Authentication**: Authenticating logins, preventing account takeover via 6-digit OTP verification, and managing password resets.
3. **Social Community & Leaderboards**: Rendering global, monthly, and weekly competitive leaderboards and enabling bidirectional friend connections.
4. **Subscription Entitlements**: Verifying Pro entitlement status (access to full workout history and multi-year statistics) via RevenueCat.
5. **Product Telemetry & Reliability**: Analyzing aggregated, de-identified error logs and feature engagement via PostHog to troubleshoot app crashes and optimize frame rate performance.

---

## 5. Third-Party Service Providers

We partner with trusted, industry-standard third-party infrastructure providers to operate the application. These providers process data strictly on our behalf under compliant data protection agreements:

| Service Provider | Purpose in Replix | Data Shared / Processed | Privacy Policy |
| :--- | :--- | :--- | :--- |
| **Supabase, Inc.** | Cloud database, authentication, file storage | Email, username, profile metadata, scalar workout records | [Supabase Privacy Policy](https://supabase.com/privacy) |
| **RevenueCat, Inc.** | In-app purchase verification & receipt validation | Anonymous App User ID, transaction ID, subscription tier | [RevenueCat Privacy Policy](https://www.revenuecat.com/privacy) |
| **PostHog, Inc.** | Product analytics & crash telemetry | De-identified usage events, device model, OS version | [PostHog Privacy Policy](https://posthog.com/privacy) |
| **Expo / 650 Industries** | Application updates & Push notification gateway | Device push tokens, app version runtime | [Expo Privacy Policy](https://expo.dev/privacy) |
| **Google LLC (Firebase / Play)** | Android push delivery (FCM) & Google OAuth | Device tokens, OAuth authentication credentials | [Google Privacy Policy](https://policies.google.com/privacy) |
| **Apple Inc. (APNs / StoreKit)** | iOS push delivery (APNs), Apple OAuth, IAP | Device tokens, Apple ID relay, receipt identifiers | [Apple Privacy Policy](https://www.apple.com/legal/privacy/) |

---

## 6. Financial & Payment Information

Replix does **not** collect, process, or store payment card details, banking credentials, or billing addresses. 

All financial transactions, trials, and renewals are handled directly through:
- **Apple App Store** (for iOS devices via StoreKit)
- **Google Play Store** (for Android devices via Google Play Billing)

Our subscription infrastructure provider, **RevenueCat**, receives only non-sensitive transaction tokens, product identifiers (e.g. `replix_annual`), and expiration dates to validate whether your account is entitled to Pro features.

---

## 7. Data Retention & Account Deletion Policy

We retain your personal data only for as long as your account remains active.

### 7.1 Right to Delete Your Data (Apple & Google Compliant)
You have the permanent right to delete your account and all associated data at any time.

#### How to Request Account Deletion:
1. **In-App Deletion**: Navigate to **Profile > Settings > Account > Delete Account**.
2. **Email Request**: Send an email from your registered address to [privacy@replix.fit](mailto:privacy@replix.fit) with the subject line `"Account Deletion Request"`.

### 7.2 What Happens Upon Deletion:
- **Immediate Database Cascade**: Deleting your account triggers an irreversible PostgreSQL `CASCADE` purge across all database tables.
- **Purged Data Includes**: Your profile record, complete workout history, joint angle metrics, XP transaction ledger, friend connections, device push tokens, and uploaded avatar files.
- **Third-Party Unlinking**: Your user ID is unlinked and anonymized in RevenueCat and analytics systems.

---

## 8. International Data Transfers & Security Safeguards

1. **Encryption in Transit**: All data transmitted between the Replix mobile app and Supabase cloud servers is encrypted using industry-standard **TLS 1.3 / HTTPS**.
2. **Encryption at Rest**: Stored profile and workout databases are encrypted at rest using AES-256 encryption.
3. **Access Controls**: Production databases enforce strict PostgreSQL **Row Level Security (RLS)**, ensuring users can only read and write data belonging to their verified authentication token (`auth.uid()`).
4. **Cross-Border Transfers**: If you access Replix outside the United States, your data may be processed in secure cloud facilities located in the US and EU compliant with GDPR and standard contractual clauses.

---

## 9. Children's Privacy (COPPA / GDPR-K Compliance)

Replix is not directed to children under the age of 13 (or under 16 in the European Economic Area). We do not knowingly collect personal information from children. If we become aware that a child under the applicable age limit has registered an account without verified parental consent, we will take immediate steps to delete that account and all associated data.

If you believe a minor has provided us with personal data, please contact us immediately at [privacy@replix.fit](mailto:privacy@replix.fit).

---

## 10. Rights Under GDPR (EEA/UK) & CCPA/CPRA (California)

Depending on your geographic location, you have specific statutory rights regarding your personal data:

- **Right to Access**: The right to request copies of the personal data we hold about you.
- **Right to Rectification**: The right to update or correct inaccurate profile information directly in the app.
- **Right to Erasure ("Right to be Forgotten")**: The right to have your data permanently purged.
- **Right to Restrict or Object to Processing**: The right to opt out of analytics tracking by contacting our privacy team.
- **Non-Discrimination**: We will never discriminate against you (e.g. by altering subscription pricing or denying service) for exercising your privacy rights.

---

## 11. Changes to This Privacy Policy

We may periodically update this Privacy Policy to reflect technical advancements, new exercise features, or legal requirements. When updates occur, we will revise the **"Last Updated"** date at the top of this document. For material modifications, we will provide in-app banner notifications or email alerts prior to the changes taking effect.

---

## 12. Contact Us

If you have questions, feedback, or concerns regarding this Privacy Policy or our data practices, please contact our Data Protection Officer:

- **Email**: [privacy@replix.fit](mailto:privacy@replix.fit)
- **Support Portal**: [support@replix.fit](mailto:support@replix.fit)
- **Developer / Organization**: Skortan / Replix Engineering Team
