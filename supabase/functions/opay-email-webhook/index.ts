import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-script-secret",
  "Content-Type": "application/json",
};

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SVC   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SCRIPT_SECRET  = Deno.env.get("FT_SCRIPT_SECRET")!;

function nameMatches(emailName: string, storedName: string): boolean {
  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z\s]/g, "").trim();
  const ew = clean(emailName).split(/\s+/).filter(w => w.length > 1);
  const sw = clean(storedName).split(/\s+/).filter(w => w.length > 1);
  return ew.some(w => sw.includes(w));
}

function accountMatches(masked: string, stored: string): boolean {
  const s = stored.replace(/\D/g, "");
  const m = masked.replace(/[\s]/g, "");
  if (s.length < 6) return false;
  const parts = m.split(/\*+/);
  if (parts.length >= 2) {
    const pre = parts[0], suf = parts[parts.length - 1];
    if (pre && s.startsWith(pre)) return true;
    if (suf && s.endsWith(suf))   return true;
  }
  return s.slice(-4) === m.slice(-4);
}

function bankMatches(a: string, b: string): boolean {
  const strip = (s: string) =>
    s.toUpperCase().replace(/\s+/g, "").replace(/(BANK|LIMITED|PLC|NIGERIA|MFB)/g, "");
  const sa = strip(a), sb = strip(b);
  return sa === sb || sa.includes(sb) || sb.includes(sa);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Verify shared secret (only Google Apps Script knows this)
  const secret = req.headers.get("x-script-secret") ?? "";
  if (secret !== SCRIPT_SECRET) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: CORS });
  }

  try {
    const body = await req.json();
    const { gmail_message_id, amount, sender_name, bank_name, sender_account } = body;

    if (!gmail_message_id || !amount || !sender_name) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: CORS });
    }

    const svc = createClient(SUPABASE_URL, SUPABASE_SVC);

    // Skip if this email was already processed
    const { data: used } = await svc
      .from("opay_used_emails")
      .select("message_uid")
      .eq("message_uid", gmail_message_id)
      .maybeSingle();

    if (used) {
      return new Response(JSON.stringify({ success: false, reason: "already_processed" }), { headers: CORS });
    }

    // Find ALL pending deposits that match this email's amount
    const { data: deposits } = await svc
      .from("free_transfer_deposits")
      .select("*")
      .eq("status", "pending")
      .eq("amount", Number(amount))
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true }); // oldest first

    if (!deposits || deposits.length === 0) {
      return new Response(JSON.stringify({ success: false, reason: "no_matching_deposit" }), { headers: CORS });
    }

    // Find best match
    let matched = null;
    for (const dep of deposits) {
      const nameOk = nameMatches(sender_name, dep.account_name);
      const bankOk = bank_name ? bankMatches(bank_name, dep.bank_name) : false;
      const acctOk = sender_account ? accountMatches(sender_account, dep.account_number) : false;

      if (nameOk && (bankOk || acctOk)) {
        matched = dep;
        break;
      }
    }

    if (!matched) {
      return new Response(JSON.stringify({ success: false, reason: "no_match_on_name_or_account" }), { headers: CORS });
    }

    // Lock the email atomically
    const { error: lockErr } = await svc.from("opay_used_emails").insert({
      message_uid: gmail_message_id,
      deposit_id:  matched.id,
      user_id:     matched.user_id,
      amount:      Number(amount),
    });
    if (lockErr) {
      return new Response(JSON.stringify({ success: false, reason: "email_lock_failed" }), { headers: CORS });
    }

    // Credit wallet
    const { data: credited, error: creditErr } = await svc.rpc("credit_wallet_from_free_transfer", {
      _user_id:    matched.user_id,
      _amount:     Number(amount),
      _deposit_id: matched.id,
    });

    if (creditErr) {
      await svc.from("opay_used_emails").delete().eq("message_uid", gmail_message_id);
      console.error("credit error:", creditErr);
      return new Response(JSON.stringify({ error: "Wallet credit failed: " + creditErr.message }), { status: 500, headers: CORS });
    }

    console.log(`Credited ₦${credited} to user ${matched.user_id} for deposit ${matched.id}`);

    return new Response(JSON.stringify({
      success:    true,
      deposit_id: matched.id,
      credited,
      message:    `₦${credited} credited successfully`,
    }), { headers: CORS });

  } catch (err) {
    console.error("opay-email-webhook:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
