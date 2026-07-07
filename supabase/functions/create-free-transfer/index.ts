import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON    = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SVC     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// BlitzPay OPay Business Account (displayed to user)
const BLITZPAY_ACCOUNT = {
  number: "6554098879",
  name:   "PRAISE ADAKOLE ONOJA",
  bank:   "OPay",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
    }

    // Verify user JWT
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false },
      global: { headers: { Authorization: auth } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: CORS });
    }

    const body = await req.json().catch(() => ({}));
    const { amount, bank_name, account_name, account_number } = body;

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Valid amount required" }), { status: 400, headers: CORS });
    }
    if (!bank_name || !account_name || !account_number) {
      return new Response(JSON.stringify({ error: "Bank details required (bank_name, account_name, account_number)" }), { status: 400, headers: CORS });
    }

    const svc = createClient(SUPABASE_URL, SUPABASE_SVC);

    // Expire any existing pending deposits for this user
    await svc.from("free_transfer_deposits")
      .update({ status: "expired" })
      .eq("user_id", user.id)
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());

    // Create new pending deposit
    const { data: dep, error: depErr } = await svc
      .from("free_transfer_deposits")
      .insert({
        user_id:        user.id,
        amount:         Number(amount),
        bank_name:      bank_name.trim().toUpperCase(),
        account_name:   account_name.trim().toUpperCase(),
        account_number: account_number.replace(/\D/g, ""),
      })
      .select("id, expires_at, amount")
      .single();

    if (depErr) throw depErr;

    // Calculate fee preview
    const fee = amount >= 500 ? 0 : Math.round(amount * 0.01 * 100) / 100;

    return new Response(JSON.stringify({
      success:   true,
      deposit_id: dep.id,
      expires_at: dep.expires_at,
      amount,
      fee,
      net_amount: amount - fee,
      pay_to: BLITZPAY_ACCOUNT,
      message: fee === 0
        ? "Transfer the exact amount to the account below. FREE deposit!"
        : `A 1% processing fee (₦${fee}) applies to deposits under ₦500. You will receive ₦${amount - fee}.`,
    }), { headers: CORS });

  } catch (err) {
    console.error("create-free-transfer:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
