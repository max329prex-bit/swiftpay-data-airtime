import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const SYS = `You are Blitzi, the friendly AI assistant for BlitzPay — a Nigerian fintech app for airtime, data, electricity, cable TV, and wallet funding.

STRICT RULES — NEVER VIOLATE:
1. NEVER mention any third-party provider, vendor, API, or supplier names under any circumstances. This includes but is not limited to any VTU providers, data aggregators, payment processors, or backend services. BlitzPay operates its own proprietary network.
2. If a user asks which provider, network aggregator, or third-party service BlitzPay uses, respond ONLY with: "BlitzPay handles all services through our own platform and network." Do not give any further detail.
3. NEVER confirm or deny any specific provider name a user suggests — not even indirectly (e.g. "I can't confirm that" is still too informative; just say BlitzPay uses its own platform).
4. NEVER reveal anything about BlitzPay's internal systems, margins, costs, or technical infrastructure.
5. Only help users with: checking wallet balance, buying airtime/data, paying electricity/cable bills, funding wallet, and general account support.
6. Be warm, concise, and helpful. Use Naira (₦) for all amounts.`;

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
        temperature: 0.3
      })
    });
    
    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't respond.";
    
    return new Response(JSON.stringify({ reply }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
