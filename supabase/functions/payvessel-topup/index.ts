import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const SUPA_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPA_ANON   = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPA_SVC    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PV_API_KEY  = Deno.env.get("PAYVESSEL_API_KEY")!;
const PV_SECRET   = Deno.env.get("PAYVESSEL_SECRET_KEY")!;
const PV_BASE     = "https://api.payvessel.com";
const PV_WEBHOOK_URL = `${SUPA_URL}/functions/v1/payvessel-webhook`;

const PV_HEADERS = {
  "api-key": PV_API_KEY,
  "api-secret": PV_SECRET,
  "Content-Type": "application/json"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (d: unknown, s = 200) =>
    new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);

  try {
    const uc = createClient(SUPA_URL, SUPA_ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: ae } = await uc.auth.getUser();
    if (ae || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPA_URL, SUPA_SVC);

    // 1. Check if user already has a Payvessel virtual account
    const { data: existingVA } = await admin
      .from("payvessel_virtual_accounts")
      .select("account_number, account_name, bank_name, bank_code")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingVA) {
      // Return existing VA — user can always deposit to same account
      return json({
        success: true,
        account_number: existingVA.account_number,
        account_name: existingVA.account_name,
        bank_name: existingVA.bank_name,
        bank_code: existingVA.bank_code,
        is_existing: true,
        message: "Transfer any amount to this account to fund your wallet instantly."
      });
    }

    // 2. Create new virtual account via Payvessel
    const firstName = user.email?.split("@")[0]?.split(".")[0] ?? "BlitzPay";
    const lastName  = "User";

    const pvRes = await fetch(`${PV_BASE}/virtual-account`, {
      method: "POST",
      headers: PV_HEADERS,
      body: JSON.stringify({
        customer_id: user.id,           // echoed back in webhook metadata
        customer_name: `${firstName} ${lastName}`,
        customer_email: user.email,
        webhook_url: PV_WEBHOOK_URL,
        metadata: { user_id: user.id }  // extra insurance
      }),
      signal: AbortSignal.timeout(20000)
    });

    const pvData = await pvRes.json();
    console.log("[payvessel-topup] VA response:", JSON.stringify(pvData).slice(0, 400));

    if (!pvData.status) {
      throw new Error(pvData.message || "Payvessel: virtual account creation failed");
    }

    const va = pvData.data;
    const accountNumber = va?.account_number ?? va?.accountNumber ?? "";
    const accountName   = va?.account_name   ?? va?.accountName   ?? `${firstName} ${lastName}`;
    const bankName      = va?.bank_name       ?? va?.bankName      ?? "Wema Bank";
    const bankCode      = va?.bank_code       ?? va?.bankCode      ?? "";
    const pvRef         = va?.reference       ?? va?.id            ?? "";

    if (!accountNumber) throw new Error("Payvessel: no account number returned");

    // 3. Store in DB
    await admin.from("payvessel_virtual_accounts").insert({
      user_id:        user.id,
      account_number: accountNumber,
      account_name:   accountName,
      bank_name:      bankName,
      bank_code:      bankCode,
      pv_reference:   pvRef
    });

    return json({
      success: true,
      account_number: accountNumber,
      account_name:   accountName,
      bank_name:      bankName,
      bank_code:      bankCode,
      is_existing: false,
      message: "Transfer any amount to this account to fund your wallet instantly."
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[payvessel-topup] error:", msg);
    return json({ success: false, error: msg }, msg.includes("Unauthorized") ? 401 : 500);
  }
});
