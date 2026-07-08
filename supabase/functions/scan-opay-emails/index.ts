import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { ImapFlow } from "npm:imapflow@1.0.164";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Content-Type": "application/json",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GMAIL_ADDRESS = Deno.env.get("GMAIL_ADDRESS") ?? "";
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD") ?? "";
const OPAY_SENDER = Deno.env.get("OPAY_SENDER") ?? "no-reply@opay-nigeria.com";
const BLITZPAY_ACCOUNT = "6554098879";

const MAX_AGE_DAYS = 7;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const auth = req.headers.get("authorization") ?? "";
  const cronSecret = req.headers.get("x-cron-secret") ?? "";
  const expectedCron = Deno.env.get("CRON_SECRET") ?? "";
  const fallbackCron = "cron-blitzpay-scan-emails-2026";
  const isServiceAuth = auth.includes(SUPABASE_SVC);
  const isCron = (expectedCron && cronSecret === expectedCron) || cronSecret === fallbackCron;
  if (!isServiceAuth && !isCron) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: CORS });
  }

  try {
    if (!GMAIL_ADDRESS || !GMAIL_APP_PASSWORD) {
      return new Response(JSON.stringify({ error: "Gmail credentials not configured" }), { status: 503, headers: CORS });
    }
    const result = await scanOpayEmails();
    return new Response(JSON.stringify(result), { headers: CORS });
  } catch (err) {
    console.error("scan-opay-emails:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});

async function scanOpayEmails() {
  const svc = createClient(SUPABASE_URL, SUPABASE_SVC);
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: GMAIL_ADDRESS, pass: GMAIL_APP_PASSWORD },
    logger: false,
  });

  const processed: Record<string, unknown>[] = [];
  const skipped: Record<string, unknown>[] = [];
  let lock: any;

  try {
    await client.connect();
    lock = await client.getMailboxLock("INBOX");

    const since = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
    // Scan ALL emails from the last 7 days, not just unread ones. The opay_used_emails
    // table already prevents double-crediting, so opening the email on a phone cannot
    // hide the payment from us.
    const searchCriteria = { since };
    const uids = await client.search(searchCriteria);
    console.log(`[scan-opay-emails] messages since ${since.toISOString()}: ${uids.length}`);

    for (const uid of uids) {
      try {
        const msg = await client.fetchOne(uid, { envelope: true, source: true });
        const fromAddrs = (msg.envelope?.from ?? []).map((f: any) => f.address).filter(Boolean);
        if (!fromAddrs.some((a: string) => a.toLowerCase() === OPAY_SENDER.toLowerCase())) {
          continue;
        }

        const body = msg.source?.toString() ?? "";
        const parsed = parseOpayEmail(body);
        if (!parsed.amount || !parsed.senderName || !parsed.transactionNumber) {
          skipped.push({ uid, reason: "parse_failed", snippet: body.slice(0, 120) });
          continue;
        }

        const receipt = parsed.receiptAccount?.replace(/\D/g, "");
        if (receipt && receipt !== BLITZPAY_ACCOUNT) {
          skipped.push({ uid, reason: "wrong_receipt_account", receipt });
          continue;
        }

        const { data: used } = await svc
          .from("opay_used_emails")
          .select("message_uid")
          .eq("message_uid", parsed.transactionNumber)
          .maybeSingle();
        if (used) {
          await client.messageFlagsAdd(uid, ["\\Seen"]);
          continue;
        }

        const { data: deposits } = await svc
          .from("free_transfer_deposits")
          .select("*")
          .eq("status", "pending")
          .eq("amount", parsed.amount)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: true });

        if (!deposits || deposits.length === 0) {
          skipped.push({ uid, reason: "no_pending_deposit", transaction_number: parsed.transactionNumber, amount: parsed.amount });
          continue;
        }

        let matched: any = null;
        for (const dep of deposits) {
          const nameOk = nameMatches(parsed.senderName, dep.account_name);
          const bankOk = parsed.bankName ? bankMatches(parsed.bankName, dep.bank_name) : false;
          const acctOk = parsed.senderAccount ? accountMatches(parsed.senderAccount, dep.account_number) : false;
          if (nameOk && (bankOk || acctOk)) {
            matched = dep;
            break;
          }
        }

        if (!matched) {
          skipped.push({ uid, reason: "no_name_or_account_match", transaction_number: parsed.transactionNumber, amount: parsed.amount, sender: parsed.senderName });
          continue;
        }

        const { error: lockErr } = await svc.from("opay_used_emails").insert({
          message_uid: parsed.transactionNumber,
          deposit_id: matched.id,
          user_id: matched.user_id,
          amount: parsed.amount,
        });
        if (lockErr) {
          skipped.push({ uid, reason: "email_lock_failed", transaction_number: parsed.transactionNumber, error: lockErr.message });
          continue;
        }

        const fee = matched.amount >= 500 ? 0 : Math.round(matched.amount * 0.01 * 100) / 100;
        const creditedAmount = matched.amount - fee;
        const { data: credited, error: creditErr } = await svc.rpc("credit_wallet_from_free_transfer", {
          _user_id: matched.user_id,
          _amount: matched.amount,
          _deposit_id: matched.id,
        });

        if (creditErr) {
          await svc.from("opay_used_emails").delete().eq("message_uid", parsed.transactionNumber);
          skipped.push({ uid, reason: "credit_failed", transaction_number: parsed.transactionNumber, deposit_id: matched.id, error: creditErr.message });
          continue;
        }

        await svc.from("free_transfer_deposits").update({
          status: "verified",
          matched_email_id: parsed.transactionNumber,
          matched_amount: parsed.amount,
          credited_amount: creditedAmount,
          matched_at: new Date().toISOString(),
        }).eq("id", matched.id);

        await client.messageFlagsAdd(uid, ["\\Seen"]);

        processed.push({
          uid,
          transaction_number: parsed.transactionNumber,
          deposit_id: matched.id,
          user_id: matched.user_id,
          amount: parsed.amount,
          credited: creditedAmount,
        });
        console.log(`[scan-opay-emails] credited ${creditedAmount} for deposit ${matched.id} (transaction ${parsed.transactionNumber})`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[scan-opay-emails] error processing uid ${uid}:`, msg);
        skipped.push({ uid, reason: "exception", error: msg });
      }
    }
  } finally {
    try { if (lock) lock.release(); } catch {}
    try { await client.logout(); } catch {}
  }

  return { success: true, processed: processed.length, deposits: processed, skipped: skipped.length, skip_reasons: skipped };
}

function parseOpayEmail(body: string) {
  const amount = body.match(/Amount:\s*₦?\s*([\d,]+(?:\.\d{2})?)/i)?.[1];
  const sender = body.match(/Sender:\s*([^\n]+)/i)?.[1]?.trim();
  const bank = body.match(/Bank Name:\s*([^\n]+)/i)?.[1]?.trim();
  const senderAccount = body.match(/Sender Account:\s*([^\n]+)/i)?.[1]?.trim();
  const transactionNumber = body.match(/Transaction number:\s*([^\n]+)/i)?.[1]?.trim();
  const receiptAccount = body.match(/Receipt account:\s*([^\n]+)/i)?.[1]?.trim();
  return {
    amount: amount ? Number(amount.replace(/,/g, "")) : null,
    senderName: sender,
    bankName: bank,
    senderAccount,
    transactionNumber,
    receiptAccount,
  };
}

function nameMatches(emailName: string, storedName: string): boolean {
  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z\s]/g, "").trim();
  const ew = clean(emailName).split(/\s+/).filter(w => w.length > 1);
  const sw = clean(storedName).split(/\s+/).filter(w => w.length > 1);
  return ew.some(w => sw.includes(w));
}

function bankMatches(a: string, b: string): boolean {
  const strip = (s: string) => s.toUpperCase().replace(/\s+/g, "").replace(/(BANK|LIMITED|PLC|NIGERIA|MFB)/g, "");
  const sa = strip(a), sb = strip(b);
  return sa === sb || sa.includes(sb) || sb.includes(sa);
}

function accountMatches(masked: string, stored: string): boolean {
  const s = stored.replace(/\D/g, "");
  const m = masked.replace(/[\s]/g, "");
  if (s.length < 6) return false;
  const parts = m.split(/\*+/);
  if (parts.length >= 2) {
    const pre = parts[0], suf = parts[parts.length - 1];
    if (pre && s.startsWith(pre)) return true;
    if (suf && s.endsWith(suf)) return true;
  }
  return s.slice(-4) === m.slice(-4);
}
