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

    // Expire any existing pending deposits for this user so a user can only
    // have one active deposit at a time. This reduces confusion and avoids
    // stale deposits being matched by a later transfer.
    await svc.from("free_transfer_deposits")
      .update({ status: "expired" })
      .eq("user_id", user.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString());

    // Pick a UNIQUE kobo-suffixed amount so this deposit can never be
    // confused with a concurrent deposit of the same round amount.
    // Example: 150 → 150.07. Try up to 60 times to find one that
    // does not clash with any other pending deposit AND has not been used by
    // another user in any past or present deposit. This prevents a late transfer
    // from ever being matched to the wrong user.
    const requested = Math.floor(Number(amount));
    let uniqueAmount = requested;
    let found = false;
    for (let i = 0; i < 60; i++) {
      const kobo = Math.floor(Math.random() * 99) + 1; // 1..99 kobo
      const candidate = Math.round((requested + kobo / 100) * 100) / 100;

      // 1. No other user must have a currently pending deposit with this amount.
      const { data: pendingClash } = await svc
        .from("free_transfer_deposits")
        .select("id")
        .eq("status", "pending")
        .eq("amount", candidate)
        .gt("expires_at", new Date().toISOString())
        .neq("user_id", user.id)
        .maybeSingle();
      if (pendingClash) continue;

      // 2. No other user must have ever used this amount (verified, expired, failed).
      //    The same user may reuse their own expired amount, so exclude them.
      const { data: historicalClash } = await svc
        .from("free_transfer_deposits")
        .select("id")
        .eq("amount", candidate)
        .neq("user_id", user.id)
        .maybeSingle();
      if (historicalClash) continue;

      uniqueAmount = candidate;
      found = true;
      break;
    }
    if (!found) {
      return new Response(JSON.stringify({
        error: "Too many concurrent deposits for this amount. Please try again in a minute or use a different amount.",
      }), { status: 429, headers: CORS });
    }

    // Create new pending deposit
    const { data: dep, error: depErr } = await svc
      .from("free_transfer_deposits")
      .insert({
        user_id:        user.id,
        amount:         uniqueAmount,
        bank_name:      bank_name.trim().toUpperCase(),
        account_name:   account_name.trim().toUpperCase(),
        account_number: account_number.replace(/\D/g, ""),
      })
      .select("id, expires_at, amount")
      .single();

    if (depErr) throw depErr;

    // Calculate fee preview
    const fee = uniqueAmount >= 500 ? 0 : Math.round(uniqueAmount * 0.01 * 100) / 100;

    return new Response(JSON.stringify({
      success:   true,
      deposit_id: dep.id,
      expires_at: dep.expires_at,
      amount: uniqueAmount,
      requested_amount: requested,
      fee,
      net_amount: uniqueAmount - fee,
      pay_to: BLITZPAY_ACCOUNT,
      message: fee === 0
        ? `Transfer EXACTLY ₦${uniqueAmount.toFixed(2)} (including the kobo) so we can uniquely identify your deposit. FREE!`
        : `Transfer EXACTLY ₦${uniqueAmount.toFixed(2)} (including the kobo). A 1% fee (₦${fee.toFixed(2)}) applies below ₦500. You will receive ₦${(uniqueAmount - fee).toFixed(2)}.`,
    }), { headers: CORS });

  } catch (err) {
    console.error("create-free-transfer:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
