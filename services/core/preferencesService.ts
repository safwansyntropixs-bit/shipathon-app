import { preferencesRepository, UserPreferences } from "../../repositories/core/preferencesRepository";
import { networkService } from "./networkService";
import { syncQueueService } from "./syncQueueService";

export const preferencesService = {
  /**
   * Fetches preferences from Supabase if online.
   * Returns null if offline or not reachable so the local MMKV cache is never overwritten.
   */
  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    if (!networkService.isInternetReachable()) {
      return null;
    }

    try {
      const prefs = await preferencesRepository.getPreferences(userId);
      return prefs;
    } catch (e) {
      console.warn("[preferencesService] Failed to fetch remote preferences:", e);
      return null;
    }
  },

  /**
   * Updates user preferences via the resilient offline outbox.
   * Immediately saves locally and syncs in the background when online.
   */
  async updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<void> {
    await syncQueueService.enqueue({
      userId,
      type: "UPDATE_PREFERENCES",
      payload: preferences,
    });
  },
};
