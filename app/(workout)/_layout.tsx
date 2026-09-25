import { Stack } from "expo-router";

export default function WorkoutLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_bottom'
      }}
    >
      <Stack.Screen name="workout-session" />
      <Stack.Screen name="workout-summary" />
    </Stack>
  );
}
