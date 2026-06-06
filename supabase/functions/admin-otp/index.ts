import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD") ?? Deno.env.get("ADMIN_PANEL_PASSWORD") ?? "";
const ADMIN_OTP_EMAIL = Deno.env.get("ADMIN_OTP_EMAIL") ?? "onojav79@gmail.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json();
    const { action } = body;

    // Step 1: verify admin password → send OTP email
    if (action === "verify-password") {
      const { password } = body;
      if (!password || password !== ADMIN_PASSWORD) {
        return new Response(
          JSON.stringify({ error: "Invalid password" }),
          { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
      // Use Supabase Auth OTP — sends 6-digit code to the admin email
      const r = await fetch(`${SUPA_URL}/auth/v1/otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPA_ANON },
        body: JSON.stringify({ email: ADMIN_OTP_EMAIL, create_user: true }),
      });
      if (!r.ok) {
        const err = await r.json();
        console.error("OTP send error:", err);
        return new Response(
          JSON.stringify({ error: "Failed to send OTP. Try again." }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, message: `OTP sent to ${ADMIN_OTP_EMAIL}` }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Step 2: verify OTP code
    if (action === "verify-otp") {
      const { otp } = body;
      if (!otp) {
        return new Response(
          JSON.stringify({ error: "OTP required" }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
      const r = await fetch(`${SUPA_URL}/auth/v1/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPA_ANON },
        body: JSON.stringify({ type: "email", email: ADMIN_OTP_EMAIL, token: otp }),
      });
      if (!r.ok) {
        const err = await r.json();
        console.error("OTP verify error:", err);
        return new Response(
          JSON.stringify({ error: "Invalid or expired OTP" }),
          { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, verified: true }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
