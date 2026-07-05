import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const SUPA_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPA_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPA_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BASE_SYS = `You are Blitzi, the AI assistant inside BlitzPay — a Nigerian fintech app for buying airtime, data, electricity and cable TV.

CRITICAL RULES:
- NEVER introduce yourself unless asked.
- NEVER start with "Hi!", "Hello!" or greetings. Go straight to the answer.
- NEVER end with "How can I help you?" — they already know.
- Answer the user's actual question DIRECTLY and helpfully.
- Keep replies concise. Use ₦ for Naira.
- NO markdown formatting. NEVER use **bold**, *italic*, or # headers. Plain text only.
- For numbered steps, put each step on its own line (use actual line breaks, not all in one paragraph).
- If the user has account context (balance, recent transactions), reference it naturally.
- If a transaction failed or is pending, acknowledge it and explain next steps clearly.
- If you cannot solve a user's issue (especially a failed transaction), you MUST create a support ticket by including this exact marker in your response: [CREATE_TICKET: {"intent":"failed_transaction","message":"<summary>"}]

What you know about BlitzPay:
- Wallet: funded via PayVessel virtual bank account (bank transfer). User deposits directly to their assigned account number. A 1.5% processing fee is deducted. Balance reflects within minutes after transfer.
- Airtime: MTN, Airtel, Glo, 9Mobile. Min ₦50. Network auto-detected from phone prefix. Primary provider: GSubz.
- Data bundles: daily, weekly, monthly plans. Blitz Prime shows best value (₦/GB) per network.
- BlitzPoints: earn 2 pts per ₦250 on DATA purchases only. 100 pts = 1GB free data reward. Airtime does NOT earn BlitzPoints.
- Electricity: select DISCO (Ikeja, Eko, Abuja, etc.) → Prepaid/Postpaid → enter meter number → verify → pay. Primary provider: IACafe.
- Cable TV: DStv, GOtv, StarTimes → smartcard/IUC number → verify → pick package → pay. Primary provider: GSubz.
- Transaction PIN: 4-digit PIN required for every purchase. Set/change in Settings.
- Failed/refunded: wallet auto-refunded within 5-10 min. If not after 30 min, email blitzpaysup@gmail.com.
- Support: blitzpaysup@gmail.com or use Send Ticket in the Support page.
- Providers: GSubz (primary for airtime, data, cable), IACafe (primary for electricity, data fallback), BSPlug (data fallback).`;

async function fetchPackages(admin: ReturnType<typeof createClient>): Promise<string> {
  try {
    const { data } = await admin.from("packages")
      .select("name, size, validity, price, network, package_code, provider_code")
      .eq("active", true)
      .order("price", { ascending: true })
      .limit(60);
    if (!data || data.length === 0) return "";
    const byNetwork: Record<string, string[]> = {};
    for (const p of data) {
      const net = (p.network || "OTHER").toUpperCase();
      if (!byNetwork[net]) byNetwork[net] = [];
      const line = `  ${p.name} (${p.size}, ${p.validity}) — ₦${p.price} — code: ${p.package_code} — provider: ${p.provider_code}`;
      byNetwork[net].push(line);
    }
    let out = "\n\nACTIVE DATA PLANS:";
    for (const [net, lines] of Object.entries(byNetwork)) {
      out += `\n${net}:\n${lines.slice(0, 12).join("\n")}`;
    }
    return out;
  } catch { return ""; }
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
    let sysPrompt = BASE_SYS;
    let userId: string | null = null;
    let ticketRef: string | null = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const uc = createClient(SUPA_URL, SUPA_ANON, { global: { headers: { Authorization: authHeader } } });
        const { data: { user } } = await uc.auth.getUser();
        if (user) {
          userId = user.id;
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
          accountCtx += `\n- BlitzPoints: ${pts} pts (earn 2 pts per ₦250 on data)`;
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
        // auth context optional
      }
    }

    // Add active data plans to system prompt
    const packagesCtx = await fetchPackages(admin);
    if (packagesCtx) sysPrompt += packagesCtx;

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
        const tRef = await createTicket(admin, userId, ticketData.intent || "other", ticketData.message || "User needs support");
        if (tRef) {
          ticketRef = tRef;
          reply = reply.replace(ticketMatch[0], `\n\nSupport ticket created: ${tRef}. Our team will review it within 24h.`).trim();
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
