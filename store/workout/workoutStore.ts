import { AudioPlayer, createAudioPlayer } from "expo-audio";
import * as Crypto from "expo-crypto";
import * as Speech from "expo-speech";
import { create } from "zustand";
import { Point3D } from "../../domain/KineticMath";
import { PlankEngine } from "../../domain/PlankEngine";
import { PushupEngine } from "../../domain/PushupEngine";
import { SquatEngine } from "../../domain/SquatEngine";
import { analyticsService } from "../../services/core/analyticsService";
import { workoutService } from "../../services/workout/workoutService";
import { useProfileStore } from "../user/profileStore";
import { scheduleStreakReminder } from "../../services/notifications/scheduleStreakReminder";
import { scheduleMorningReport } from "../../services/notifications/scheduleMorningReport";

let successSound: AudioPlayer | null = null;
let warningSound: AudioPlayer | null = null;

const isSoundEnabled = () => useProfileStore.getState().preferences.haptics;
const isSpeechEnabled = () => useProfileStore.getState().preferences.voiceCoach;

const playSuccessSound = async () => {
  if (!isSoundEnabled()) return;
  try {
    if (!successSound) {
      successSound = createAudioPlayer(require("../../assets/sounds/success.ogg"));
    }
    await successSound.seekTo(0);
    successSound.play();
  } catch (e) { }
};

const playWarningSound = async () => {
  if (!isSoundEnabled()) return;
  try {
    if (!warningSound) {
      warningSound = createAudioPlayer(require("../../assets/sounds/warning.ogg"));
    }
    await warningSound.seekTo(0);
    warningSound.play();
  } catch (e) { }
};

const stopMedia = (stopSpeech = true) => {
  try {
    if (stopSpeech) Speech.stop();
    if (warningSound) warningSound.pause();
    if (successSound) successSound.pause();
  } catch (e) { }
};

interface WorkoutState {
  isActive: boolean;
  exerciseKey: string;
  reps: number;
  formAccuracy: number;
  isFormPerfect: boolean;
  statusMessage: string;
  seconds: number; // Active/Stabilized time
  globalSeconds: number; // Overall duration for the current set
  sessionGlobalSeconds: number; // Overall duration across all sets

  isPaused: boolean;
  isResting: boolean; // Flag to hard-stop processing between sets
  isDevicePaused: boolean; // For hardware interruptions (fall detection, background)
  isSessionEnding: boolean; // For when confirmation modal is opened
  hasCountdownFinishedOnce: boolean; // Tracks if the initial workout countdown has finished
  countdown: number | null;
  engine: PushupEngine | SquatEngine | PlankEngine | null;
  plankDebugAngles: { alignment: number; shoulder: number; elbow: number } | null;
  accuracySum: number;
  accuracyCount: number;
  lastWorkoutSummary: any | null;

  startWorkout: (exerciseKey: string) => void;
  endWorkout: () => void;
  incrementTimers: (incrementActive: boolean) => void;
  setIsPaused: (isPaused: boolean) => void;
  setIsResting: (isResting: boolean) => void;
  setIsDevicePaused: (isDevicePaused: boolean) => void;
  setIsSessionEnding: (isSessionEnding: boolean) => void;
  triggerResumeCountdown: (duration?: number) => void;
  resetEngine: () => void;
  resetSetMetrics: () => void; // Resets counters for the next set
  processFrame: (landmarks: Point3D[]) => void;
  finishWorkout: (userId: string, exerciseName: string, targetValue: number, isEndedEarly?: boolean) => Promise<any>;
}

