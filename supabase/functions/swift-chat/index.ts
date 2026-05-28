import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const SUPA_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPA_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const BASE_SYS = `You are Blitzi, the AI assistant inside BlitzPay — a Nigerian fintech app for buying airtime, data, electricity and cable TV.

CRITICAL RULES:
- NEVER introduce yourself unless asked.
- NEVER start with "Hi!", "Hello!" or greetings. Go straight to the answer.
- NEVER end with "How can I help you?" — they already know.
- Answer the user's actual question DIRECTLY and helpfully.
- Keep replies concise. Use ₦ for Naira.
- If the user has account context (balance, recent transactions), reference it naturally.
- If a transaction failed or is pending, acknowledge it and explain next steps clearly.

What you know about BlitzPay:
- Wallet: funded via Korapay bank transfer. User pays deposit amount + 2% processing fee. Reflects within minutes.
- Airtime: MTN, Airtel, Glo, 9Mobile. Min ₦50. Network auto-detected from phone prefix.
- Data bundles: daily, weekly, monthly plans. Blitz Prime shows best value (₦/GB) per network.
- BlitzPoints: earn 5 pts per ₦250 on airtime/data. 100 pts = 1GB free data.
- Electricity: select DISCO → Prepaid/Postpaid → enter meter number → verify → pay.
- Cable TV: DStv, GOtv, StarTimes → smartcard/IUC number → verify → pick package.
- Transaction PIN: 4-digit PIN required for every purchase. Set/change in Settings.
- Failed/refunded: wallet auto-refunded within 5-10 min. If not after 30 min, email blitzpaysup@gmail.com.
- Support: blitzpaysup@gmail.com`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const CEREBRAS_KEY = Deno.env.get("CEREBRAS_API_KEY") ?? "";

  try {
    const body = await req.json();

    // Support BOTH formats:
    // AppShell sends { messages: [...] } with full history
    // Legacy: { message: "..." } single string
    let messages: Array<{ role: string; content: string }> = [];
    if (Array.isArray(body.messages) && body.messages.length > 0) {
      messages = body.messages;
    } else if (body.message) {
      messages = [{ role: "user", content: String(body.message) }];
    }

    if (messages.length === 0) {
      return new Response(JSON.stringify({ reply: "I didn't receive your message. Please try again." }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    // Build personalized system prompt with user account context
    let sysPrompt = BASE_SYS;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const uc = createClient(SUPA_URL, SUPA_ANON, { global: { headers: { Authorization: authHeader } } });
        const { data: { user } } = await uc.auth.getUser();
        if (user) {
          // Get wallet balance
          const { data: wallet } = await uc.from("wallets").select("balance, refund_balance").eq("user_id", user.id).maybeSingle();
          // Get recent transactions
          const { data: txs } = await uc.from("transactions")
            .select("type, network, amount, status, reference, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(5);
          // Get swift points
          const { data: profile } = await uc.from("profiles").select("full_name, swift_points").eq("user_id", user.id).maybeSingle();

          const balance = wallet?.balance ?? 0;
          const refund = wallet?.refund_balance ?? 0;
          const pts = profile?.swift_points ?? 0;
          const name = profile?.full_name?.split(" ")[0] || "the user";

          let accountCtx = `\n\nUSER ACCOUNT CONTEXT (${name}):`;
          accountCtx += `\n- Wallet balance: ₦${Number(balance).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
          if (refund > 0) accountCtx += `\n- Refund balance: ₦${Number(refund).toLocaleString("en-NG", { minimumFractionDigits: 2 })} (pending credit)`;
          accountCtx += `\n- BlitzPoints: ${pts} pts`;
          if (txs && txs.length > 0) {
            accountCtx += `\n- Recent transactions:`;
            for (const tx of txs.slice(0, 3)) {
              const date = new Date(tx.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
              accountCtx += `\n  * ${tx.type} ${tx.network || ""} ₦${tx.amount} — ${tx.status} (${date}, ref: ${tx.reference})`;
            }
          }
          sysPrompt = BASE_SYS + accountCtx;
        }
      } catch {
        // auth context optional — proceed without it
      }
    }

    if (!CEREBRAS_KEY) {
      return new Response(JSON.stringify({ reply: "Blitzi AI is temporarily unavailable. Email blitzpaysup@gmail.com for support." }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    const r = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${CEREBRAS_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-oss-120b",
        messages: [{ role: "system", content: sysPrompt }, ...messages],
        max_tokens: 2000,
        temperature: 0.65,
        top_p: 0.9,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (r.ok) {
      const data = await r.json();
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (reply) {
        return new Response(JSON.stringify({ reply }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      }
    }

    const errText = await r.text().catch(() => "");
    console.error("Cerebras error:", r.status, errText.slice(0, 200));
    return new Response(JSON.stringify({ reply: "I'm having trouble connecting right now. Please email blitzpaysup@gmail.com if it's urgent." }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });

  } catch (e: unknown) {
    console.error("swift-chat error:", e);
    return new Response(JSON.stringify({ reply: "Something went wrong. Please try again or email blitzpaysup@gmail.com." }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
