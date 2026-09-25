import React, { useEffect, useRef, useMemo } from "react";
import { StyleSheet, useWindowDimensions, View, Text } from "react-native";
import { Circle, Line, Svg } from "react-native-svg";
import { usePoseStore } from "@/store/workout/poseStore";
import { useWorkoutStore } from "@/store/workout/workoutStore";
import { useProfileStore } from "@/store/user/profileStore";
import * as Speech from 'expo-speech';

export const SkeletonOverlay = React.memo(
  ({
    isFormPerfect,
    hasStarted,
  }: {
    isFormPerfect: boolean;
    hasStarted: boolean;
  }) => {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const landmarks = usePoseStore((state) => state.landmarks);
    const validationStatus = usePoseStore((state) => state.validationStatus);
    const imageWidth = usePoseStore((state) => state.imageWidth);
    const imageHeight = usePoseStore((state) => state.imageHeight);

    const statusMessage = useWorkoutStore((state) => state.statusMessage);
    const hasCountdownFinishedOnce = useWorkoutStore((state) => state.hasCountdownFinishedOnce);

    const lastValidLandmarksRef = useRef<any[]>([]);
    const isRedRef = useRef(false);

    useEffect(() => {
      if (landmarks && landmarks.length > 0) {
        lastValidLandmarksRef.current = landmarks;
      }
    }, [landmarks]);

    const isTrackingLost = landmarks?.length === 0 || validationStatus === "NO_DETECTION";
    
    const isLandscape = screenWidth > screenHeight;

    // Create a stable, professional standing pose for when tracking is lost
    const DEFAULT_POSE = useMemo(() => {
      // In landscape mode, the top and bottom of the frame get heavily cropped because of 'slice'.
      // We must compress the skeleton's coordinates towards the center so it stays fully visible.
      const scaleX = (x: number) => isLandscape ? 0.5 + (x - 0.5) * 0.7 : x;
      const scaleY = (y: number) => isLandscape ? 0.5 + (y - 0.5) * 0.6 : y;

      const pose = new Array(33).fill({ x: 0.5, y: 0.5, z: 0, visibility: 0 });
      pose[0] = { x: scaleX(0.5), y: scaleY(0.15), z: 0, visibility: 0 }; // Nose
      pose[11] = { x: scaleX(0.4), y: scaleY(0.25), z: 0, visibility: 0 }; // ShoulderL
      pose[12] = { x: scaleX(0.6), y: scaleY(0.25), z: 0, visibility: 0 }; // ShoulderR
      pose[13] = { x: scaleX(0.35), y: scaleY(0.4), z: 0, visibility: 0 }; // ElbowL
      pose[14] = { x: scaleX(0.65), y: scaleY(0.4), z: 0, visibility: 0 }; // ElbowR
      pose[15] = { x: scaleX(0.3), y: scaleY(0.55), z: 0, visibility: 0 }; // WristL
      pose[16] = { x: scaleX(0.7), y: scaleY(0.55), z: 0, visibility: 0 }; // WristR
      pose[23] = { x: scaleX(0.45), y: scaleY(0.55), z: 0, visibility: 0 }; // HipL
      pose[24] = { x: scaleX(0.55), y: scaleY(0.55), z: 0, visibility: 0 }; // HipR
      pose[25] = { x: scaleX(0.45), y: scaleY(0.75), z: 0, visibility: 0 }; // KneeL
      pose[26] = { x: scaleX(0.55), y: scaleY(0.75), z: 0, visibility: 0 }; // KneeR
      pose[27] = { x: scaleX(0.45), y: scaleY(0.9), z: 0, visibility: 0 }; // AnkleL
      pose[28] = { x: scaleX(0.55), y: scaleY(0.9), z: 0, visibility: 0 }; // AnkleR
      return pose;
    }, [isLandscape]);

    // When tracking is lost, jump to the professional default pose instead of freezing in an awkward position
    const activeLandmarks = isTrackingLost ? DEFAULT_POSE : (landmarks?.length > 0 ? landmarks : lastValidLandmarksRef.current);
    
    const CONFIDENCE_THRESHOLD = 0.6;
    
    const isRedSkeleton = isTrackingLost;

    useEffect(() => {
      if (!hasStarted || !hasCountdownFinishedOnce) return;
      
      if (isRedSkeleton && !isRedRef.current) {
        isRedRef.current = true;
        if (useProfileStore.getState().preferences.voiceCoach) {
          Speech.stop();
          Speech.speak("Body not detected. Please step into the camera frame.", { language: 'en' });
        }
      } else if (!isRedSkeleton && isRedRef.current) {
        isRedRef.current = false;
        if (useProfileStore.getState().preferences.voiceCoach) {
          Speech.stop();
        }
      }
    }, [isRedSkeleton, hasStarted, hasCountdownFinishedOnce]);

    // We only unmount if we have never seen the user at all
    if (!hasStarted || !activeLandmarks || activeLandmarks.length === 0) return null;

    // Use the native camera frame aspect ratio so SVG 'slice' exactly matches camera 'FILL_CENTER'
    // Fallback to old math if the native update hasn't propagated yet
    const frameW = imageWidth > 0 ? imageWidth : (isLandscape ? 640 : 480);
    const frameH = imageHeight > 0 ? imageHeight : (isLandscape ? 480 : 640);

    // Pre-calculate all joints in a single pass to prevent massive object reallocation 
    // and garbage collection overhead during the 30 FPS render loop.
    const j = new Array(33);
    if (activeLandmarks) {
      for (let i = 0; i < 33; i++) {
        const lm = activeLandmarks[i];
        if (lm) {
          j[i] = {
            x: (1 - lm.x) * frameW, // Invert X for front camera mirror effect
            y: lm.y * frameH,
            visibility: isTrackingLost ? 0 : (lm.visibility ?? 0),
          };
        }
      }
    }

    const skeleton = {
      nose: j[0] || { x: 50, y: 15, visibility: 0 },
      leftEyeInner: j[1] || { x: 48, y: 12, visibility: 0 },
      leftEye: j[2] || { x: 46, y: 12, visibility: 0 },
      leftEyeOuter: j[3] || { x: 44, y: 12, visibility: 0 },
      rightEyeInner: j[4] || { x: 52, y: 12, visibility: 0 },
      rightEye: j[5] || { x: 54, y: 12, visibility: 0 },
      rightEyeOuter: j[6] || { x: 56, y: 12, visibility: 0 },
      leftEar: j[7] || { x: 42, y: 15, visibility: 0 },
      rightEar: j[8] || { x: 58, y: 15, visibility: 0 },
      mouthLeft: j[9] || { x: 47, y: 20, visibility: 0 },
      mouthRight: j[10] || { x: 53, y: 20, visibility: 0 },
      shoulderL: j[11] || { x: 40, y: 30, visibility: 0 },
      shoulderR: j[12] || { x: 60, y: 30, visibility: 0 },
      elbowL: j[13] || { x: 30, y: 50, visibility: 0 },
      elbowR: j[14] || { x: 70, y: 50, visibility: 0 },
      wristL: j[15] || { x: 20, y: 70, visibility: 0 },
      wristR: j[16] || { x: 80, y: 70, visibility: 0 },
      hipL: j[23] || { x: 45, y: 60, visibility: 0 },
      hipR: j[24] || { x: 55, y: 60, visibility: 0 },
      kneeL: j[25] || { x: 44, y: 88, visibility: 0 },
      kneeR: j[26] || { x: 56, y: 88, visibility: 0 },
      ankleL: j[27] || { x: 45, y: 92, visibility: 0 },
      ankleR: j[28] || { x: 55, y: 92, visibility: 0 },
      midSpine:
        j[11] && j[23]
          ? {
            x: (j[11].x + j[12].x + j[23].x + j[24].x) / 4,
            y: (j[11].y + j[12].y + j[23].y + j[24].y) / 4,
            visibility: Math.min(
              j[11].visibility,
              j[12].visibility,
              j[23].visibility,
              j[24].visibility
            ),
          }
          : { x: frameW / 2, y: frameH / 2, visibility: 0 },
    };

    const msg = (statusMessage || "").toLowerCase();
    const isWarning = !isFormPerfect && hasStarted;

    // Categorize Warnings
    const isLegStraight = msg.includes("legs straight");
    const isKneeWarning = isWarning && (msg.includes("knee") || msg.includes("leg") || msg.includes("thigh") || msg.includes("calves") || msg.includes("parallel"));
    const isChestWarning = isWarning && (msg.includes("chest") || msg.includes("arm") || msg.includes("shoulder") || msg.includes("elbow") || msg.includes("90-degree"));
    const isCoreWarning = isWarning && (msg.includes("hip") || (msg.includes("straight") && !isLegStraight));
    const isGeneralWarning = isWarning && !isKneeWarning && !isChestWarning && !isCoreWarning;

    // Determine colors
    const legColor = isWarning ? (isKneeWarning || isGeneralWarning ? "#F0B35C" : "#3FA76A") : "#3FA76A";
    const armColor = isWarning ? (isChestWarning || isGeneralWarning ? "#F0B35C" : "#3FA76A") : "#3FA76A";
    const coreColor = isWarning ? ((isCoreWarning || isChestWarning || isGeneralWarning) ? "#F0B35C" : "#3FA76A") : "#3FA76A";

    const WARNING_COLOR = "#DC143C"; // Crimson Red

    const getLineProps = (p1: any, p2: any, defaultColor: string) => {
      const v1 = p1?.visibility ?? 0;
      const v2 = p2?.visibility ?? 0;
      const isLowConfidence = v1 < CONFIDENCE_THRESHOLD || v2 < CONFIDENCE_THRESHOLD;
      
      if (isTrackingLost) {
        return { stroke: WARNING_COLOR, opacity: "1", strokeWidth: "5" };
      }
      
      return {
        stroke: defaultColor,
        opacity: isLowConfidence ? "0.3" : "1",
        strokeWidth: "5",
      };
    };

    const getJointProps = (p: any, defaultColor: string) => {
      const v = p?.visibility ?? 0;
      const isLowConfidence = v < CONFIDENCE_THRESHOLD;
      
      if (isTrackingLost) {
        return { fill: WARNING_COLOR, opacity: "1" };
      }
      
      return {
        fill: defaultColor,
        opacity: isLowConfidence ? "0.3" : "1",
      };
    };

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg
          className="opacity-80"
          style={StyleSheet.absoluteFill}
          viewBox={`0 0 ${frameW} ${frameH}`}
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Torso */}
          <Line x1={skeleton.shoulderL.x} y1={skeleton.shoulderL.y} x2={skeleton.shoulderR.x} y2={skeleton.shoulderR.y} {...getLineProps(skeleton.shoulderL, skeleton.shoulderR, coreColor)} />
          <Line x1={skeleton.hipL.x} y1={skeleton.hipL.y} x2={skeleton.hipR.x} y2={skeleton.hipR.y} {...getLineProps(skeleton.hipL, skeleton.hipR, coreColor)} />
          <Line x1={skeleton.shoulderL.x} y1={skeleton.shoulderL.y} x2={skeleton.hipL.x} y2={skeleton.hipL.y} {...getLineProps(skeleton.shoulderL, skeleton.hipL, coreColor)} />
          <Line x1={skeleton.shoulderR.x} y1={skeleton.shoulderR.y} x2={skeleton.hipR.x} y2={skeleton.hipR.y} {...getLineProps(skeleton.shoulderR, skeleton.hipR, coreColor)} />

          {/* Arms */}
          <Line x1={skeleton.shoulderL.x} y1={skeleton.shoulderL.y} x2={skeleton.elbowL.x} y2={skeleton.elbowL.y} {...getLineProps(skeleton.shoulderL, skeleton.elbowL, armColor)} />
          <Line x1={skeleton.elbowL.x} y1={skeleton.elbowL.y} x2={skeleton.wristL.x} y2={skeleton.wristL.y} {...getLineProps(skeleton.elbowL, skeleton.wristL, armColor)} />

          <Line x1={skeleton.shoulderR.x} y1={skeleton.shoulderR.y} x2={skeleton.elbowR.x} y2={skeleton.elbowR.y} {...getLineProps(skeleton.shoulderR, skeleton.elbowR, armColor)} />
          <Line x1={skeleton.elbowR.x} y1={skeleton.elbowR.y} x2={skeleton.wristR.x} y2={skeleton.wristR.y} {...getLineProps(skeleton.elbowR, skeleton.wristR, armColor)} />

          {/* Legs */}
          <Line x1={skeleton.hipL.x} y1={skeleton.hipL.y} x2={skeleton.kneeL.x} y2={skeleton.kneeL.y} {...getLineProps(skeleton.hipL, skeleton.kneeL, legColor)} />
          <Line x1={skeleton.kneeL.x} y1={skeleton.kneeL.y} x2={skeleton.ankleL.x} y2={skeleton.ankleL.y} {...getLineProps(skeleton.kneeL, skeleton.ankleL, legColor)} />

          <Line x1={skeleton.hipR.x} y1={skeleton.hipR.y} x2={skeleton.kneeR.x} y2={skeleton.kneeR.y} {...getLineProps(skeleton.hipR, skeleton.kneeR, legColor)} />
          <Line x1={skeleton.kneeR.x} y1={skeleton.kneeR.y} x2={skeleton.ankleR.x} y2={skeleton.ankleR.y} {...getLineProps(skeleton.kneeR, skeleton.ankleR, legColor)} />

          {/* Head & Spine */}
          <Circle cx={skeleton.nose.x} cy={skeleton.nose.y} r="15" {...getJointProps(skeleton.nose, coreColor)} />
          <Circle cx={skeleton.midSpine.x} cy={skeleton.midSpine.y} r="8" {...getJointProps(skeleton.midSpine, coreColor)} />

          {/* Arm Joints */}
          <Circle cx={skeleton.elbowL.x} cy={skeleton.elbowL.y} r="6" {...getJointProps(skeleton.elbowL, armColor)} />
          <Circle cx={skeleton.wristL.x} cy={skeleton.wristL.y} r="6" {...getJointProps(skeleton.wristL, "#FFFFFF")} />

          <Circle cx={skeleton.elbowR.x} cy={skeleton.elbowR.y} r="6" {...getJointProps(skeleton.elbowR, armColor)} />
          <Circle cx={skeleton.wristR.x} cy={skeleton.wristR.y} r="6" {...getJointProps(skeleton.wristR, "#FFFFFF")} />

          {/* Torso Joints */}
          <Circle cx={skeleton.hipL.x} cy={skeleton.hipL.y} r="8" {...getJointProps(skeleton.hipL, coreColor)} />
          <Circle cx={skeleton.hipR.x} cy={skeleton.hipR.y} r="8" {...getJointProps(skeleton.hipR, coreColor)} />

          {/* Leg Joints */}
          <Circle cx={skeleton.kneeL.x} cy={skeleton.kneeL.y} r="8" {...getJointProps(skeleton.kneeL, legColor)} />
          <Circle cx={skeleton.ankleL.x} cy={skeleton.ankleL.y} r="6" {...getJointProps(skeleton.ankleL, "#FFFFFF")} />

          <Circle cx={skeleton.kneeR.x} cy={skeleton.kneeR.y} r="8" {...getJointProps(skeleton.kneeR, legColor)} />
          <Circle cx={skeleton.ankleR.x} cy={skeleton.ankleR.y} r="6" {...getJointProps(skeleton.ankleR, "#FFFFFF")} />
        </Svg>
        {isRedSkeleton && hasCountdownFinishedOnce && (
          <View className="absolute top-[25%] left-0 right-0 flex-row justify-center z-50 px-4">
            <View className="bg-[#DC143C]/90 px-6 py-3 rounded-full border border-red-400 backdrop-blur-md shadow-2xl">
              <Text className="text-white font-outfitBold text-sm text-center tracking-wide">
                Body not detected. Please step into the camera frame.
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  }
);
