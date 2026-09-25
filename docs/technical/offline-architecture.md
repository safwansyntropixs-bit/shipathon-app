# Offline-First Architecture Specification

## 1. Overview & Architectural Principles

Replix operates on a **Local-First, Server-Authoritative** model. All user interactions and workout completions commit to high-speed local disk storage (`react-native-mmkv`) immediately, rendering optimistic UI transitions with zero latency. A foreground-driven sync manager subsequently drains queued actions to Supabase when network connectivity is confirmed (`isInternetReachable: true`).

```mermaid
flowchart TD
    UI[User Action / Workout Complete] -->|1. Atomic Disk Write| LocalStore[Local MMKV Persistent Storage]
    LocalStore -->|2. Instant UI Update| OptimisticUI[Optimistic UI Render - Zero Skeleton]
    LocalStore -->|3. Append to FIFO Queue| Outbox[Resilient Offline Outbox / Queue]
    
    NetCheck{NetInfo: isInternetReachable?}
    AppStateChange[AppState: Active / Launch] --> NetCheck
    Outbox --> NetCheck
    
    NetCheck -->|Yes| SyncManager[Foreground-Driven Sync Engine]
    NetCheck -->|No / Flaky| Outbox
    
    SyncManager -->|4. Idempotent RPC with UUID| Supabase[Supabase PostgreSQL RPC]
    Supabase -->|5. Authoritative XP & Streak| Reconcile[Cache Reconciliation & Outbox Pop]
    
    SyncManager -.->|Permanent Error / 4xx x3| DLQ[Dead-Letter Queue (DLQ)]
```

---

## 2. The 4 Core Pillars

### Pillar 1: Persistent Local-First Storage (Implemented in Phase 1)
- **Mechanism**: Zustand stores (`usePreferencesStore`, `useDashboardStore`, `useHistoryStore`, `useStreakStore`, `useTrophyStore`, `useAchievementStore`) wrapped with `persist` middleware backed by `react-native-mmkv` via `mmkvStorage`.
- **Behavior**: App hydrates synchronously on startup. Target reps (e.g. 50 pushups), PRs, streaks, and trophies load immediately from disk without default fallback flashes or UI loading skeletons.
- **Storage Exhaustion Safeties**: Disk write attempts in `storageService.ts` are protected by a centralized try/catch wrapper (`defaultStorageErrorHandler`). If the device storage is full (quota exhaustion), an explicit UI alert is dispatched (`"Device storage full. Free up space to save workout and app data."`) to prevent application crashes.

### Pillar 2: Resilient Offline Outbox (Queue + Dead-Letter Queue)
- **FIFO Queue**: Stores offline operations tagged with client UUIDs (`Crypto.randomUUID()`) for backend idempotency.
- **Dead-Letter Queue (DLQ)**: Poison-pill and malformed payloads failing permanent client errors (4xx) or max retries are segregated into `dead_letter` status to unblock head-of-line execution.
- **Outbox Item Schema**:
  ```typescript
  export interface OutboxItem {
    id: string;              // Client-generated UUID (Crypto.randomUUID()) for idempotency
    userId: string;          // Authenticated Supabase user ID
    schemaVersion: number;   // Backward compatibility across app updates
    type: 'WORKOUT_SESSION' | 'UPDATE_PREFERENCES' | 'CLAIM_QUEST' | 'UNLOCK_TROPHY';
    payload: any;
    createdAt: string;       // Exact ISO timestamp when action occurred
    attempts: number;
    lastAttemptAt?: string;
    lastError?: string;
    status: 'queued' | 'syncing' | 'failed' | 'dead_letter';
  }
  ```

### Pillar 3: Foreground-Driven Sync Engine
- **Triggers**: Fired upon:
  1. `NetInfo` network restoration (`isInternetReachable: true` via `networkService.ts`).
  2. `AppState` transitioning to `"active"` or on app cold start.
  3. Immediate dispatch post local queue write if online.
- **Error Routing**:
  - *Transient (5xx, timeouts)*: Exponential backoff (2s, 4s, 8s); remains `queued`.
  - *Permanent (4xx, schema mismatch)*: After 3 failed attempts, moves to `dead_letter`.
  - *Auth (401 / expired session)*: Pauses queue, refreshes Supabase session, resumes on success.

### Pillar 4: Server-Authoritative Gamification & Idempotency
- **Idempotency**: Supabase RPCs utilize `ON CONFLICT (id) DO NOTHING` keyed by the client's UUID, guaranteeing duplicate workouts are ignored even during network drops.
- **Clock Drift & Anti-Tampering**: Client timestamp (`p_created_at`) is validated server-side. PostgreSQL calculates authoritative XP and streaks, returning the definitive values to overwrite local optimistic estimates silently.

