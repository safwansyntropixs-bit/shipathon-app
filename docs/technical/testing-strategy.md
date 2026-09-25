# Testing Strategy & Quality Assurance Specification

## 1. Executive Summary & Current State of Testing

### 1.1 Reality of the Codebase
A comprehensive scan of the repository reveals that **formal automated test runners (such as Jest, Detox, or Maestro) are currently not configured in `package.json`**. 

The current quality assurance framework in this codebase relies on:
1. **Static Analysis & Type Checking**: TypeScript 5.9 strict type checking and ESLint 9 (`eslint-config-expo`).
2. **In-Code Component & Service Fallbacks**: Mock shims for camera previews, fallback RevenueCat packages, and simulated analytics networks.
3. **Database Test Fixtures**: Pre-configured SQL seed scripts in `schema.sql` containing test user profiles and opponents for leaderboard verification.
4. **Rigorous Physical Device Manual QA Protocols**: Dedicated testing checklists for the hardware-accelerated MediaPipe computer vision engine, CameraX lifecycle, and RevenueCat sandbox purchases.

This document serves as both the **authoritative Manual QA Release Gate Protocol** and the **Target Automated Testing Architecture Blueprint** designed specifically for Replix's React Native (New Architecture) + Supabase stack.

---

## 2. Static Analysis & Current Mocking Strategies

### 2.1 Static Code Quality Verification
The project enforces code quality and type safety via two primary CLI commands:

```bash
# 1. TypeScript Strict Compilation Check
npx tsc --noEmit

# 2. Expo ESLint Linter
npm run lint
```

### 2.2 Built-In Codebase Mocks & Graceful Fallbacks

| Subsystem | File Reference | Mocking / Fallback Implementation |
| :--- | :--- | :--- |
| **Camera & Vision Shims** | `components/workout/CameraPreview.tsx` | Fallback component shims for mock device interfaces (`Camera`, `useCameraDevice`, `useFrameProcessor`) to prevent runtime crashes during web or non-native builds. |
| **RevenueCat Offerings** | `services/core/premiumService.ts` | Hardcoded fallback packages (`replix_annual` at `$29.99` with 7-day trial, `replix_monthly` at `$4.99`) allowing full UI inspection and layout testing without live StoreKit connectivity. |
| **Analytics Telemetry** | `repositories/core/analyticsRepository.ts` | Local in-memory queue (`eventQueue`) that batches events and simulates network transmission latency via `setTimeout(resolve, 300)`. |
| **Database Seed Fixtures** | `schema.sql` (Lines 490–670) | Test users and opponent profiles (`sarah.shreds@replix.io`, `zain.beast@replix.io`, etc.) populated with sample workouts, XP transactions, and friend relations. |

---

## 3. Manual QA & Release Verification Matrix

Before publishing any production build via EAS (`eas build --profile production`), the following comprehensive manual verification matrix **must be executed on physical hardware (iOS and Android)**.

### 3.1 AI Vision & Kinematic Tracking QA Matrix

```
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| ID | Test Scenario               | Execution Steps                                           | Expected Result                               |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| V1 | Camera Permission Grant     | Launch fresh install -> Tap "Start Workout"               | OS permission dialog appears; accepting       |
|    |                             |                                                           | activates live video preview.                 |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| V2 | Skeleton Overlay Rendering  | Position body in camera view                              | 33-point SVG wireframe aligns with joints     |
|    |                             |                                                           | in Emerald Green (#3FA76A).                   |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| V3 | Low Light / Occlusion       | Step completely out of camera view                        | Skeleton turns Crimson Red (#DC143C);         |
|    |                             |                                                           | Voice coach: "Body not detected".             |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| V4 | Pushup Side-Profile Rule    | Attempt pushup facing camera frontally                    | Form warning: "Position yourself sideways".   |
|    |                             |                                                           | Reps are NOT incremented.                     |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| V5 | Pushup Rep & Depth Check    | Rotate sideways -> Perform full rep with elbows <= 90 deg | Rep count increments (+1); Chime plays;       |
|    |                             |                                                           | Accuracy displays >= 85%.                     |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| V6 | Pushup Knee-Bend Anti-Cheat | Perform pushup with knees on floor (Knee angle < 140 deg) | Rep is rejected; No count incremented.        |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| V7 | Squat Parallel Depth Check  | Perform squat lowering hips parallel to knees             | Ratio computes parallel (85 deg); Rep counts; |
|    |                             |                                                           | Voice coach provides cadence feedback.        |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| V8 | Plank Stability Hold        | Hold plank with straight torso (162-198 deg alignment)    | Timer accumulates valid_active_seconds;       |
|    |                             | Sag hips or rest on knees (< 140 deg)                     | Timer pauses immediately on form breakdown.   |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
```

