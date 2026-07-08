import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    if ("message" in err && typeof (err as { message?: unknown }).message === "string") {
      return (err as { message: string }).message;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return "Unexpected error";
    }
  }
  return String(err);
}

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

    // Block new reservations while a payment is already being verified. A
    // pending deposit means the user already claimed to have paid; expiring it
    // could strand a real transfer that is still being matched by the scanner.
    const { data: pendingDeps } = await svc
      .from("free_transfer_deposits")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .limit(1);
    if (pendingDeps && pendingDeps.length > 0) {
      return new Response(JSON.stringify({
        error: "You already have a pending deposit. Please wait for it to verify before starting a new one.",
      }), { status: 409, headers: CORS });
    }

    // A reserved session is only a displayed pay screen; it is safe to replace
    // with a new one so the user can change the amount or bank details.
    await svc.from("free_transfer_deposits")
      .update({ status: "expired" })
      .eq("user_id", user.id)
      .eq("status", "reserved")
      .gt("expires_at", new Date().toISOString());

    // Use the exact amount the user requested.
    const requested = Math.floor(Number(amount));
    const uniqueAmount = requested;

    // Create a reserved payment session. The amount is held, but the deposit
    // is not yet visible to the email scanner. It becomes 'pending' only
    // after the user taps "I have made payment".
    const { data: dep, error: depErr } = await svc
      .from("free_transfer_deposits")
      .insert({
        user_id:        user.id,
        amount:         uniqueAmount,
        bank_name:      bank_name.trim().toUpperCase(),
        account_name:   account_name.trim().toUpperCase(),
        account_number: account_number.replace(/\D/g, ""),
        status:         "reserved",
      })
      .select("id, expires_at, amount")
      .single();

    if (depErr) throw depErr;

    // Calculate fee preview
    const fee = uniqueAmount >= 500 ? 0 : Math.round(uniqueAmount * 0.01 * 100) / 100;

    return new Response(JSON.stringify({
      success:   true,
      deposit_id: dep.id,
      user_id:    user.id,
      expires_at: dep.expires_at,
      amount: uniqueAmount,
      requested_amount: requested,
      fee,
      net_amount: uniqueAmount - fee,
      pay_to: BLITZPAY_ACCOUNT,
      message: fee === 0
        ? `Transfer EXACTLY ₦${uniqueAmount.toFixed(2)}. FREE!`
        : `Transfer EXACTLY ₦${uniqueAmount.toFixed(2)}. A 1% fee (₦${fee.toFixed(2)}) applies below ₦500. You will receive ₦${(uniqueAmount - fee).toFixed(2)}.`,
    }), { headers: CORS });

  } catch (err) {
    console.error("create-free-transfer:", err);
    return new Response(JSON.stringify({ error: formatError(err) }), { status: 500, headers: CORS });
  }
});
