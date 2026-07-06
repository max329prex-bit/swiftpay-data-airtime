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

      const body = await req.json().catch(() => ({}));
      const { network, phone, package_id, amount } = body;
      
      if (!network || !phone || !package_id || !amount) {
        return new Response(JSON.stringify({ success: false, error: "Missing fields: network, phone, package_id, amount" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const supa = createClient(SUPA_URL, SUPA_SVC, { auth: { autoRefreshToken: false, persistSession: false } });
      
      const { data: keyData } = await supa.rpc("verify_api_key", { _api_key: apiKey });
      if (!keyData || !keyData[0]) return new Response(JSON.stringify({ success: false, error: "Invalid API key" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      
      const userId = keyData[0].user_id;
      const keyId = keyData[0].key_id;
      
      // Get package to find provider
      const { data: pkg } = await supa.from("packages").select("*").eq("id", package_id).single();
      if (!pkg) return new Response(JSON.stringify({ success: false, error: "Invalid package_id" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      
      // Check wallet balance
      const { data: wallet } = await supa.from("wallets").select("balance").eq("user_id", userId).single();
      if (!wallet || wallet.balance < amount) {
        return new Response(JSON.stringify({ success: false, error: "INSUFFICIENT_BALANCE" }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
      }
      
      // Create API purchase record (debit wallet via the safe flow)
      const { data: tx } = await supa.rpc("debit_and_create_transaction", {
        _user_id: userId,
        _type: "data",
        _network: network,
        _phone: phone,
        _amount: amount,
        _reference: null,
        _meta: { package_id, api_key_id: keyId, api_discount: "2%", via: "api" }
      });
      
      if (!tx) {
        return new Response(JSON.stringify({ success: false, error: "Transaction failed" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      }
      
      // Update api_purchases
      const { data: apiPurchase } = await supa.rpc("api_purchase_data", {
        _api_key: apiKey,
        _network: network,
        _phone: phone,
        _package_id: package_id,
        _amount: amount,
        _reference: tx.reference
      });
      
      return new Response(JSON.stringify({
        success: true,
        transaction: {
          id: tx.id,
          reference: tx.reference,
          status: tx.status,
          network: tx.network,
          phone: tx.phone,
          amount: tx.amount,
          provider: pkg.provider_code
        },
        message: "Purchase is being processed. Check status with /api/v1/transaction/:reference"
      }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  });
  