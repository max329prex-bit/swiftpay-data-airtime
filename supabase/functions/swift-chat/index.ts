import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const SYS = `You are Blitzi, the AI assistant inside SwiftPay — a Nigerian fintech app.

CRITICAL RULES:
- NEVER introduce yourself or say "I'm Blitzi" unless the user explicitly asks who you are.
- NEVER start replies with "Hi!", "Hello!" or any greeting. Go straight to the answer.
- NEVER say "How can I help you?" at the end — the user already knows they can ask questions.
- Answer the user's actual question directly and helpfully.
- Keep replies concise but complete — don't truncate useful information.
- Always use Nigerian Naira (₦) for amounts.

What you know about SwiftPay:
- Wallet: funded via a dedicated Monnify virtual bank account (free, instant). Tap + on dashboard.
- Airtime: MTN, Airtel, Glo and 9Mobile. Min ₦50. Network auto-detected from phone prefix.
- Data bundles: daily, weekly and monthly plans. Blitz Prime shows the best value (₦ per GB) deals per network.
- SwiftPoints: earn 5 pts per ₦250 spent on airtime or data. 100 pts = 1GB free data reward.
- Electricity: select DISCO (EKEDC, IKEDC, AEDC etc.), Prepaid or Postpaid, verify meter number, then pay.
- Cable TV: DStv, GOtv, StarTimes. Enter smartcard/IUC number, verify, pick a package, confirm.
- Transaction PIN: 4-digit PIN required for every purchase. Set/change in Settings.
- Beneficiaries: save phone numbers for quick repeat purchases.
- History: full transaction log in the History tab.
- Failed transaction: wallet auto-refunded within 5-10 min. If not refunded after 30 min, email blitzpaysup@gmail.com with reference number.
- Support email: blitzpaysup@gmail.com`;

// FAQ fallback — used ONLY when Cerebras is unreachable
// NEVER introduces Blitzi — just answers the question directly
function getFallback(msg: string): string {
  const q = msg.toLowerCase();
  if (q.includes("wallet") || q.includes("fund") || q.includes("deposit") || q.includes("top up") || q.includes("balance"))
    return "Tap the + button on your dashboard to fund your wallet. You'll see your reserved bank account — transfer any amount and it reflects within minutes. Bank transfers are free.";
  if (q.includes("airtime"))
    return "Go to Airtime, enter the phone number (network auto-detects from the prefix), pick an amount (min \u20a650), confirm with your 4-digit PIN.";
  if (q.includes("data") || q.includes("bundle") || q.includes("gb") || q.includes("mb"))
    return "Tap Data, choose your network, check Blitz Prime for the best value plans (ranked by \u20a6 per GB), enter the phone number, confirm with PIN. You earn SwiftPoints on every purchase.";
  if (q.includes("pin") || q.includes("password"))
    return "To change your PIN, go to Settings \u2192 Change Transaction PIN. You'll need your current PIN. Your PIN is required for every purchase.";
  if (q.includes("point") || q.includes("swiftpoint") || q.includes("reward") || q.includes("redeem"))
    return "You earn 5 SwiftPoints per \u20a6250 spent on airtime or data. Hit 100 points and you can redeem 1GB of free data from the dashboard.";
  if (q.includes("electric") || q.includes("disco") || q.includes("meter") || q.includes("prepaid") || q.includes("postpaid"))
    return "Tap Electric \u2192 select your DISCO (e.g. EKEDC, IKEDC, AEDC) \u2192 choose Prepaid or Postpaid \u2192 enter your meter number \u2192 verify \u2192 enter amount \u2192 confirm with PIN.";
  if (q.includes("cable") || q.includes("dstv") || q.includes("gotv") || q.includes("startimes") || q.includes("tv"))
    return "Tap Cable TV \u2192 choose DStv, GOtv or StarTimes \u2192 enter your smartcard/IUC number \u2192 verify \u2192 select package \u2192 confirm with PIN.";
  if (q.includes("fail") || q.includes("error") || q.includes("refund") || q.includes("charged") || q.includes("not deliver"))
    return "If a transaction failed but your wallet was debited, it's automatically refunded within 5-10 minutes. If it's been more than 30 minutes, email blitzpaysup@gmail.com with your reference number.";
  if (q.includes("contact") || q.includes("support") || q.includes("email") || q.includes("help"))
    return "You can reach support at blitzpaysup@gmail.com — we typically respond within a few hours. You can also keep chatting here for instant answers.";
  // Generic fallback — still no self-introduction
  return "I can help with wallet funding, airtime, data bundles, electricity, cable TV, SwiftPoints, PINs and transactions. What specifically do you need?";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const CEREBRAS_KEY = Deno.env.get("CEREBRAS_API_KEY") ?? "";

  try {
    const { messages } = await req.json();
    const lastMsg = messages?.[messages.length - 1]?.content ?? "";

    if (CEREBRAS_KEY) {
      try {
        const r = await fetch("https://api.cerebras.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${CEREBRAS_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.3-70b",
            messages: [
              { role: "system", content: SYS },
              ...(messages || [])
            ],
            max_tokens: 800,
            temperature: 0.6,
            top_p: 0.9,
          }),
          signal: AbortSignal.timeout(12000),
        });

        if (r.ok) {
          const data = await r.json();
          const reply = data.choices?.[0]?.message?.content?.trim();
          if (reply) {
            return new Response(JSON.stringify({ reply }), {
              headers: { ...cors, "Content-Type": "application/json" }
            });
          }
        } else {
          const errText = await r.text();
          console.error("Cerebras error:", r.status, errText.slice(0, 300));
        }
      } catch (aiErr) {
        console.error("Cerebras unreachable:", aiErr instanceof Error ? aiErr.message : String(aiErr));
      }
    } else {
      console.warn("CEREBRAS_API_KEY not configured");
    }

    // FAQ fallback — never introduces Blitzi
    return new Response(JSON.stringify({ reply: getFallback(lastMsg) }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });

  } catch (e: any) {
    console.error("swift-chat error:", e?.message);
    return new Response(JSON.stringify({ reply: "Something went wrong on my end. Please try again or email blitzpaysup@gmail.com." }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
