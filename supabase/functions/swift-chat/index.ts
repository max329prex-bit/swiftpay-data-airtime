import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

async function tryModel(key: string, model: string): Promise<{ ok: boolean; status: number; body: string; time: number }> {
  const t0 = Date.now();
  try {
    const r = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "say hi" }], max_tokens: 10 }),
      signal: AbortSignal.timeout(8000),
    });
    const body = await r.text();
    return { ok: r.ok, status: r.status, body: body.slice(0, 300), time: Date.now() - t0 };
  } catch(e: any) {
    return { ok: false, status: 0, body: e?.message ?? "timeout/network error", time: Date.now() - t0 };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const key = Deno.env.get("CEREBRAS_API_KEY") ?? "";
  const models = ["llama3.3-70b", "llama3.1-70b", "llama3.1-8b", "llama-3.3-70b"];
  const results: Record<string, any> = {};
  for (const m of models) {
    results[m] = await tryModel(key, m);
  }
  return new Response(JSON.stringify({ key_prefix: key.slice(0,8), results }), { headers: { ...cors, "Content-Type": "application/json" } });
});
