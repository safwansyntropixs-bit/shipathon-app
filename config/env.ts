// env.ts
import Constants from "expo-constants";

export const env = {
  SUPABASE_URL: Constants.expoConfig?.extra?.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: Constants.expoConfig?.extra?.SUPABASE_ANON_KEY || "",
};

if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
  console.warn("Supabase URL or Anon Key is missing in environment variables.");
}
