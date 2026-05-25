import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const SYS = "You are Swift, the friendly AI assistant for BlitzPay, a Nigerian fintech app. Help with wallet top-up, airtime, data, electricity and cable TV purchases. Be concise and warm. Use Naira for amounts.";

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
        temperature: 0.7
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
