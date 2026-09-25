import { useFocusEffect, useRouter } from "expo-router";
import { Play, X } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  InteractionManager,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { PremiumAmbientBackground } from '../../components/layout/PremiumAmbientBackground';
import { LevelUpModal } from "../../components/modals/LevelUpModal";
import { ModalTopBorder } from "../../components/ui/ModalTopBorder";
import { WorkoutTrainerCard } from "../../components/workout/WorkoutTrainerCard";
import { usePreferencesStore } from "../../store/core/preferencesStore";
import { useAuthStore } from "../../store/user/authStore";
import { useProfileStore } from "../../store/user/profileStore";

const EXERCISE_INFO = {
  pushup: {
    name: "Push-up Trainer",
    description: "Real-time biomechanical tracking. Monitors elbow flare, back alignment, and descent depth.",
    focus: "Chest & Triceps",
    unit: "reps"
  },
  squat: {
    name: "Split Squat",
    description: "Unilateral precision tracking. Analyzes knee-to-toe alignment and hip drop for optimal activation.",
    focus: "Quads & Glutes",
    unit: "reps"
  },
  plank: {
    name: "Plank Stabilizer",
    description: "Core endurance monitor. Live hip-level detection prevents lower back sag during extended holds.",
    focus: "Core & Shoulders",
    unit: "s"
  }
};

const getDefaultTarget = (exercise: string) => {
  const prefs = usePreferencesStore.getState().preferences;
  if (prefs && (prefs as any)[`${exercise}_target`]) {
    return (prefs as any)[`${exercise}_target`];
  }
  return exercise === 'plank' ? 120 : exercise === 'squat' ? 30 : 50;
};

