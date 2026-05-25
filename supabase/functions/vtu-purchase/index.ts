// supabase/functions/vtu-purchase/index.ts
// BlitzPay VTU Purchase Edge Function
// Verifies PIN → checks balance → calls AidaPay → records tx

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AIDAPAY_BASE = "https://www.aidapay.ng/api/v1";
const AIDAPAY_KEY = Deno.env.get("AIDAPAY_API_KEY") ?? "";
const AIDAPAY_PIN = Deno.env.get("AIDAPAY_ACCOUNT_PIN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Network → AidaPay airtime provider_code
const AIRTIME_PROVIDER: Record<string, string> = {
  MTN: "mtn-airtime",
  AIRTEL: "airtel-airtime",
  GLO: "glo-airtime",
  "9MOBILE": "9mobile-airtime",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing authorization");

    // Create Supabase client with user's JWT
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { type, network, phone, amount, pin, bundle: packageCode, provider: providerCode } = body;

    if (!type || !network || !phone || !amount || !pin) {
      throw new Error("Missing required fields");
    }

    // 1. Verify PIN
    const { data: pinOk, error: pinErr } = await supabase.rpc("verify_transaction_pin", { _pin: pin });
    if (pinErr) throw new Error(pinErr.message);
    if (!pinOk) throw new Error("Incorrect PIN");

    // 2. Check wallet balance
    const { data: wallet, error: walletErr } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .single();
    if (walletErr) throw new Error("Failed to fetch wallet");
    if (!wallet || wallet.balance < amount) throw new Error("Insufficient balance");

    // 3. Build AidaPay request
    const ref = `BLITZ-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const aidaBody: Record<string, unknown> = {
      recipient: phone,
      amount: String(amount),
      account_pin: AIDAPAY_PIN,
      ref,
    };

    if (type === "data") {
      aidaBody.provider_code = providerCode;
      if (packageCode && packageCode !== "MTN-1GB-1DAY") {
        aidaBody.package_code = packageCode;
      }
    } else if (type === "airtime") {
      aidaBody.provider_code = AIRTIME_PROVIDER[network.toUpperCase()] ?? "mtn-airtime";
    } else {
      throw new Error("Unsupported type");
    }

    // 4. Call AidaPay
    const aidaRes = await fetch(`${AIDAPAY_BASE}/buy`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AIDAPAY_KEY}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(aidaBody),
    });

    const aidaData = await aidaRes.json();

    // Handle "bundle unavailable" from AidaPay
    if (!aidaData.success) {
      const msg = (aidaData.message ?? "").toLowerCase();
      if (msg.includes("package") || msg.includes("provider") || msg.includes("unavailable")) {
        return new Response(
          JSON.stringify({ success: false, code: "BUNDLE_UNAVAILABLE", error: aidaData.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(aidaData.message ?? "AidaPay purchase failed");
    }

    const txHash = aidaData.data?.transaction_data?.transaction_hash ?? ref;
    const status = (aidaData.data?.transaction_data?.status ?? "Processing").toLowerCase() === "processing"
      ? "pending" : "success";

    // 5. Deduct wallet balance
    await supabase
      .from("wallets")
      .update({ balance: wallet.balance - amount, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    // 6. Record transaction in Supabase
    const txType = type === "data" ? "data" : "airtime";
    await supabase.from("transactions").insert({
      user_id: user.id,
      type: txType,
      network: network.toUpperCase(),
      phone,
      amount,
      reference: txHash,
      status,
      meta: {
        package_code: packageCode ?? null,
        provider_code: type === "data" ? providerCode : AIRTIME_PROVIDER[network.toUpperCase()],
        aidapay_ref: ref,
        transaction_hash: txHash,
      },
    });

    return new Response(
      JSON.stringify({ success: true, reference: txHash, status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
