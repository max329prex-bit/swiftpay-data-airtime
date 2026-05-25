import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { messages } = await req.json();
    const lastMsg = messages?.[messages.length - 1]?.content ?? "";

    // Diagnostic endpoint — safe to expose (no secret values, just existence)
    if (lastMsg === "__diag__") {
      const key = Deno.env.get("CEREBRAS_API_KEY") ?? "";
      return new Response(JSON.stringify({
        reply: "__diag__",
        key_set: key.length > 0,
        key_length: key.length,
        key_prefix: key.length > 4 ? key.slice(0, 6) + "..." : "(empty)",
        all_env_keys: Object.keys(Deno.env.toObject()).filter(k => !k.includes("SUPABASE")).join(", ")
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const CEREBRAS_KEY = Deno.env.get("CEREBRAS_API_KEY") ?? "";
    if (!CEREBRAS_KEY) {
      return new Response(JSON.stringify({ reply: "CEREBRAS_API_KEY is not set in this function" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const r = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${CEREBRAS_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b",
        messages: [{ role: "system", content: "You are a helpful assistant." }, ...(messages || [])],
        max_tokens: 100,
      }),
      signal: AbortSignal.timeout(12000),
    });

    const body = await r.text();
    if (r.ok) {
      const data = JSON.parse(body);
      return new Response(JSON.stringify({ reply: data.choices?.[0]?.message?.content ?? "no content" }), { headers: { ...cors, "Content-Type": "application/json" } });
    } else {
      return new Response(JSON.stringify({ reply: `Cerebras error ${r.status}: ${body.slice(0, 200)}` }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ reply: `Exception: ${e?.message}` }), { headers: { ...cors, "Content-Type": "application/json" } });
  }
});