export default function Workouts() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { preferences, fetchPreferences, updatePreference, updateMultiplePreferences } = usePreferencesStore();

  const [editingExercise, setEditingExercise] = useState<string | null>(null);
  const [targetInput, setTargetInput] = useState("");

  const [preStartExercise, setPreStartExercise] = useState<string | null>(null);

  const profile = useProfileStore((state) => state.profile);
  const previousLevel = useProfileStore((state) => state.previousLevel);
  const clearPreviousLevel = useProfileStore((state) => state.clearPreviousLevel);

  const [showLevelUpModal, setShowLevelUpModal] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      if (previousLevel !== null && profile?.level !== undefined && profile.level > previousLevel) {
        const timer = setTimeout(() => {
          setShowLevelUpModal(true);
        }, 300);
        return () => clearTimeout(timer);
      }
    }, [previousLevel, profile?.level])
  );

  const handleCloseLevelUp = () => {
    setShowLevelUpModal(false);
    clearPreviousLevel();
  };

  const isNavigatingRef = useRef(false);
  const lastClickTime = useRef(0);

  // 1. STATE TO HOLD HEAVY RENDERING UNTIL TAB ANIMATION FINISHES
  const [isScreenReady, setIsScreenReady] = useState(false);

  useEffect(() => {
    // 2. MAGIC FIX: Wait for all tab sliding animations to finish before rendering skeletons
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      setIsScreenReady(true);
    });
    return () => interactionTask.cancel();
  }, []);

  // 3. Delay data fetching until screen is ready
  useEffect(() => {
    if (isScreenReady && user?.id) {
      fetchPreferences(user.id);
    }
  }, [user?.id, isScreenReady]);

  const startWorkout = (exercise: string) => {
    const now = Date.now();
    if (now - lastClickTime.current < 2000) return;
    lastClickTime.current = now;

    setPreStartExercise(exercise);
  };

  const confirmStartWorkout = () => {
    if (!preStartExercise) return;

    const exercise = preStartExercise;
    const target = preferences ? ((preferences as any)[`${exercise}_target`] || getDefaultTarget(exercise)) : getDefaultTarget(exercise);

    setPreStartExercise(null);

    // 50ms magic delay for butter-smooth touch feedback before routing
    setTimeout(() => {
      router.navigate({
        pathname: "/(workout)/workout-session",
        params: { exercise, target: target.toString() }
      } as any);
    }, 50);
  };

  const currentPreStartExercise = preStartExercise || 'pushup';

  const formattedTimeLimit = useMemo(() => {
    const exercise = currentPreStartExercise;
    const targetValue = preferences ? ((preferences as any)[`${exercise}_target`] || getDefaultTarget(exercise)) : getDefaultTarget(exercise);

    if (exercise === 'plank') {
      const baseXp = Math.round(targetValue / 4.0);
      return {
        fast: Math.floor(targetValue * 1.1),
        normal: Math.floor(targetValue * 1.5),
        slow: Math.ceil(targetValue * 1.5),
        fastXp: Math.round(baseXp * 1.2),
        normalXp: baseXp,
        slowXp: Math.round(baseXp * 0.8)
      };
    }

    const expectedTime = targetValue * 4;
    const baseXp = targetValue;
    return {
      fast: Math.floor(expectedTime * 0.8),
      normal: expectedTime,
      slow: Math.ceil(expectedTime * 1.3),
      fastXp: Math.round(baseXp * 1.2),
      normalXp: baseXp,
      slowXp: Math.round(baseXp * 0.8)
    };
  }, [currentPreStartExercise, preferences]);

  const openEditModal = (exercise: string) => {
    setEditingExercise(exercise);
    setTargetInput((preferences ? ((preferences as any)[`${exercise}_target`] || getDefaultTarget(exercise)) : getDefaultTarget(exercise)).toString());
  };

  const saveTarget = async () => {
    if (!editingExercise || !user?.id) return;

    const newTarget = parseInt(targetInput) || 0;
    if (newTarget > 0) {
      await updateMultiplePreferences(user.id, {
        [`${editingExercise}_target`]: newTarget
      });
    }
    setEditingExercise(null);
  };

  const handleTargetInputChange = (text: string) => {
    const cleanText = text.replace(/[^0-9]/g, "");
    if (!cleanText) {
      setTargetInput("");
      return;
    }

    let val = parseInt(cleanText, 10);
    if (editingExercise === "plank") {
      if (val > 300) val = 300;
    } else {
      if (val > 150) val = 150;
    }

    setTargetInput(val.toString());
  };

  const getTargetText = (exercise: string) => {
    if (!preferences) return `${getDefaultTarget(exercise)}${EXERCISE_INFO[exercise as keyof typeof EXERCISE_INFO].unit}`;
    const target = (preferences as any)[`${exercise}_target`] || getDefaultTarget(exercise);
    return `${target}${EXERCISE_INFO[exercise as keyof typeof EXERCISE_INFO].unit}`;
  };

  return (
    <View className="flex-1 bg-transparent">
      <PremiumAmbientBackground />
      <ScrollView
        className="flex-1 px-5 pt-3"
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-1 mb-3.5">
          <Text className="text-[28px] font-outfitBold tracking-tight text-white">
            Biomechanics<Text className="text-[#3A9E66]">.</Text>
          </Text>
        </View>

        {isScreenReady && (
          <View className="gap-3.5">
            <WorkoutTrainerCard
              exerciseKey="pushup"
              name={EXERCISE_INFO.pushup.name}
              focus={EXERCISE_INFO.pushup.focus}
              targetText={getTargetText("pushup")}
              delay={80}
              onEditTarget={() => openEditModal("pushup")}
              onStartSession={() => startWorkout("pushup")}
            />

            <WorkoutTrainerCard
              exerciseKey="squat"
              name={EXERCISE_INFO.squat.name}
              focus={EXERCISE_INFO.squat.focus}
              targetText={getTargetText("squat")}
              delay={160}
              onEditTarget={() => openEditModal("squat")}
              onStartSession={() => startWorkout("squat")}
            />

            <WorkoutTrainerCard
              exerciseKey="plank"
              name={EXERCISE_INFO.plank.name}
              focus={EXERCISE_INFO.plank.focus}
              targetText={getTargetText("plank")}
              delay={240}
              onEditTarget={() => openEditModal("plank")}
              onStartSession={() => startWorkout("plank")}
            />

            {/* Bottom Scroll Teaser */}
            <View className="items-center justify-center py-6 mt-1">
              <View className="flex-row items-center gap-2">
                <View className="w-1.5 h-1.5 rounded-full bg-[#3A9E66]/40" />
                <Text className="text-[10px] font-outfitMed uppercase tracking-[0.25em] text-white/30">
                  More Vision Workouts Coming Soon
                </Text>
                <View className="w-1.5 h-1.5 rounded-full bg-[#3A9E66]/40" />
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={!!editingExercise}
        transparent
        animationType="fade"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={() => setEditingExercise(null)}
      >
        <View className="flex-1 bg-black/80 justify-center items-center px-6">
          <View className="bg-[#1C1C1C] border border-white/10 w-full rounded-3xl p-6 overflow-hidden relative">
            <ModalTopBorder theme="emerald" />
            <View className="flex-row justify-between items-center mb-6 z-10">
              <Text className="text-xl font-outfitBold text-white">
                Set Target {editingExercise === 'plank' ? 'Duration' : 'Reps'}
              </Text>
              <TouchableOpacity onPress={() => setEditingExercise(null)} className="p-2 -mr-2 bg-white/5 rounded-full">
                <X size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View className="bg-black/40 rounded-2xl p-5 flex-col mb-8 border border-white/5 z-10">
              <View className="flex-col">
                <Text className="font-outfitMed text-white/60 text-base mb-4">
                  {editingExercise && EXERCISE_INFO[editingExercise as keyof typeof EXERCISE_INFO].name} Target
                </Text>
                <View className="flex-row items-center bg-white/5 px-4 py-3 rounded-xl border border-white/10">
                  <TextInput
                    value={targetInput}
                    onChangeText={handleTargetInputChange}
                    keyboardType="numeric"
                    maxLength={3}
                    className="font-outfitBold text-2xl text-brand-sage flex-1 text-left"
                    selectionColor="#A7C4B5"
                  />
                  <Text className="font-outfitMed text-white/40 text-lg ml-2">
                    {editingExercise && EXERCISE_INFO[editingExercise as keyof typeof EXERCISE_INFO].unit}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={saveTarget}
              className="bg-brand-forest w-full py-4 rounded-xl items-center z-10"
            >
              <Text className="text-[#121212] font-outfitBold text-lg">Save Target</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={!!preStartExercise}
        animationType="fade"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={() => setPreStartExercise(null)}
      >
        <View className="flex-1 bg-black/80 justify-center px-5">
          <View className="bg-[#121212] border border-white/10 rounded-[32px] overflow-hidden w-full h-[88%] max-h-[680px] flex-col relative">
            <ModalTopBorder theme="emerald" />

            <View className="items-center px-6 pt-5 pb-3.5 border-b border-white/5 z-10">
              <Text className="text-white font-outfitBold text-2xl mb-0.5 text-center">
                {EXERCISE_INFO[currentPreStartExercise as keyof typeof EXERCISE_INFO].name}
              </Text>
              <Text className="text-brand-sage font-outfitMed text-[10px] uppercase tracking-widest">
                AI Tracking Session
              </Text>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
              bounces={true}
              overScrollMode="always"
              className="flex-1"
            >
              {/* Target & Base XP Badge */}
              <View className="flex-row items-center justify-between w-full mb-3 bg-white/5 rounded-2xl p-3.5 border border-white/5">
                <View className="items-center flex-1">
                  <Text className="text-[#A1A1AA] font-outfitReg text-[10px] uppercase tracking-wider mb-0.5">Target</Text>
                  <Text className="text-white font-outfitBold text-lg">
                    {preferences ? ((preferences as any)[`${currentPreStartExercise}_target`] || getDefaultTarget(currentPreStartExercise)) : getDefaultTarget(currentPreStartExercise)} {EXERCISE_INFO[currentPreStartExercise as keyof typeof EXERCISE_INFO].unit}
                  </Text>
                </View>
              </View>

              <Text className="text-[#A1A1AA] font-outfitReg text-[12px] text-center mb-2.5 leading-relaxed">
                {currentPreStartExercise === 'plank' ? 'Hold unbroken form to earn bonus XP:' : 'Beat the clock to earn bonus XP:'}
              </Text>

              {/* Bonus XP Tiers */}
              <View className="w-full flex-col gap-1.5 mb-3.5">
                <View className="flex-row justify-between bg-brand-success/10 p-3 rounded-xl border border-brand-success/30 gap-2 items-center">
                  <View className="flex-col flex-1">
                    <Text className="font-outfitMed text-brand-success text-xs">{currentPreStartExercise === 'plank' ? 'Unbroken' : 'Fast'}</Text>
                    <Text className="font-outfitBold text-brand-success text-[12px]" numberOfLines={1}>Under {formattedTimeLimit.fast}s{currentPreStartExercise === 'plank' ? ' real time' : ''}</Text>
                  </View>
                  <Text className="font-outfitBold text-brand-success text-base">+{formattedTimeLimit.fastXp} XP</Text>
                </View>
                <View className="flex-row justify-between bg-white/5 p-3 rounded-xl border border-white/10 gap-2 items-center">
                  <View className="flex-col flex-1">
                    <Text className="font-outfitMed text-white text-xs">Normal</Text>
                    <Text className="font-outfitBold text-white/70 text-[12px]" numberOfLines={1}>Around {formattedTimeLimit.normal}s{currentPreStartExercise === 'plank' ? ' real time' : ''}</Text>
                  </View>
                  <Text className="font-outfitBold text-white text-base">+{formattedTimeLimit.normalXp} XP</Text>
                </View>
                <View className="flex-row justify-between bg-red-500/10 p-3 rounded-xl border border-red-500/30 gap-2 items-center">
                  <View className="flex-col flex-1">
                    <Text className="font-outfitMed text-red-400 text-xs">{currentPreStartExercise === 'plank' ? 'Resting Penalty' : 'Slow'}</Text>
                    <Text className="font-outfitBold text-red-400/70 text-[12px]" numberOfLines={1}>Over {formattedTimeLimit.slow}s{currentPreStartExercise === 'plank' ? ' real time' : ''}</Text>
                  </View>
                  <Text className="font-outfitBold text-red-400 text-base">+{formattedTimeLimit.slowXp} XP</Text>
                </View>
              </View>

              {/* AI Tracking Rules Card */}
              <View className="w-full bg-[#1A1A1A] border border-[#3A9E66]/30 rounded-2xl p-3.5">
                <View className="flex-row items-center gap-2 mb-2">
                  <Text className="text-[#3A9E66] font-outfitBold text-[11px] uppercase tracking-wider">
                    For Best AI Tracking
                  </Text>
                </View>
                <View className="gap-1.5">
                  <Text className="text-white/80 font-outfitReg text-[11px] leading-relaxed">
                    • <Text className="font-outfitMed text-white">Clothing:</Text> Wear medium-loose clothes (avoid very baggy clothes that hide your joints).
                  </Text>
                  <Text className="text-white/80 font-outfitReg text-[11px] leading-relaxed">
                    • <Text className="font-outfitMed text-white">Lighting:</Text> Ensure good lighting and high contrast in the room.
                  </Text>
                  <Text className="text-white/80 font-outfitReg text-[11px] leading-relaxed">
                    • <Text className="font-outfitMed text-white">Position:</Text> Prop phone on floor {currentPreStartExercise === 'squat' ? 'vertically' : 'horizontally'}, leaning against a wall.
                  </Text>
                  <Text className="text-white/80 font-outfitReg text-[11px] leading-relaxed">
                    • <Text className="font-outfitMed text-white">Visibility:</Text> Keep your full body visible in the camera frame.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View className="flex-col w-full gap-2.5 px-5 pb-5 pt-3.5 border-t border-white/5 bg-[#121212]">
              <TouchableOpacity
                onPress={confirmStartWorkout}
                activeOpacity={0.8}
                className="w-full h-13 py-3.5 rounded-full bg-[#2F6B47] border border-[#3E8B5C] flex-row items-center justify-center gap-2 shadow-xs"
              >
                <Text className="text-white font-outfitBold text-base uppercase tracking-wider">
                  READY
                </Text>
                <Play size={14} color="#FFFFFF" fill="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPreStartExercise(null)}
                activeOpacity={0.7}
                className="py-3 items-center justify-center"
              >
                <Text className="text-white/50 font-outfitMed text-sm">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <LevelUpModal
        isVisible={showLevelUpModal}
        onClose={handleCloseLevelUp}
        level={profile?.level || 1}
        username={profile?.username || user?.email?.split('@')[0] || "User"}
      />
    </View>
  );
}