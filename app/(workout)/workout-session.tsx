import { ErrorBoundary } from "@/components/core/ErrorBoundary";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";
import { RotationPrompt } from '@/components/workout/RotationPrompt';
import { SkeletonOverlay } from '@/components/workout/SkeletonOverlay';
import { useAuthStore } from "@/store/user/authStore";
import { useProfileStore } from "@/store/user/profileStore";
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ScreenOrientation from 'expo-screen-orientation';
import { Accelerometer, LightSensor } from "expo-sensors";
import * as Speech from 'expo-speech';
import {
  AlertCircle,
  Camera as CameraIcon,
  Timer,
  X
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  InteractionManager,
  Linking,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions
} from "react-native";
import Toast from 'react-native-toast-message';
import CameraPreview from "../../components/workout/CameraPreview";
import { useCameraStore } from "../../store/core/cameraStore";
import { usePreferencesStore } from "../../store/core/preferencesStore";
import { UserPreferences } from "../../repositories/core/preferencesRepository";
import { usePoseStore } from "../../store/workout/poseStore";
import { useWorkoutStore } from "../../store/workout/workoutStore";

const EXERCISE_INFO: Record<string, { name: string }> = {
  pushup: { name: "Push-up" },
  squat: { name: "Split Squat" },
  plank: { name: "Plank Stabilizer" },
};

