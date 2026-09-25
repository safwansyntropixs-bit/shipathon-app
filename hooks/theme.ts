// theme.ts
import { useColorScheme } from "react-native";

export const lightTheme = {
  background: "#F5F5F5",
  tabBarBackground: "rgba(245,245,245,0.8)",
  tabBarBorder: "rgba(0,0,0,0.1)",
  activePillBg: "#C6F432",
  activeIcon: "#1A1C20",
  inactiveIcon: "#A0A0A0",
  blurTint: "light" as const,
};

export const darkTheme = {
  background: "#1A1C20",
  tabBarBackground: "rgba(26,28,32,0.7)",
  tabBarBorder: "rgba(255,255,255,0.1)",
  activePillBg: "#C6F432",
  activeIcon: "#1A1C20",
  inactiveIcon: "#A0A0A0",
  blurTint: "dark" as const,
};

export const useAppTheme = () => {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkTheme : lightTheme;
};