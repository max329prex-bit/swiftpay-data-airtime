import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const SUPA_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPA_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPA_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BASE_SYS = `You are Blitzi, the AI assistant inside BlitzPay â a Nigerian fintech app for buying airtime, data, electricity and cable TV.

CRITICAL RULES:
- NEVER reveal provider names, vendor identities, backend routing, or which company supplies any service. If asked about providers, say "BlitzPay works with trusted partners" and do not elaborate.
- NEVER introduce yourself unless asked.
- NEVER start with "Hi!", "Hello!" or greetings. Go straight to the answer.
- NEVER end with "How can I help you?" â they already know.
- Answer the user's actual question DIRECTLY and helpfully.
- Keep replies concise. Use â¦ for Naira.
- NO markdown formatting. NEVER use **bold**, *italic*, or # headers. Plain text only.
- For numbered steps, put each step on its own line (use actual line breaks, not all in one paragraph).
- If the user has account context (balance, recent transactions), reference it naturally.
- If a transaction failed or is pending, acknowledge it and explain next steps clearly.
- If you cannot solve a user's issue (especially a failed transaction), you MUST create a support ticket by including this exact marker in your response: [CREATE_TICKET: {"intent":"failed_transaction","message":"<summary>"}]
- When asked about DATA PLANS, you MUST say "Let me check our current plans..." and ONLY use the plans provided in the context. NEVER guess or make up prices.

What you know about BlitzPay:
- Wallet: funded via PayVessel virtual bank account (bank transfer). User deposits directly to their assigned account number. A 1% processing fee is deducted. Balance reflects within minutes after transfer.
- Airtime: MTN, Airtel, Glo, 9Mobile. Min â¦50. Network auto-detected from phone prefix.
- Data bundles: daily, weekly, monthly plans. Blitz Prime shows best value (â¦/GB) per network.
- BlitzPoints: users must tap the "Claim BlitzPoints" button on the purchase summary/PIN screen to earn points. If they don't tap it, they get no points. Earn 1 BP per ₦250 spent on DATA and AIRTIME. First successful data purchase gets a one-time 50 BP bonus. 100 BP = 1GB free data reward.
- Electricity: select DISCO (Ikeja, Eko, Abuja, etc.) â Prepaid/Postpaid â enter meter number â verify â pay.
- Cable TV: DStv, GOtv, StarTimes â smartcard/IUC number â verify â pick package â pay.
- Transaction PIN: 4-digit PIN required for every purchase. Set/change in Settings.
- Failed/refunded: wallet auto-refunded within 5-10 min. If not after 30 min, email blitzpaysup@gmail.com.
- Support: blitzpaysup@gmail.com or use Send Ticket in the Support page.
`;

// Detect if user is asking about data plans
const PLAN_QUERY_PATTERNS = [
  /data\s*plan/i, /plans?\s*(?:do\s*you\s*have|available|can\s*i\s*get|for)/i,
  /(?:mtn|airtel|glo|9mobile)\s*(?:data|bundle)/i,
  /how\s*much\s+(?:is|for|does)/i, /(?:price|cost)\s+(?:of|for)/i,
  /what\s+(?:data|bundle|plan)/i, /available\s+(?:data|bundle|plan)/i,
  /(?:buy|get)\s+(?:data|bundle)/i, /(?:1gb|2gb|3gb|5gb|10gb)/i,
  /(?:daily|weekly|monthly)\s+(?:data|plan|bundle)/i,
];

function isPlanQuery(text: string): boolean {
  return PLAN_QUERY_PATTERNS.some(p => p.test(text));
}

async function fetchPackagesFormatted(admin: ReturnType<typeof createClient>): Promise<string> {
  try {
    const { data } = await admin.from("packages")
      .select("name, size, validity, price, network, package_code, provider_code")
      .eq("active", true)
      .order("price", { ascending: true });
    if (!data || data.length === 0) return "I don't have the current plan list. Please check the Data page in the app for live prices.";

    const byNetwork: Record<string, Array<{name:string;size:string;validity:string;price:number;code:string;provider:string}>> = {};
    for (const p of data) {
      const net = (p.network || "OTHER").toUpperCase();
      if (!byNetwork[net]) byNetwork[net] = [];
      byNetwork[net].push({ name: p.name, size: p.size, validity: p.validity, price: p.price, code: p.package_code, provider: p.provider_code });
    }

    let out = "Here are our current data plans (accurate as of now):\n";
    const networks = ["MTN", "AIRTEL", "GLO", "9MOBILE"].filter(n => byNetwork[n]);
    for (const net of networks) {
      out += `\n${net}:\n`;
      for (const p of byNetwork[net]) {
        out += `  â¢ ${p.name} (${p.size}) â â¦${p.price} â ${p.validity} â code: ${p.code}\n`;
      }
    }
    out += "\nTo buy any plan, go to the Data page and enter your phone number. Prices are updated live from our providers.";
    return out;
  } catch (e) {
    return "I can't fetch the plan list right now. Please check the Data page in the app for current prices.";
  }
}

