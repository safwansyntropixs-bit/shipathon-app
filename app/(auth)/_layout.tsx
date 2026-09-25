import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false, 
        contentStyle: { backgroundColor: '#121212' },
        presentation: 'fullScreenModal',
        animation: 'slide_from_bottom',
        animationDuration: 300,
      }}
    >
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="signin" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="otp-verification" />
      <Stack.Screen name="create-new-password" />
    </Stack>
  );
}

