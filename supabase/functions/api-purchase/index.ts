import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key" };
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GSUBZ_BASE = "https://api.gsubz.com/api";
const GSUBZ_KEY = Deno.env.get("GSUBZ_API_KEY") ?? "";
const IACAFE_BASE = "https://iacafe.com.ng/devapi/v1";
const IACAFE_TOKEN = Deno.env.get("IACAFE_TOKEN") ?? "";

const GSUBZ_AIRTIME_MAP = { MTN: "mtn", AIRTEL: "airtel", GLO: "glo", "9MOBILE": "9mobile" };

interface PR { success: boolean; ref?: string; msg?: string; }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) return json({ success: false, error: "Missing x-api-key header" }, 401);
    const body = await req.json().catch(() => ({}));
    const type = body.type || "data";

    const supa = createClient(SUPA_URL, SUPA_SVC, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: keyData } = await supa.rpc("verify_api_key", { _api_key: apiKey });
    if (!keyData?.[0]) return json({ success: false, error: "Invalid API key" }, 401);

    const userId = keyData[0].user_id, keyId = keyData[0].key_id;
    const { data: wallet } = await supa.from("wallets").select("balance").eq("user_id", userId).single();

    let network = body.network || "";
    let phone = body.phone || "";
    let amount = Number(body.amount || 0);
    let packageId = body.package_id || body.package_id || "";
    let providerCode = body.provider_code || "";
    let packageCode = body.package_code || "";
    let meterNumber = body.meter_number || "";
    let smartcard = body.smartcard || body.phone || "";
    let meta: Record<string, unknown> = {};

    let txType = type;
    let txPhone = phone;
    let txNetwork = network;

    if (type === "electricity") {
      if (!providerCode || !meterNumber || !amount) return json({ success: false, error: "Missing fields: provider_code, meter_number, amount" }, 400);
      txPhone = meterNumber;
      txNetwork = providerCode;
      meta = { provider_code: providerCode, meter_number: meterNumber };
    } else if (type === "cable") {
      if (!providerCode || !smartcard || !amount || !packageCode) return json({ success: false, error: "Missing fields: provider_code, smartcard, package_code, amount" }, 400);
      txPhone = smartcard;
      txNetwork = providerCode;
      meta = { provider_code: providerCode, smartcard, package_code: packageCode };
    } else if (type === "airtime") {
      if (!network || !phone || !amount) return json({ success: false, error: "Missing fields: network, phone, amount" }, 400);
      if (amount < 100) return json({ success: false, error: "Airtime minimum is ₦100" }, 400);
      meta = { network, phone };
    } else if (type === "data") {
      if (!network || !phone || !packageId || !amount) return json({ success: false, error: "Missing fields: network, phone, package_id, amount" }, 400);
      meta = { package_id: packageId };
    } else {
      return json({ success: false, error: "Unsupported type. Use data, airtime, electricity, or cable" }, 400);
    }

    let dataPackage: Record<string, unknown> | null = null;
    if (type === "data") {
      const { data: pkg } = await supa.from("packages").select("*").eq("id", packageId).single();
      if (!pkg) return json({ success: false, error: "Invalid package_id" }, 400);
      dataPackage = pkg;
    }

    if (!wallet || Number(wallet.balance) < amount) return json({ success: false, error: "INSUFFICIENT_BALANCE" }, 402);

    const { data: tx } = await supa.rpc("debit_and_create_transaction", {
      _user_id: userId, _type: txType, _network: txNetwork, _phone: txPhone,
      _amount: amount, _reference: null,
      _meta: { ...meta, api_key_id: keyId, api_discount: "2%", via: "api" }
    });
    // API purchases bypass the app claim UI, so they do NOT earn BlitzPoints.
    if (!tx) return json({ success: false, error: "Transaction failed" }, 500);
    const ref = tx.reference;

    await supa.from("api_purchases").insert({
      api_key_id: keyId, user_id: userId, type: txType, network: txNetwork, phone: txPhone,
      amount, package_id: packageId || null, status: "pending", reference: ref, provider_code: providerCode || "gsubz",
      meta: { ...meta, package_name: type === "data" ? packageId : packageCode }
    });

    let providerResult: { provider: string; status: string; response?: unknown } | null = null;
    let pr: PR = { success: false, msg: "No provider matched" };

    if (type === "data") {
      const pkg = dataPackage!;
      if (pkg.provider_code === "gsubz" && GSUBZ_KEY) {
        const service = network.toUpperCase() === "MTN" ? "mtn_sme" : GSUBZ_AIRTIME_MAP[network.toUpperCase()] || "mtn_sme";
        const gsubzRes = await fetch(`${GSUBZ_BASE}/pay/`, {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ serviceID: service, plan: pkg.provider_id || pkg.id, api: GSUBZ_KEY, phone, requestID: ref, amount: "" })
        });
        const gsubzData = await gsubzRes.json().catch(() => ({}));
        providerResult = { provider: "partner", status: gsubzRes.ok ? "submitted" : "failed", response: gsubzData };
        if (gsubzRes.ok && gsubzData.status === "successful") {
          await supa.from("transactions").update({ status: "successful", provider_reference: gsubzData.transid || gsubzData.transactionId, updated_at: new Date().toISOString() }).eq("reference", ref);
          await supa.from("api_purchases").update({ status: "successful", provider_reference: gsubzData.transid || gsubzData.transactionId, updated_at: new Date().toISOString() }).eq("reference", ref);
        }
        pr = { success: gsubzRes.ok && gsubzData.status === "successful", ref: gsubzData.transid || gsubzData.transactionId || ref, msg: gsubzData.message || gsubzData.description };
      }
    } else if (type === "airtime") {
      const serviceID = GSUBZ_AIRTIME_MAP[network.toUpperCase()] || "mtn";
      const gsubzRes = await fetch(GSUBZ_BASE + "/pay/", {
        method: "POST", headers: { "Authorization": "Bearer " + GSUBZ_KEY },
        body: new URLSearchParams({ serviceID, api: GSUBZ_KEY, amount: String(amount), phone, requestID: ref })
      });
      const gsubzData = await gsubzRes.json().catch(() => ({}));
      providerResult = { provider: "partner", status: gsubzRes.ok ? "submitted" : "failed", response: gsubzData };
      if (gsubzRes.ok && gsubzData.status === "successful") {
        await supa.from("transactions").update({ status: "successful", provider_reference: gsubzData.transid || gsubzData.transactionId, updated_at: new Date().toISOString() }).eq("reference", ref);
        await supa.from("api_purchases").update({ status: "successful", provider_reference: gsubzData.transid || gsubzData.transactionId, updated_at: new Date().toISOString() }).eq("reference", ref);
      }
      pr = { success: gsubzRes.ok && gsubzData.status === "successful", ref: gsubzData.transid || gsubzData.transactionId || ref, msg: gsubzData.message || gsubzData.description };
    } else if (type === "electricity") {
      if (!IACAFE_TOKEN) return json({ success: false, error: "Electricity provider not configured" }, 500);
      const reqId = `IAC-EL-${Date.now()}`;
      const iacafeRes = await fetch(IACAFE_BASE + "/electricity", {
        method: "POST", headers: { Accept: "application/json", Authorization: `Bearer ${IACAFE_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: reqId, service_id: providerCode, customer_id: meterNumber, variation_id: "prepaid", amount: String(amount), phone: txPhone })
      });
      const iacafeData = await iacafeRes.json().catch(() => ({}));
      const ok = iacafeRes.ok && iacafeData.success !== false && iacafeData.code !== "error";
      providerResult = { provider: "partner", status: ok ? "submitted" : "failed", response: iacafeData };
      const token = iacafeData?.data?.token || iacafeData?.data?.reference || iacafeData?.data?.request_id || reqId;
      if (ok) {
        await supa.from("transactions").update({ status: "successful", provider_reference: token, updated_at: new Date().toISOString() }).eq("reference", ref);
        await supa.from("api_purchases").update({ status: "successful", provider_reference: token, updated_at: new Date().toISOString() }).eq("reference", ref);
      }
      pr = { success: ok, ref: token, msg: iacafeData.message || iacafeData.error };
    } else if (type === "cable") {
      if (!GSUBZ_KEY) return json({ success: false, error: "Cable provider not configured" }, 500);
      const reqId = `GSZ-${Date.now()}`;
      const gsubzRes = await fetch(GSUBZ_BASE + "/pay/", {
        method: "POST", headers: { "Authorization": "Bearer " + GSUBZ_KEY },
        body: new URLSearchParams({ serviceID: providerCode, plan: packageCode, api: GSUBZ_KEY, phone: smartcard, requestID: reqId, callback_url: "https://blitz.com.ng/webhook/gsubz" })
      });
      const gsubzData = await gsubzRes.json().catch(() => ({}));
      const ok = gsubzRes.ok && gsubzData.status !== "failed" && gsubzData.status !== "error" && gsubzData.code !== "error";
      providerResult = { provider: "partner", status: ok ? "submitted" : "failed", response: gsubzData };
      if (ok) {
        await supa.from("transactions").update({ status: "successful", provider_reference: gsubzData.data?.reference || gsubzData.reference || reqId, updated_at: new Date().toISOString() }).eq("reference", ref);
        await supa.from("api_purchases").update({ status: "successful", provider_reference: gsubzData.data?.reference || gsubzData.reference || reqId, updated_at: new Date().toISOString() }).eq("reference", ref);
      }
      pr = { success: ok, ref: gsubzData.data?.reference || gsubzData.reference || reqId, msg: gsubzData.description || gsubzData.message };
    }

    if (!pr.success) {
      await supa.rpc("fail_and_refund_transaction", { _tx_id: tx.id, _reason: pr.msg || "Purchase failed" });
      return json({ success: false, error: pr.msg || "Purchase failed", code: "PURCHASE_FAILED", balance_credited: true, reference: ref }, 200);
    }

    return json({
      success: true,
      transaction: { id: tx.id, reference: ref, status: providerResult?.status === "submitted" ? "processing" : "pending", network: txNetwork, phone: txPhone, amount, provider: "partner" },
      provider_result: providerResult,
      message: "Purchase is being processed. Check status with GET /api/v1/transaction/:reference"
    });
  } catch (e: any) { return json({ success: false, error: e.message }, 500); }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
