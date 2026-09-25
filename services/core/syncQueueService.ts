import { workoutRepository } from "@/repositories/workout/workoutRepository";
import { useAuthStore } from "@/store/user/authStore";
import { OutboxItem, OutboxItemType, SyncResult } from "@/types/sync.types";
import { supabase } from "@/utils/supabase";
import * as Crypto from "expo-crypto";
import { AppState, AppStateStatus } from "react-native";
import { create } from "zustand";
import { networkService } from "./networkService";
import { preferencesService } from "./preferencesService";
import { appStorage, defaultStorageErrorHandler } from "./storageService";

export * from "@/types/sync.types";

const OUTBOX_STORAGE_KEY = "REPLIX_OUTBOX_QUEUE_V1";
export const CURRENT_SCHEMA_VERSION = 1;

interface SyncStoreState {
  isSyncing: boolean;
  pendingCount: number;
  deadLetterCount: number;
  lastSyncAt: string | null;
  setSyncState: (state: Partial<SyncStoreState>) => void;
  refreshCounts: () => void;
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  isSyncing: false,
  pendingCount: 0,
  deadLetterCount: 0,
  lastSyncAt: null,
  setSyncState: (state) => set((prev) => ({ ...prev, ...state })),
  refreshCounts: () => {
    const all = syncQueueService.getAllItems();
    const pending = all.filter((i) => i.status === "queued" || i.status === "failed" || i.status === "syncing").length;
    const deadLetter = all.filter((i) => i.status === "dead_letter").length;
    set({ pendingCount: pending, deadLetterCount: deadLetter });
  },
}));

let isDrainingMutex = false;
let listenersInitialized = false;

// Exponential backoff calculator: 2s, 4s, 8s, 16s... capped at 60s
export const calculateBackoffDelayMs = (attempts: number): number => {
  const baseMs = 2000;
  const exponent = Math.max(0, attempts - 1);
  return Math.min(baseMs * Math.pow(2, exponent), 60000);
};

export const isAuthError = (err: any): boolean => {
  const status = err?.status || err?.statusCode || err?.code;
  const msg = (err?.message || "").toLowerCase();
  return (
    status === 401 ||
    status === "401" ||
    msg.includes("jwt") ||
    msg.includes("unauthorized") ||
    msg.includes("token is expired") ||
    msg.includes("invalid claim")
  );
};

export const isPermanentClientError = (err: any): boolean => {
  const status = Number(err?.status || err?.statusCode);
  if (!isNaN(status)) {
    // 4xx errors excluding 401 (handled via refresh), 408 (timeout), and 429 (rate limit)
    return status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429;
  }
  const msg = (err?.message || "").toLowerCase();
  return (
    msg.includes("violates check constraint") ||
    msg.includes("invalid input syntax") ||
    msg.includes("violates not-null constraint") ||
    msg.includes("foreign key violation") ||
    msg.includes("invalid format")
  );
};

