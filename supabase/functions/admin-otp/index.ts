import { createClient } from "npm:@supabase/supabase-js@2";

const SUPA_URL   = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_BOT     = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT    = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function genOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function genToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 48; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

async function sendTelegramOtp(code: string): Promise<boolean> {
  if (!TG_BOT || !TG_CHAT) {
    console.warn("[admin-otp] TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID not set");
    return false;
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHAT,
        text: `🔐 *BlitzPay Admin OTP*\n\nCode: \`${code}\`\nValid for 5 minutes.\nDo not share with anyone.`,
        parse_mode: "Markdown"
      }),
      signal: AbortSignal.timeout(15000)
    });
    const d = await r.json();
    if (!r.ok || !d.ok) {
      console.error("[admin-otp] Telegram send failed:", JSON.stringify(d).slice(0, 200));
      return false;
    }
    console.log("[admin-otp] OTP sent via Telegram, messageId:", d.result?.message_id);
    return true;
  } catch (e) {
    console.error("[admin-otp] Telegram error:", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD") ?? Deno.env.get("ADMIN_PANEL_PASSWORD") ?? "";
    const body = await req.json();
    const { action, password, code } = body as Record<string, string>;

    // ── 1. Verify password ──────────────────────────────────────────────────────────
    if (action === "verify-password") {
      if (!password || password !== ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ success: false, error: "Invalid password" }),
          { status: 401, headers: cors });
      }
      return new Response(JSON.stringify({ success: true }), { headers: cors });
    }

    // ── 2. Request OTP (generate + send via Telegram) ──────────────────────────
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

      // Send via Telegram
      const sent = await sendTelegramOtp(otp);
      if (!sent) {
        return new Response(JSON.stringify({ success: false, error: "Failed to send OTP via Telegram" }),
          { status: 500, headers: cors });
      }

      return new Response(JSON.stringify({ success: true, message: "OTP sent to Telegram admin" }),
        { headers: cors });
    }

    // ── 3. Verify OTP + create admin session token ────────────────────────────
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

      // Create independent admin session (NO link to any user account)
      const token = genToken();
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "";
      const ua = req.headers.get("user-agent") || "";
      const sessionExpiry = new Date(Date.now() + 8 * 60 * 60_000).toISOString(); // 8 hours

      await sb.from("admin_sessions").insert({
        token,
        ip_address: ip,
        user_agent: ua,
        expires_at: sessionExpiry,
      });

      return new Response(JSON.stringify({ success: true, token, expires_at: sessionExpiry }), { headers: cors });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
