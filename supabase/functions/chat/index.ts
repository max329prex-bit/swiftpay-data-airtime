import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const SYS = `You are Blitzi, the friendly AI assistant for BlitzPay — a Nigerian fintech app.
Help users with: wallet balance, buying airtime/data, paying electricity/cable bills, wallet funding, and account support.
Always use Naira (₦). Be warm and concise.
IMPORTANT: You only know about BlitzPay's services. You have no knowledge of any external vendors, providers, or third-party services. BlitzPay is a self-contained platform.`;

// Regex that catches all common variations case-insensitively
const BLOCKED_REGEX = /g[\s\-_]?subz|iacafe|ia[\s\-_]?cafe|bsplug|bs[\s\-_]?plug|clubkonnect|n3tdata|husmodata|megasubz|mega[\s\-_]?subz|datastation|smeplug|sme[\s\-_]?plug|tmssubscribe|vtpass|vt[\s\-_]?pass|topgosubz|fastsubz/gi;

// Keywords that signal a "who is your provider" type question
const PROVIDER_QUESTION_REGEX = /\b(provider|vendor|supplier|partner|aggregator|vtu\s+provider|third.?party|backend|infrastructure|powered by|who (do|does|are)|what (company|service|api|platform) (do|does)|which (company|service|api|platform))\b/i;

const SAFE_REPLY = "BlitzPay handles all services through our own platform and network. Is there anything else I can help you with? 😊";

function sanitizeText(text: string): string {
  return text.replace(BLOCKED_REGEX, "[BlitzPay]");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const CEREBRAS_KEY = Deno.env.get("CEREBRAS_API_KEY") ?? "";

  try {
    const { messages } = await req.json();
    const msgList: { role: string; content: string }[] = messages || [];

    // Layer 1: Check if the latest user message is asking about providers
    const lastUserMsg = [...msgList].reverse().find(m => m.role === "user");
    if (lastUserMsg && PROVIDER_QUESTION_REGEX.test(lastUserMsg.content)) {
      return new Response(JSON.stringify({ reply: SAFE_REPLY }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    // Layer 2: Scrub any provider names from the message history before sending to LLM
    const cleanMessages = msgList.map(m => ({
      ...m,
      content: sanitizeText(m.content)
    }));

    const r = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CEREBRAS_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b",
        messages: [{ role: "system", content: SYS }, ...cleanMessages],
        max_tokens: 512,
        temperature: 0.2
      })
    });

    const data = await r.json();
    let reply: string = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't respond.";

    // Layer 3: Hard post-filter on the LLM output
    if (BLOCKED_REGEX.test(reply)) {
      reply = SAFE_REPLY;
    }

    return new Response(JSON.stringify({ reply }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
