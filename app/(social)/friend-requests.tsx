import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React, { useCallback, useRef } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { PremiumAmbientBackground } from "../../components/layout/PremiumAmbientBackground";
import { FriendRequests } from "../../components/social/FriendRequests";

export default function FriendRequestsScreen() {
  const router = useRouter();
  const isBackingRef = useRef(false);

  const handleBack = useCallback(() => {
    if (isBackingRef.current) return;
    isBackingRef.current = true;
    router.back();
    setTimeout(() => {
      isBackingRef.current = false;
    }, 600);
  }, [router]);

  return (
    <View className="flex-1 bg-[#050505]">
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} pointerEvents="none">
        <PremiumAmbientBackground />
      </View>
      <View className="flex-1 z-10">
        {/* Header - Aligned identically with settings.tsx and edit-profile.tsx */}
        <View className="px-6 pt-3 pb-2">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={handleBack}
              className="p-2 -ml-2 rounded-full items-center justify-center active:opacity-60"
            >
              <ArrowLeft size={24} color="white" />
            </TouchableOpacity>
            <Text className="font-outfitMed tracking-widest uppercase text-white">
              Friend Requests
            </Text>
            <View className="w-9" />
          </View>
        </View>

        {/* Content Area */}
        <ScrollView
          className="flex-1 px-6 pt-2"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        >
          <FriendRequests />
        </ScrollView>
      </View>
    </View>
  );
}
