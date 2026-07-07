import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
  import { createClient } from "npm:@supabase/supabase-js@2";
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key" };
  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GSUBZ_BASE = "https://api.gsubz.com/api";
  const GSUBZ_KEY = Deno.env.get("GSUBZ_API_KEY") ?? "";
  const GSUBZ_AIRTIME_MAP = { MTN: "mtn", AIRTEL: "airtel", GLO: "glo", "9MOBILE": "9mobile" };
  serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const apiKey = req.headers.get("x-api-key");
      if (!apiKey) return json({ success: false, error: "Missing x-api-key header" }, 401);
      const body = await req.json().catch(() => ({}));
      const { network, phone, package_id, amount } = body;
      if (!network || !phone || !package_id || !amount) return json({ success: false, error: "Missing fields: network, phone, package_id, amount" }, 400);
      const supa = createClient(SUPA_URL, SUPA_SVC, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data: keyData } = await supa.rpc("verify_api_key", { _api_key: apiKey });
      if (!keyData?.[0]) return json({ success: false, error: "Invalid API key" }, 401);
      const userId = keyData[0].user_id, keyId = keyData[0].key_id;
      const { data: pkg } = await supa.from("packages").select("*").eq("id", package_id).single();
      if (!pkg) return json({ success: false, error: "Invalid package_id" }, 400);
      const { data: wallet } = await supa.from("wallets").select("balance").eq("user_id", userId).single();
      if (!wallet || Number(wallet.balance) < Number(amount)) return json({ success: false, error: "INSUFFICIENT_BALANCE" }, 402);
      // Debit wallet and create transaction
      const { data: tx } = await supa.rpc("debit_and_create_transaction", {
        _user_id: userId, _type: "data", _network: network, _phone: phone,
        _amount: Number(amount), _reference: null,
        _meta: { package_id, api_key_id: keyId, api_discount: "2%", via: "api", provider_code: pkg.provider_code }
      });
      if (!tx) return json({ success: false, error: "Transaction failed" }, 500);
      const ref = tx.reference;
      await supa.from("api_purchases").insert({ api_key_id: keyId, user_id: userId, type: "data", network, phone, amount: Number(amount), package_id, status: "pending", reference: ref, provider_code: pkg.provider_code, meta: { package_name: pkg.name, size: pkg.size, validity: pkg.validity } });
      // Try to deliver via GSUBZ
      let providerResult = null;
      if (pkg.provider_code === "gsubz" && GSUBZ_KEY) {
        const service = network.toUpperCase() === "MTN" ? "mtn_sme" : GSUBZ_AIRTIME_MAP[network.toUpperCase()] || "mtn_sme";
        const gsubzRes = await fetch(`${GSUBZ_BASE}/pay/`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ serviceID: service, plan: pkg.provider_id || pkg.id, api: GSUBZ_KEY, phone, requestID: ref, amount: "" }) });
        const gsubzData = await gsubzRes.json().catch(() => ({}));
        providerResult = { provider: "partner", status: gsubzRes.ok ? "submitted" : "failed", response: gsubzData };
        if (gsubzRes.ok && gsubzData.status === "successful") {
          await supa.from("transactions").update({ status: "successful", provider_reference: gsubzData.transid || gsubzData.transactionId, updated_at: new Date().toISOString() }).eq("reference", ref);
          await supa.from("api_purchases").update({ status: "successful", provider_reference: gsubzData.transid || gsubzData.transactionId, updated_at: new Date().toISOString() }).eq("reference", ref);
        }
      }
      return json({
        success: true,
        transaction: { id: tx.id, reference: ref, status: providerResult?.status === "submitted" ? "processing" : "pending", network, phone, amount: Number(amount), provider: "partner" },
        provider_result: providerResult,
        message: "Purchase is being processed. Check status with GET /api/v1/transaction/:reference"
      });
    } catch (e: any) { return json({ success: false, error: e.message }, 500); }
  });
  function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } }); }