import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WifiOff, CheckCircle2, RefreshCw } from "lucide-react-native";
import { useNetworkStore } from "@/services/core/networkService";
import { useSyncStore } from "@/services/core/syncQueueService";
import { useHistoryStore } from "@/store/workout/historyStore";

export const OfflineBanner = React.memo(() => {
  const insets = useSafeAreaInsets();
  const isInternetReachable = useNetworkStore((s) => s.isInternetReachable);
  const isConnected = useNetworkStore((s) => s.isConnected);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const pendingWorkouts = useHistoryStore((s) =>
    (s.history || []).filter((h) => h.syncStatus === "pending").length
  );

  const isOffline = isInternetReachable === false || isConnected === false;
  const [showReconnected, setShowReconnected] = useState(false);
  const hasEverBeenOfflineRef = useRef(false);

  useEffect(() => {
    if (isOffline) {
      hasEverBeenOfflineRef.current = true;
    } else if (hasEverBeenOfflineRef.current) {
      // Reconnected transition ONLY if the device was genuinely offline in this session
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        hasEverBeenOfflineRef.current = false;
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOffline]);

  // If the app is online and hasn't just transitioned from offline, render NOTHING
  if (!isOffline && !showReconnected) {
    return null;
  }

  const topOffset = Math.max(insets.top + 6, 12);

  return (
    <Animated.View
      entering={FadeInUp.duration(300)}
      exiting={FadeOutUp.duration(250)}
      layout={LinearTransition.springify()}
      pointerEvents="none"
      style={[styles.container, { top: topOffset }]}
    >
      {isOffline ? (
        <View style={styles.offlinePill}>
          <WifiOff size={13} color="#F59E0B" strokeWidth={2.5} />
          <Text style={styles.offlineText}>
            {pendingWorkouts > 0
              ? `${pendingWorkouts} ${pendingWorkouts === 1 ? "workout" : "workouts"} pending sync. Stats will update online.`
              : "Offline Mode"}
          </Text>
        </View>
      ) : showReconnected ? (
        <View style={styles.onlinePill}>
          {isSyncing ? (
            <RefreshCw size={13} color="#10B981" strokeWidth={2.5} />
          ) : (
            <CheckCircle2 size={13} color="#10B981" strokeWidth={2.5} />
          )}
          <Text style={styles.onlineText}>
            {isSyncing ? "Back Online • Syncing data..." : "Back Online • All data synced"}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
  },
  offlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(24, 24, 27, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
  offlineText: {
    color: "#FDE68A",
    fontSize: 11,
    fontFamily: "Outfit-Medium",
    letterSpacing: 0.2,
  },
  onlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(24, 24, 27, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
  onlineText: {
    color: "#A7F3D0",
    fontSize: 11,
    fontFamily: "Outfit-Medium",
    letterSpacing: 0.2,
  },
});
