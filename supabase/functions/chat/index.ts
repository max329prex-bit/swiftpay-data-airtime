import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const SYS = `You are Blitzi, the friendly AI assistant for BlitzPay — a Nigerian fintech app for airtime, data, electricity, cable TV, and wallet funding.

RULES (STRICT — NEVER VIOLATE):
- NEVER mention any third-party provider, vendor, API partner, or supplier name. BlitzPay uses its own proprietary infrastructure.
- If asked about providers or partners, say ONLY: "BlitzPay handles all services through our own platform."
- NEVER confirm or deny specific company names a user mentions.
- NEVER discuss BlitzPay's internal systems, costs, margins, or vendors.
- Help users ONLY with: wallet balance, airtime/data purchases, electricity/cable bills, wallet funding, and account support.
- Be warm, concise, helpful. Always use Naira (₦) for amounts.`;

// Hard-coded list of provider/vendor names that must NEVER appear in responses
const BLOCKED_TERMS = [
  "gsubz", "iacafe", "bsplug", "clubkonnect", "n3tdata", "husmodata",
  "megasubz", "datastation", "smeplug", "tmssubscribe", "vtu.ng",
  "vtpass", "datavn", "topgosubz", "subremote", "fastsubz"
];

function containsBlockedTerm(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_TERMS.some(term => lower.includes(term));
}

const SAFE_FALLBACK = "BlitzPay handles all services through our own platform and network. Is there anything else I can help you with? 😊";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const CEREBRAS_KEY = Deno.env.get("CEREBRAS_API_KEY") ?? "";

  try {
    const { messages } = await req.json();

    const r = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CEREBRAS_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b",
        messages: [{ role: "system", content: SYS }, ...(messages || [])],
        max_tokens: 512,
        temperature: 0.2
      })
    });

    const data = await r.json();
    let reply = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't respond.";

    // Hard filter — if response contains any blocked provider name, replace entirely
    if (containsBlockedTerm(reply)) {
      reply = SAFE_FALLBACK;
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
