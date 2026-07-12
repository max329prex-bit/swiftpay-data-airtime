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
      const { user_id, api_key_id } = keyData[0];
      await supa.rpc("update_api_key_last_used", { _key_id: api_key_id });
      const { data: wallet } = await supa.from("wallets").select("balance").eq("user_id", user_id).single();
      return json({ success: true, balance: wallet?.balance ?? 0, currency: "NGN" });
    } catch (e: any) { return json({ success: false, error: e.message }, 500); }
  });
  function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } }); }