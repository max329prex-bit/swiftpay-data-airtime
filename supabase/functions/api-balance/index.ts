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
      
      // Verify key
      const { data: keyData } = await supa.rpc("verify_api_key", { _api_key: apiKey });
      if (!keyData || !keyData[0]) return new Response(JSON.stringify({ success: false, error: "Invalid API key" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      
      const userId = keyData[0].user_id;
      const keyId = keyData[0].key_id;
      
      // Update last used
      await supa.rpc("update_api_key_last_used", { _key_id: keyId });
      
      // Get balance
      const { data: wallet } = await supa.from("wallets").select("balance").eq("user_id", userId).single();
      
      return new Response(JSON.stringify({
        success: true,
        balance: wallet?.balance ?? 0,
        currency: "NGN"
      }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  });
  