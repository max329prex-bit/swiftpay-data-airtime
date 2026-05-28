import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const AIDAPAY_BASE  = "https://www.aidapay.ng/api/v1";
const AIDAPAY_TOKEN = Deno.env.get("AIDAPAY_TOKEN")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const r = await fetch(`${AIDAPAY_BASE}/service/meter-token`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${AIDAPAY_TOKEN}` },
      signal: AbortSignal.timeout(15000),
    });
    const d = await r.json();
    if (!d.success || !Array.isArray(d.data)) {
      return new Response(JSON.stringify({ success: false, providers: [], error: d.message }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    // Map to { name, code } shape for the frontend
    const providers = (d.data as Array<{ provider_name: string; provider_code: string }>).map(p => ({
      name: p.provider_name,
      code: p.provider_code,
    }));
    return new Response(JSON.stringify({ success: true, providers }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, providers: [], error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
