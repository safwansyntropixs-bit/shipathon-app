import { useRouter } from "expo-router";
import * as StoreReview from 'expo-store-review';
import { ArrowLeft, Award, Calendar, ChevronRight, Compass, Crown, Lock, LogOut, MessageSquare, Mic, RefreshCw, ShieldCheck, Sparkles, Star, Timer, Trash2, Volume2, CheckCircle2, AlertCircle } from 'lucide-react-native';
import React, { useState } from "react";
import Toast from 'react-native-toast-message';
import { ActivityIndicator, Alert, Linking, Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { OnboardingScreen } from "../(onboarding)/onboarding";
import { PremiumAmbientBackground } from "../../components/layout/PremiumAmbientBackground";
import { CelebrationModal } from "../../components/modals/CelebrationModal";
import { ConfirmationModal } from "../../components/modals/ConfirmationModal";
import { LockedFeatureModal } from "../../components/modals/LockedFeatureModal";
import { SaveButton } from "../../components/ui/SaveButton";
import { XPToast } from "../../components/ui/XPToast";
import { usePremiumStore } from "../../store/core/premiumStore";
import { useRecapStore } from "../../store/gamification/recapStore";
import { useAuthStore } from "../../store/user/authStore";
import { useProfileStore } from "../../store/user/profileStore";

const SettingsSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View className="mb-6">
    <Text className="text-[10px] font-outfitBold uppercase tracking-widest text-[#3A9E66] mb-2 px-1">
      {title}
    </Text>
    <View className="bg-[#141414]/95 border border-white/10 rounded-2xl overflow-hidden shadow-xs">
      {children}
    </View>
  </View>
);

