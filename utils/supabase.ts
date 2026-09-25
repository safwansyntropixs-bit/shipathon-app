import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import { env } from "./../config/env";

WebBrowser.maybeCompleteAuthSession();

const customFetch = async (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
  let attempt = 0;
  while (attempt < 3) {
    const response = await fetch(url, options);
    if (!response.ok) {
      const clonedResponse = response.clone();
      try {
        const errorText = await clonedResponse.text();
        if (errorText.includes("PGRST303") && attempt < 2) {
          // Clock skew detected, wait 1 second and retry globally
          await new Promise(r => setTimeout(r, 1000));
          attempt++;
          continue;
        }
      } catch (e) {
        // Ignore parse errors on clone
      }
    }
    return response;
  }
  return fetch(url, options);
};

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
  global: {
    fetch: customFetch,
  }
});