import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  try {
    // 1. Security check: Validate Authorization header
    const authHeader = req.headers.get("Authorization");
    const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
    
    if (!webhookSecret) {
      console.error("REVENUECAT_WEBHOOK_SECRET is not set.");
      return new Response("Internal Server Error", { status: 500 });
    }

    if (authHeader !== `Bearer ${webhookSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. Parse payload
    const body = await req.json();
    const event = body.event;

    if (!event) {
      return new Response("Bad Request: Missing event data", { status: 400 });
    }

    // Resolve UUID
    let resolvedId: string | null = null;
    
    if (event.app_user_id && UUID_REGEX.test(event.app_user_id.toString())) {
      resolvedId = event.app_user_id.toString();
    } else if (event.aliases && Array.isArray(event.aliases)) {
      for (const alias of event.aliases) {
        if (alias && UUID_REGEX.test(alias.toString())) {
          resolvedId = alias.toString();
          break;
        }
      }
    }
    
    if (!resolvedId && event.original_app_user_id && UUID_REGEX.test(event.original_app_user_id.toString())) {
      resolvedId = event.original_app_user_id.toString();
    }

    if (!resolvedId || resolvedId.startsWith("$RCAnonymousID")) {
      console.log(`Skipping non-UUID anonymous event. app_user_id: ${event.app_user_id}`);
      return new Response(JSON.stringify({ message: "Skipping non-UUID anonymous event" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const type = event.type ? event.type.toString() : "";
    const product_id = event.product_id ? event.product_id.toString() : "";
    const transaction_id = (event.transaction_id || event.id)?.toString() || "";
    const store = event.store ? event.store.toString() : "";
    const expiration_at_ms = event.expiration_at_ms;

    // Initialize Supabase client bypassing RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine status and premium state
    let status = "active";
    let isPremium = true;

    switch (type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "UNCANCELLATION":
        status = "active";
        isPremium = true;
        break;
      case "CANCELLATION":
        status = "cancelled";
        // Do not revoke access until the billing cycle officially ends.
        isPremium = true;
        break;
      case "EXPIRATION":
      case "BILLING_ISSUE":
        status = "expired";
        isPremium = false;
        break;
      default:
        console.log(`Unhandled event type: ${type}`);
        return new Response(`Event type ${type} ignored`, { status: 200 });
    }

    const expiresAt = expiration_at_ms
      ? new Date(expiration_at_ms).toISOString()
      : null;

    // 3. Database Operations
    
    // Upsert into subscriptions table
    const { error: subError } = await supabase.from("subscriptions").upsert({
      user_id: resolvedId,
      revenuecat_id: transaction_id,
      tier: product_id,
      status: status,
      expires_at: expiresAt,
      // Add store if you have it in schema, optionally
      // store: store, 
    }, { onConflict: 'user_id' }); 

    if (subError) {
      console.error("Error upserting subscription:", subError);
      return new Response("Failed to update subscription", { status: 200 }); // Return 200 to acknowledge RevenueCat
    }

    // Update profiles table
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ is_premium: isPremium })
      .eq("id", resolvedId);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      return new Response("Failed to update profile", { status: 200 });
    }

    return new Response("Webhook processed successfully", { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response("Internal Server Error", { status: 200 }); // Always 200 to prevent retries of bad data, or 500 if you want retries
  }
});
