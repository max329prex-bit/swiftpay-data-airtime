import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const SYS = "You are Blitzi, the friendly AI assistant for BlitzPay, a Nigerian fintech app. Help users with wallet top-up, airtime, data bundles, electricity and cable TV payments. Be concise, warm and helpful. Always use Naira (₦) for amounts. Keep replies short — 2-3 sentences max.";

// Smart FAQ fallback for when AI is unavailable
function getFallback(msg: string): string {
  const q = msg.toLowerCase();
  if (q.includes("wallet") || q.includes("fund") || q.includes("deposit") || q.includes("top up") || q.includes("money") || q.includes("balance"))
    return "To fund your wallet, tap the + button on your dashboard. You'll see your reserved bank account — transfer any amount and it reflects automatically within minutes! 💰";
  if (q.includes("airtime"))
    return "To buy airtime: tap Airtime on the dashboard, enter the phone number (it auto-detects the network), pick an amount (min ₦50), then confirm with your 4-digit PIN. ⚡";
  if (q.includes("data") || q.includes("bundle") || q.includes("gb") || q.includes("mb"))
    return "To buy data: tap Data on the dashboard, choose your network, enter the phone number, select a plan, then confirm with your PIN. You earn BlitzPoints on every purchase! 📶";
  if (q.includes("pin") || q.includes("password"))
    return "To change your PIN: go to Settings → Change Transaction PIN. You'll need your current PIN to set a new one. Keep it safe! 🔐";
  if (q.includes("point") || q.includes("blitzpoint") || q.includes("reward") || q.includes("redeem"))
    return "You earn BlitzPoints on every purchase! 100 points = 1GB free data reward. Track your points on the dashboard and redeem when you hit 100. 🎁";
  if (q.includes("electricity") || q.includes("disco") || q.includes("meter") || q.includes("prepaid") || q.includes("postpaid"))
    return "For electricity: tap Electric on the dashboard, select your DISCO provider, choose Prepaid or Postpaid, enter your meter number, verify it, then select an amount and pay. ⚡";
  if (q.includes("cable") || q.includes("dstv") || q.includes("gotv") || q.includes("startimes") || q.includes("tv"))
    return "For cable TV: tap Cable TV, choose DStv/GOtv/StarTimes, enter your smartcard/IUC number, verify it, select a subscription package, and confirm payment. 📺";
  if (q.includes("fail") || q.includes("error") || q.includes("refund") || q.includes("deduct") || q.includes("not deliver"))
    return "If a transaction failed but you were charged, your wallet is refunded automatically within 5-10 minutes. If not refunded after 30 minutes, email blitzpaysup@gmail.com with your reference number. 🛡️";
  if (q.includes("contact") || q.includes("support") || q.includes("email") || q.includes("help"))
    return "You can reach our support team anytime at blitzpaysup@gmail.com. We typically respond within a few hours. You can also go back and send a direct email from the support page! 📧";
  if (q.includes("register") || q.includes("sign up") || q.includes("account") || q.includes("create"))
    return "Welcome to BlitzPay! 🎉 Your account is set up. Start by funding your wallet using the + button on your dashboard, then you can buy airtime, data and pay bills instantly.";
  return "I'm Blitzi, your BlitzPay assistant! 😊 I can help with wallet funding, airtime, data, electricity, cable TV, BlitzPoints, and anything else about the app. What do you need help with?";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const CEREBRAS_KEY = Deno.env.get("CEREBRAS_API_KEY") ?? "";

  try {
    const { messages } = await req.json();
    const lastMsg = messages?.[messages.length - 1]?.content ?? "";

    // Try Cerebras AI first
    if (CEREBRAS_KEY) {
      try {
        const r = await fetch("https://api.cerebras.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${CEREBRAS_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama-3.3-70b",
            messages: [{ role: "system", content: SYS }, ...(messages || [])],
            max_tokens: 300,
            temperature: 0.7
          }),
          signal: AbortSignal.timeout(8000), // 8 second timeout
        });

        if (r.ok) {
          const data = await r.json();
          const reply = data.choices?.[0]?.message?.content;
          if (reply) {
            return new Response(JSON.stringify({ reply }), {
              headers: { ...cors, "Content-Type": "application/json" }
            });
          }
        }
      } catch (_) {
        // Cerebras failed — fall through to FAQ fallback
      }
    }

    // FAQ fallback — always gives a helpful response
    const reply = getFallback(lastMsg);
    return new Response(JSON.stringify({ reply }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ reply: "I'm having a moment! Please try again or email blitzpaysup@gmail.com for help. 😊" }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
