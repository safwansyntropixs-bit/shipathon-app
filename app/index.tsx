import { Redirect } from "expo-router";
import { storageService } from "../services/core/storageService";
import { useAuthStore } from "../store/user/authStore";

export default function Index() {
  const { isAuthenticated } = useAuthStore();
  const hasSeenOnboarding = storageService.hasSeenOnboarding();

  // Instantly redirect so the user doesn't see a blank screen first
  if (isAuthenticated) {
    return <Redirect href="/(tabs)/home" />;
  }

  if (!hasSeenOnboarding) {
    return <Redirect href="/(onboarding)/onboarding" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}