export default function WorkoutSession() {
  useKeepAwake();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const { exercise, target } = useLocalSearchParams();
  const exerciseKey = (exercise as string) || "pushup";
  const parsedTarget = parseInt(target as string);
  const targetReps = !isNaN(parsedTarget) && parsedTarget > 0
    ? parsedTarget
    : (usePreferencesStore.getState().preferences?.[`${exerciseKey}_target` as keyof UserPreferences] as number) || (exerciseKey === 'plank' ? 120 : exerciseKey === 'squat' ? 30 : 50);
  const info = EXERCISE_INFO[exerciseKey] || EXERCISE_INFO.pushup;

  const authStore = useAuthStore();
  const workoutStore = useWorkoutStore();
  const fps = usePoseStore((state) => state.fps);
  const {
    startCamera,
    stopCamera,
    permissionGranted,
    requestPermissions,
    error: storeCameraError,
  } = useCameraStore();

  const [hasStarted, setHasStarted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isOrientationCorrect, setIsOrientationCorrect] = useState(false);
  const [isFallenOver, setIsFallenOver] = useState(false);
  const [isLowLight, setIsLowLight] = useState(false);

  // Refs for safe cross-effect hardware state reading without dependency loops
  const isOrientationCorrectRef = useRef(isOrientationCorrect);
  isOrientationCorrectRef.current = isOrientationCorrect;

  const isFallenOverRef = useRef(isFallenOver);
  isFallenOverRef.current = isFallenOver;

  const isLowLightRef = useRef(isLowLight);
  isLowLightRef.current = isLowLight;

  // Computed before any effect that references it, to avoid a
  // temporal-dead-zone ReferenceError when it's used in a dependency array.
  const combinedError =
    cameraError ||
    storeCameraError ||
    (permissionGranted === false ? "Camera permission denied" : null);

  const [isTransitionComplete, setIsTransitionComplete] = useState(false);

  // Remove unused Time Attack & Sets states
  const [showCancelModal, setShowCancelModal] = useState(false);


  // 1. Initial Setup
  useEffect(() => {
    // 400ms ka strict timer taake bottom-to-top slide animation sukoon se puri ho jaye
    // Uske baad hi JS thread camera ko load karega
    const timer = setTimeout(() => {
      setIsTransitionComplete(true);
    }, 400);

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      setIsTransitionComplete(true);
    });

    return () => {
      clearTimeout(timer);
      interactionTask.cancel();
    };
  }, []);

  // AppState Listener: Pause workout if app goes to background and track penalty time
  const backgroundTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      const store = useWorkoutStore.getState();
      if (nextAppState === 'inactive' || nextAppState === 'background') {
        if (store.isActive) {
          store.setIsDevicePaused(true);
          backgroundTimeRef.current = Date.now();
        }
      } else if (nextAppState === 'active') {
        if (store.isActive && store.isDevicePaused) {
          store.setIsDevicePaused(false);
          store.triggerResumeCountdown(5);

          if (backgroundTimeRef.current) {
            const timeAway = Math.floor((Date.now() - backgroundTimeRef.current) / 1000);
            if (timeAway > 0) {
              useWorkoutStore.setState((s) => ({ sessionGlobalSeconds: s.sessionGlobalSeconds + timeAway }));
            }
            backgroundTimeRef.current = null;
          }
        }
      }
    });
    return () => subscription.remove();
  }, []);

  // 3. MODIFY THIS USE-EFFECT TO DEPEND ON TRANSITION
  useEffect(() => {
    // Agar animation abhi chal rahi hai, tw camera start mat karo
    if (!isTransitionComplete) return;

    let isActive = true;

    const init = async () => {
      let granted = permissionGranted;
      if (granted === null) {
        granted = await requestPermissions();
      }

      if (isActive) {
        setIsInitializing(false);
        if (granted) {
          // STRICT THE USER: rigidly lock the orientation immediately to a single specific side.
          // This forces the user to physically match the UI, preventing ALL camera/UI desync edge cases.
          const targetIsLandscape = exerciseKey === "pushup" || exerciseKey === "plank";
          await ScreenOrientation.lockAsync(
            targetIsLandscape ? ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT : ScreenOrientation.OrientationLock.PORTRAIT_UP
          );
          if (cameraError) setCameraError(null);
        } else {
          setCameraError("Camera permission denied");
        }
      }
    };

    init();

    return () => {
      isActive = false;
      stopCamera();
      workoutStore.endWorkout();
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, [exerciseKey, isTransitionComplete]); // <-- add isTransitionComplete as dependency

  // 2. Hardware Validation (Accelerometer)
  const playWarningSpeech = (message: string) => {
    if (useProfileStore.getState().preferences.voiceCoach) {
      Speech.stop();
      Speech.speak(message, { language: 'en' });
    }
  };

  useEffect(() => {
    if (isInitializing || !permissionGranted || combinedError) return;

    let fallTimeout: ReturnType<typeof setTimeout> | null = null;
    let resumeTimeout: ReturnType<typeof setTimeout> | null = null;
    let wrongOrientationTimeout: ReturnType<typeof setTimeout> | null = null;
    let currentFallenState = false;
    let currentWrongOrientationState = false;

    Accelerometer.setUpdateInterval(200);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      // Guard: If the session has started, halt hardware polling if it is finished or failing
      const storeState = useWorkoutStore.getState();
      if (hasStarted && (!storeState.isActive || storeState.isSessionEnding)) return;

      const targetIsLandscape = exerciseKey === "pushup" || exerciseKey === "plank";
      const currentIsLandscape = Math.abs(x) > Math.abs(y);
      const isZFlat = Math.abs(z) > 0.8;

      if (!hasStarted) {
        // Interstitial Preparation State Logic
        if (!isZFlat && currentIsLandscape === targetIsLandscape) {
          // Correct orientation achieved! Start frictionless sequence.
          setIsOrientationCorrect(true);
          setHasStarted(true);

          try {
            startCamera();
            workoutStore.startWorkout(exerciseKey as any);
            const prepTimer = useProfileStore.getState().preferences.prepTimer ?? 5;
            workoutStore.triggerResumeCountdown(prepTimer);
          } catch (e: any) {
            setCameraError(String(e?.message || e));
          }

          // NOTE: we intentionally do NOT remove the subscription here —
          // it's still needed below for mid-set fall detection once
          // hasStarted flips to true on the next listener callback.
        }
      } else {
        // Mid-Set Edge Case Handling (Debounced Fall Detection & Orientation check)
        if (isZFlat) {
          if (resumeTimeout) { clearTimeout(resumeTimeout); resumeTimeout = null; }
          if (wrongOrientationTimeout) { clearTimeout(wrongOrientationTimeout); wrongOrientationTimeout = null; }

          if (!currentFallenState && !fallTimeout) {
            fallTimeout = setTimeout(() => {
              currentFallenState = true;
              setIsFallenOver(true);
              workoutStore.setIsDevicePaused(true);
              playWarningSpeech("Device has fallen over. Please place it upright.");
              fallTimeout = null;
            }, 500); // 500ms continuous reading required
          }
        } else if (currentIsLandscape !== targetIsLandscape) {
          // Device is upright, but in the WRONG orientation!
          if (resumeTimeout) { clearTimeout(resumeTimeout); resumeTimeout = null; }
          if (fallTimeout) { clearTimeout(fallTimeout); fallTimeout = null; }

          if (!currentWrongOrientationState && !wrongOrientationTimeout) {
            wrongOrientationTimeout = setTimeout(() => {
              currentWrongOrientationState = true;
              setIsOrientationCorrect(false); // Brings up the RotationPrompt
              workoutStore.setIsDevicePaused(true);
              playWarningSpeech(`Please rotate your device to ${targetIsLandscape ? 'landscape' : 'portrait'} mode.`);
              wrongOrientationTimeout = null;
            }, 500);
          }
        } else {
          // Upright AND correct orientation
          if (fallTimeout) { clearTimeout(fallTimeout); fallTimeout = null; }
          if (wrongOrientationTimeout) { clearTimeout(wrongOrientationTimeout); wrongOrientationTimeout = null; }

          if ((currentFallenState || currentWrongOrientationState) && !resumeTimeout) {
            resumeTimeout = setTimeout(() => {
              currentFallenState = false;
              currentWrongOrientationState = false;
              setIsFallenOver(false);
              setIsOrientationCorrect(true);

              if (!isLowLightRef.current) {
                workoutStore.setIsDevicePaused(false);
                workoutStore.triggerResumeCountdown(3);
              }

              resumeTimeout = null;
            }, 500); // 500ms continuous upright reading
          }
        }
      }
    });

    return () => {
      subscription.remove();
      if (fallTimeout) clearTimeout(fallTimeout);
      if (resumeTimeout) clearTimeout(resumeTimeout);
      if (wrongOrientationTimeout) clearTimeout(wrongOrientationTimeout);
    };
  }, [isInitializing, permissionGranted, combinedError, hasStarted, exerciseKey]);

  // 3. Lighting Validation (LightSensor)
  useEffect(() => {
    if (isInitializing || !permissionGranted || combinedError || !hasStarted) return;

    let lowLightTimeout: ReturnType<typeof setTimeout> | null = null;
    let resumeTimeout: ReturnType<typeof setTimeout> | null = null;
    let currentLowLightState = false;

    let subscription: any = null;

    LightSensor.isAvailableAsync().then((isAvailable) => {
      if (isAvailable) {
        LightSensor.setUpdateInterval(500);
        subscription = LightSensor.addListener(({ illuminance }) => {
          // Relaxed low light threshold: < 3 lux is essentially pitch black.
          // This prevents false positives in medium-lit rooms or when the sensor is partially occluded.
          const isDark = illuminance < 4;

          if (isDark) {
            if (resumeTimeout) { clearTimeout(resumeTimeout); resumeTimeout = null; }
            if (!currentLowLightState && !lowLightTimeout) {
              lowLightTimeout = setTimeout(() => {
                currentLowLightState = true;
                setIsLowLight(true);
                workoutStore.setIsDevicePaused(true);
                playWarningSpeech("It is too dark to track your form. Please turn on the lights.");
                lowLightTimeout = null;
              }, 1000); // 1s continuous dark
            }
          } else {
            if (lowLightTimeout) { clearTimeout(lowLightTimeout); lowLightTimeout = null; }
            if (currentLowLightState && !resumeTimeout) {
              resumeTimeout = setTimeout(() => {
                currentLowLightState = false;
                setIsLowLight(false);

                // Safely check if we should resume by querying the refs
                if (!isFallenOverRef.current && isOrientationCorrectRef.current) {
                  workoutStore.setIsDevicePaused(false);
                  workoutStore.triggerResumeCountdown(3);
                }

                resumeTimeout = null;
              }, 1000); // 1s continuous bright
            }
          }
        });
      }
    });

    return () => {
      if (subscription) subscription.remove();
      if (lowLightTimeout) clearTimeout(lowLightTimeout);
      if (resumeTimeout) clearTimeout(resumeTimeout);
    };
  }, [isInitializing, permissionGranted, combinedError, hasStarted]);



  // Continuous Global Timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (hasStarted && workoutStore.hasCountdownFinishedOnce && workoutStore.countdown === null && !workoutStore.isSessionEnding) {
      interval = setInterval(() => {
        // Sync core workout timers for Plank seconds & overall duration
        const store = useWorkoutStore.getState();
        store.incrementTimers(!(store.isPaused || store.isDevicePaused));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [hasStarted, workoutStore.hasCountdownFinishedOnce, workoutStore.countdown, workoutStore.isSessionEnding]);

  // 60-Second Auto-Kill Switch
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (workoutStore.isDevicePaused && hasStarted && workoutStore.hasCountdownFinishedOnce && !workoutStore.isSessionEnding) {
      timeout = setTimeout(() => {
        try {
          if (useProfileStore.getState().preferences.voiceCoach) {
            Speech.speak('Workout suspended for too long. Saving session.', { language: 'en' });
          }
        } catch (e) { }
        setShowCancelModal(false);
        workoutStore.setIsSessionEnding(true);
        setIsFinishing(true);
        confirmFinishWorkout(true); // Save & Exit Early
      }, 60000);
    }
    return () => clearTimeout(timeout);
  }, [workoutStore.isDevicePaused, hasStarted, workoutStore.hasCountdownFinishedOnce, workoutStore.isSessionEnding]);

  // Auto-Finish Validation Loop
  useEffect(() => {
    if (!hasStarted) return;
    const isPlank = exerciseKey === 'plank';
    const currentMetric = isPlank ? workoutStore.seconds : workoutStore.reps;

    if (workoutStore.isSessionEnding) return;

    if (targetReps > 0 && currentMetric >= targetReps) {
      if (useProfileStore.getState().preferences.haptics) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      let xpMultiplier = 1.0;
      if (!isPlank) {
        const expectedTime = targetReps * 4;
        if (workoutStore.sessionGlobalSeconds < expectedTime * 0.8) xpMultiplier = 1.2;
        else if (workoutStore.sessionGlobalSeconds > expectedTime * 1.3) xpMultiplier = 0.8;
      } else {
        if (workoutStore.sessionGlobalSeconds < targetReps * 1.1) xpMultiplier = 1.2;
        else if (workoutStore.sessionGlobalSeconds > targetReps * 1.5) xpMultiplier = 0.8;
      }

      let message = 'Workout complete. Good job.';
      if (xpMultiplier === 1.2) {
        message = isPlank ? 'Unbroken hold! Amazing effort!' : 'Lightning fast! Amazing effort!';
      } else if (xpMultiplier === 0.8) {
        message = isPlank ? 'Workout complete. Try to rest less next time.' : 'Workout complete. Try to increase your speed next time.';
      } else {
        message = isPlank ? 'Workout complete. Solid hold.' : 'Workout complete. Great pace.';
      }

      workoutStore.setIsPaused(true);
      workoutStore.setIsSessionEnding(true);

      const proceedToFinish = () => { confirmFinishWorkout(false); };

      try {
        if (useProfileStore.getState().preferences.voiceCoach) {
          Speech.speak(message, {
            language: 'en',
            onDone: proceedToFinish,
            onError: proceedToFinish,
            onStopped: proceedToFinish
          });
        } else {
          setTimeout(proceedToFinish, 1500);
        }
      } catch (e) {
        setTimeout(proceedToFinish, 1500);
      }
    }
  }, [workoutStore.reps, workoutStore.seconds, targetReps, exerciseKey, hasStarted, workoutStore.isSessionEnding]);


  const [isFinishing, setIsFinishing] = useState(false);

  const confirmFinishWorkout = async (isEndedEarly: boolean = false) => {
    if (isFinishing) return;
    setIsFinishing(true);
    const userId = authStore.user?.id || "local-user";

    const currentMetric = exerciseKey === 'plank' ? workoutStore.seconds : workoutStore.reps;

    if (isEndedEarly && currentMetric === 0) {
      stopCamera();
      workoutStore.endWorkout();

      if (mounted.current) {
        setHasStarted(false);
        router.replace("/(tabs)/workouts");
        setTimeout(() => {
          Toast.show({
            type: 'error',
            text1: 'Workout Aborted',
            text2: 'No progress was made. Session was not saved.',
            position: 'top',
          });
        }, 1000);
      }
      return;
    }

    try {
      const finalSummary = await workoutStore.finishWorkout(userId, info.name, targetReps, isEndedEarly);
      stopCamera();

      if (mounted.current) {
        setHasStarted(false); // Force local timers/intervals to immediately detach
        router.replace("/(workout)/workout-summary");
      }
    } catch (e) {
      if (mounted.current) {
        setIsFinishing(false);
      }
    }
  };

  const mounted = useRef(true);
  useEffect(() => {
    return () => { mounted.current = false; }
  }, []);

  const isFormPerfect = workoutStore.isFormPerfect;


  // ADD THIS BLOCK BEFORE isInitializing
  if (!isTransitionComplete) {
    return (
      <View className="flex-1 bg-[#121212] items-center justify-center">
        {/* Jab screen bottom se top aari hogi tw sirf ye blank lightweight screen show hogi */}
        <ActivityIndicator size="small" color="#A7C4B5" />
      </View>
    );
  }

  if (isInitializing) {
    return (
      <View className="flex-1 bg-[#121212] items-center justify-center p-6">
        <Text className="text-white font-outfitMed text-lg">
          Preparing Camera...
        </Text>
      </View>
    );
  }

  if (combinedError) {
    return (
      <View className="flex-1 bg-[#121212] items-center justify-center p-6">
        <View className="bg-[#1C1C1E] p-8 rounded-3xl border border-[#27272A] items-center w-full shadow-2xl">
          <View className="w-16 h-16 bg-red-500/10 rounded-full items-center justify-center mb-6">
            <CameraIcon size={32} color="#EF4444" />
          </View>
          <Text className="text-white font-outfitBold text-2xl mb-3 text-center">
            Camera Required
          </Text>
          <Text className="text-[#A1A1AA] font-outfitReg text-[13px] text-center mb-6 leading-relaxed">
            Replix needs camera access to track your body movements securely
            on-device. Please enable it in your device settings to continue.
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            className="bg-brand-forest px-8 py-4 rounded-full w-full flex-row items-center justify-center mb-3"
          >
            <Text className="text-white font-outfitBold">Open Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              stopCamera();
              workoutStore.endWorkout();
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)/home");
              }
            }}
            className="bg-[#27272A] px-8 py-4 rounded-full w-full flex-row items-center justify-center"
          >
            <Text className="text-white font-outfitMed">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const hasNoProgress = (exerciseKey === 'plank' ? workoutStore.seconds : workoutStore.reps) === 0;

  return (
    <View className="flex-1 bg-[#121212]">
      {/* 1. NATIVE VIDEO CAMERA FEED WITH OVERLAYS */}
      <View className="absolute inset-0 bg-[#0F1014] items-center justify-center overflow-hidden">
        {/* Native Camera View */}
        <View className="absolute inset-0">
          <ErrorBoundary>
            {hasStarted && <CameraPreview />}
          </ErrorBoundary>
        </View>

        {/* Soft grid lines to mimic camera overlay mapping */}
        <View className="absolute inset-0 opacity-5" pointerEvents="none">
          {Array.from({ length: 8 }).map((_, row) => (
            <View key={row} className="flex-row flex-1">
              {Array.from({ length: 6 }).map((_, col) => (
                <View
                  key={col}
                  className="flex-1 border-[0.5px] border-white"
                />
              ))}
            </View>
          ))}
        </View>

        {/* ACTIVE SKELETON POSE ESTIMATION (SVG joint lines!) */}
        <SkeletonOverlay
          isFormPerfect={isFormPerfect}
          hasStarted={hasStarted}
        />
      </View>

      {/* Rotation Prompt Overlay (Pre-workout & Mid-workout) */}
      {!isOrientationCorrect && (
        <RotationPrompt
          requiredOrientation={exerciseKey === "squat" ? "portrait" : "landscape"}
          hasCountdownFinishedOnce={workoutStore.hasCountdownFinishedOnce}
          sessionGlobalSeconds={workoutStore.sessionGlobalSeconds}
        />
      )}

      {/* Mid-Set Edge Case: Fallen Over Overlay */}
      {hasStarted && isFallenOver && (
        <View className="absolute inset-0 bg-black/80 items-center justify-center z-50 px-8 backdrop-blur-md">
          <View className="items-center bg-[#1C1C1E] p-8 rounded-3xl border border-red-500/20 shadow-2xl">
            <AlertCircle size={48} color="#EF4444" className="mb-4" />
            <Text className="text-white font-outfitBold text-2xl mb-2 text-center">Device Moved</Text>
            <Text className="text-[#A1A1AA] font-outfitReg text-sm text-center mb-6">
              {workoutStore.hasCountdownFinishedOnce
                ? "Tracking suspended, but your clock is still ticking. Fix quickly to save your Speed Multiplier!"
                : "Please reset your phone upright to begin the countdown."}
            </Text>
            {workoutStore.hasCountdownFinishedOnce && (
              <View className="bg-red-500/20 px-4 py-2 rounded-xl mb-6 flex-row items-center gap-2 border border-red-500/30">
                <Timer size={16} color="#EF4444" />
                <Text className="text-red-400 font-outfitBold text-lg">
                  {Math.floor(workoutStore.sessionGlobalSeconds / 60).toString().padStart(2, "0")}
                  :{(workoutStore.sessionGlobalSeconds % 60).toString().padStart(2, "0")}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Mid-Set Edge Case: Low Light Overlay */}
      {hasStarted && isLowLight && !isFallenOver && (
        <View className="absolute inset-0 bg-black/90 items-center justify-center z-50 px-8 backdrop-blur-md">
          <View className="items-center bg-[#1C1C1E] p-8 rounded-3xl border border-orange-500/20 shadow-2xl">
            <CameraIcon size={48} color="#F97316" className="mb-4" />
            <Text className="text-white font-outfitBold text-2xl mb-2 text-center">Low Light Detected</Text>
            <Text className="text-[#A1A1AA] font-outfitReg text-sm text-center mb-6">
              {workoutStore.hasCountdownFinishedOnce
                ? "Tracking suspended, but your clock is still ticking. Fix quickly to save your Speed Multiplier!"
                : "It's too dark for the camera to accurately track your form. Please move to a brighter area."}
            </Text>
            {workoutStore.hasCountdownFinishedOnce && (
              <View className="bg-red-500/20 px-4 py-2 rounded-xl mb-6 flex-row items-center gap-2 border border-red-500/30">
                <Timer size={16} color="#EF4444" />
                <Text className="text-red-400 font-outfitBold text-lg">
                  {Math.floor(workoutStore.sessionGlobalSeconds / 60).toString().padStart(2, "0")}
                  :{(workoutStore.sessionGlobalSeconds % 60).toString().padStart(2, "0")}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* TOP LEFT CONTROLS (End Early & FPS) */}
      {hasStarted && (
        <View className="absolute top-10 left-6 z-40 flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => {
              workoutStore.setIsPaused(true);
              setShowCancelModal(true);
            }}
            className={`bg-red-500 rounded-full shadow-lg shadow-red-500/30 items-center justify-center ${isLandscape ? "w-8 h-8" : "w-10 h-10"}`}
          >
            <X size={isLandscape ? 16 : 20} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>

          <View className={`bg-black/60 px-3 rounded-full border border-white/10 backdrop-blur-md flex-row items-center justify-center ${isLandscape ? "py-1.5" : "py-2"}`}>
            <Text className="text-brand-sage font-outfitBold text-[10px] uppercase tracking-widest">{fps} FPS</Text>
          </View>
        </View>
      )}
      {/* BOTTOM HUD (Status Message + Metrics) */}
      {hasStarted && (
        <View className={`absolute z-40 left-0 right-0 items-center flex-col justify-end ${isLandscape ? "bottom-2" : "bottom-10 px-6"}`} pointerEvents="box-none">

          {/* AI STATUS MESSAGE */}
          <View className={`mb-4 ${isLandscape ? "px-4 py-2 rounded-full" : "px-6 py-3 rounded-3xl"} bg-black/70 flex-row items-center justify-center gap-3 border border-white/10 backdrop-blur-md w-auto`} pointerEvents="none">
            <View className={`rounded-full ${isFormPerfect ? "bg-brand-success" : "bg-brand-warning"} w-2 h-2 shrink-0`}></View>
            <Text className={`${isLandscape ? "text-xs" : "text-sm"} font-outfitMed text-white/90 text-center flex-shrink`}>
              {workoutStore.statusMessage}
            </Text>
          </View>

          <View className={isLandscape ? "w-[65%] max-w-xl" : "w-full"} pointerEvents="auto">
            {/* Main Metrics Card */}
            <View className={`bg-black/80 rounded-3xl border border-white/10 backdrop-blur-lg flex-row items-center justify-between shadow-2xl w-full ${isLandscape ? "py-3 px-5" : "p-5"}`}>

              {/* Center: Global Timer */}
              <View className="flex-col items-center flex-[1.5]">
                <Text className="text-[#A1A1AA] font-outfitMed text-[10px] uppercase tracking-widest mb-1">Duration</Text>
                <View className="flex-row items-center gap-2">
                  <Timer size={16} color="#A7C4B5" />
                  <Text className="text-3xl font-outfitBold tracking-tight text-brand-sage">
                    {Math.floor(workoutStore.sessionGlobalSeconds / 60).toString().padStart(2, "0")}
                    :{(workoutStore.sessionGlobalSeconds % 60).toString().padStart(2, "0")}
                  </Text>
                </View>
              </View>

              {/* Divider */}
              <View className={`w-[1px] bg-white/10 mx-2 ${isLandscape ? "h-8" : "h-10"}`} />

              {/* Right: Reps / Time */}
              <View className="flex-col items-center flex-1">
                <Text className="text-[#A1A1AA] font-outfitMed text-[10px] uppercase tracking-widest mb-1">
                  {exerciseKey === "plank" ? "Hold" : "Reps"}
                </Text>
                <View className="flex-row items-baseline gap-1">
                  <Text className="text-2xl font-outfitBold text-white">
                    {exerciseKey === "plank" ? workoutStore.seconds : workoutStore.reps}
                  </Text>
                  <Text className="text-sm font-outfitBold text-white/40">
                    / {targetReps}{exerciseKey === "plank" ? "s" : ""}
                  </Text>
                </View>
              </View>

            </View>
          </View>
        </View>
      )}

      {/* Cancel Workout Confirmation Modal */}
      {showCancelModal && (
        <ConfirmationModal
          visible={showCancelModal}
          title={hasNoProgress ? "Abort Session?" : "Save & Exit Early?"}
          description={hasNoProgress ? "You haven't made any progress yet. Exiting now will abort the session without saving." : "You haven't hit your target! Exiting now will save your progress, but applies a 0.7x XP penalty. Are you sure you want to end this session early?"}
          confirmText={hasNoProgress ? "Yes, Abort" : "Yes, Save & Exit"}
          cancelText="No, Resume"
          isDestructive={true}
          onCancel={() => {
            setShowCancelModal(false);
            workoutStore.setIsSessionEnding(false);
            if (workoutStore.exerciseKey !== "plank") {
              workoutStore.triggerResumeCountdown(3);
            }
          }}
          onConfirm={() => {
            setShowCancelModal(false);
            workoutStore.setIsSessionEnding(true);
            confirmFinishWorkout(true);
          }}
        />
      )}

      {/* FINISHING WORKOUT OVERLAY */}
      {workoutStore.isSessionEnding && (
        <View className="absolute inset-0 bg-black/80 items-center justify-center z-50 backdrop-blur-md">
          <ActivityIndicator size="large" color={hasNoProgress ? "#EF4444" : "#A7C4B5"} />
          <Text className={`font-outfitBold text-2xl mt-4 ${hasNoProgress ? "text-red-400" : "text-white"}`}>
            {hasNoProgress ? "Aborting Session..." : "Saving Session..."}
          </Text>
        </View>
      )}

      {/* 5-4-3-2-1 COUNTDOWN OVERLAY */}
      {hasStarted && workoutStore.countdown !== null && !workoutStore.isSessionEnding && (
        <View className="absolute inset-0 bg-black/40 items-center justify-center z-50 px-8 backdrop-blur-sm">
          <Text className="text-[120px] font-outfitBold text-white drop-shadow-2xl">
            {workoutStore.countdown}
          </Text>
        </View>
      )}

    </View>
  );
}