---

### 3.2 Authentication & Password Recovery QA Matrix

```
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| ID | Test Scenario               | Execution Steps                                           | Expected Result                               |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| A1 | Email/Password Registration | Fill Full Name, Email, Password -> Submit                 | OTP verification screen opens; SMTP delivers  |
|    |                             |                                                           | 6-digit numeric verification code.            |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| A2 | 6-Digit Auto-Submit OTP     | Type 6-digit code into input boxes                        | Code verifies automatically on 6th digit;     |
|    |                             |                                                           | Redirects to (tabs)/home.                     |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| A3 | Progressive Resend Limiter  | Tap "Resend Code" repeatedly                              | Cooldown increases: 60s -> 120s -> 300s;      |
|    |                             |                                                           | Cooldown persists across back navigation.     |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| A4 | Anti-Enumeration Shield     | Request password reset on unregistered email              | UI shows identical success notification;      |
|    |                             |                                                           | check_email_exists skips SMTP (Zero cost).    |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| A5 | Social OAuth (Apple/Google) | Tap "Continue with Apple" or "Continue with Google"       | System browser opens -> Completes auth ->     |
|    |                             |                                                           | Redirects to replix://auth-callback -> Home.  |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| A6 | Session Persistence         | Close app -> Kill background process -> Re-open           | User remains authenticated on (tabs)/home     |
|    |                             |                                                           | without splash screen flicker.                |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
```

---

### 3.3 Monetization & RevenueCat Paywall QA Matrix

```
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| ID | Test Scenario               | Execution Steps                                           | Expected Result                               |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| M1 | Free Tier History Gate      | Free user queries workout history older than current month| RLS blocks historical records; Only current   |
|    |                             |                                                           | month workouts are returned.                  |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| M2 | Free Tier Analytics Gate    | Free user selects "Monthly" or "Yearly" stats             | get_statistics_range_data returns             |
|    |                             |                                                           | isLocked: true; Paywall prompt displays.      |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| M3 | Sandbox Pro Purchase Flow   | Tap "Unlock Pro" -> Complete Google/Apple Sandbox purchase| RevenueCat grants entitlement; UI unlocks;    |
|    |                             |                                                           | rc-webhook updates profiles.is_premium=true.  |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
| M4 | Restore Purchases           | Log into another device with same Apple ID -> Tap Restore | Entitlements restored; Database synced.       |
+----+-----------------------------+-----------------------------------------------------------+-----------------------------------------------+
```

---

## 4. Recommended Automated Testing Architecture (Target Blueprint)

To transition from manual verification to an automated CI pipeline, the following 3-tier testing architecture is recommended for implementation.

```
                    ┌─────────────────────────────────────────┐
                    │               MAESTRO E2E               │
                    │   (Complete User Journeys on Devices)   │
                    └────────────────────┬────────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    │       COMPONENT & STORE INTEGRATION     │
                    │   (@testing-library/react-native + RTL) │
                    └────────────────────┬────────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    │         UNIT & KINEMATIC MATH TESTS     │
                    │     (Jest + KineticMath / Engine FSMs)  │
                    └─────────────────────────────────────────┘
```

### 4.1 Tier 1: Unit Testing (Kinematic Math & State Machines)
The domain mathematical calculations in `domain/` are 100% pure TypeScript functions and are prime candidates for high-speed unit testing:

