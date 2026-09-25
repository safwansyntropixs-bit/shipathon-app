import { useNetworkStore } from "@/services/core/networkService";
import { LinearGradient } from "expo-linear-gradient";
import { AlertCircle, Check, UserPlus, WifiOff } from "lucide-react-native";
import React, { useEffect } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { LEVELS, getRankTheme } from "../../constants/gamification";
import { useFriendStore } from "../../store/social/friendStore";
import { useAuthStore } from "../../store/user/authStore";
import { SkeletonBlock } from "../loaders/SkeletonLoader";
import { UserAvatar } from "../ui/UserAvatar";

export function FriendRequests() {
  const { user } = useAuthStore();
  const incomingRequests = useFriendStore((s) => s.incomingRequests);
  const outgoingRequests = useFriendStore((s) => s.outgoingRequests);
  const isLoading = useFriendStore((s) => s.isLoading);
  const error = useFriendStore((s) => s.error);
  const loadRequests = useFriendStore((s) => s.loadRequests);
  const acceptRequest = useFriendStore((s) => s.acceptRequest);
  const rejectRequest = useFriendStore((s) => s.rejectRequest);

  const isInternetReachable = useNetworkStore((s) => s.isInternetReachable);
  const isConnected = useNetworkStore((s) => s.isConnected);
  const isOffline = isInternetReachable === false || isConnected === false;

  const currentUserId = user?.id ?? "";

  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(20);

  useEffect(() => {
    contentOpacity.value = 0;
    contentTranslateY.value = 20;

    contentOpacity.value = withTiming(1, { duration: 400 });
    contentTranslateY.value = withSpring(0, { damping: 20, stiffness: 90 });
  }, []);

  const viewAnimationStyle = useAnimatedStyle(() => {
    return {
      opacity: contentOpacity.value,
      transform: [{ translateY: contentTranslateY.value }],
    };
  });

  useEffect(() => {
    if (user?.id) {
      loadRequests(user.id);
    }
  }, [user?.id, loadRequests]);

  return (
    <View className="flex-1 w-full">
      {isLoading && (
        <View className="pb-6">
          <View className="mb-3 px-1 mt-1">
            <SkeletonBlock width={110} height={10} borderRadius={4} className="opacity-40" />
          </View>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} className="bg-[#161616] border border-white/10 rounded-xl p-4 flex-row items-center justify-between shadow-xs mb-2">
              <View className="flex-row items-center flex-1">
                <View className="relative">
                  <SkeletonBlock width={44} height={44} borderRadius={22} className="border border-white/20" />
                </View>
                <View className="ml-3 flex-1 justify-center">
                  <SkeletonBlock width="50%" height={13} borderRadius={4} className="mb-1.5 opacity-40" />
                  <SkeletonBlock width="30%" height={11} borderRadius={4} className="opacity-40" />
                </View>
              </View>
              <View className="flex-row ml-2 gap-2">
                <View className="bg-[#3A9E66] w-8 h-8 rounded-lg items-center justify-center shadow-lg shadow-[#3A9E66]/20 opacity-30" />
                <View className="bg-[#2A2A2A] w-8 h-8 rounded-lg items-center justify-center border border-white/10 opacity-40" />
              </View>
            </View>
          ))}
        </View>
      )}

      {!isLoading && (
        <Animated.View style={viewAnimationStyle}>
          <View className="pb-6">
            {error && !isOffline && (
              <View className="mb-4 px-3.5 py-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl flex-row items-center gap-2.5">
                <AlertCircle size={14} color="#F59E0B" />
                <Text className="text-xs text-amber-300 font-outfitMedium flex-1">
                  {error}
                </Text>
              </View>
            )}

            <View className="space-y-4">
              {isOffline && incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
                <View className="items-center py-12 px-4 space-y-2">
                  <View className="bg-amber-500/10 p-4 rounded-full mb-2 border border-amber-500/20">
                    <WifiOff size={28} color="#F59E0B" />
                  </View>
                  <Text className="text-sm font-outfitBold text-white text-center">
                    You're Offline
                  </Text>
                  <Text className="text-[11px] font-outfitReg text-brand-grey text-center max-w-[260px] leading-4">
                    Connect to the internet to view and accept friend requests.
                  </Text>
                </View>
              ) : incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
                <View className="items-center py-8 space-y-2">
                  <View className="bg-white/5 p-4 rounded-full mb-2 border border-white/10">
                    <UserPlus size={32} color="#9F9F99" className="opacity-60" />
                  </View>
                  <Text className="text-sm font-outfitBold text-white">
                    No pending requests
                  </Text>
                  <Text className="text-[11px] font-outfitReg text-white/40">
                    When someone sends you a request, it will appear here.
                  </Text>
                </View>
              ) : (
                <>
                  {incomingRequests.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-[10px] font-outfitBold uppercase tracking-wider text-white/40 mb-3 px-1">
                        Incoming Requests
                      </Text>
                      {incomingRequests.map((req) => (
                        <View
                          key={req.id}
                          className="bg-[#161616] border border-white/10 rounded-xl p-4 flex-row items-center justify-between shadow-xs mb-2"
                        >
                          <View className="flex-row items-center flex-1">
                            <View className="relative">
                              {req.profile?.is_premium ? (
                                <UserAvatar
                                  avatarUrl={req.profile?.avatar_url}
                                  initials={(req.profile?.username || "U").substring(0, 2).toUpperCase()}
                                  className="w-11 h-11 rounded-full border-[2px] border-[#FDE047]"
                                  size={44}
                                />
                              ) : (
                                <UserAvatar
                                  avatarUrl={req.profile?.avatar_url}
                                  initials={(req.profile?.username || "U").substring(0, 2).toUpperCase()}
                                  className="w-11 h-11 rounded-full border border-white/20"
                                  size={44}
                                />
                              )}
                            </View>
                            <View className="ml-3 flex-1">
                              <View className="flex-row items-center gap-1.5">
                                <Text className="text-[13px] font-outfitBold text-white" numberOfLines={1}>
                                  {req.profile?.username || "Athlete"}
                                </Text>
                                {req.profile?.is_premium && (
                                  <View className="rounded-full border-[0.5px] border-[#FFF]/30 overflow-hidden shadow-sm shadow-[#F59E0B]/20">
                                    <LinearGradient
                                      colors={["#FDE047", "#D97706"]}
                                      start={{ x: 0, y: 0 }}
                                      end={{ x: 1, y: 1 }}
                                      className="px-1.5 py-[2px] items-center justify-center"
                                    >
                                      <Text
                                        className="text-[7px] font-outfitBlack text-[#451A03] uppercase tracking-widest text-center leading-none"
                                        style={{ textShadowColor: 'rgba(255,255,255,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}
                                      >
                                        PRO
                                      </Text>
                                    </LinearGradient>
                                  </View>
                                )}
                              </View>
                              <Text
                                className="text-[11px] font-outfitBold mt-0.5 uppercase tracking-wide"
                                style={{ color: getRankTheme(req.profile?.level || 1).color }}
                              >
                                {LEVELS.find((l) => l.rank === (req.profile?.level || 1))?.name || "Beginner"}
                              </Text>
                            </View>
                          </View>
                          <View className="flex-row ml-2 gap-2">
                            <TouchableOpacity
                              onPress={() => acceptRequest(req.id, req.sender_id, currentUserId)}
                              className="bg-[#3A9E66] w-8 h-8 rounded-lg items-center justify-center shadow-lg shadow-[#3A9E66]/20"
                            >
                              <Check size={16} color="#FFFFFF" strokeWidth={3} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => rejectRequest(req.id, currentUserId)}
                              className="bg-[#2A2A2A] w-8 h-8 rounded-lg items-center justify-center border border-white/10"
                            >
                              <Text className="text-lg text-white/70 font-outfitBold leading-none" style={{ marginTop: -2 }}>×</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {outgoingRequests.length > 0 && (
                    <View>
                      <Text className="text-[10px] font-outfitBold uppercase tracking-wider text-white/40 mb-3 px-1">
                        Outgoing Pending
                      </Text>
                      {outgoingRequests.map((req) => (
                        <View
                          key={req.id}
                          className="bg-[#161616] border border-white/10 rounded-xl p-4 flex-row items-center justify-between shadow-xs mb-2"
                        >
                          <View className="flex-row items-center flex-1">
                            <View className="relative">
                              {req.profile?.is_premium ? (
                                <UserAvatar
                                  avatarUrl={req.profile?.avatar_url}
                                  initials={(req.profile?.username || "A").substring(0, 2).toUpperCase()}
                                  className="w-11 h-11 rounded-full border-[2px] border-[#FDE047]"
                                  size={44}
                                />
                              ) : (
                                <UserAvatar
                                  avatarUrl={req.profile?.avatar_url}
                                  initials={(req.profile?.username || "A").substring(0, 2).toUpperCase()}
                                  className="w-11 h-11 rounded-full border border-white/20"
                                  size={44}
                                />
                              )}
                            </View>
                            <View className="ml-3 flex-1">
                              <View className="flex-row items-center gap-1.5">
                                <Text className="text-[13px] font-outfitBold text-white" numberOfLines={1}>
                                  {req.profile?.username || "Athlete"}
                                </Text>
                                {req.profile?.is_premium && (
                                  <View className="rounded-full border-[0.5px] border-[#FFF]/30 overflow-hidden shadow-sm shadow-[#F59E0B]/20">
                                    <LinearGradient
                                      colors={["#FDE047", "#D97706"]}
                                      start={{ x: 0, y: 0 }}
                                      end={{ x: 1, y: 1 }}
                                      className="px-1.5 py-[2px] items-center justify-center"
                                    >
                                      <Text
                                        className="text-[7px] font-outfitBlack text-[#451A03] uppercase tracking-widest text-center leading-none"
                                        style={{ textShadowColor: 'rgba(255,255,255,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}
                                      >
                                        PRO
                                      </Text>
                                    </LinearGradient>
                                  </View>
                                )}
                              </View>
                              <Text
                                className="text-[11px] font-outfitBold mt-0.5 uppercase tracking-wide"
                                style={{ color: getRankTheme(req.profile?.level || 1).color }}
                              >
                                {LEVELS.find((l) => l.rank === (req.profile?.level || 1))?.name || "Beginner"}
                              </Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => rejectRequest(req.id, currentUserId)}
                            className="bg-[#2A2A2A] w-8 h-8 rounded-lg items-center justify-center border border-white/10 ml-4"
                          >
                            <Text className="text-lg text-white/70 font-outfitBold leading-none" style={{ marginTop: -2 }}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