---

## 3. Edge Case Mitigation Matrix

| Scenario | Handling Strategy |
| :--- | :--- |
| **App Crash / Swipe Close Post-Workout** | Atomic disk write commits before UI render. Sync manager picks up pending queue items on subsequent launch. |
| **Multi-Day Offline (Camping Mode)** | FIFO queue preserves chronological order with client timestamps ensuring streak calculation fidelity. |
| **Flaky Network / Captive Portal** | 10-second timeout + `isInternetReachable` verification; fails back to queue with exponential retry. |
| **Payload Version Mismatch** | `schemaVersion` in payload allows backend RPC to migrate or gracefully handle legacy structures. |
| **Device Storage Full** | Atomic MMKV write caught -> UI alerts user immediately to free space -> optimistic flow halted cleanly. |
| **Multi-User Device Switching** | Outbox items are partitioned by `userId`. Sync engine processes items belonging exclusively to the currently authenticated session. |
| **Offline Target Reps & Preferences** | `fetchPreferences` short-circuits when offline; network errors never overwrite cached targets with defaults. `updatePreference` writes to MMKV and queues to Outbox. |
| **Clock Tampering / Cheating** | Client XP is a local optimistic approximation; Supabase computes true XP and overwrites client cache on sync. |
| **LWW Preference Conflict** | Uses server `updated_at` timestamps for multi-device reconciliation. |

---

## 4. Implementation Status

- [x] **Phase 1: Persistent Storage & Safeties**
  - `@react-native-community/netinfo` installed and configured.
  - `networkService.ts` and `useNetworkStore` implemented for reachability monitoring.
  - `storageService.ts` upgraded with `mmkvStorage` and storage exhaustion error handling.
  - Persisted stores: `usePreferencesStore`, `useDashboardStore`, `useHistoryStore`, `useStreakStore`, `useTrophyStore`, `useAchievementStore`.
  - `clearStores.ts` updated with clean default state resets.
- [x] **Phase 2: Sync Engine & Dead-Letter Queue**
  - `types/sync.types.ts` defined with `OutboxItem`, `OutboxItemType`, and `OutboxItemStatus` (`'queued' | 'syncing' | 'failed' | 'dead_letter'`).
  - `syncQueueService.ts` created with MMKV disk-backed FIFO queue, storage exhaustion protection, and `useSyncStore`.
  - Exponential backoff calculation implemented for 5xx/transient errors (2s, 4s, 8s, up to 60s).
  - Dead-Letter Queue (DLQ) routing implemented (moves to `'dead_letter'` after 3 attempts or fatal 4xx to prevent head-of-line blocking).
  - Automated triggers wired up to `AppState` (foregrounding), `NetInfo` (`isInternetReachable` restoration), and local enqueue.
- [x] **Phase 3: Server-Authoritative Workout Routing & Global Pending Sync UI**
  - `workoutStore.finishWorkout` refactored to route payloads cleanly to `syncQueueService.enqueue()` and prepend to local `historyStore` with `syncStatus: 'pending'`.
  - Fragile client-side optimistic mutations removed to eliminate double-counting and client-side drift, adhering to the Strava/Garmin server-authoritative model.
  - `achievementStore.ts` refactored: `computeMetricsFromHistory` and `loadCompletedQuests` ignore `syncStatus: 'pending'` workouts for logged-in users. Daily/weekly/monthly quest progress remains stable offline and refreshes authoritatively upon online synchronization.
  - Global `OfflineBanner.tsx` mounted in `_layout.tsx` displaying `⚡ [N] workout(s) pending sync. Stats will update online.` across all screens.
  - `syncQueueService.drainQueue()` updated: once `syncedCount > 0`, automatically triggers parallel store refreshes (`dashboardStore`, `streakStore`, `profileStore`, `achievementStore`, `historyStore`, `trophyStore`) to render 100% server-authoritative data.
  - `workoutRepository.insertWorkoutSession` upgraded with primary key UUID idempotency (`onConflict: 'id', ignoreDuplicates: true`).
- [x] **Phase 4: Backend Re-architecture (Supabase)**
  - `log_workout_session` PostgreSQL RPC updated with client-provided UUID idempotency (`p_workout_id`).
  - Historical timestamp reconciliation (`p_created_at`) ensures offline workouts calculate streaks and timestamps for the exact date the workout was performed.
  - Server-side sanity checks: future timestamps (> 1 hour ahead) and stale payloads (> 90 days) rejected to prevent clock tampering.
  - Pure level calculation helper `calculate_level_from_xp(p_xp)` and immutable ledger logging (`xp_transactions`).
  - Frontend `workoutRepository.insertWorkoutSession` updated to transmit `p_workout_id` and `p_created_at`.

