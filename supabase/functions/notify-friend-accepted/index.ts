import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: any;
  schema: "public";
  old_record: any;
}

serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json();

    // 1. Guard Clause: Only process INSERT on friends
    if (payload.type !== "INSERT" || payload.table !== "friends") {
      return new Response("Ignored: Not a friends insert", { status: 200 });
    }

    const { record } = payload;
    const { user_id, friend_id } = record;

    // We only want to process this once per friendship.
    // The webhook will be fired via a trigger where auth.uid() = user_id.
    // user_id is the person who ACCEPTED the request.
    // friend_id is the person who originally SENT the request.
    // So we need to notify friend_id.

    // 3. Initialize Supabase Client (Service Role for bypass RLS)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 4. Fetch Receiver's Profile (The person who accepted, which is user_id)
    const { data: receiverProfile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("username")
      .eq("id", user_id)
      .single();

    if (profileError || !receiverProfile) {
      console.error("Profile fetch error:", profileError);
      throw new Error("Could not find receiver profile");
    }

    const receiverName = receiverProfile.username || "A fellow athlete";

    // 5. Fetch Sender's Active Devices (The original sender, which is friend_id)
    const { data: devices, error: deviceError } = await supabaseClient
      .from("user_devices")
      .select("fcm_token")
      .eq("user_id", friend_id);

    if (deviceError || !devices || devices.length === 0) {
      return new Response("Skipped: User has no registered devices.", { status: 200 });
    }

    // 6. Extract valid tokens (filtering out any nulls)
    const expoTokens = devices.map((d: any) => d.fcm_token).filter(Boolean);
    
    if (expoTokens.length === 0) {
       return new Response("Skipped: No valid Expo tokens found.", { status: 200 });
    }

    // 7. Construct the Expo Push Payload
    const message = {
      to: expoTokens,
      sound: "default",
      title: "Request Accepted! 🎉",
      body: `${receiverName} accepted your friend request!`,
      data: { route: "social" }, // Deep-link to social
    };

    // 8. Fire and Forget to Expo API
    const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const expoData = await expoResponse.json();
    console.log("Expo Push Response:", expoData);

    return new Response(JSON.stringify({ success: true, data: expoData }), { 
      headers: { "Content-Type": "application/json" },
      status: 200
    });
    
  } catch (error: any) {
    console.error("Webhook processing failed:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
