import React, { useCallback, useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { PoseValidationStatus, poseService } from "../../services/workout/poseService";
import { useCameraStore } from "../../store/core/cameraStore";
import { usePoseStore } from "../../store/workout/poseStore";
import { useWorkoutStore } from "../../store/workout/workoutStore";
import { PoseLandmarkerView } from "../../modules/pose-landmarker/src/index";
import { Ionicons } from "@expo/vector-icons";
// @ts-ignore
// import { Camera, useCameraDevice, useFrameProcessor } from "react-native-vision-camera";
// import { useTensorflowModel } from "react-native-fast-tflite";
// import { Worklets } from "react-native-worklets-core";

// --- Expo Go Mocking ---
const Camera = (props: any) => <View {...props} />;
const useCameraDevice = (pos: string) => ({ id: "mock-device", position: pos });
const useFrameProcessor = (cb: any) => cb;
const useTensorflowModel = (url: string) => ({
  state: "loaded",
  model: { runSync: () => [] },
});
const Worklets = { createRunInJsFn: (fn: any) => fn };

const CameraPreview = () => {
  const { permissionGranted, requestPermissions } = useCameraStore();
  const formAccuracy = useWorkoutStore((state) => state.formAccuracy);
  const [facing, setFacing] = React.useState<"front" | "back">("front");
  const [warning, setWarning] = React.useState<string | null>(null);

  // FIX: Track device orientation to fix landscape skeleton inversion
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  useEffect(() => {
    if (permissionGranted === null) {
      requestPermissions();
    }
  }, [permissionGranted, requestPermissions]);

  const handleLandmarks = useCallback((event: any) => {
    const flat: number[] = event.nativeEvent.landmarks;
    const imageWidth: number = event.nativeEvent.imageWidth || 0;
    const imageHeight: number = event.nativeEvent.imageHeight || 0;

    const numLandmarks = flat.length / 4;
    const landmarks = new Array(numLandmarks);

    for (let i = 0; i < numLandmarks; i++) {
      const offset = i * 4;
      landmarks[i] = {
        x: flat[offset],
        y: flat[offset + 1],
        z: flat[offset + 2],
        visibility: flat[offset + 3],
      };
    }

    // Since the app now globally supports landscape, the React Native UI automatically rotates to match gravity.
    // MediaPipe also aligns with gravity. Thus, the coordinates map 1:1 without any manual rotation!
    const status = poseService.validatePose(landmarks);

    // If MediaPipe gets stuck tracking a ghost skeleton (head to feet, or severely shrunken),
    // we simply reject the frame by passing an empty array to the store. 
    // We DO NOT force a native camera restart (which causes black screens/lag).
    if (status === PoseValidationStatus.HALLUCINATION) {
      usePoseStore.getState().setPoseData([], status);
      return;
    }

    if (status === PoseValidationStatus.VALID) {
      useWorkoutStore.getState().processFrame(landmarks);
      usePoseStore.getState().setPoseData(landmarks, PoseValidationStatus.VALID, imageWidth, imageHeight);
    } else {
      usePoseStore.getState().setPoseData([], status);
    }
  }, [isLandscape]); // Re-create callback only if orientation changes

  const handleCameraWarning = useCallback((event: any) => {
    setWarning(event.nativeEvent.message);
  }, []);

  if (permissionGranted !== true) {
    return (
      <View className="flex-1 justify-center items-center p-6 bg-[#0F1014]">
        <View className="w-16 h-16 rounded-full bg-red-500/10 items-center justify-center mb-4 border border-red-500/20">
          <Text className="text-red-400 text-2xl">📷</Text>
        </View>
        <Text className="text-white font-outfitBold text-lg mb-2 text-center">
          Camera Permission Required
        </Text>
        <Text className="text-brand-grey font-outfitReg text-xs text-center">
          Please grant camera access to track your workouts
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <PoseLandmarkerView
        style={StyleSheet.absoluteFill}
        cameraFacing={facing}
        onLandmarks={handleLandmarks}
        onCameraWarning={handleCameraWarning}
      />

      <View
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          backgroundColor: "rgba(0,0,0,0.6)",
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 30,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Text
          style={{
            color:
              formAccuracy >= 85
                ? "#4ade80" // green-400
                : formAccuracy >= 60
                ? "#facc15" // yellow-400
                : "#ef4444", // red-500
            fontSize: 14,
            fontWeight: "bold",
          }}
        >
          {formAccuracy}%
        </Text>
        <View style={{ width: 1, height: 16, backgroundColor: "rgba(255,255,255,0.2)" }} />
        <TouchableOpacity onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))}>
          <Ionicons name="camera-reverse" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {warning && (
        <View
          style={{
            position: "absolute",
            top: 60,
            left: 16,
            right: 16,
            backgroundColor: "rgba(240,179,92,0.9)",
            padding: 10,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: "black", fontSize: 12 }}>{warning}</Text>
        </View>
      )}
    </View>
  );
};

export default React.memo(CameraPreview);