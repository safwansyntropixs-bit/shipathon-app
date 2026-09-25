import { SkeletonBlock } from "@/components/loaders/SkeletonLoader";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from 'expo-notifications';
import { useRouter } from "expo-router";
import { Check, X } from 'lucide-react-native';
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { analyticsService } from "../../services/core/analyticsService";
import { usePremiumStore } from "../../store/core/premiumStore";
import { useAuthStore } from "../../store/user/authStore";
import { useProfileStore } from "../../store/user/profileStore";

export default function PremiumScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const fetchProfile = useProfileStore((s) => s.fetchProfile);
  const loadOfferings = usePremiumStore((s) => s.loadOfferings);
  const purchase = usePremiumStore((s) => s.purchase);
  const restore = usePremiumStore((s) => s.restore);

  const offerings = usePremiumStore((s) => s.offerings);
  const isLoadingOfferings = usePremiumStore((s) => s.isLoadingOfferings);
  const isPurchasing = usePremiumStore((s) => s.isPurchasing);
  const isRestoring = usePremiumStore((s) => s.isRestoring);
  const error = usePremiumStore((s) => s.error);
  const setJustSubscribed = usePremiumStore((s) => s.setJustSubscribed);

  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [remindMe, setRemindMe] = useState(true);

  const isBackingRef = React.useRef(false);
  const isPurchasingRef = React.useRef(false);
  const isRestoringRef = React.useRef(false);

  const handleClose = React.useCallback(() => {
    if (isBackingRef.current) return;
    isBackingRef.current = true;
    router.back();
    setTimeout(() => {
      isBackingRef.current = false;
    }, 600);
  }, [router]);

  const checkAndRequestPermissions = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      setRemindMe(false);
      return false;
    }
    return true;
  };

  const handleToggleReminder = async (val: boolean) => {
    setRemindMe(val);
    if (val) {
      await checkAndRequestPermissions();
    }
  };

  useEffect(() => {
    loadOfferings(user?.id);
    analyticsService.trackEvent("paywall_viewed", {
      trigger_source: "locked_feature",
    });
  }, [loadOfferings, user?.id]);

  useEffect(() => {
    if (offerings.length > 0 && !selectedPackage) {
      const annualPkg = offerings.find(p => p.type === 'annual' || p.id.includes('annual'));
      if (annualPkg) {
        setSelectedPackage(annualPkg.id);
      } else {
        setSelectedPackage(offerings[0].id);
      }
    }
  }, [offerings, selectedPackage]);

  const selectedPkg = offerings.find(o => o.id === selectedPackage);
  const annualPkg = offerings.find(o => o.type === 'annual' || o.id.includes('annual'));
  const annualSelected = selectedPackage === annualPkg?.id;
  const isTrialEligible = Boolean(selectedPkg?.hasFreeTrial && selectedPkg?.isTrialEligible);

  const handlePurchase = async () => {
    if (!user?.id || !selectedPackage || isPurchasingRef.current || isPurchasing) return;
    isPurchasingRef.current = true;

    let willRemind = remindMe;
    if (annualSelected && isTrialEligible && remindMe) {
      try {
        willRemind = await checkAndRequestPermissions();
      } catch (permErr) {
        console.warn("[premium] Error checking notification permissions:", permErr);
      }
    }

    try {
      const success = await purchase(selectedPackage, user.id);
      if (success) {
        if (annualSelected && isTrialEligible && willRemind) {
          try {
            const targetDate = new Date(Date.now() + (__DEV__ ? 3 * 60 * 1000 : 6 * 24 * 60 * 60 * 1000));
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "Your free trial is ending soon! ⏳",
                body: "Your Replix Pro trial ends in 24 hours. Cancel now if you don't want to be charged.",
                sound: true,
              },
              trigger: {
                type: "date" as const,
                date: targetDate,
              } as Notifications.NotificationTriggerInput,
            });
          } catch (notifErr) {
            console.warn("[premium] Error scheduling trial reminder:", notifErr);
          }
        }

        try {
          await fetchProfile(true); // Force fetch to skip TTL cache and sync is_premium instantly
        } catch (profileErr) {
          console.warn("[premium] Error refreshing profile after purchase:", profileErr);
        }

        setJustSubscribed(true);
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(tabs)/profile" as any);
        }
      }
    } catch (err: any) {
      console.error("[premium] handlePurchase error:", err);
    } finally {
      isPurchasingRef.current = false;
    }
  };

  const handleRestore = async () => {
    if (!user?.id || isRestoringRef.current || isRestoring) return;
    isRestoringRef.current = true;

    try {
      const success = await restore(user.id);
      if (success) {
        try {
          await fetchProfile(true); // Force fetch to skip TTL cache
        } catch (profileErr) {
          console.warn("[premium] Error refreshing profile after restore:", profileErr);
        }
        setJustSubscribed(true);
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(tabs)/profile" as any);
        }
      }
    } catch (err: any) {
      console.error("[premium] handleRestore error:", err);
    } finally {
      isRestoringRef.current = false;
    }
  };

  const getCtaButtonText = () => {
    if (isLoadingOfferings || offerings.length === 0) {
      return "Loading Plans...";
    }
    if (annualSelected) {
      if (isTrialEligible) {
        return `Start ${selectedPkg?.trialDurationText || "7-Day"} Free Trial`;
      }
      return "Subscribe Annually";
    }
    return "Subscribe Monthly";
  };

  const features = [
    "Unlimited History and Deep Analytics",
    "Competitor Intel and Unlock Rival PRs",
    "Monthly Global Rankings and Pro Recaps",
    "Golden Pro Avatar"
  ];

  return (
    <View className="flex-1 bg-zinc-950">
      <LinearGradient
        colors={['rgba(16, 185, 129, 0.25)', 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.65 }}
      />
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <ScrollView
          className="flex-1 px-6 pt-0"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {/* Header Close */}
          <View className="flex-row justify-end items-center mb-1">
            <TouchableOpacity onPress={handleClose} className="w-10 h-10 items-end justify-center">
              <View className="bg-black/50 rounded-full p-2">
                <X size={20} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Hero Section */}
          <View>
            <Text className="text-[32px] leading-[36px] font-outfitBold text-white tracking-tight mb-6">
              Unlock{"\n"}
              <Text className="text-gold">Replix Pro</Text>
            </Text>

            {/* Pro Features List */}
            <View className="flex-col gap-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md p-3.5">
              {features.map((f, idx) => (
                <View key={idx} className="flex-row">
                  <View className="w-5 h-5 rounded-full bg-[#3A9E66]/20 items-center justify-center mr-2.5">
                    <Check size={12} color="#3A9E66" strokeWidth={2.5} />
                  </View>
                  <Text className="text-[13px] font-outfitMed text-zinc-200 flex-1" numberOfLines={2}>
                    {f}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View className="flex-1 min-h-[8px]" />

          {/* Pricing Cards (Stacked) */}
          <View className="mb-4 flex-col gap-3">
            {(isLoadingOfferings || offerings.length === 0) ? (
              <>
                {/* Annual Card Skeleton */}
                <View className="w-full rounded-2xl p-4 border border-white/10 bg-white/5 relative">
                  <View className="absolute -top-3 right-4 bg-white/10 px-3 py-1 rounded-full">
                    <SkeletonBlock width={50} height={10} borderRadius={5} />
                  </View>
                  <View className="flex-row justify-between items-center">
                    <View className="flex-1 mr-3">
                      <SkeletonBlock width={120} height={20} borderRadius={6} className="mb-2" />
                      <SkeletonBlock width={160} height={14} borderRadius={4} />
                    </View>
                    <SkeletonBlock width={24} height={24} borderRadius={12} />
                  </View>
                </View>

                {/* Monthly Card Skeleton */}
                <View className="w-full rounded-2xl p-4 border border-white/10 bg-white/5">
                  <View className="flex-row justify-between items-center">
                    <View className="flex-1 mr-3">
                      <SkeletonBlock width={90} height={20} borderRadius={6} className="mb-2" />
                      <SkeletonBlock width={130} height={14} borderRadius={4} />
                    </View>
                    <SkeletonBlock width={24} height={24} borderRadius={12} />
                  </View>
                </View>
              </>
            ) : (
              offerings.map((pkg) => {
                const isAnnual = pkg.type === "annual" || pkg.id.includes("annual");
                const isSelected = selectedPackage === pkg.id;
                const showTrial = isAnnual && pkg.hasFreeTrial && pkg.isTrialEligible;

                if (isAnnual) {
                  return (
                    <TouchableOpacity
                      key={pkg.id}
                      onPress={() => setSelectedPackage(pkg.id)}
                      activeOpacity={0.9}
                      className={`w-full rounded-2xl p-4 border relative backdrop-blur-md ${isSelected ? "border-[#3A9E66] bg-[#3A9E66]/10" : "border-white/10 bg-white/5"
                        }`}
                    >
                      {/* 50% OFF Badge */}
                      <View className="absolute -top-3 right-4 bg-gold px-3 py-1 rounded-full shadow-md">
                        <Text className="text-[10px] font-outfitBold text-black uppercase tracking-wider">
                          50% OFF
                        </Text>
                      </View>

                      <View className="flex-row justify-between items-center">
                        <View>
                          <Text className="text-xl font-outfitBold text-white mb-0.5">
                            {showTrial ? `${pkg.trialDurationText || "7-Day"} Free Trial` : "Annual"}
                          </Text>
                          <Text className="font-outfitMed text-zinc-400">
                            {showTrial ? `then ${pkg.priceString} / year` : `${pkg.priceString} / year`}
                          </Text>
                        </View>
                        <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${isSelected ? "border-[#3A9E66]" : "border-zinc-600"}`}>
                          {isSelected && <View className="w-2.5 h-2.5 rounded-full bg-[#3A9E66]" />}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                } else {
                  return (
                    <TouchableOpacity
                      key={pkg.id}
                      onPress={() => setSelectedPackage(pkg.id)}
                      activeOpacity={0.9}
                      className={`w-full rounded-2xl p-4 border backdrop-blur-md ${isSelected ? "border-[#3A9E66] bg-[#3A9E66]/10" : "border-white/10 bg-white/5"
                        }`}
                    >
                      <View className="flex-row justify-between items-center">
                        <View>
                          <Text className="text-xl font-outfitBold text-zinc-200 mb-0.5">
                            Monthly
                          </Text>
                          <Text className="font-outfitMed text-zinc-500">
                            {pkg.priceString} / month
                          </Text>
                        </View>
                        <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${isSelected ? "border-[#3A9E66]" : "border-zinc-600"}`}>
                          {isSelected && <View className="w-2.5 h-2.5 rounded-full bg-[#3A9E66]" />}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }
              })
            )}
          </View>

          {error && (
            <Text className="text-xs text-red-400 text-center font-outfitMed mb-3 bg-red-400/10 py-2.5 rounded-xl border border-red-400/20">
              {error}
            </Text>
          )}

        </ScrollView>

        {/* Sticky Footer / CTA */}
        <View className="px-6 pb-2 bg-zinc-950">

          {annualSelected && isTrialEligible && (
            <View className="flex-row items-center justify-between mb-3 px-1">
              <View className="flex-1 mr-3">
                <Text className="text-white font-outfitMed text-[13px] mb-0.5">
                  Remind me before my trial ends
                </Text>
                <Text className="text-zinc-500 font-outfitReg text-[11px]">
                  We'll notify you 24 hours before you're charged.
                </Text>
              </View>
              <Switch
                value={remindMe}
                onValueChange={handleToggleReminder}
                trackColor={{ false: '#3F3F46', true: '#3A9E66' }}
                thumbColor={'#ffffff'}
                ios_backgroundColor="#3F3F46"
                style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
              />
            </View>
          )}

          <TouchableOpacity
            onPress={handlePurchase}
            disabled={isPurchasing || !selectedPackage || (isLoadingOfferings && offerings.length === 0)}
            activeOpacity={0.8}
            className={`w-full h-14 rounded-2xl items-center justify-center flex-row shadow-xl mb-2.5 ${(isPurchasing || !selectedPackage || (isLoadingOfferings && offerings.length === 0)) ? 'bg-[#3A9E66]/60' : 'bg-[#3A9E66]'
              }`}
          >
            {isPurchasing ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text className="text-white font-outfitBold text-base tracking-wide mt-0.5">
                {getCtaButtonText()}
              </Text>
            )}
          </TouchableOpacity>

          <View className="items-center">
            <TouchableOpacity onPress={handleRestore} disabled={isRestoring} className="py-1 px-3">
              <Text className="text-[11px] text-zinc-500 font-outfitMed tracking-wide">
                {isRestoring ? "Restoring..." : "Restore Purchases"}
              </Text>
            </TouchableOpacity>

            <View className="flex-row items-center justify-center my-1">
              <Text className="text-zinc-500 text-[10px] font-outfit">Terms of Service</Text>
              <Text className="text-zinc-500 text-[10px] font-outfit mx-2">•</Text>
              <Text className="text-zinc-500 text-[10px] font-outfit">Privacy Policy</Text>
            </View>

            <Text className="text-zinc-500/70 text-[9px] text-center font-outfit leading-[12px] px-2 pb-0.5">
              Subscription automatically renews unless canceled at least 24 hours before the end of the current period. You can manage and cancel your subscription in your Play Store account settings. Payment will be charged to your account at confirmation of purchase.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}


