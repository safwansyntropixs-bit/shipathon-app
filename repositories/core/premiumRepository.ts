import { supabase } from "@/utils/supabase";

export const premiumRepository = {
  async grantPremiumEntitlement(userId: string, expiresAt?: string | null): Promise<boolean> {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ is_premium: true })
      .eq("id", userId);

    if (profileError) {
      console.error("Failed to grant premium entitlement on profile:", profileError);
      throw profileError;
    }

    try {
      const expirationTimestamp = expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from("subscriptions")
        .upsert({
          user_id: userId,
          status: "active",
          tier: "pro",
          expires_at: expirationTimestamp,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
    } catch (subErr) {
      // Non-blocking if subscriptions table schema differs
      console.warn("[premiumRepository] Optional subscriptions table sync notice:", subErr);
    }

    return true;
  },

  async revokePremiumEntitlement(userId: string): Promise<boolean> {
    // Check if there is an unexpired subscription in the database
    try {
      const { data } = await supabase
        .from("subscriptions")
        .select("expires_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (data?.expires_at && new Date(data.expires_at).getTime() > Date.now()) {
        // Subscription is canceled (auto-renew off) but paid period is still valid!
        await supabase
          .from("subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("user_id", userId);
        return true;
      }
    } catch (e) {}

    const { error } = await supabase
      .from("profiles")
      .update({ is_premium: false })
      .eq("id", userId);

    if (error) {
      console.error("Failed to revoke premium entitlement:", error);
      throw error;
    }

    try {
      await supabase
        .from("subscriptions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    } catch (subErr) {
      console.warn("[premiumRepository] Optional subscriptions table revoke notice:", subErr);
    }

    return true;
  },

  async verifyPremiumStatus(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("profiles")
      .select("is_premium")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to verify premium status:", error);
      throw error;
    }

    return data?.is_premium || false;
  }
};
