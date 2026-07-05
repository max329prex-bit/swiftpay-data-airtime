import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { from, subject, body, to } = await req.json();
    const recipient = to || Deno.env.get("SUPPORT_EMAIL") || "blitzpaysup@gmail.com";

    // Send via Brevo transactional email API
    const BREVO_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
    if (BREVO_KEY) {
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": BREVO_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: "BlitzPay Support", email: from || "support@blitzpay.ng" },
          to: [{ email: recipient }],
          subject: subject || "BlitzPay Support",
          textContent: body || "",
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) {
        return new Response(JSON.stringify({ success: true, sent_via: "brevo" }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      }
      const err = await r.text();
      console.error("[send-support-email] Brevo failed:", r.status, err.slice(0, 200));
    }

    // Fallback: Telegram notification to admin
    const TG_BOT = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
    const TG_CHAT = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") ?? "";
    if (TG_BOT && TG_CHAT) {
      await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TG_CHAT,
          text: `✉️ *BlitzPay Support Ticket*\n\nFrom: ${from || "unknown"}\nSubject: ${subject || "Support"}\n\n${body?.slice(0, 800) || ""}`,
          parse_mode: "Markdown",
        }),
      });
      return new Response(JSON.stringify({ success: true, sent_via: "telegram" }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: false, error: "No email provider configured" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" }
    });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