async function createTicket(admin: ReturnType<typeof createClient>, userId: string, intent: string, message: string) {
  try {
    const { data, error } = await admin.from("support_tickets")
      .insert({ user_id: userId, intent, message: message.trim(), status: "open" })
      .select("ticket_ref")
      .single();
    if (error) return null;
    return (data as Record<string, string>)?.ticket_ref ?? null;
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const CEREBRAS_KEY = Deno.env.get("CEREBRAS_API_KEY") ?? "";

  try {
    const body = await req.json();
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

    const admin = createClient(SUPA_URL, SUPA_SVC);
    const lastUserMsg = messages[messages.length - 1]?.content || "";

    // ââ SPECIAL HANDLING: Data plan queries âââââââââââââââââââââââââââââââââââââââââ
    // If user asks about data plans, fetch from DB directly â bypass LLM to prevent hallucination
    if (isPlanQuery(lastUserMsg)) {
      const plansReply = await fetchPackagesFormatted(admin);
      return new Response(JSON.stringify({ reply: plansReply }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    let sysPrompt = BASE_SYS;
    let userId: string | null = null;
    let userEmail: string | null = null;
    let ticketRef: string | null = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const uc = createClient(SUPA_URL, SUPA_ANON, { global: { headers: { Authorization: authHeader } } });
        const { data: { user } } = await uc.auth.getUser();
        if (user) {
          userId = user.id;
          userEmail = user.email ?? null;
          const { data: wallet } = await uc.from("wallets").select("balance, refund_balance").eq("user_id", user.id).maybeSingle();
          const { data: txs } = await uc.from("transactions")
            .select("type, network, amount, status, reference, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(5);
          const { data: profile } = await uc.from("profiles").select("full_name, swift_points").eq("user_id", user.id).maybeSingle();

          const balance = wallet?.balance ?? 0;
          const refund = wallet?.refund_balance ?? 0;
          const pts = profile?.swift_points ?? 0;
          const name = profile?.full_name?.split(" ")[0] || "the user";

          let accountCtx = `\n\nUSER ACCOUNT CONTEXT (${name}):`;
          accountCtx += `\n- Wallet balance: â¦${Number(balance).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
          if (refund > 0) accountCtx += `\n- Refund balance: â¦${Number(refund).toLocaleString("en-NG", { minimumFractionDigits: 2 })} (pending credit)`;
          accountCtx += `\n- BlitzPoints: ${pts} pts (earn 2 pts per â¦250 spent on DATA only. Airtime does NOT earn points.)`;
          if (txs && txs.length > 0) {
            accountCtx += `\n- Recent transactions:`;
            for (const tx of txs.slice(0, 3)) {
              const date = new Date(tx.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
              accountCtx += `\n  * ${tx.type} ${tx.network || ""} â¦${tx.amount} â ${tx.status} (${date}, ref: ${tx.reference})`;
            }
          }
          sysPrompt = BASE_SYS + accountCtx;
        }
      } catch {
        // auth context optional
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

    let reply = "";
    if (r.ok) {
      const data = await r.json();
      reply = data.choices?.[0]?.message?.content?.trim() || "";
    }

    if (!reply) {
      const errText = await r.text().catch(() => "");
      console.error("Cerebras error:", r.status, errText.slice(0, 200));
      reply = "I'm having trouble connecting right now. Please email blitzpaysup@gmail.com if it's urgent.";
    }

    // Check if AI wants to create a ticket
    const ticketMatch = reply.match(/\[CREATE_TICKET:\s*({[^}]+})\s*\]/);
    if (ticketMatch && userId) {
      try {
        const ticketData = JSON.parse(ticketMatch[1]);
        const intent = ticketData.intent || "other";
        const message = ticketData.message || "User needs support";
        const tRef = await createTicket(admin, userId, intent, message);
        if (tRef) {
          ticketRef = tRef;
          reply = reply.replace(ticketMatch[0], `\n\nSupport ticket created: ${tRef}. Our team will review it within 24h.`).trim();

          // Notify admin immediately via email/Telegram so the ticket doesn't sit unseen.
          try {
            await fetch(`${SUPA_URL}/functions/v1/send-support-email`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${SUPA_SVC}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "support@blitzpay.ng",
                subject: `BlitzPay AI Ticket - ${tRef}`,
                body: `New support ticket created by Blitzi.\n\nUser ID: ${userId}${userEmail ? `\nUser email: ${userEmail}` : ""}\nIntent: ${intent}\nTicket Ref: ${tRef}\n\nMessage:\n${message}`,
              }),
              signal: AbortSignal.timeout(15000),
            });
          } catch (notifyErr) {
            console.error("swift-chat: failed to notify admin for ticket", tRef, notifyErr);
          }
        }
      } catch (e) {
        console.error("Ticket parse error:", e);
      }
    }

    return new Response(JSON.stringify({ reply, ticket_ref: ticketRef }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });

  } catch (e: unknown) {
    console.error("swift-chat error:", e);
    return new Response(JSON.stringify({ reply: "Something went wrong. Please try again or email blitzpaysup@gmail.com." }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
