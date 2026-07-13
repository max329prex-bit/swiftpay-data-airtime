import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key" };
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET")!;

// Supabase functions live on the same domain as the REST API
const VTU_URL = SUPA_URL.replace(/\/$/, "") + "/functions/v1/vtu-purchase";

function discountForType(type: string): number {
  if (type === "data") return 2;
  if (type === "airtime") return 1.5;
  return 0; // cable/electricity: full price, no discount advertised
}

function chargeAmountFor(amount: number, discountPercent: number): number {
  return discountPercent > 0
    ? Math.round(amount * (1 - discountPercent / 100) * 100) / 100
    : amount;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

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

    const keyInfo = keyData[0] as Record<string, any>;
    const userId = String(keyInfo.user_id || "");
    const keyId = String(keyInfo.api_key_id || "");
    if (!userId) return json({ success: false, error: "Invalid API key" }, 401);
    if (keyId) await supa.rpc("update_api_key_last_used", { _key_id: keyId });

    let network = body.network || "";
    let phone = body.phone || "";
    let amount = Number(body.amount || 0);
    let packageId = body.package_id || "";
    let packageCode = body.package_code || "";
    let providerCode = body.provider_code || "";
    let meterNumber = body.meter_number || "";
    let smartcard = body.smartcard || body.phone || "";

    if (type === "electricity") {
      if (!providerCode || !meterNumber || !amount) return json({ success: false, error: "Missing fields: provider_code, meter_number, amount" }, 400);
    } else if (type === "cable") {
      if (!providerCode || !smartcard || !amount || !packageCode) return json({ success: false, error: "Missing fields: provider_code, smartcard, package_code, amount" }, 400);
    } else if (type === "airtime") {
      if (!network || !phone || !amount) return json({ success: false, error: "Missing fields: network, phone, amount" }, 400);
      if (amount < 100) return json({ success: false, error: "Airtime minimum is ₦100" }, 400);
    } else if (type === "data") {
      if (!network || !phone || !packageId || !amount) return json({ success: false, error: "Missing fields: network, phone, package_id, amount" }, 400);
    } else {
      return json({ success: false, error: "Unsupported type. Use data, airtime, electricity, or cable" }, 400);
    }

    const discountPercent = discountForType(type);
    const vtuBody: Record<string, unknown> = {
      type, network, phone, amount,
      discount_percent: discountPercent,
      meta: { via: "api", api_key_id: keyId },
    };

    let dataPkg: Record<string, any> | null = null;
    if (type === "data") {
      const { data: pkg } = await supa.from("packages").select("package_code,provider_code,price").eq("id", packageId).single();
      if (!pkg) return json({ success: false, error: "Invalid package_id" }, 400);
      dataPkg = pkg as Record<string, any>;
      if (Math.abs(Number(dataPkg.price) - amount) > 0.01) {
        return json({ success: false, error: `Amount must match package price ₦${dataPkg.price}` }, 400);
      }
      vtuBody.package_code = dataPkg.package_code;
      vtuBody.provider_code = dataPkg.provider_code;
    } else if (type === "cable") {
      vtuBody.provider_code = providerCode;
      vtuBody.smartcard = smartcard;
      vtuBody.packageCode = packageCode;
    } else if (type === "electricity") {
      vtuBody.provider_code = providerCode;
      vtuBody.meter_number = meterNumber;
    }

    const vtuRes = await fetch(VTU_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer api-purchase-internal",
        "x-admin-secret": ADMIN_SECRET,
        "x-user-id": userId,
        "x-api-key-id": keyId,
      },
      body: JSON.stringify(vtuBody),
    });

    const vtuData = await vtuRes.json().catch(() => ({ success: false, error: "Could not parse BlitzPay response" })) as Record<string, any>;

    // Log the API purchase attempt
    if (vtuData.reference) {
      const now = new Date().toISOString();
      const logStatus = vtuData.success === true ? "success" : (vtuData.balance_credited === true ? "failed" : "pending");
      const logPhone = type === "electricity" ? meterNumber : (type === "cable" ? smartcard : phone);
      const logNetwork = type === "electricity" || type === "cable" ? providerCode : network;
      const logProviderCode = dataPkg?.provider_code || providerCode || (type === "airtime" ? "gsubz" : "");
      const logAmount = vtuData.amount_charged ?? chargeAmountFor(amount, discountPercent);
      const { error: logErr } = await supa.from("api_purchases").insert({
        api_key_id: keyId || null,
        user_id: userId,
        type,
        network: logNetwork || "",
        phone: logPhone || "",
        amount: logAmount,
        package_id: packageId || null,
        status: logStatus,
        reference: vtuData.reference,
        provider_code: logProviderCode || null,
        meta: { via: "api", amount_full: amount, api_key_id: keyId },
        updated_at: now,
        resolved_at: logStatus !== "pending" ? now : null,
      });
      if (logErr) console.error("api_purchases insert failed:", logErr.message);
    }

    if (!vtuRes.ok) {
      return json({ success: false, error: vtuData.error || "BlitzPay engine error", code: vtuData.code || "ENGINE_ERROR" }, 500);
    }

    return json(vtuData);
  } catch (e: any) {
    console.error("api-purchase error:", e);
    return json({ success: false, error: e.message }, 500);
  }
});
