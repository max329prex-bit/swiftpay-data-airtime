import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
  import { createClient } from "npm:@supabase/supabase-js@2";

  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };

  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    
    try {
      const apiKey = req.headers.get("x-api-key") || req.headers.get("X-API-Key");
      if (!apiKey) return new Response(JSON.stringify({ success: false, error: "Missing x-api-key header" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

      const supa = createClient(SUPA_URL, SUPA_SVC, { auth: { autoRefreshToken: false, persistSession: false } });
      
      const { data: keyData } = await supa.rpc("verify_api_key", { _api_key: apiKey });
      if (!keyData || !keyData[0]) return new Response(JSON.stringify({ success: false, error: "Invalid API key" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      
      const keyId = keyData[0].key_id;
      await supa.rpc("update_api_key_last_used", { _key_id: keyId });
      
      // Get active packages with 2% API discount
      const { data: packages } = await supa
        .from("packages")
        .select("id, name, network, size, validity, price, provider_code, is_active, is_blitz_prime, sort_order, tier")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      
      const plans = (packages || []).map(p => ({
        id: p.id,
        name: p.name,
        network: p.network,
        size: p.size,
        validity: p.validity,
        price: p.price,
        api_price: Math.round(p.price * 0.98 * 100) / 100,
        discount: "2%",
        provider: p.provider_code,
        available: p.is_active
      }));
      
      return new Response(JSON.stringify({ success: true, plans }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  });
  