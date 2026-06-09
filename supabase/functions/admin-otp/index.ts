import { createClient } from "npm:@supabase/supabase-js@2";

const SUPA_URL   = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BREVO_KEY  = Deno.env.get("BREVO_API_KEY") ?? "";
const OTP_EMAIL  = Deno.env.get("ADMIN_OTP_EMAIL") ?? "";
const BREVO_BASE = "https://api.brevo.com/v3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function genOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendBrevoOtp(code: string): Promise<boolean> {
  if (!BREVO_KEY || !OTP_EMAIL) {
    console.warn("[admin-otp] BREVO_API_KEY or ADMIN_OTP_EMAIL not set");
    return false;
  }
  try {
    const r = await fetch(`${BREVO_BASE}/smtp/email`, {
      method: "POST",
      headers: { "api-key": BREVO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "BlitzPay Admin", email: "noreply@blitzpay.ng" },
        to: [{ email: OTP_EMAIL }],
        subject: "BlitzPay Admin OTP",
        htmlContent: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
            <h2 style="color:#f59e0b;margin:0 0 8px;">BlitzPay Admin Access</h2>
            <p style="color:#666;margin:0 0 24px;">Your one-time password is:</p>
            <div style="background:#111;border:2px solid #f59e0b;border-radius:8px;padding:20px;text-align:center;">
              <span style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#f59e0b;font-family:monospace;">${code}</span>
            </div>
            <p style="color:#999;font-size:12px;margin-top:16px;">Valid for 5 minutes. Do not share with anyone.</p>
          </div>`,
        textContent: `Your BlitzPay Admin OTP is: ${code}\nValid for 5 minutes.`
      }),
      signal: AbortSignal.timeout(15000)
    });
    const d = await r.json();
    if (!r.ok) {
      console.error("[admin-otp] Brevo send failed:", JSON.stringify(d).slice(0, 200));
      return false;
    }
    console.log("[admin-otp] OTP sent via Brevo, messageId:", d.messageId);
    return true;
  } catch (e) {
    console.error("[admin-otp] Brevo error:", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD") ?? Deno.env.get("ADMIN_PANEL_PASSWORD") ?? "";
    const body = await req.json();
    const { action, password, code } = body as Record<string, string>;

    // ── 1. Verify password (unchanged) ─────────────────────────────────────
    if (action === "verify-password") {
      if (!password || password !== ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ success: false, error: "Invalid password" }),
          { status: 401, headers: cors });
      }
      return new Response(JSON.stringify({ success: true }), { headers: cors });
    }

    // ── 2. Request OTP (generate + send via Brevo) ─────────────────────────
    if (action === "request-otp") {
      // Rate-limit: don't allow more than 1 OTP every 60s
      const sb = createClient(SUPA_URL, SUPA_SVC);
      const { count } = await sb.from("admin_otps")
        .select("id", { count: "exact", head: true })
        .gt("created_at", new Date(Date.now() - 60_000).toISOString());
      if ((count ?? 0) > 0) {
        return new Response(JSON.stringify({ success: false, error: "Wait 60 seconds before requesting a new OTP" }),
          { status: 429, headers: cors });
      }

      const otp = genOtp();
      const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

      // Store in DB (expires in 5min)
      await sb.from("admin_otps").insert({ code: otp, expires_at: expiresAt });

      // Send via Brevo
      const sent = await sendBrevoOtp(otp);
      if (!sent) {
        return new Response(JSON.stringify({ success: false, error: "Failed to send OTP email" }),
          { status: 500, headers: cors });
      }

      const maskedEmail = OTP_EMAIL.replace(/(.{2})(.+)(@.+)/, (_, a, b, c) =>
        a + "*".repeat(Math.max(b.length - 1, 2)) + b.slice(-1) + c);
      return new Response(JSON.stringify({ success: true, message: `OTP sent to ${maskedEmail}` }),
        { headers: cors });
    }

    // ── 3. Verify OTP ──────────────────────────────────────────────────────
    if (action === "verify-otp") {
      if (!code) return new Response(JSON.stringify({ success: false, error: "OTP required" }),
        { status: 400, headers: cors });

      const sb = createClient(SUPA_URL, SUPA_SVC);
      const { data: otpRow } = await sb.from("admin_otps")
        .select("id, code, expires_at, used")
        .eq("code", code)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otpRow) {
        return new Response(JSON.stringify({ success: false, error: "Invalid or expired OTP" }),
          { status: 401, headers: cors });
      }

      // Mark as used (one-time use)
      await sb.from("admin_otps").update({ used: true }).eq("id", otpRow.id);

      return new Response(JSON.stringify({ success: true, message: "OTP verified" }), { headers: cors });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
