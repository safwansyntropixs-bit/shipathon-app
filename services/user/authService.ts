import { supabase } from "@/utils/supabase";
import type { Session, User } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";


import AsyncStorage from "@react-native-async-storage/async-storage";

interface RateLimitRecord {
  attempts: number;
  lastSent: number;
  cooldownUntil: number;
}

const STORAGE_KEY = "@replix_otp_rate_limits";
const BACKOFF_SCHEDULE = [60, 120, 300, 900]; // 1m, 2m, 5m, 15m
const RESET_WINDOW_MS = 30 * 60 * 1000; // 30 minutes of inactivity resets progressive backoff

// In-memory cache for instant synchronous access (zero render blocking)
let rateLimitsMemoryCache: Record<string, RateLimitRecord> = {};

// Hydrate from AsyncStorage on startup
const hydrateStorage = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const now = Date.now();
      const cleaned: Record<string, RateLimitRecord> = {};
      // Purge entries older than 24 hours
      for (const [key, val] of Object.entries(parsed)) {
        const record = val as RateLimitRecord;
        if (now - record.lastSent < 24 * 60 * 60 * 1000) {
          cleaned[key] = record;
        }
      }
      rateLimitsMemoryCache = cleaned;
    }
  } catch (e) {
    // Non-blocking fallback
  }
};
hydrateStorage();

const persistCache = async () => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rateLimitsMemoryCache));
  } catch (e) {
    // Non-blocking
  }
};

export const otpRateLimiter = {
  getRemainingCooldown(email: string, action: string = 'recovery'): number {
    if (!email) return 0;
    const key = `${action}:${email.trim().toLowerCase()}`;
    const record = rateLimitsMemoryCache[key];
    if (!record) return 0;

    const now = Date.now();
    if (now >= record.cooldownUntil) {
      return 0;
    }

    const remainingMs = record.cooldownUntil - now;
    // Guard against device clock skew
    if (remainingMs > 3600 * 1000) {
      return 60;
    }

    return Math.max(0, Math.ceil(remainingMs / 1000));
  },

  recordOtpSent(email: string, action: string = 'recovery'): number {
    if (!email) return 60;
    const key = `${action}:${email.trim().toLowerCase()}`;
    const now = Date.now();
    const existing = rateLimitsMemoryCache[key];

    let attempts = 1;
    if (existing) {
      // If previous request occurred within the 30-minute activity window, progress to higher backoff
      if (now - existing.lastSent < RESET_WINDOW_MS) {
        attempts = existing.attempts + 1;
      }
    }

    const tierIndex = Math.min(attempts - 1, BACKOFF_SCHEDULE.length - 1);
    const cooldownSeconds = BACKOFF_SCHEDULE[tierIndex];
    const cooldownUntil = now + (cooldownSeconds * 1000);

    rateLimitsMemoryCache[key] = {
      attempts,
      lastSent: now,
      cooldownUntil,
    };

    persistCache();
    return cooldownSeconds;
  },

  checkAndEnforce(email: string, action: string = 'recovery'): void {
    const remaining = this.getRemainingCooldown(email, action);
    if (remaining > 0) {
      const formatted = this.formatTime(remaining);
      throw new Error(`Please wait ${formatted} before requesting another verification code.`);
    }
  },

  formatTime(totalSeconds: number): string {
    if (totalSeconds <= 0) return "0s";
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins > 0 && secs > 0) {
      return `${mins}m ${secs}s`;
    }
    if (mins > 0) {
      return `${mins}m`;
    }
    return `${secs}s`;
  }
};

export const authService = {
  async signUp(email: string, password: string, options?: { username?: string; full_name?: string }) {
    const cleanEmail = email.trim().toLowerCase();
    otpRateLimiter.checkAndEnforce(cleanEmail, 'signup');
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          username: options?.username,
          full_name: options?.full_name,
        }
      }
    });
    if (error) throw error;
    otpRateLimiter.recordOtpSent(cleanEmail, 'signup');
    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

async signInWithOAuth(provider: "google" | "apple") {
  const redirectTo = Linking.createURL("auth-callback");
  console.log("Redirect URL:", redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;

  if (data?.url) {
    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectTo
    );

    if (result.type === "success" && result.url) {
      const parsed = Linking.parse(result.url);
      const code = parsed.queryParams?.code;
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(String(code));
        if (exchangeError) throw exchangeError;
      } else {
        throw new Error("No authentication code found in redirect URL");
      }
    } else if (result.type !== "success") {
      throw new Error("Authentication cancelled");
    }
  }
},

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async verifyOtp(email: string, token: string, type: 'signup' | 'recovery') {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    });
    if (error) throw error;
    return data;
  },

  async checkEmailExists(email: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('check_email_exists', {
        check_email: email.trim().toLowerCase(),
      });
      if (error) {
        // If RPC is unavailable or encounters an error, fallback to true so native auth handling proceeds
        return true;
      }
      return Boolean(data);
    } catch {
      return true;
    }
  },

  async resendOtp(email: string, type: 'signup' | 'recovery') {
    const cleanEmail = email.trim().toLowerCase();
    if (type === 'recovery') {
      return await this.resetPassword(cleanEmail);
    } else {
      otpRateLimiter.checkAndEnforce(cleanEmail, 'signup');
      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
      });
      if (error) throw error;
      otpRateLimiter.recordOtpSent(cleanEmail, 'signup');
      return data;
    }
  },

  async updatePassword(password: string) {
    const { data, error } = await supabase.auth.updateUser({
      password: password
    });
    if (error) throw error;
    return data;
  },

  async updateUserMetadata(metaData: Record<string, any>) {
    const { data, error } = await supabase.auth.updateUser({
      data: metaData
    });
    if (error) throw error;
    return data;
  },

  async resetPassword(email: string) {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Enforce global rate limiting (persisted across back navigation)
    otpRateLimiter.checkAndEnforce(cleanEmail, 'recovery');

    // 2. Query database to check if the email exists
    const exists = await this.checkEmailExists(cleanEmail);

    // 3. If email exists: generate OTP and trigger email dispatch
    if (exists) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
        if (error) {
          const msg = error.message?.toLowerCase() || '';
          // Suppress user not found errors for enumeration protection
          if (!msg.includes('user not found') && !msg.includes('user does not exist')) {
            throw error;
          }
        }
      } catch (err: any) {
        const msg = err?.message?.toLowerCase() || '';
        if (!msg.includes('user not found') && !msg.includes('user does not exist')) {
          throw err;
        }
      }
    }

    // 4. Record timestamp of OTP request
    otpRateLimiter.recordOtpSent(cleanEmail, 'recovery');

    // 5. If email does not exist: do NOT send email (saving API cost), and still return 200/success
    return { success: true };
  },

  async getSession() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  onAuthStateChange(
    callback: (event: string, session: Session | null, user: User | null) => void,
  ) {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string, session: any) => {
      callback(event, session, session?.user ?? null);
    });
    return subscription;
  },
};
