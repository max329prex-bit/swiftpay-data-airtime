import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const SUPA_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPA_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const KP_SK     = Deno.env.get("KORAPAY_SECRET_KEY")!;
const KP_BASE   = "https://api.korapay.com/merchant/api/v1";
const FEE_PCT   = 2;  // 2% processing fee charged to customer on top of deposit amount

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const auth = req.headers.get("Authorization");
  if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const uc = createClient(SUPA_URL, SUPA_ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: ae } = await uc.auth.getUser();
    if (ae || !user) throw new Error("Unauthorized");
    const body = await req.json();
    const amount = Number(body.amount);  // desired wallet credit amount
    const redirectBaseUrl = body.redirect_base_url as string | undefined;
    if (!amount || amount < 100) throw new Error("Minimum deposit is ₦100");
    if (amount > 500_000) throw new Error("Maximum single deposit is ₦500,000");

    // FIX: User pays gross (amount + 2% fee), wallet gets the full amount they typed
    const fee = Math.round(amount * (FEE_PCT / 100) * 100) / 100;          // e.g. ₦4 on ₦200
    const grossAmount = Math.round((amount + fee) * 100) / 100;             // e.g. ₦204 — shown on Korapay checkout
    // netCredit = amount (the full input) — credited after payment

    const ref = `BP-${user.id.replace(/-/g,"").substring(0,8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const korapayBody: Record<string, unknown> = {
      amount: grossAmount,  // ← user sees and pays the gross on checkout
      currency: "NGN",
      reference: ref,
      notification_url: `${SUPA_URL}/functions/v1/korapay-webhook`,
      merchant_bears_cost: true,  // Korapay's own tx fee still on merchant, BlitzPay's 2% is baked into grossAmount
      customer: { name: user.email?.split("@")[0] || "BlitzPay User", email: user.email },
      channels: ["bank_transfer"],
      narration: `BlitzPay wallet top-up`,
      metadata: { user_id: user.id, net_credit: amount }  // ← webhook credits amount (what user wanted)
    };

    if (redirectBaseUrl) {
      korapayBody.redirect_url = `${redirectBaseUrl}?ref=${ref}`;
    }

    const kRes = await fetch(`${KP_BASE}/charges/initialize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KP_SK}`, "Content-Type": "application/json" },
      body: JSON.stringify(korapayBody),
      signal: AbortSignal.timeout(15000)
    });
    const kData = await kRes.json();
    if (!kData.status) throw new Error(kData.message || "Payment initialization failed");

    const { error: txErr } = await uc.from("transactions").insert({
      user_id: user.id, type: "wallet_fund", amount: grossAmount, reference: ref, status: "pending",
      meta: { provider: "korapay", checkout_url: kData.data.checkout_url, fee, net_credit: amount }
    });
    if (txErr) console.error("[korapay-topup] pending tx insert failed:", txErr.code, txErr.message);

    return new Response(JSON.stringify({
      success: true,
      checkout_url: kData.data.checkout_url,
      reference: ref,
      gross_amount: grossAmount,
      wallet_credit: amount,
      fee
    }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return new Response(JSON.stringify({ success: false, error: msg }),
      { status: msg.includes("Unauthorized") ? 401 : 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
