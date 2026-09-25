import { useNetworkStore } from "@/services/core/networkService";
import { LinearGradient } from "expo-linear-gradient";
import { AlertCircle, Search, WifiOff } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { LEVELS, getRankTheme } from "../../constants/gamification";
import { useFriendStore } from "../../store/social/friendStore";
import { useAuthStore } from "../../store/user/authStore";
import { SkeletonBlock } from "../loaders/SkeletonLoader";
import { UserAvatar } from "../ui/UserAvatar";
import { InviteFriendButton } from "./InviteFriendButton";

export function FriendSearch() {
  const { user } = useAuthStore();
  const searchResults = useFriendStore((s) => s.searchResults);
  const isSearching = useFriendStore((s) => s.isSearching);
  const outgoingRequests = useFriendStore((s) => s.outgoingRequests);
  const friends = useFriendStore((s) => s.friends);
  const searchUsers = useFriendStore((s) => s.searchUsers);
  const clearSearch = useFriendStore((s) => s.clearSearch);
  const sendRequest = useFriendStore((s) => s.sendRequest);
  const error = useFriendStore((s) => s.error);

  const isInternetReachable = useNetworkStore((s) => s.isInternetReachable);
  const isConnected = useNetworkStore((s) => s.isConnected);
  const isOffline = isInternetReachable === false || isConnected === false;

  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [isDebouncing, setIsDebouncing] = useState(false);

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
    if (globalSearchQuery && user?.id) {
      setIsDebouncing(true);
      const timeoutId = setTimeout(() => {
        setIsDebouncing(false);
        searchUsers(globalSearchQuery, user.id);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else if (!globalSearchQuery) {
      setIsDebouncing(false);
      clearSearch();
    }
  }, [globalSearchQuery, user?.id, searchUsers, clearSearch]);

  const handleSearch = () => {
    if (user?.id) {
      searchUsers(globalSearchQuery, user.id);
    }
  };

  return (
    <View className="flex-1 w-full">
      <View className="flex-row items-center mb-3">
        <View className="flex-1 relative justify-center">
          <View className="absolute left-3 z-10">
            <Search size={16} color="#9F9F99" />
          </View>
          <TextInput
            value={globalSearchQuery}
            onChangeText={(text) => {
              setGlobalSearchQuery(text);
              setIsDebouncing(text.length > 0);
            }}
            placeholder={"Search users to add"}
            placeholderTextColor="#8E8E93"
            className="w-full h-11 pl-10 pr-4 bg-brand-card border border-brand-divider rounded-xl text-xs text-brand-charcoal font-outfitReg"
            autoCapitalize="none"
            onSubmitEditing={handleSearch}
          />
        </View>
      </View>

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

          {isOffline && (
            <View className="mb-4 px-3.5 py-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl flex-row items-center gap-2.5">
              <WifiOff size={14} color="#F59E0B" />
              <Text className="text-xs text-amber-300 font-outfitMedium flex-1">
                You're offline. Connect to search for athletes.
              </Text>
            </View>
          )}

          {(isSearching || isDebouncing) && (
            <View className="space-y-3 pb-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <View key={i} className="bg-[#161616] border border-white/10 rounded-xl p-4 flex-row items-center justify-between shadow-xs mb-2">
                  <View className="flex-row items-center flex-1 pr-2">
                    <SkeletonBlock width={44} height={44} borderRadius={22} />
                    <View className="ml-3 flex-1 justify-center">
                      <SkeletonBlock width={120} height={14} borderRadius={4} className="mb-2" />
                      <SkeletonBlock width={80} height={10} borderRadius={4} />
                    </View>
                  </View>
                  <View className="flex-row items-center ml-2">
                    <SkeletonBlock width={32} height={32} borderRadius={8} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {!(isSearching || isDebouncing) && (
            <View className="space-y-3">
              {searchResults.length === 0 && globalSearchQuery.length > 0 ? (
                <View className="items-center py-10 space-y-2">
                  <Search size={32} color="#9F9F99" className="opacity-40" />
                  <Text className="text-sm text-white font-outfitBold mt-2">
                    No users found
                  </Text>
                  <Text className="text-xs text-brand-charcoal font-outfitReg text-center mb-6 max-w-[240px]">
                    Can't find who you're looking for? Invite them to join Replix!
                  </Text>

                  <InviteFriendButton
                    label="Invite Them"
                    iconSize={16}
                    className="mt-4 px-6 py-3 shadow-lg"
                  />
                </View>
              ) : (
                searchResults.map((res) => {
                  const isPending = outgoingRequests.some(r => r.receiver_id === res.id);
                  const isFriend = friends.some(f => f.id === res.id);

                  return (
                    <View
                      key={res.id}
                      className="bg-[#161616] border border-white/10 rounded-xl p-4 flex-row items-center justify-between shadow-xs mb-2"
                    >
                      <View className="flex-row items-center flex-1">
                        <View className="relative">
                          {res.is_premium ? (
                            <UserAvatar
                              avatarUrl={res.avatar_url}
                              initials={(res.username || "U").substring(0, 2).toUpperCase()}
                              className="w-11 h-11 rounded-full border-[2px] border-[#FDE047]"
                              size={44}
                            />
                          ) : (
                            <UserAvatar
                              avatarUrl={res.avatar_url}
                              initials={(res.username || "U").substring(0, 2).toUpperCase()}
                              className="w-11 h-11 rounded-full border border-white/20"
                              size={44}
                            />
                          )}
                        </View>
                        <View className="ml-3 flex-1">
                          <View className="flex-row items-center gap-1.5">
                            <Text className="text-[13px] font-outfitBold text-white" numberOfLines={1}>
                              {res.username || "Unknown"}
                            </Text>
                            {res.is_premium && (
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
                            style={{ color: getRankTheme(res.level || 1).color }}
                          >
                            {LEVELS.find((l) => l.rank === (res.level || 1))?.name || "Beginner"}
                          </Text>
                        </View>
                      </View>

                      {isFriend ? (
                        <View className="ml-2 px-3 py-1.5 rounded-lg bg-[#2A2A2A] border border-white/10">
                          <Text className="text-[10px] font-outfitBold uppercase tracking-wider text-white/40">
                            Friend
                          </Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => sendRequest(currentUserId, res.id)}
                          disabled={isPending}
                          className={`ml-2 px-3 py-1.5 rounded-lg shadow-lg ${isPending ? "bg-[#2A2A2A] border border-white/10" : "bg-[#3A9E66] shadow-[#3A9E66]/20"
                            }`}
                        >
                          <Text
                            className={`text-[10px] font-outfitBold uppercase tracking-wider ${isPending ? "text-white/40" : "text-white"
                              }`}
                          >
                            {isPending ? "Sent" : "Add"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
              {!globalSearchQuery && (
                <View className="items-center py-6 space-y-2">
                  <Search size={32} color="#9F9F99" className="opacity-40" />
                  <Text className="text-xs text-white/50 font-outfitBold mt-2">
                    Type to search for users
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}
