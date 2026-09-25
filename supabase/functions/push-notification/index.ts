import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// Type definition for Supabase Database Webhook payload
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

    // 1. Guard Clause: Only process new friend requests
    if (payload.type !== "INSERT" || payload.table !== "friend_requests") {
      return new Response("Ignored: Not a friend_request insert", { status: 200 });
    }

    const { sender_id, receiver_id } = payload.record;

    // 2. Initialize Supabase Client (Service Role for bypass RLS)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 3. Fetch Sender's Profile for Personalization
    const { data: senderProfile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("username")
      .eq("id", sender_id)
      .single();

    if (profileError || !senderProfile) {
      console.error("Profile fetch error:", profileError);
      throw new Error("Could not find sender profile");
    }

    const senderName = senderProfile.username || "A fellow athlete";

    // 4. Fetch Receiver's Active Devices
    const { data: devices, error: deviceError } = await supabaseClient
      .from("user_devices")
      .select("fcm_token")
      .eq("user_id", receiver_id);

    if (deviceError || !devices || devices.length === 0) {
      return new Response("Skipped: User has no registered devices.", { status: 200 });
    }

    // 5. Extract valid tokens (filtering out any nulls)
    const expoTokens = devices.map((d: any) => d.fcm_token).filter(Boolean);
    
    if (expoTokens.length === 0) {
       return new Response("Skipped: No valid Expo tokens found.", { status: 200 });
    }

    // 6. Construct the Expo Push Payload
    const message = {
      to: expoTokens,
      sound: "default",
      title: "New Friend Request! 🤝",
      body: `${senderName} wants to compete with you. Accept to hit the leaderboard!`,
      data: { route: "/(tabs)/leaderboard?scope=friends&action=requests" }, // Deep-link straight to the modal
    };

    // 7. Fire and Forget to Expo API
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
