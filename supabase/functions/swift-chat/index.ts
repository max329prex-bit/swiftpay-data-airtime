import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const SYS = `You are Blitzi, the smart AI assistant built into SwiftPay — a Nigerian fintech app for airtime, data, electricity, cable TV and wallet management.

You know everything about SwiftPay:
- Users fund their wallet via a dedicated Monnify virtual bank account (free, instant bank transfer). Tap + on the dashboard.
- Airtime: supports MTN, Airtel, Glo and 9Mobile. Min ₦50. Phone number is auto-detected by prefix.
- Data bundles: daily, weekly and monthly plans across all 4 networks. Blitz Prime shows the absolute best price-per-GB deals. Users earn SwiftPoints on every purchase.
- SwiftPoints: earn 5 points per ₦250 spent on airtime or data. Redeem 100 points for 1GB free data.
- Electricity: select DISCO provider (EKEDC, IKEDC, AEDC, etc.), choose Prepaid or Postpaid, enter meter number, verify it, then pay any amount.
- Cable TV: supports DStv, GOtv and StarTimes. Enter smartcard/IUC number, verify, then pick a subscription package.
- Transaction PIN: required for every purchase. Set up in Settings → Change Transaction PIN.
- Beneficiaries: save numbers for quick repeat purchases.
- History: full transaction log available in the History tab.
- Support: email blitzpaysup@gmail.com or chat with Blitzi (that's me!).
- If a purchase fails, wallet is auto-refunded within 5–10 minutes. If not refunded after 30 min, contact support with your reference number.
- All amounts are in Nigerian Naira (₦).

Personality: warm, direct, knowledgeable. Answer the user's actual question — don't deflect or give generic responses. If you don't know something specific (like a live balance or transaction status), tell them honestly and guide them to where they can find it in the app. You can give multi-step instructions when needed. Never truncate a useful answer just to be brief.`;

// Smart keyword fallback — only used when Cerebras is unreachable
function getFallback(msg: string): string {
  const q = msg.toLowerCase();
  if (q.includes("wallet") || q.includes("fund") || q.includes("deposit") || q.includes("top up") || q.includes("balance"))
    return "To fund your wallet, tap the + button on your dashboard. You'll see your reserved bank account details — transfer any amount and it reflects automatically within minutes. There's no fee for bank transfers! \u{1F4B0}";
  if (q.includes("airtime"))
    return "To buy airtime: go to Airtime on the dashboard, enter the recipient phone number (the network auto-detects), pick an amount (min \u20A650), confirm with your 4-digit PIN. Done in seconds! \u26A1";
  if (q.includes("data") || q.includes("bundle") || q.includes("gb") || q.includes("mb"))
    return "To buy data: tap Data, choose a plan (check Blitz Prime for the best price-per-GB deals!), enter the phone number, confirm with your PIN. You earn SwiftPoints on every data purchase! \u{1F4F6}";
  if (q.includes("pin") || q.includes("password"))
    return "To set or change your PIN: go to Settings → Change Transaction PIN. You need your current PIN to change it. Your PIN is required for every purchase to keep your wallet secure. \u{1F510}";
  if (q.includes("point") || q.includes("swiftpoint") || q.includes("reward") || q.includes("redeem"))
    return "SwiftPoints: you earn 5 points per \u20A6250 spent on airtime or data. Hit 100 points and you can redeem 1GB of free data! Track your progress on the dashboard — the progress bar shows how close you are. \u{1F3C6}";
  if (q.includes("electric") || q.includes("disco") || q.includes("meter") || q.includes("prepaid") || q.includes("postpaid"))
    return "For electricity: tap Electric on the dashboard → select your DISCO (e.g. EKEDC, IKEDC, AEDC) → choose Prepaid or Postpaid → enter your meter number → verify it → enter the amount → confirm with PIN. \u26A1";
  if (q.includes("cable") || q.includes("dstv") || q.includes("gotv") || q.includes("startimes") || q.includes("tv"))
    return "For cable TV: tap Cable TV → choose DStv, GOtv or StarTimes → enter your smartcard/IUC number → verify → select your package → confirm with PIN. \u{1F4FA}";
  if (q.includes("fail") || q.includes("error") || q.includes("refund") || q.includes("charged") || q.includes("not deliver"))
    return "If a transaction failed but your wallet was debited, it's automatically refunded within 5–10 minutes. If it's been more than 30 minutes with no refund, email blitzpaysup@gmail.com with your reference number and we'll resolve it quickly. \u{1F6E1}\uFE0F";
  if (q.includes("contact") || q.includes("support") || q.includes("email") || q.includes("help"))
    return "You can reach our support team at blitzpaysup@gmail.com — we respond within a few hours. For instant help, just keep chatting with me here! \u{1F4E7}";
  return "I'm Blitzi, your SwiftPay assistant! \u{1F60A} I can help with wallet funding, airtime, data bundles, electricity, cable TV, SwiftPoints and anything else about the app. What do you need help with?";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const CEREBRAS_KEY = Deno.env.get("CEREBRAS_API_KEY") ?? "";

  try {
    const { messages } = await req.json();
    const lastMsg = messages?.[messages.length - 1]?.content ?? "";

    // Cerebras AI — llama-3.3-70b with full context
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
            temperature: 0.65,
            top_p: 0.9,
          }),
          signal: AbortSignal.timeout(12000), // 12-second timeout
        });

        if (r.ok) {
          const data = await r.json();
          const reply = data.choices?.[0]?.message?.content;
          if (reply) {
            return new Response(JSON.stringify({ reply: reply.trim() }), {
              headers: { ...cors, "Content-Type": "application/json" }
            });
          }
        } else {
          const errText = await r.text();
          console.error("Cerebras error:", r.status, errText.slice(0, 200));
        }
      } catch (aiErr) {
        console.error("Cerebras unreachable:", aiErr instanceof Error ? aiErr.message : aiErr);
        // Fall through to FAQ fallback
      }
    } else {
      console.warn("CEREBRAS_API_KEY not set — using FAQ fallback");
    }

    // FAQ fallback — always gives a useful response
    const reply = getFallback(lastMsg);
    return new Response(JSON.stringify({ reply }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });

  } catch (e: any) {
    console.error("swift-chat error:", e?.message);
    return new Response(JSON.stringify({ reply: "I ran into a small issue! Please try again or email blitzpaysup@gmail.com \u{1F60A}" }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