let countdownInterval: ReturnType<typeof setInterval> | null = null;

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  isActive: false,
  exerciseKey: "pushup",
  reps: 0,
  formAccuracy: 0,
  isFormPerfect: false,
  statusMessage: "Position yourself in frame.",
  seconds: 0,
  globalSeconds: 0,
  sessionGlobalSeconds: 0,
  isPaused: false,
  isResting: false,
  isDevicePaused: false,
  isSessionEnding: false,
  hasCountdownFinishedOnce: false,
  countdown: null,
  engine: null,
  plankDebugAngles: null,
  accuracySum: 0,
  accuracyCount: 0,
  lastWorkoutSummary: null,

  startWorkout: (exerciseKey) => {
    let engine = null;
    if (exerciseKey === "pushup") {
      engine = new PushupEngine();
    } else if (exerciseKey === "squat") {
      engine = new SquatEngine();
    } else if (exerciseKey === "plank") {
      engine = new PlankEngine();
    }

    set({
      isActive: true,
      exerciseKey,
      reps: 0,
      formAccuracy: 100, // Start with 100
      isFormPerfect: true,
      statusMessage: "Position yourself...",
      seconds: 0,
      globalSeconds: 0,
      sessionGlobalSeconds: 0,
      isPaused: true, // ALWAYS start paused so the 3-2-1 countdown can safely unpause
      isResting: false,
      isDevicePaused: false,
      isSessionEnding: false,
      hasCountdownFinishedOnce: false,
      countdown: null,
      engine,
      plankDebugAngles: null,
      accuracySum: 0,
      accuracyCount: 0,
      lastWorkoutSummary: null,
    });

    analyticsService.trackEvent("workout_started", {
      exercise_type: exerciseKey,
      camera_orientation: "portrait", // Mocked orientation
    });
  },

  endWorkout: () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    stopMedia();
    set({
      isActive: false,
      engine: null,
      isPaused: false,
      isResting: false,
      isDevicePaused: false,
      isSessionEnding: false,
      hasCountdownFinishedOnce: false,
      countdown: null,
      reps: 0,
      seconds: 0,
      globalSeconds: 0,
      sessionGlobalSeconds: 0,
      accuracySum: 0,
      accuracyCount: 0,
      formAccuracy: 0,
    });
  },

  incrementTimers: (incrementActive) => set((state) => {
    const newSessionGlobalSeconds = state.sessionGlobalSeconds + 1;

    if (state.exerciseKey === "plank" && state.seconds === 0 && !incrementActive) {
      return { ...state, sessionGlobalSeconds: newSessionGlobalSeconds };
    }
    let newSeconds = incrementActive ? state.seconds + 1 : state.seconds; 
    const newGlobalSeconds = state.globalSeconds + 1;
    let newFormAccuracy = state.formAccuracy;
    // 1. True Calibration: Give free valid seconds during the first 5 seconds
    if (newGlobalSeconds <= 5) {
      newSeconds = newGlobalSeconds;
    }

    // 2. The Plank Math (reverting to the clean ratio)
    if (state.exerciseKey === "plank") {
      const calc = newGlobalSeconds > 0
        ? (newSeconds / newGlobalSeconds) * 100
        : 100;

      newFormAccuracy = Math.max(0, Math.min(100, Math.round(calc)));
    }
    return {
      sessionGlobalSeconds: newSessionGlobalSeconds,
      globalSeconds: newGlobalSeconds,
      seconds: newSeconds,
      formAccuracy: newFormAccuracy
    };
  }),

  setIsPaused: (isPaused) => {
    if (isPaused) stopMedia();
    set({ isPaused });
  },
  setIsResting: (isResting) => {
    if (isResting) stopMedia();
    set({ isResting });
  },
  setIsDevicePaused: (isDevicePaused) => {
    if (isDevicePaused) {
      stopMedia();
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      set({ isDevicePaused, countdown: null });
    } else {
      set({ isDevicePaused });
    }
  },
  setIsSessionEnding: (isSessionEnding) => {
    if (isSessionEnding) stopMedia(false); // DO NOT stop speech so the success message plays!
    set({ isSessionEnding });
  },

  resetEngine: () => {
    const { exerciseKey } = get();
    let engine = null;
    if (exerciseKey === "pushup") engine = new PushupEngine();
    else if (exerciseKey === "squat") engine = new SquatEngine();
    else if (exerciseKey === "plank") engine = new PlankEngine();
    set({ engine });
  },

  resetSetMetrics: () => {
    set({
      accuracySum: 0,
      accuracyCount: 0,
      seconds: 0,
      globalSeconds: 0,
      formAccuracy: 100, // Reset to 100 for the new set
    });
  },

  triggerResumeCountdown: (duration?: number) => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    const defaultDuration = useProfileStore.getState().preferences.prepTimer ?? 5;
    const finalDuration = duration ?? defaultDuration;

    playSuccessSound();

    // Pre-warm the TTS engine silently during the countdown to eliminate cold-start delays
    try {
      if (isSpeechEnabled()) {
        Speech.speak(' ', { language: 'en' });
      }
    } catch (e) {}

    const isFirstStart = !get().hasCountdownFinishedOnce;

    set({
      isPaused: true, // STRICTLY PAUSE processing during countdown to suppress premature warnings
      countdown: finalDuration,
      statusMessage: isFirstStart ? `Starting in ${finalDuration}...` : `Resuming in ${finalDuration}...`,
    });

    countdownInterval = setInterval(() => {
      const currentCountdown = get().countdown;
      const currentIsFirstStart = !get().hasCountdownFinishedOnce;
      if (currentCountdown !== null && currentCountdown > 1) {
        playSuccessSound();
        set({ countdown: currentCountdown - 1, statusMessage: currentIsFirstStart ? `Starting in ${currentCountdown - 1}...` : `Resuming in ${currentCountdown - 1}...` });
      } else {
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = null;
        playSuccessSound();
        try {
          if (isSpeechEnabled()) {
            Speech.stop();
            Speech.speak(currentIsFirstStart ? "Workout begun. Let's go!" : "Workout resumed.", { language: 'en' });
          }
        } catch (e) {}
        set({
          isPaused: get().exerciseKey === 'plank' ? true : false,
          countdown: null,
          hasCountdownFinishedOnce: true,
          statusMessage: currentIsFirstStart ? "Workout Begun" : "Workout Resumed",
        });
      }
    }, 1000);
  },

  finishWorkout: async (userId: string, exerciseName: string, targetValue: number, isEndedEarly: boolean = false) => {
    const state = get();
    const isPlank = state.exerciseKey === "plank";

    // 1. Core Variables
    const rawReps = isPlank ? 0 : state.reps;
    const rawSeconds = isPlank ? state.seconds : 0;
    const rawDuration = state.sessionGlobalSeconds; 
    
    const targetReps = isPlank ? 0 : targetValue;
    const targetSeconds = isPlank ? targetValue : 0;

    // 2. The Backend Payload (Idempotent UUID & Timestamp)
    const sessionId = Crypto.randomUUID();
    const workoutTimestamp = new Date().toISOString();
    const payload = {
      workout_id: sessionId,
      user_id: userId,
      exercise_type: state.exerciseKey,
      duration_seconds: rawDuration,
      target_reps: targetReps,
      target_seconds: targetSeconds,
      valid_rep_count: rawReps,
      valid_active_seconds: rawSeconds,
      is_ended_early: isEndedEarly,
      form_accuracy: state.formAccuracy,
      created_at: workoutTimestamp,
      schema_version: 1,
    };

    // 3. UI-Only Gamification Multipliers & Estimated XP Calculation
    let xpMultiplier = 1.0;
    if (isEndedEarly) {
      xpMultiplier = 0.7;
    } else if (!isPlank && targetReps > 0) {
      const expectedTime = targetReps * 4;
      if (rawDuration < expectedTime * 0.8) xpMultiplier = 1.2;
      else if (rawDuration > expectedTime * 1.3) xpMultiplier = 0.8;
    } else if (isPlank && targetSeconds > 0) {
      if (rawDuration < targetSeconds * 1.1) xpMultiplier = 1.2;
      else if (rawDuration > targetSeconds * 1.5) xpMultiplier = 0.8;
    }

    const baseXP = isPlank ? Math.round(rawSeconds / 4) : rawReps;
    const estimatedEarnedXp = Math.max(1, Math.round(baseXP * xpMultiplier));

    // 4. ATOMIC DISK WRITE: Enqueue to Offline Outbox with Storage Full Try/Catch Guard
    try {
      await workoutService.saveWorkoutSession(payload, sessionId, workoutTimestamp);
    } catch (storageError) {
      console.error("[workoutStore] Critical: Storage exhaustion saving workout:", storageError);
      // If disk is full, the storage error handler alerted the user; halt optimistic flow cleanly
      get().endWorkout();
      return null;
    }

    // 5. OPTIMISTIC UI UPDATES (Instant local state reflection without skeleton/loading delay)
    const { useHistoryStore } = require("./historyStore");
    const { useDashboardStore } = require("./dashboardStore");
    const { useStreakStore } = require("../gamification/streakStore");
    const { useProfileStore } = require("../user/profileStore");
    const { useAchievementStore } = require("../gamification/achievementStore");

    // Optimistic History Item (tagged with syncStatus: 'pending')
    const optimisticHistoryItem = {
      id: sessionId,
      exercise: exerciseName,
      reps: rawReps,
      accuracy: state.formAccuracy,
      date: "Today",
      duration: `${Math.floor(rawDuration / 60)
        .toString()
        .padStart(2, "0")}:${(rawDuration % 60).toString().padStart(2, "0")}`,
      volume: state.exerciseKey === "squat" ? `${rawReps * 50} kg` : "Bodyweight",
      calories: Math.floor(rawSeconds * 0.15 + rawReps * 0.4),
      timestamp: Date.now(),
      plankSeconds: isPlank ? rawSeconds : undefined,
      syncStatus: "pending" as const,
    };
    useHistoryStore.getState().addOptimisticWorkout(optimisticHistoryItem);

    // Server-Authoritative: Complex stats (streaks, XP level curves, dashboard aggregates, and quests)
    // are finalized by Supabase upon sync to prevent double-counting and client-side drift.

    // Analytics Telemetry
    if (!isEndedEarly) {
      analyticsService.trackEvent("workout_completed", {
        exercise_type: state.exerciseKey,
        target_reps: targetReps,
        valid_reps: rawReps,
        duration_seconds: rawDuration,
      });
    } else {
      analyticsService.trackEvent("workout_ended_early", {
        exercise_type: state.exerciseKey,
        target_reps: targetReps,
        valid_reps: rawReps,
        duration_seconds: rawDuration,
      });
    }

    const summary = {
      id: sessionId,
      exercise: exerciseName,
      reps: rawReps,
      duration: `${Math.floor(rawDuration / 60)
        .toString()
        .padStart(2, "0")}:${(rawDuration % 60).toString().padStart(2, "0")}`,
      accuracy: state.formAccuracy,
      volume: state.exerciseKey === "squat" ? `${rawReps * 50} kg` : "Bodyweight",
      calories: Math.floor(rawSeconds * 0.15 + rawReps * 0.4),
      isEndedEarly,
      durationSeconds: rawDuration,
      validSeconds: rawSeconds,
      xpMultiplier,
      streakBonusXp: 0,
      streakDays: 1,
      syncStatus: "pending" as const,
    };

    set({ lastWorkoutSummary: summary });

    // Clean up active camera / engine state
    get().endWorkout();

    // Fire-and-forget: Schedule notifications
    scheduleStreakReminder();

    return summary;
  },

  processFrame: (landmarks) => {
    const { engine, isActive, isResting, isDevicePaused, isSessionEnding, isPaused, exerciseKey } = get();

    // Completely halt processing if session is ending (Modal open) or hardware paused or resting
    if (!isActive || !engine) return;
    if (get().isResting) return;
    if (get().isDevicePaused) return;
    if (isSessionEnding) return;

    // STRICT GUARD: If the 5-4-3-2-1 preparation countdown is running, completely blind the AI. 
    // This gives the user true silent freedom to get into position without premature form warnings!
    if (get().countdown !== null) return;

    // Halt processing for rep-based exercises if manually paused
    if (isPaused && exerciseKey !== "plank") return;

    const event = engine.processFrame(landmarks);

    if (event) {
      if (event.type === "DEBUG_UPDATE" && get().exerciseKey === "plank") {
        set({ plankDebugAngles: (event as any).angles });
        return;
      }

      if (event.type === "REP_COUNTED") {
        stopMedia();
        playSuccessSound();

        const newRepCount = get().reps + 1;
        analyticsService.trackEvent("rep_counted", {
          exercise_type: get().exerciseKey,
          rep_number: newRepCount,
        });

        let newAccuracyCount = get().accuracyCount;
        let newAccuracySum = get().accuracySum;
        let newFormAccuracy = get().formAccuracy;

        if ((event as any).accuracy !== undefined) {
          newAccuracyCount += 1;
          newAccuracySum += (event as any).accuracy;
          newFormAccuracy = Math.round(newAccuracySum / newAccuracyCount);
        }

        set((state) => ({
          reps: newRepCount,
          accuracyCount: newAccuracyCount,
          accuracySum: newAccuracySum,
          formAccuracy: newFormAccuracy,
          isFormPerfect: ((event as any).accuracy ?? 0) >= 85,
          statusMessage: event.message ?? "Rep counted.",
        }));
      } else if (event.type === "FORM_WARNING") {
        playWarningSound();

        const currentMessage = get().statusMessage;
        if (event.message && event.message !== currentMessage) {
          Speech.stop();
          if (isSpeechEnabled()) Speech.speak(event.message, { language: "en" });
        }

        analyticsService.trackEvent("tracking_warning_displayed", {
          warning_type: event.message ?? "unknown_warning",
        });

        let newAccuracyCount = get().accuracyCount;
        let newAccuracySum = get().accuracySum;
        let newFormAccuracy = get().formAccuracy;

        const isTrackingWarning = event.message && event.message.toLowerCase().includes("accurate tracking");

        if (!isTrackingWarning && 'accuracy' in event && event.accuracy !== undefined) {
          newAccuracyCount += 1;
          newAccuracySum += event.accuracy;
          newFormAccuracy = Math.round(newAccuracySum / newAccuracyCount);
        }

        set((state) => {
          const isPlank = state.exerciseKey === "plank";
          return {
            accuracyCount: newAccuracyCount,
            accuracySum: newAccuracySum,
            formAccuracy: isPlank ? state.formAccuracy : newFormAccuracy,
            isFormPerfect: isTrackingWarning ? state.isFormPerfect : false,
            statusMessage: event.message ?? "Form warning.",
            isPaused: (isPlank && !isTrackingWarning) ? true : state.isPaused,
            countdown: (isPlank && !isTrackingWarning) ? null : state.countdown,
          };
        });
        if (get().exerciseKey === "plank" && countdownInterval) {
          clearInterval(countdownInterval);
          countdownInterval = null;
        }
      } else if (event.type === "FORM_VALID") {
        const state = get();
        // For plank, immediately start the timer instead of doing a 3-2-1 countdown
        if (state.exerciseKey === "plank" && state.isPaused) {
          stopMedia();
          playSuccessSound();

          set({
            isFormPerfect: true,
            statusMessage: event.message ?? "Perfect alignment. Timer started.",
            isPaused: false,
            countdown: null,
          });
        } else if (state.exerciseKey !== "plank") {
          stopMedia();
          playSuccessSound();

          set({
            isFormPerfect: true,
            statusMessage: event.message ?? "Form perfect.",
            isPaused: false,
          });
        }
      }

      if ((event as any).angles && get().exerciseKey === "plank") {
        set({ plankDebugAngles: (event as any).angles });
      }
    }
  },
}));
