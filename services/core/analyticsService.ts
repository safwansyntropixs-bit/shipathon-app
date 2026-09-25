import PostHog from "posthog-react-native";

// Initialize PostHog globally so we don't have to wait for a component to mount
export const posthogClient = new PostHog(process.env.EXPO_PUBLIC_POSTHOG_API_KEY as string, {
  host: process.env.EXPO_PUBLIC_POSTHOG_HOST,
});

const setOptOut = (optOut: boolean): void => {
  if (optOut) {
    posthogClient.optOut();
  } else {
    posthogClient.optIn();
  }
};

const trackEvent = async (
  eventName: string,
  properties?: Record<string, any>,
): Promise<void> => {
  posthogClient.capture(eventName, properties);
};

const identifyUser = async (
  userId: string,
  traits?: Record<string, any>,
): Promise<void> => {
  posthogClient.identify(userId, traits);
};

const getFeatureFlag = async (
  flagKey: string,
  defaultValue: boolean = false,
): Promise<boolean> => {
  const flag = posthogClient.getFeatureFlag(flagKey);
  if (flag === undefined) return defaultValue;
  return Boolean(flag);
};

export const analyticsService = {
  setOptOut,
  trackEvent,
  identifyUser,
  getFeatureFlag,
};