export const syncQueueService = {
  /**
   * Load entire outbox array from MMKV disk storage
   */
  getAllItems(): OutboxItem[] {
    try {
      const raw = appStorage.getString(OUTBOX_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as OutboxItem[];
    } catch (e) {
      console.error("[syncQueueService] Failed to parse outbox queue from MMKV:", e);
      return [];
    }
  },

  /**
   * Commit queue to MMKV with device storage exhaustion try/catch defense
   */
  persistItems(items: OutboxItem[]): void {
    try {
      appStorage.set(OUTBOX_STORAGE_KEY, JSON.stringify(items));
      useSyncStore.getState().refreshCounts();
    } catch (e) {
      defaultStorageErrorHandler(e, OUTBOX_STORAGE_KEY);
      throw e;
    }
  },

  /**
   * Enqueue a new action to the FIFO outbox.
   * Immediately attempts an asynchronous drain if online.
   */
  async enqueue<T = any>(params: {
    userId: string;
    type: OutboxItemType;
    payload: T;
    id?: string;
    schemaVersion?: number;
    createdAt?: string;
  }): Promise<OutboxItem<T>> {
    const item: OutboxItem<T> = {
      id: params.id || Crypto.randomUUID(),
      userId: params.userId,
      schemaVersion: params.schemaVersion || CURRENT_SCHEMA_VERSION,
      type: params.type,
      payload: params.payload,
      createdAt: params.createdAt || new Date().toISOString(),
      attempts: 0,
      status: "queued",
    };

    const currentItems = this.getAllItems();
    // Guard against duplicate id insertion
    const exists = currentItems.some((i) => i.id === item.id);
    if (!exists) {
      currentItems.push(item);
      this.persistItems(currentItems);
    }

    // Trigger immediate background drain if network is reachable
    if (networkService.isInternetReachable()) {
      // Fire-and-forget
      this.drainQueue().catch((err) => {
        console.warn("[syncQueueService] Background drain after enqueue failed:", err);
      });
    }

    return item;
  },

  /**
   * Remove item from outbox upon successful server reconciliation
   */
  dequeue(id: string): void {
    const current = this.getAllItems();
    const filtered = current.filter((i) => i.id !== id);
    this.persistItems(filtered);
  },

  /**
   * Update fields of a specific queue item (status, attempts, error message)
   */
  updateItem(id: string, updates: Partial<OutboxItem>): void {
    const current = this.getAllItems();
    const idx = current.findIndex((i) => i.id === id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...updates };
      this.persistItems(current);
    }
  },

  /**
   * Get all pending items (queued or failed), ordered chronologically (FIFO)
   */
  getPendingItems(userId?: string): OutboxItem[] {
    const items = this.getAllItems();
    return items
      .filter((i) => (i.status === "queued" || i.status === "failed" || i.status === "syncing") && (!userId || i.userId === userId))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  /**
   * Get all dead letter items for a user
   */
  getDeadLetterItems(userId?: string): OutboxItem[] {
    const items = this.getAllItems();
    return items.filter((i) => i.status === "dead_letter" && (!userId || i.userId === userId));
  },

  /**
   * User-initiated manual retry for a Dead-Letter item
   */
  async retryDeadLetterItem(id: string): Promise<void> {
    this.updateItem(id, {
      status: "queued",
      attempts: 0,
      lastError: undefined,
      lastAttemptAt: undefined,
    });

    try {
      const { useHistoryStore } = require("@/store/workout/historyStore");
      useHistoryStore.getState().updateSyncStatus(id, "pending");
    } catch {}

    if (networkService.isInternetReachable()) {
      await this.drainQueue();
    }
  },

  /**
   * Clear outbox queue (optional filter by user ID)
   */
  clearQueue(userId?: string): void {
    if (!userId) {
      this.persistItems([]);
    } else {
      const remaining = this.getAllItems().filter((i) => i.userId !== userId);
      this.persistItems(remaining);
    }
  },

  /**
   * Execute an individual outbox action handler based on action type
   */
  async executeItemHandler(item: OutboxItem): Promise<any> {
    switch (item.type) {
      case "WORKOUT_SESSION": {
        return await workoutRepository.insertWorkoutSession(item.payload);
      }
      case "UPDATE_PREFERENCES": {
        return await preferencesService.updateUserPreferences(item.userId, item.payload);
      }
      case "CLAIM_QUEST": {
        const { error } = await supabase.from("user_achievements").upsert(
          {
            user_id: item.userId,
            achievement_id: item.payload.achievement_id || item.payload.id,
            type: item.payload.type,
            is_completed: true,
            progress: item.payload.progress || item.payload.target,
            created_at: item.createdAt,
          },
          { onConflict: "user_id,achievement_id" }
        );
        if (error) throw error;
        return true;
      }
      case "UNLOCK_TROPHY": {
        const { error } = await supabase.from("user_achievements").upsert(
          {
            user_id: item.userId,
            achievement_id: item.payload.achievementId || item.payload.id,
            type: "trophy",
            is_completed: true,
            progress: 1,
            created_at: item.createdAt,
          },
          { onConflict: "user_id,achievement_id" }
        );
        if (error) throw error;
        return true;
      }
      default:
        throw new Error(`Unknown OutboxItemType: ${(item as any).type}`);
    }
  },

  /**
   * Main Foreground FIFO Queue Drain Engine.
   * Safely handles Mutex locks, NetInfo guards, Auth refresh, and Dead-Letter routing.
   */
  async drainQueue(): Promise<SyncResult> {
    if (isDrainingMutex) {
      return { syncedCount: 0, failedCount: 0, deadLetterCount: 0 };
    }

    if (!networkService.isInternetReachable()) {
      return { syncedCount: 0, failedCount: 0, deadLetterCount: 0 };
    }

    isDrainingMutex = true;
    useSyncStore.getState().setSyncState({ isSyncing: true });

    let syncedCount = 0;
    let failedCount = 0;
    let deadLetterCount = 0;

    try {
      const activeUser = useAuthStore.getState().session?.user || useAuthStore.getState().user;
      const activeUserId = activeUser?.id;

      // Only drain if an authenticated user session is active
      if (!activeUserId) {
        return { syncedCount: 0, failedCount: 0, deadLetterCount: 0 };
      }

      // Fetch pending items strictly belonging to current authenticated user in FIFO order
      const pending = this.getPendingItems(activeUserId);
      const now = Date.now();

      for (const item of pending) {
        // Double check network connectivity
        if (!networkService.isInternetReachable()) {
          break;
        }

        // Exponential backoff check for previously failed items
        if (item.attempts > 0 && item.lastAttemptAt) {
          const lastAttemptTime = new Date(item.lastAttemptAt).getTime();
          const backoffDelay = calculateBackoffDelayMs(item.attempts);
          if (now - lastAttemptTime < backoffDelay) {
            // Backoff window still active; skip to avoid spamming server
            continue;
          }
        }

        const currentAttempts = item.attempts + 1;
        this.updateItem(item.id, {
          status: "syncing",
          attempts: currentAttempts,
          lastAttemptAt: new Date().toISOString(),
        });

        try {
          // Process the item payload
          await this.executeItemHandler(item);

          // Success: Remove from Outbox
          this.dequeue(item.id);
          syncedCount++;

          if (item.type === "WORKOUT_SESSION") {
            try {
              const { useHistoryStore } = require("@/store/workout/historyStore");
              useHistoryStore.getState().updateSyncStatus(item.id, "synced");
            } catch {}
          }
        } catch (err: any) {
          const errorMessage = err?.message || String(err);
          console.error(`[syncQueueService] Failed to sync item ${item.id} (${item.type}):`, errorMessage);

          // 1. Check for Auth Expired (401)
          if (isAuthError(err)) {
            console.warn("[syncQueueService] 401 Auth error encountered. Attempting session refresh...");
            this.updateItem(item.id, {
              status: "queued",
              lastError: "Authentication expired. Will retry after refresh.",
            });

            try {
              const { data, error: refreshErr } = await supabase.auth.refreshSession();
              if (refreshErr || !data.session) {
                console.warn("[syncQueueService] Session refresh failed, halting drain loop:", refreshErr);
                break;
              }
              // Session refreshed, continue loop
              continue;
            } catch {
              break;
            }
          }

          // 2. Check for Permanent Client Error (4xx / Schema / Constraints)
          const isClientFatal = isPermanentClientError(err);
          if (isClientFatal || currentAttempts >= 3) {
            console.warn(`[syncQueueService] Moving item ${item.id} to Dead-Letter Queue after ${currentAttempts} attempts.`);
            this.updateItem(item.id, {
              status: "dead_letter",
              lastError: errorMessage,
            });
            deadLetterCount++;

            if (item.type === "WORKOUT_SESSION") {
              try {
                const { useHistoryStore } = require("@/store/workout/historyStore");
                useHistoryStore.getState().updateSyncStatus(item.id, "dead_letter");
              } catch {}
            }
            // Unblocks subsequent queue items (Prevents head-of-line blocking!)
            continue;
          }

          // 3. Transient Error (5xx / Timeout / Network Drop)
          this.updateItem(item.id, {
            status: "failed",
            lastError: errorMessage,
          });
          failedCount++;

          if (item.type === "WORKOUT_SESSION") {
            try {
              const { useHistoryStore } = require("@/store/workout/historyStore");
              // Transient failure (e.g. offline): Keep status as 'pending' in UI while item waits in outbox
              useHistoryStore.getState().updateSyncStatus(item.id, "pending");
            } catch {}
          }

          // If network dropped mid-request, abort drain until next network event
          if (!networkService.isInternetReachable()) {
            break;
          }
        }
      }
    } finally {
      isDrainingMutex = false;
      useSyncStore.getState().setSyncState({
        isSyncing: false,
        lastSyncAt: new Date().toISOString(),
      });
      useSyncStore.getState().refreshCounts();

      // Post-Sync Authoritative Refresh: If any workouts or items synced, refresh all stores
      if (syncedCount > 0) {
        try {
          const activeUser = useAuthStore.getState().session?.user || useAuthStore.getState().user;
          const activeUserId = activeUser?.id;
          if (activeUserId) {
            const { useDashboardStore } = require("@/store/workout/dashboardStore");
            const { useStreakStore } = require("@/store/gamification/streakStore");
            const { useProfileStore } = require("@/store/user/profileStore");
            const { useAchievementStore } = require("@/store/gamification/achievementStore");
            const { useHistoryStore } = require("@/store/workout/historyStore");
            const { useTrophyStore } = require("@/store/gamification/trophyStore");

            await Promise.all([
              useDashboardStore.getState().loadDashboardData(activeUserId, true),
              useStreakStore.getState().loadStreakData(activeUserId, true),
              useProfileStore.getState().fetchProfile(true),
              useAchievementStore.getState().loadCompletedQuests(activeUserId),
              useHistoryStore.getState().loadInitialHistory(activeUserId, undefined, true),
              useHistoryStore.getState().loadRangeStats(activeUserId, "week"),
              useTrophyStore.getState().loadTrophies(activeUserId),
            ]).catch((err) => {
              console.warn("[syncQueueService] Post-sync store reload error:", err);
            });
          }
        } catch (reloadErr) {
          console.warn("[syncQueueService] Failed to trigger store refresh post-sync:", reloadErr);
        }
      }
    }

    return { syncedCount, failedCount, deadLetterCount };
  },

  /**
   * Initialize automated event listeners for AppState (foregrounding) and NetInfo (reconnection)
   */
  initListeners(): void {
    if (listenersInitialized) return;
    listenersInitialized = true;

    // Trigger on app transition to foreground
    AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        syncQueueService.drainQueue().catch((e) => {
          console.warn("[syncQueueService] AppState active drain error:", e);
        });
      }
    });

    // Trigger on network connectivity restoration with a short 400ms settle buffer for DNS/socket warmup
    let reconnectTimeout: any = null;
    networkService.subscribe((status) => {
      if (status.isInternetReachable) {
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(() => {
          syncQueueService.drainQueue().catch((e) => {
            console.warn("[syncQueueService] Network restoration drain error:", e);
          });
        }, 400);
      }
    });

    // Initial check on startup
    if (networkService.isInternetReachable()) {
      this.drainQueue().catch(() => { });
    }
  },
};

// Automatically wire up listeners upon service evaluation
syncQueueService.initListeners();