const SettingsRow = ({
  icon: Icon,
  title,
  subtitle,
  rightElement,
  onPress,
  isDestructive = false,
  isLoading = false
}: {
  icon: any;
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  isDestructive?: boolean;
  isLoading?: boolean;
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={!onPress || isLoading}
    activeOpacity={0.7}
    className="flex-row items-center justify-between p-4 border-b border-white/5"
  >
    <View className="flex-row items-center flex-1">
      <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${isDestructive ? 'bg-red-500/10' : 'bg-white/5'}`}>
        <Icon size={16} color={isDestructive ? '#EF4444' : '#FFFFFF'} />
      </View>
      <View className="flex-1 mr-4">
        <Text className={`text-sm font-outfitMed ${isDestructive ? 'text-red-500' : 'text-white'}`}>
          {title}
        </Text>
        {subtitle && (
          <Text className="text-[10px] text-white/50 font-outfitReg mt-0.5">
            {subtitle}
          </Text>
        )}
      </View>
    </View>
    {isLoading ? (
      <ActivityIndicator size="small" color={isDestructive ? '#EF4444' : '#3A9E66'} />
    ) : (
      rightElement || (onPress && <ChevronRight size={16} color="#FFFFFF50" />)
    )}
  </TouchableOpacity>
);

const ToggleButton = ({ value, onToggle }: { value: boolean; onToggle: () => void }) => (
  <TouchableOpacity onPress={onToggle} className="p-1">
    <View className={`w-12 h-7 rounded-full justify-center px-0.5 ${value ? "bg-[#3A9E66]" : "bg-white/20"}`}>
      <View className={`w-6 h-6 rounded-full bg-white shadow-sm ${value ? "ml-5" : "ml-0"}`} />
    </View>
  </TouchableOpacity>
);

const PrepTimerPicker = ({ value, onChange }: { value: number; onChange: (val: number) => void }) => {
  const options = Array.from({ length: 8 }, (_, i) => i + 3); // 3 to 10

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="flex-row mt-2 mb-2"
      contentContainerStyle={{ paddingHorizontal: 16 }}
    >
      {options.map((time) => {
        const isSelected = value === time;
        return (
          <TouchableOpacity
            key={time}
            onPress={() => onChange(time)}
            className={`w-12 h-12 rounded-full items-center justify-center mr-3 border ${isSelected ? 'bg-[#3A9E66] border-[#3A9E66]' : 'bg-white/5 border-white/10'
              }`}
          >
            <Text className={`font-outfitMed text-sm ${isSelected ? 'text-white' : 'text-white/50'}`}>
              {time}s
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

export default function SettingsScreen() {
  const router = useRouter();
  const isBackingRef = React.useRef(false);
  const handleBack = React.useCallback(() => {
    if (isBackingRef.current) return;
    isBackingRef.current = true;
    router.back();
    setTimeout(() => {
      isBackingRef.current = false;
    }, 600);
  }, [router]);

  const preferences = useProfileStore((s) => s.preferences);
  const updatePreferences = useProfileStore((s) => s.updatePreferences);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [isOnboardingPreviewOpen, setIsOnboardingPreviewOpen] = useState(false);
  const [isTestLockedModalOpen, setIsTestLockedModalOpen] = useState(false);

  const [localPreferences, setLocalPreferences] = useState(preferences);

  React.useEffect(() => {
    setLocalPreferences(preferences);
  }, [preferences]);

  const [toastQueue, setToastQueue] = useState<any[]>([]);

  const {
    isOpen: isCelebrationOpen,
    closeCelebration,
    activeData: celebrationData,
    triggerCelebration,
    resetCelebrationForTesting,
  } = useRecapStore();

  const hasChanges = JSON.stringify(localPreferences) !== JSON.stringify(preferences);

  const handleSave = async () => {
    if (!hasChanges) return;

    setIsSaving(true);
    try {
      updatePreferences(localPreferences);

      await updateProfile({
        preferences: {
          voiceCoach: localPreferences.voiceCoach,
        },
      });

      setIsSaved(true);
      setTimeout(() => {
        handleBack();
      }, 400);
    } catch (error) {
      console.error("Failed to save settings:", error);
      Alert.alert("Error", "Could not save your preferences. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendFeedback = async () => {
    try {
      await Linking.openURL('mailto:support@example.com?subject=App Feedback');
    } catch (error) {
      Alert.alert("Error", "Could not open mail client.");
    }
  };

  const handleRateApp = async () => {
    try {
      if (await StoreReview.hasAction()) {
        await StoreReview.requestReview();
      } else {
        Alert.alert("Notice", "Store review is not available on this device.");
      }
    } catch (error) {
      Alert.alert("Error", "Could not open store review.");
    }
  };

  const handlePrivacyPolicy = async () => {
    try {
      await Linking.openURL('https://example.com/privacy');
    } catch (error) {
      Alert.alert("Error", "Could not open link.");
    }
  };

  const handleRestorePurchases = async () => {
    setProcessingAction('restore');
    try {
      // Mock network request
      await new Promise(resolve => setTimeout(resolve, 1500));
      Alert.alert("Success", "Purchases restored successfully.");
    } catch (error) {
      Alert.alert("Error", "Failed to restore purchases.");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleSignOut = () => {
    setShowSignOutModal(true);
  };

  const handleConfirmSignOut = async () => {
    setProcessingAction('signout');
    try {
      await signOut();
      setShowSignOutModal(false);
      router.replace("/(auth)/welcome" as any);
    } catch (e) {
      setShowSignOutModal(false);
      Alert.alert("Error", "Could not sign out. Please try again.");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    setProcessingAction('delete');
    try {
      // Mock network request for deletion
      await new Promise(resolve => setTimeout(resolve, 2000));
      await signOut();
      setShowDeleteModal(false);
      router.replace("/(auth)/welcome" as any);
    } catch (e) {
      setShowDeleteModal(false);
      Alert.alert("Error", "Could not delete account. Please try again.");
    } finally {
      setProcessingAction(null);
    }
  };

  return (
    <View className="flex-1 bg-[#050505]">
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} pointerEvents="none">
        <PremiumAmbientBackground />
      </View>
      <View className="flex-1 z-10">
        <View className="px-6 pt-3 pb-2">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={handleBack} className="p-2 -ml-2 rounded-full items-center justify-center">
              <ArrowLeft size={24} color="white" />
            </TouchableOpacity>
            <Text className="font-outfitMed tracking-widest uppercase text-white">Settings</Text>
            <View className="w-9" />
          </View>
        </View>

        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          <SettingsSection title="Workout">
            <SettingsRow
              icon={Volume2}
              title="Sound Confirmation"
              subtitle="Play sounds on reps and warnings."
              rightElement={
                <ToggleButton
                  value={localPreferences.haptics}
                  onToggle={() => setLocalPreferences({ ...localPreferences, haptics: !localPreferences.haptics })}
                />
              }
            />
            <SettingsRow
              icon={Mic}
              title="Audio Coach"
              subtitle="Announce form adjustments."
              rightElement={
                <ToggleButton
                  value={localPreferences.voiceCoach}
                  onToggle={() => setLocalPreferences({ ...localPreferences, voiceCoach: !localPreferences.voiceCoach })}
                />
              }
            />
            <View className="py-4 border-b border-white/5">
              <View className="px-4 flex-row items-center mb-1">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-3 bg-white/5">
                  <Timer size={16} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-outfitMed text-white">Preparation Timer</Text>
                  <Text className="text-[10px] text-white/50 font-outfitReg mt-0.5">Swipe to adjust countdown (3s - 10s)</Text>
                </View>
              </View>
              <PrepTimerPicker
                value={localPreferences.prepTimer ?? 5}
                onChange={(val) => setLocalPreferences({ ...localPreferences, prepTimer: val })}
              />
            </View>
          </SettingsSection>

          <SettingsSection title="Support">
            <SettingsRow
              icon={MessageSquare}
              title="Send Feedback"
              onPress={handleSendFeedback}
            />
            <SettingsRow
              icon={Star}
              title="Rate the App"
              onPress={handleRateApp}
            />
          </SettingsSection>

          <SettingsSection title="Legal & Account">
            <SettingsRow
              icon={ShieldCheck}
              title="Privacy Policy"
              onPress={handlePrivacyPolicy}
            />
            <SettingsRow
              icon={RefreshCw}
              title="Restore Purchases"
              onPress={handleRestorePurchases}
              isLoading={processingAction === 'restore'}
            />
            <SettingsRow
              icon={LogOut}
              title="Sign Out"
              onPress={handleSignOut}
              isDestructive
              isLoading={processingAction === 'signout'}
            />
            <SettingsRow
              icon={Trash2}
              title="Delete Account"
              onPress={handleDeleteAccount}
              isDestructive
              isLoading={processingAction === 'delete'}
            />
          </SettingsSection>

          <SettingsSection title="UI Testing & Previews">
            <SettingsRow
              icon={Crown}
              title="Preview Premium Unlocked Celebration Modal"
              subtitle="Test celebratory gold crown popup modal."
              onPress={() => {
                usePremiumStore.getState().setJustSubscribed(true);
              }}
            />
            <SettingsRow
              icon={Lock}
              title="Preview Locked Feature Paywall Modal"
              subtitle="Test action interceptor bottom sheet modal."
              onPress={() => {
                setIsTestLockedModalOpen(true);
              }}
            />
            <SettingsRow
              icon={Sparkles}
              title="Open Full Premium Paywall Screen"
              subtitle="Navigate to the interactive paywall & tier plans."
              onPress={() => {
                router.push("/(profile)/premium" as any);
              }}
            />
            <SettingsRow
              icon={Compass}
              title="Preview Interactive Onboarding Screen"
              subtitle="Test 60FPS Skia pose tracking & feature cards."
              onPress={() => {
                setIsOnboardingPreviewOpen(true);
              }}
            />
            <SettingsRow
              icon={CheckCircle2}
              title="Test Dynamic Island Toast (Success)"
              subtitle="Test glowing emerald dynamic island toast."
              onPress={() => {
                Toast.show({
                  type: 'success',
                  text1: 'Workout Completed',
                  text2: 'Awesome job! 25 reps recorded with 98% form accuracy.',
                });
              }}
            />
            <SettingsRow
              icon={AlertCircle}
              title="Test Dynamic Island Toast (Error)"
              subtitle="Test glowing crimson dynamic island toast."
              onPress={() => {
                Toast.show({
                  type: 'error',
                  text1: 'Connection Lost',
                  text2: 'Failed to sync workout session. Offline cache enabled.',
                });
              }}
            />
          </SettingsSection>

          <SettingsSection title="Developer Celebration Tools">
            <SettingsRow
              icon={Sparkles}
              title="Trigger Weekly Friends Celebration (Test)"
              onPress={() => {
                resetCelebrationForTesting();
                if (user?.id) void triggerCelebration("weekly_friends", user.id, true);
              }}
            />
            <SettingsRow
              icon={Sparkles}
              title="Trigger Weekly Global Celebration (Test)"
              onPress={() => {
                resetCelebrationForTesting();
                if (user?.id) void triggerCelebration("weekly_global", user.id, true);
              }}
            />
            <SettingsRow
              icon={Calendar}
              title="Trigger Monthly Global Celebration (Test)"
              onPress={() => {
                resetCelebrationForTesting();
                if (user?.id) void triggerCelebration("monthly_global", user.id, true);
              }}
            />
            <SettingsRow
              icon={Sparkles}
              title="Test Quest Toast"
              onPress={() => {
                setToastQueue(prev => [...prev, {
                  id: Math.random().toString(),
                  title: "Quick Pump",
                  subtitle: "Quest Unlocked",
                  xpAmount: 50,
                  iconName: "Flame",
                  theme: "default"
                }]);
              }}
            />
            <SettingsRow
              icon={Award}
              title="Test Trophy Toast"
              onPress={() => {
                setToastQueue(prev => [...prev, {
                  id: Math.random().toString(),
                  title: "THE JUGGERNAUT",
                  subtitle: "Trophy Unlocked",
                  xpAmount: 0,
                  theme: "trophy",
                  imageSource: require('../../assets/achievement_badges/The Juggernaut_badge.png'),
                  accentColor: '#D20000'
                }]);
              }}
            />
          </SettingsSection>
        </ScrollView>

        <View className="absolute bottom-8 right-6 z-20">
          <SaveButton
            isSaving={isSaving}
            isSaved={isSaved}
            hasChanges={hasChanges}
            onPress={handleSave}
            variant="fab"
          />
        </View>
      </View>

      {toastQueue.length > 0 && (
        <XPToast
          key={toastQueue[0].id}
          title={toastQueue[0].title}
          subtitle={toastQueue[0].subtitle}
          xpAmount={toastQueue[0].xpAmount}
          iconName={toastQueue[0].iconName}
          theme={toastQueue[0].theme}
          imageSource={toastQueue[0].imageSource}
          accentColor={toastQueue[0].accentColor}
          index={0}
          onComplete={() => setToastQueue(prev => prev.slice(1))}
        />
      )}

      {/* Sign Out Confirmation Modal */}
      <ConfirmationModal
        visible={showSignOutModal}
        title="Sign Out"
        description="Are you sure you want to sign out of your account?"
        confirmText="Sign Out"
        cancelText="Cancel"
        isDestructive
        isLoading={processingAction === 'signout'}
        onConfirm={handleConfirmSignOut}
        onCancel={() => {
          if (!processingAction) setShowSignOutModal(false);
        }}
      />

      {/* Delete Account Confirmation Modal */}
      <ConfirmationModal
        visible={showDeleteModal}
        title="Delete Account"
        description="Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently lost."
        confirmText="Delete Account"
        cancelText="Cancel"
        isDestructive
        isLoading={processingAction === 'delete'}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!processingAction) setShowDeleteModal(false);
        }}
      />

      {celebrationData && (
        <CelebrationModal
          visible={isCelebrationOpen}
          onClose={closeCelebration}
          data={celebrationData}
        />
      )}

      {/* Test Locked Feature Modal */}
      <LockedFeatureModal
        visible={isTestLockedModalOpen}
        onClose={() => setIsTestLockedModalOpen(false)}
        onUpgradePress={() => {
          setIsTestLockedModalOpen(false);
          router.push("/(profile)/premium" as any);
        }}
        title="Unlock Replix Pro (Test Preview)"
        description="This is a preview of the Pro paywall popup modal used when tapping locked features across history, analytics, and leaderboards."
        buttonText="View All Plans"
      />

      {/* Test Onboarding Fullscreen Modal */}
      <Modal
        visible={isOnboardingPreviewOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsOnboardingPreviewOpen(false)}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <OnboardingScreen
            onNavigateTo={() => setIsOnboardingPreviewOpen(false)}
            onClose={() => setIsOnboardingPreviewOpen(false)}
            isPreview
          />
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}
