import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
  import { createClient } from "npm:@supabase/supabase-js@2";
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key" };
  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const apiKey = req.headers.get("x-api-key");
      if (!apiKey) return json({ success: false, error: "Missing x-api-key header" }, 401);
      const supa = createClient(SUPA_URL, SUPA_SVC, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data: keyData } = await supa.rpc("verify_api_key", { _api_key: apiKey });
      if (!keyData?.[0]) return json({ success: false, error: "Invalid API key" }, 401);
      await supa.rpc("update_api_key_last_used", { _key_id: keyData[0].key_id });
      const { data: packages } = await supa.from("packages").select("id,name,network,size,validity,price,provider_code,is_active,is_blitz_prime,sort_order,tier,cost_price,health_score").eq("is_active", true).order("sort_order", { ascending: true });
      const plans = (packages || []).map(p => ({
        id: p.id, name: p.name, network: p.network, size: p.size, validity: p.validity,
        price: Number(p.price), api_price: Math.round(Number(p.price) * 0.98 * 100) / 100,
        discount: "2%", provider: p.provider_code, available: p.is_active, health_score: p.health_score
      }));
      return json({ success: true, plans });
    } catch (e: any) { return json({ success: false, error: e.message }, 500); }
  });
  function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } }); }