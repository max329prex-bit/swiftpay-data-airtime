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
const BLITZPAY_ACCOUNTS = ["6554098879", "6616057979"];

function nameMatches(emailName: string, storedName: string): boolean {
  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z\s]/g, "").trim();
  const ew = clean(emailName).split(/\s+/).filter(w => w.length > 1);
  const sw = clean(storedName).split(/\s+/).filter(w => w.length > 1);
  if (ew.length === 0 || sw.length === 0) return false;
  const shared = ew.filter(w => sw.includes(w)).length;
  const required = Math.min(2, sw.length);
  return shared >= required;
}

function accountMatches(masked: string, stored: string): boolean {
  const s = stored.replace(/\D/g, "");
  if (s.length < 6) return false;
  const mRaw = masked.replace(/\s/g, "");
  if (!mRaw.includes("*")) {
    return s === mRaw.replace(/\D/g, "");
  }
  const parts = mRaw.split(/\*+/).filter(Boolean);
  const pre = (parts[0] ?? "").replace(/\D/g, "");
  const suf = (parts[parts.length - 1] ?? "").replace(/\D/g, "");
  if (pre && suf && parts.length >= 2) return s.startsWith(pre) && s.endsWith(suf);
  if (pre) return s.startsWith(pre);
  if (suf) return s.endsWith(suf);
  const mDigits = mRaw.replace(/\D/g, "");
  return s.length >= 4 && mDigits.length >= 4 && s.slice(-4) === mDigits.slice(-4);
}

function accountSuffixMatches(masked: string, stored: string): boolean {
  const s = stored.replace(/\D/g, "");
  if (s.length < 7) return false;
  const mRaw = masked.replace(/\s/g, "");
  if (!mRaw.includes("*")) {
    return s === mRaw.replace(/\D/g, "");
  }
  const parts = mRaw.split(/\*+/).filter(Boolean);
  const pre = (parts[0] ?? "").replace(/\D/g, "");
  const suf = (parts[parts.length - 1] ?? "").replace(/\D/g, "");
  const first4 = s.slice(0, 4);
  const last3 = s.slice(-3);
  const preOk = pre.length >= 4 ? pre.slice(0, 4) === first4 : pre === first4;
  const sufOk = suf.length >= 3 ? suf.slice(-3) === last3 : suf === last3;
  return preOk && sufOk;
}

function bankMatches(a: string, b: string): boolean {
  const strip = (s: string) =>
    s.toUpperCase().replace(/\s+/g, "").replace(/(BANK|LIMITED|PLC|NIGERIA|MFB)/g, "");
  const sa = strip(a), sb = strip(b);
  return sa === sb || sa.includes(sb) || sb.includes(sa);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const headerSecret = req.headers.get("x-script-secret");
    if (!SCRIPT_SECRET || !headerSecret || headerSecret !== SCRIPT_SECRET) {
      console.error("opay-email-webhook: unauthorized attempt", { headerSecret: !!headerSecret, scriptSecret: !!SCRIPT_SECRET });
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: CORS });
    }

    const body = await req.json();
    const { gmail_message_id, amount, sender_name, bank_name, sender_account, receipt_account } = body;

    if (!gmail_message_id || !amount || !sender_name) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: CORS });
    }

    const rcpt = String(receipt_account ?? "").replace(/\D/g, "");
    if (rcpt && !BLITZPAY_ACCOUNTS.includes(rcpt)) {
      return new Response(JSON.stringify({ success: false, reason: "wrong_receipt_account", receipt_account: rcpt }), { headers: CORS });
    }

    const svc = createClient(SUPABASE_URL, SUPABASE_SVC);

    const { data: used } = await svc
      .from("opay_used_emails")
      .select("message_uid")
      .eq("message_uid", gmail_message_id)
      .maybeSingle();

    if (used) {
      return new Response(JSON.stringify({ success: false, reason: "already_processed" }), { headers: CORS });
    }

    const { data: deposits } = await svc
      .from("free_transfer_deposits")
      .select("*")
      .eq("status", "pending")
      .eq("amount", Number(amount))
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });

    if (!deposits || deposits.length === 0) {
      return new Response(JSON.stringify({ success: false, reason: "no_matching_deposit" }), { headers: CORS });
    }

    let matched = null;
    let matchMethod = "";
    for (const dep of deposits) {
      const nameOk = nameMatches(sender_name, dep.account_name);
      const bankOk = bank_name ? bankMatches(bank_name, dep.bank_name) : false;
      const acctOk = sender_account ? accountMatches(sender_account, dep.account_number) : false;
      const suffixOk = sender_account ? accountSuffixMatches(sender_account, dep.account_number) : false;
      const fullAccountUnmasked = sender_account && !sender_account.includes("*");

      if (acctOk && fullAccountUnmasked) {
        matched = dep;
        matchMethod = "account_exact";
        break;
      } else if (acctOk && bankOk) {
        matched = dep;
        matchMethod = "account+bank";
        break;
      } else if (suffixOk && bankOk) {
        matched = dep;
        matchMethod = "account_suffix+bank";
        break;
      } else if (nameOk && bankOk) {
        matched = dep;
        matchMethod = "name+bank";
        break;
      }
    }

    if (!matched) {
      return new Response(JSON.stringify({ success: false, reason: "no_match_on_name_or_account" }), { headers: CORS });
    }

    const { error: lockErr } = await svc.from("opay_used_emails").insert({
      message_uid: gmail_message_id,
      deposit_id:  matched.id,
      user_id:     matched.user_id,
      amount:      Number(amount),
    });
    if (lockErr) {
      return new Response(JSON.stringify({ success: false, reason: "email_lock_failed" }), { headers: CORS });
    }

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

    // Persist the successful match so the deposit is no longer pending and the
    // wallet-fund transaction can be reconciled with the email it came from.
    const { error: updateErr } = await svc.from("free_transfer_deposits").update({
      status: "verified",
      matched_email_id: gmail_message_id,
      matched_amount: Number(amount),
      credited_amount: credited,
      matched_at: new Date().toISOString(),
    }).eq("id", matched.id);

    if (updateErr) {
      console.error(`opay-email-webhook: wallet credited but deposit update failed for ${matched.id}:`, updateErr);
      // Keep the email lock so the email cannot be re-matched and cause a double credit.
      // A manual/admin reconciliation will be needed to move the deposit to verified.
      return new Response(JSON.stringify({ error: "Deposit update failed: " + updateErr.message, requires_reconciliation: true }), { status: 500, headers: CORS });
    }

    console.log(`Credited ₦${credited} to user ${matched.user_id} for deposit ${matched.id} via ${matchMethod}`);

    return new Response(JSON.stringify({
      success:    true,
      deposit_id: matched.id,
      credited,
      match_method: matchMethod,
      message:    `₦${credited} credited successfully`,
    }), { headers: CORS });

  } catch (err) {
    console.error("opay-email-webhook:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
