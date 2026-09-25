# Replix UI Copy & Voice Guidelines

**Document Version:** 1.0.0  
**Effective Date:** September 17, 2026  
**Application:** Replix Mobile Application (`com.skortan.replix`)  
**Primary Language:** English (US)  
**Localization Status:** Hardcoded English (Zero multi-language i18n bundles currently installed)  

---

## 1. Brand Tone of Voice & Editorial Principles

Replix speaks with the precision of a biomechanical sports scientist and the intensity of an elite strength coach:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               REPLIX VOICE ARCHITECTURE                                │
├──────────────────────────┬─────────────────────────────────────────────────────────────┤
│ Core Trait               │ How It Manifests in Copy & Audio                            │
├──────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **1. Direct & Urgent**   │ Short, punchy sentences. No conversational filler or        │
│                          │ fluff. Designed to be heard clearly during strenuous reps. │
├──────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **2. Biomechanically     │ Uses specific angular and postural cues ("Drop chest to     │
│    Precise**             │ 90 degrees", "Thighs parallel to floor", "Hips sagging").   │
├──────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **3. Unapologetically    │ Strict rep validation. No participation trophies for        │
│    Strict**              │ shallow reps; calls out form breakdowns immediately.        │
├──────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **4. Clean Cybernetic**  │ UI copy emphasizes telemetry, tracking, and calibration     │
│                          │ ("Performance Intel", "Biomechanical Accuracy", "PRs").    │
└──────────────────────────┴─────────────────────────────────────────────────────────────┘
```

---

## 2. Real-Time Voice Coach Audio Speech Catalog (`expo-speech`)

All speech cues are spoken dynamically through the device text-to-speech engine during live workout sessions:

### 2.1 Push-Up Voice Feedback ([`PushupEngine.ts`](file:///d:/rs/domain/PushupEngine.ts#L190-L222))
- **Rep Validated:** `"Rep counted."`
- **Side Profile Required:** `"For accurate tracking, please position yourself sideways to the camera."`
- **Very Shallow Rep (Elbow > 120°):** `"Come on, drop that chest! You barely bent your arms. Get those elbows to a 90-degree angle!"`
- **Borderline Shallow Rep (Elbow 95°–120°):** `"Almost there, but bend those elbows a bit more! Let's hit that perfect 90-degree angle!"`
- **Minor Depth Fault:** `"Push through the full range of motion! Lower your chest just a little bit more."`

### 2.2 Squat Voice Feedback ([`SquatEngine.ts`](file:///d:/rs/domain/SquatEngine.ts#L220-L248))
- **Rep Validated:** `"Rep counted."`
- **Too Shallow to Count (Accuracy < 30%):** `"Rep too shallow to count. Bend deeper!"`
- **Very Shallow (Knee > 120°):** `"Please bend your knees deeper. That was a very shallow squat."`
- **Above Parallel (Knee 100°–120°):** `"For a full squat, please ensure your thighs reach parallel to the floor."`
- **Near Parallel (Knee 90°–100°):** `"Almost perfect. Drop just a bit lower to hit parallel."`
- **Calf Collision / Tension Loss:** `"Please avoid resting on your calves. Maintain tension at the bottom of the squat."`

### 2.3 Plank Hold Voice Feedback ([`PlankEngine.ts`](file:///d:/rs/domain/PlankEngine.ts#L134-L210))
- **Pose Established:** `"Perfect alignment. Timer started."` / `"Form perfect."`
- **Leg Deviation:** `"Keep your legs straight!"` / `"Please keep your legs straight."`
- **Hip Movement:** `"Hips moving!"`
- **Shoulder Shift:** `"Shoulders shifting!"`
- **Arm Shift:** `"Arms moving!"`
- **Alignment Lost:** `"Body alignment lost!"` / `"Form broken. Timer paused."`
- **Initial Setup:** `"Rest your elbows on the surface."` / `"Get into plank position."`

---

## 3. Error Handling UX & Critical Failure Messaging

When hardware, network, or validation exceptions occur, the app displays structured, actionable feedback:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                SYSTEM ERROR MESSAGING CATALOG                                          │
├────────────────────┬─────────────────────────────────────────────────┬─────────────────────────────────┤
│ Failure Scenario   │ Displayed Text / Copy                           │ Presentation Medium             │
├────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────┤
│ **Camera Denied**  │ *"Camera permission is required to analyze      │ Full-screen overlay with        │
│                    │ exercise form and count repetitions."*          │ `Linking.openSettings()` CTA    │
├────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────┤
│ **Low Light**      │ *"Lighting too dim for reliable tracking.       │ Workout session warning toast   │
│                    │ Please move to a brighter area."*               │                                 │
├────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────┤
│ **Device Tilted**  │ *"Phone appears tilted or fallen over. Place    │ Workout session rotation banner │
│                    │ device upright facing your exercise space."*    │                                 │
├────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────┤
│ **Invalid Email**  │ *"Please enter a valid email address."*         │ Auth form inline validation     │
├────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────┤
│ **Weak Password**  │ *"Password must be at least 8 characters long."*│ Auth form inline validation     │
├────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────┤
│ **Invalid OTP**    │ *"Could not verify code. Please check the       │ OTP screen alert toast          │
│                    │ 6-digit code sent to your email."*              │                                 │
├────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────┤
│ **Invalid Age**    │ *"Please enter a valid age between 13 and 100."*│ Physical metrics error toast    │
├────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────┤
│ **Invalid Weight** │ *"Please enter a valid weight in kg (20–150)."* │ Physical metrics error toast    │
├────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────┤
│ **Invalid Height** │ *"Please enter a valid height in FT.IN format   │ Physical metrics error toast    │
│                    │ (e.g. 5.11). Inches must be between 0 and 11."* │                                 │
├────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────┤
│ **Purchase Error** │ *"Failed to complete purchase. Please check     │ Paywall alert modal             │
│                    │ your App Store / Google Play billing details."* │                                 │
├────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────┤
│ **Clock Skew**     │ Handled silently: Retries automatically after   │ Background global interceptor   │
│ (`PGRST303`)       │ 1,000ms delay without alarming the user.        │                                 │
└────────────────────┴─────────────────────────────────────────────────┴─────────────────────────────────┘
```

---

## 4. Toast & In-App Notification Standards

Configured in [`utils/toastConfig.tsx`](file:///d:/rs/utils/toastConfig.tsx):

- **Dynamic Island Toast Architecture:**
  - Container: Futuristic Dynamic Island card (`borderRadius: 22`), spanning 92% screen width with centered margin, pitch black surface (`#0C0C0E`), subtle glassmorphic border, ambient themed glow, and high-elevation shadow.
  - Positioning: Slides down from the top status / dynamic island area with generous top offset (`74pt` iOS / `52pt` Android) for clear top clearance.
  - Feedback: Triggers subtle tactile haptic feedback (`Haptics.impactAsync`) on appearance.
  - Interaction: Interactive swipe/drag-to-dismiss gesture (drag left or right to dismiss with fluid translation & fade) plus tap-to-dismiss support.
- **Success Toast (`toastConfig.success`):**
  - Leading Island Badge: Glowing emerald circular capsule with `CheckCircle2` icon (`#4ADE80`), translucent background (`rgba(58, 158, 102, 0.22)`), and glowing border.
  - Title (`text1`): `font-outfitBold text-[13px] text-white`.
  - Description (`text2`): `font-outfitReg text-[11px] text-zinc-400`.
- **Error Toast (`toastConfig.error`):**
  - Leading Island Badge: Glowing crimson circular capsule with `AlertCircle` icon (`#F87171`), translucent background (`rgba(239, 68, 68, 0.22)`), and glowing border.
  - Title (`text1`): `font-outfitBold text-[13px] text-white`.
  - Description (`text2`): `font-outfitReg text-[11px] text-zinc-400`.
- **Gamification XP Toast ([`XPToast.tsx`](file:///d:/rs/components/ui/XPToast.tsx)):**
  - Visual: Slides in from top with green flame or gold trophy badge.
  - Text Pattern: `"[Quest/Trophy Name]"` + `"+[XP] XP Unlocked"`.

---

## 5. Localization & Internationalization (i18n) Status

### 5.1 Current Architecture
- **Language:** 100% of user interface copy, navigation titles, settings descriptions, and voice coach speeches are **hardcoded in English (US)**.
- **`expo-localization` Usage:** The library `expo-localization` is installed and imported in [`services/user/profileService.ts`](file:///d:/rs/services/user/profileService.ts#L3), but its role is strictly limited to reading the device's IANA **Timezone identifier** (`Localization.getCalendars()[0]?.timeZone`) to compute midnight streak resets accurately across time zones.

### 5.2 Future Internationalization (i18n) Recommendations
To support multi-language localizations (e.g., Spanish, German, Japanese) in future versions:
1. Install `i18next` and `react-i18next`.
2. Extract all strings from `domain/*Engine.ts`, `app/**/*.tsx`, and `components/**/*.tsx` into structured JSON translation namespaces (`en/workout.json`, `en/auth.json`, `en/onboarding.json`).
3. Bind `expo-speech` voice locale to `Localization.getLocales()[0]?.languageTag` so the voice coach synthesizes audio in the user's native language.
