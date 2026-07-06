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

      const url = new URL(req.url);
      const ref = url.pathname.split("/").pop();
      if (!ref || ref === "transaction") {
        return new Response(JSON.stringify({ success: false, error: "Missing reference" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const supa = createClient(SUPA_URL, SUPA_SVC, { auth: { autoRefreshToken: false, persistSession: false } });
      
      const { data: keyData } = await supa.rpc("verify_api_key", { _api_key: apiKey });
      if (!keyData || !keyData[0]) return new Response(JSON.stringify({ success: false, error: "Invalid API key" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      
      const userId = keyData[0].user_id;
      const keyId = keyData[0].key_id;
      await supa.rpc("update_api_key_last_used", { _key_id: keyId });
      
      // Look up by reference in both tables
      const { data: tx } = await supa
        .from("transactions")
        .select("id, status, reference, network, phone, amount, provider_reference, meta, created_at, updated_at")
        .eq("reference", ref)
        .eq("user_id", userId)
        .single();
      
      if (!tx) {
        return new Response(JSON.stringify({ success: false, error: "Transaction not found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
      }
      
      return new Response(JSON.stringify({
        success: true,
        transaction: {
          id: tx.id,
          reference: tx.reference,
          status: tx.status,
          network: tx.network,
          phone: tx.phone,
          amount: tx.amount,
          provider_reference: tx.provider_reference,
          created_at: tx.created_at,
          updated_at: tx.updated_at,
          meta: tx.meta
        }
      }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  });
  