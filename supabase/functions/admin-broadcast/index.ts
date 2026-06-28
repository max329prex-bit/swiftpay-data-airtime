import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPA_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const token = req.headers.get("x-admin-token");
    if (!token) {
      return new Response(JSON.stringify({ error: "Admin token required" }), { status: 401, headers: cors });
    }

    const sb = createClient(SUPA_URL, SUPA_SVC);

    // Verify admin session
    const { data: session } = await sb
      .from("admin_sessions")
      .select("id")
      .eq("token", token)
      .eq("revoked", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!session) {
      return new Response(JSON.stringify({ error: "Invalid or expired admin session" }), { status: 403, headers: cors });
    }

    const body = await req.json();
    const { title, message, type = "info" } = body;

    if (!message || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Message is required" }), { status: 400, headers: cors });
    }

    // Send broadcast via RPC function
    const { data: count, error } = await sb.rpc("send_broadcast", {
      _title: title || "",
      _message: message.trim(),
      _type: type,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, count: count || 0 }), { headers: cors });

  } catch (e: unknown) {
    console.error("[admin-broadcast] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: cors
    });
  }
});
