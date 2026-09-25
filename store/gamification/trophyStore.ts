import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { supabase } from "@/utils/supabase";
import { mmkvStorage } from "@/services/core/storageService";

export interface Trophy {
  id: string;
  type: 'trophy';
  created_at: string;
}

interface TrophyState {
  unlockedTrophies: Trophy[];
  isLoading: boolean;
  loadTrophies: (userId: string) => Promise<void>;
  unlockTrophy: (userId: string, achievementId: string) => Promise<void>;
  getTrophyRarity: (trophyId: string) => Promise<number>;
}

export const useTrophyStore = create<TrophyState>()(
  persist(
    (set, get) => ({
      unlockedTrophies: [],
      isLoading: false,

      loadTrophies: async (userId: string) => {
        // If we already have cached trophies, don't show full-screen loading spinner
        const hasCached = get().unlockedTrophies.length > 0;
        if (!hasCached) {
          set({ isLoading: true });
        }

        const { networkService } = require("@/services/core/networkService");
        if (!networkService.isInternetReachable() && hasCached) {
          set({ isLoading: false });
          return;
        }

        try {
          const { data, error } = await supabase
            .from("user_achievements")
            .select("achievement_id, type, created_at")
            .eq("user_id", userId)
            .eq("type", "trophy")
            .eq("is_completed", true);

          if (error) throw error;
          
          const trophies = (data || []).map((row: any) => ({
            id: row.achievement_id,
            type: row.type,
            created_at: row.created_at
          }));
          set({ unlockedTrophies: trophies, isLoading: false });
        } catch (e) {
          if (!hasCached) {
            console.warn("[trophyStore] Error loading trophies (offline/transient):", e);
          }
          set({ isLoading: false });
        }
      },

      unlockTrophy: async (userId: string, achievementId: string) => {
        const alreadyUnlocked = get().unlockedTrophies.some(t => t.id === achievementId);
        if (alreadyUnlocked) return;

        // Optimistic update immediately saved to MMKV
        set(state => ({
          unlockedTrophies: [...state.unlockedTrophies, { id: achievementId, type: 'trophy', created_at: new Date().toISOString() }]
        }));

        try {
          const { networkService } = require("@/services/core/networkService");
          if (networkService.isInternetReachable()) {
            const { error } = await supabase.from("user_achievements").upsert({
              user_id: userId,
              achievement_id: achievementId,
              type: 'trophy',
              is_completed: true,
              progress: 1, // Trophies are permanent and binary, target is 1
              created_at: new Date().toISOString()
            }, { onConflict: "user_id,achievement_id" });

            if (error) throw error;
          } else {
            // Offline: Enqueue to outbox
            const { syncQueueService } = require("@/services/core/syncQueueService");
            syncQueueService.enqueue({
              userId,
              type: "UNLOCK_TROPHY",
              payload: {
                achievement_id: achievementId,
                type: 'trophy',
                target: 1,
                progress: 1,
              },
            });
          }
        } catch (e) {
          console.warn("[trophyStore] Failed to unlock trophy in backend, enqueuing:", e);
          try {
            const { syncQueueService } = require("@/services/core/syncQueueService");
            syncQueueService.enqueue({
              userId,
              type: "UNLOCK_TROPHY",
              payload: {
                achievement_id: achievementId,
                type: 'trophy',
                target: 1,
                progress: 1,
              },
            });
          } catch {}
        }
      },

      getTrophyRarity: async (trophyId: string) => {
        try {
          const { networkService } = require("@/services/core/networkService");
          if (!networkService.isInternetReachable()) {
            return 0.00;
          }
          const { data, error } = await supabase
            .from("trophy_global_stats")
            .select("rarity_percent")
            .eq("trophy_id", trophyId)
            .single();
            
          if (error && error.code !== 'PGRST116') { // Ignore "no rows returned" error
            console.warn("Failed to fetch trophy rarity:", error.message);
            return 0.00;
          }
          
          return data?.rarity_percent ? Number(data.rarity_percent) : 0.00;
        } catch (e) {
          console.warn("Error fetching trophy rarity", e);
          return 0.00;
        }
      }
    }),
    {
      name: "replix-trophy-store",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        unlockedTrophies: state.unlockedTrophies,
      }),
    }
  )
);
