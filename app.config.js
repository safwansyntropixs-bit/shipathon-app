const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST;

const appIdentifier = "com.skortan.replix";

export default {
  expo: {
    name: "Replix",
    slug: "replix",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/logo/replix_logo1024.png",
    scheme: "replix",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,

    updates: {
      url: "https://u.expo.dev/d2c0c3a5-97f2-4472-939d-b052e746f2e6",
    },

    runtimeVersion: {
      policy: "appVersion",
    },

    ios: {
      bundleIdentifier: appIdentifier,
      supportsTablet: true,
    },

    android: {
      versionCode: 2,
      package: appIdentifier,
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        backgroundColor: "#16451B",
        foregroundImage: "./assets/logo/Untitled_designmorepadded.png",
        // backgroundImage: "./assets/logo/replix_logo1024.png",
        monochromeImage: "./assets/logo/transparent.png",
      },

      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },

    web: {
      output: "static",
      favicon: "./assets/logo/replix_logo512_transparent.png",
    },

    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/logo/replix_logo1024_transparent.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#16451B",
          dark: {
            backgroundColor: "#16451B",
          },
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission: "Allow Replix to access your camera",
          microphonePermission: "Allow Replix to access your microphone",
          recordAudioAndroid: true,
          barcodeScannerEnabled: true,
        },
      ],
      "expo-font",
      "expo-sqlite",
      "expo-audio",
      "expo-asset",
      "expo-localization",
      [
        "expo-notifications",
        {
          "icon": "./assets/logo/replix_logo512.png",
          "color": "#16451B"
        }
      ]
    ],

    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },

    extra: {
      SUPABASE_URL: SUPABASE_URL || "",
      SUPABASE_ANON_KEY: SUPABASE_ANON_KEY || "",
      POSTHOG_API_KEY: POSTHOG_API_KEY || "",
      POSTHOG_HOST: POSTHOG_HOST || "",
      router: {},
      eas: {
        projectId: "d2c0c3a5-97f2-4472-939d-b052e746f2e6",
      },
    },

    owner: "skortan",
  },
};