- **Target Files**:
  - `domain/KineticMath.ts` (Vector dot products, 2D/3D angle clamp limits).
  - `domain/PushupEngine.ts` (State machine transitions, accuracy scoring).
  - `domain/SquatEngine.ts` (Normalized Y-axis depth ratio formulas).
  - `domain/PlankEngine.ts` (Angular stability tolerances and knee sag checks).
  - `services/workout/poseService.ts` (Anti-cheat, screen cheating, and ghost rejection filters).
  - `services/workout/poseSmoother.ts` (Exponential moving average calculations).

#### Example Unit Test Blueprint (`__tests__/PushupEngine.test.ts`)
```typescript
import { PushupEngine } from "../domain/PushupEngine";
import { Point3D } from "../domain/KineticMath";

describe("PushupEngine Kinematics", () => {
  let engine: PushupEngine;

  beforeEach(() => {
    engine = new PushupEngine();
  });

  it("should reject pushups performed frontally to camera", () => {
    // Generate synthetic landmarks where shoulder width is wide relative to depth
    const frontalPose: Point3D[] = new Array(33).fill({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 });
    frontalPose[11] = { x: 0.3, y: 0.4, z: 0, visibility: 0.9 }; // Left Shoulder
    frontalPose[12] = { x: 0.7, y: 0.4, z: 0, visibility: 0.9 }; // Right Shoulder (Width = 0.4)

    // Process frames to trigger frontal warning
    let event = null;
    for (let i = 0; i < 30; i++) {
      event = engine.processFrame(frontalPose);
    }

    expect(event).not.toBeNull();
    expect(event?.type).toBe("FORM_WARNING");
    expect(event?.message).toContain("sideways");
  });

  it("should count a valid rep when side-profile elbow bends below 90 degrees", () => {
    // 1. Initial UP state (Elbow = 160 deg)
    // 2. Transition DOWN state (Elbow = 80 deg)
    // 3. Return to UP state (Elbow = 155 deg)
    // Assert event.type === "REP_COUNTED" and event.accuracy >= 85
  });
});
```

---

### 4.2 Tier 2: Component & Native Module Mocking
When testing React Native screens without the physical CameraX hardware, `PoseLandmarkerView` should be mocked with deterministic landmark sequences:

```typescript
// __mocks__/modules/pose-landmarker.ts
import React from "react";
import { View } from "react-native";

export const PoseLandmarkerView = ({ onLandmarks, ...props }: any) => {
  return <View testID="mock-pose-landmarker" {...props} />;
};
```

---

### 4.3 Tier 3: End-to-End Testing with Maestro
**Maestro** is recommended over Detox for Replix because it does not require native bridge compilation hacks and runs natively against React Native New Architecture builds.

#### Example Maestro Flow (`.maestro/auth_login_flow.yaml`)
```yaml
appId: com.skortan.replix
---
- launchApp
- assertVisible: "Replix"
- tapOn: "Sign in with Email"
- assertVisible: "Welcome back."
- inputText: "safwan@replix.fit"
- tapOn: "Password"
- inputText: "TestPassword123!"
- tapOn: "Sign In"
- assertVisible: "HOME"
- assertVisible: "DAILY STREAK"
```

---

## 5. Target CI/CD Pipeline Workflow

The proposed GitHub Actions workflow (`.github/workflows/ci.yml`) executes static analysis, unit testing, and EAS Preview build verification on every pull request:

```mermaid
flowchart LR
    PR[Pull Request Created] --> LINT[ESLint Static Check]
    PR --> TSC[TypeScript Compiler Check]
    LINT --> JEST[Jest Unit Tests (Kinematics & Stores)]
    TSC --> JEST
    JEST --> EAS_CHECK[EAS Build Dry Run / Preview APK]
    EAS_CHECK --> MERGE[Merge Approved to Main]
```

### Suggested Workflow Configuration
```yaml
name: Replix Continuous Integration

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  validate:
    name: Lint, Typecheck & Unit Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Codebase
        uses: actions/checkout@v4

      - name: Setup Node.js 20.x
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run TypeScript Typecheck
        run: npx tsc --noEmit
```
