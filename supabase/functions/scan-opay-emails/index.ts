import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { ImapFlow } from "npm:imapflow@1.0.164";
import PostalMime from "npm:postal-mime@2.4.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Content-Type": "application/json",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GMAIL_ADDRESS = Deno.env.get("GMAIL_ADDRESS") ?? "";
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD") ?? "";
const OPAY_SENDERS = Deno.env.get("OPAY_SENDERS")
  ? Deno.env.get("OPAY_SENDERS")!.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  : Deno.env.get("OPAY_SENDER")
  ? [Deno.env.get("OPAY_SENDER")!.trim().toLowerCase()]
  : [
      "no-reply@opay-nigeria.com",
      "no-reply@opay.com",
      "noreply@opay.com",
      "opay@opay.com",
      "notifications@opay.com",
    ];
const BLITZPAY_ACCOUNTS = ["6554098879", "6616057979"];

const MAX_AGE_DAYS = 2;
const TARGET_SCAN_BUFFER_MS = 30 * 60 * 1000; // 30 minutes before deposit creation
const MAX_MESSAGES_PER_FOLDER = 50; // newest 50 OPay emails for cron
const TARGETED_MAX_MESSAGES_PER_FOLDER = 200; // newest 200 for targeted scans
const TARGETED_FOLDERS = ["INBOX", "[Gmail]/All Mail", "[Google Mail]/All Mail"];
const CRON_FOLDERS = ["INBOX"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const auth = req.headers.get("authorization") ?? "";
  const cronSecret = req.headers.get("x-cron-secret") ?? "";
  const expectedCron = Deno.env.get("CRON_SECRET");
  if (!expectedCron || (auth !== `Bearer ${expectedCron}` && cronSecret !== expectedCron)) {
    console.error("scan-opay-emails: unauthorized request", { auth: auth.slice(0, 20), cronSecret: !!cronSecret, expectedCron: !!expectedCron });
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: CORS });
  }

  const body = await req.json().catch(() => ({}));
  const targetDepositId = body.deposit_id ?? null;

  try {
    if (!GMAIL_ADDRESS || !GMAIL_APP_PASSWORD) {
      return new Response(JSON.stringify({ error: "Gmail credentials not configured" }), { status: 503, headers: CORS });
    }
    const result = await scanOpayEmails(targetDepositId);
    return new Response(JSON.stringify(result), { headers: CORS });
  } catch (err) {
    console.error("scan-opay-emails:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});

async function scanOpayEmails(targetDepositId?: string | null) {
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

  let since: Date;
  let targetDeposit: any = null;

  if (targetDepositId) {
    const { data: dep, error: depErr } = await svc
      .from("free_transfer_deposits")
      .select("*")
      .eq("id", targetDepositId)
      .single();
    if (depErr || !dep) {
      return { success: false, error: "deposit not found", processed: 0, skipped: 0 };
    }
    targetDeposit = dep;
    since = new Date(new Date(dep.created_at).getTime() - TARGET_SCAN_BUFFER_MS);
  } else {
    since = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  }

  // For a targeted scan, search INBOX + All Mail variants so the email is found even if
  // it was delivered to another folder or automatically archived. The cron keeps a smaller scope.
  const foldersToScan = targetDeposit ? TARGETED_FOLDERS : CRON_FOLDERS;
  const maxMessages = targetDeposit ? TARGETED_MAX_MESSAGES_PER_FOLDER : MAX_MESSAGES_PER_FOLDER;

  try {
    await client.connect();

    for (const folder of foldersToScan) {
      let lock: any;
      try {
        lock = await client.getMailboxLock(folder);
      } catch (lockErr) {
        console.warn(`[scan-opay-emails] could not open folder ${folder}:`, lockErr);
        continue;
      }
      try {
        // Only search unread OPay emails. Once an email has been inspected it is
        // either left unread (no match) or marked read after a successful match.
        // This prevents already-credited or already-read emails from being
        // re-evaluated against new deposits.
        const searchCriteria: any = { unseen: true, since };
        const allUids = await client.search(searchCriteria);
        const uids = allUids.slice(-maxMessages); // newest messages only
        console.log(`[scan-opay-emails] folder=${folder} messages since ${since.toISOString()}: ${allUids.length}, scanning ${uids.length}`);

        for (const uid of uids) {
          try {
            const msg = await client.fetchOne(uid, { envelope: true, source: true });
            const fromAddrs = (msg.envelope?.from ?? []).map((f: any) => f.address).filter(Boolean);
            if (!fromAddrs.some((a: string) => OPAY_SENDERS.includes(a.toLowerCase()))) {
              continue;
            }

            const rawBody = msg.source?.toString() ?? "";
            let body = rawBody;
            try {
              const mime = await PostalMime.parse(msg.source as Uint8Array);
              body = mime.text ?? (mime.html ? stripHtml(mime.html) : rawBody);
            } catch (parseErr) {
              console.warn(`[scan-opay-emails] postal-mime parse failed for uid ${uid}: ${parseErr}`);
            }
            const parsed = parseOpayEmail(body);
            if (!parsed.amount || !parsed.senderName || !parsed.transactionNumber) {
              const snippet = body.slice(0, 3000).replace(/\s+/g, " ");
              console.log(`[scan-opay-emails] parse_failed folder=${folder} uid=${uid} body=${snippet}`);
              skipped.push({ folder, uid, reason: "parse_failed", snippet: snippet.slice(0, 2000) });
              continue;
            }

            const receipt = parsed.receiptAccount?.replace(/\D/g, "");
            if (receipt && !BLITZPAY_ACCOUNTS.includes(receipt)) {
              skipped.push({ folder, uid, reason: "wrong_receipt_account", receipt, transaction_number: parsed.transactionNumber, amount: parsed.amount });
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

            let deposits: any[] = [];
            if (targetDeposit) {
              if (targetDeposit.amount === parsed.amount) {
                deposits = [targetDeposit];
              }
            } else {
              const { data: pending } = await svc
                .from("free_transfer_deposits")
                .select("*")
                .eq("status", "pending")
                .eq("amount", parsed.amount)
                .gt("expires_at", new Date().toISOString())
                .order("created_at", { ascending: true });
              deposits = pending ?? [];
            }

            if (!deposits || deposits.length === 0) {
              skipped.push({ folder, uid, reason: "no_pending_deposit", transaction_number: parsed.transactionNumber, amount: parsed.amount });
              continue;
            }

            let matched: any = null;
            let matchMethod = "";
            for (const dep of deposits) {
              const nameOk = nameMatches(parsed.senderName, dep.account_name);
              const bankOk = parsed.bankName ? bankMatches(parsed.bankName, dep.bank_name) : false;
              const acctOk = parsed.senderAccount ? accountMatches(parsed.senderAccount, dep.account_number) : false;
              const suffixOk = parsed.senderAccount ? accountSuffixMatches(parsed.senderAccount, dep.account_number) : false;
              const fullAccountUnmasked = parsed.senderAccount && !parsed.senderAccount.includes("*");

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
              skipped.push({ folder, uid, reason: "no_name_or_account_match", transaction_number: parsed.transactionNumber, amount: parsed.amount, sender: parsed.senderName, bank: parsed.bankName, account: parsed.senderAccount });
              continue;
            }

            const { error: lockErr } = await svc.from("opay_used_emails").insert({
              message_uid: parsed.transactionNumber,
              deposit_id: matched.id,
              user_id: matched.user_id,
              amount: parsed.amount,
            });
            if (lockErr) {
              skipped.push({ folder, uid, reason: "email_lock_failed", transaction_number: parsed.transactionNumber, error: lockErr.message });
              continue;
            }

            const { data: credited, error: creditErr } = await svc.rpc("credit_wallet_from_free_transfer", {
              _user_id: matched.user_id,
              _amount: matched.amount,
              _deposit_id: matched.id,
            });

            if (creditErr) {
              await svc.from("opay_used_emails").delete().eq("message_uid", parsed.transactionNumber);
              skipped.push({ folder, uid, reason: "credit_failed", transaction_number: parsed.transactionNumber, deposit_id: matched.id, error: creditErr.message });
              continue;
            }

            const { error: updateErr } = await svc.from("free_transfer_deposits").update({
              status: "verified",
              matched_email_id: parsed.transactionNumber,
              matched_amount: parsed.amount,
              credited_amount: credited,
              matched_at: new Date().toISOString(),
            }).eq("id", matched.id);

            if (updateErr) {
              console.error(`[scan-opay-emails] wallet credited but deposit update failed for ${matched.id}:`, updateErr);
              // Keep the email lock so the email cannot be re-matched and cause a double credit.
              // A manual/admin reconciliation will be needed to move the deposit to verified.
              skipped.push({ folder, uid, reason: "deposit_update_failed", transaction_number: parsed.transactionNumber, deposit_id: matched.id, error: updateErr.message });
              continue;
            }

            await client.messageFlagsAdd(uid, ["\\Seen"]);

            processed.push({
              folder,
              uid,
              transaction_number: parsed.transactionNumber,
              deposit_id: matched.id,
              user_id: matched.user_id,
              amount: parsed.amount,
              credited,
              match_method: matchMethod,
            });
            console.log(`[scan-opay-emails] credited ${credited} for deposit ${matched.id} (transaction ${parsed.transactionNumber}) via ${matchMethod}`);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`[scan-opay-emails] error processing folder=${folder} uid=${uid}:`, msg);
            skipped.push({ folder, uid, reason: "exception", error: msg });
          }
        }
      } finally {
        try { if (lock) lock.release(); } catch {}
      }
    }
  } finally {
    try { await client.logout(); } catch {}
  }

  return {
    success: true,
    target_deposit_id: targetDepositId ?? undefined,
    target_matched: targetDepositId ? processed.some((p) => p.deposit_id === targetDepositId) : undefined,
    processed: processed.length,
    deposits: processed,
    skipped: skipped.length,
    skip_reasons: skipped,
  };
}

function stripHtml(html: string) {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, "")
    .replace(/<script[^>]*>.*?<\/script>/gis, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(body: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = body.match(p);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function parseOpayEmail(body: string) {
  const amount = firstMatch(body, [
    /Amount[\s:]*₦?\s*([\d,]+(?:\.\d{2})?)/i,
    /(?:NGN|₦|N)\s*([\d,]+(?:\.\d{2})?)/i,
    /([\d,]+\.\d{2})\s*(?:NGN|₦)/i,
  ]);
  const sender = firstMatch(body, [
    /Sender[\s:]*([^\n]+)/i,
    /Sender Name[\s:]*([^\n]+)/i,
    /From[\s:]*([^\n]+)/i,
    /Transfer from[\s:]*([^\n]+)/i,
    /Sent by[\s:]*([^\n]+)/i,
    /Dear\s+([A-Z][A-Z\s',.-]+(?:\s[A-Z][A-Z\s',.-]+)?),/i,
  ]);
  const bank = firstMatch(body, [
    /Bank\s*Name[\s:]*([^\n]+)/i,
    /Source\s*Bank[\s:]*([^\n]+)/i,
    /From\s*Bank[\s:]*([^\n]+)/i,
    /Bank[\s:]*([^\n]+)/i,
  ]);
  const senderAccount = firstMatch(body, [
    /Sender\s*Account[\s:]*([^\n]+)/i,
    /Source\s*Account[\s:]*([^\n]+)/i,
    /Account\s*No(?:\.|umber)?[\s:]*([^\n]+)/i,
    /Account[\s:]*([^\n]+)/i,
  ]);
  const transactionNumber = firstMatch(body, [
    /Transaction\s*(?:Number|No\.?|#)[\s:]*([^\n]+)/i,
    /Transaction\s*(?:Number|No\.?|#)\s*([A-Z0-9]+)/i,
    /Transaction\s*ID[\s:]*([^\n]+)/i,
    /Trx\s*ID[\s:]*([^\n]+)/i,
    /Reference[\s:]*([^\n]+)/i,
    /Ref[\s:]*([^\n]+)/i,
  ]);
  const receiptAccount = firstMatch(body, [
    /Receipt\s*account[\s:]*([^\n]+)/i,
    /Recipient[\s:]*([^\n]+)/i,
    /Credited\s*to[\s:]*([^\n]+)/i,
    /Beneficiary[\s:]*([^\n]+)/i,
    /To[\s:]*([^\n]+)/i,
    /Account\s*(?:Number|No\.?)[\s:]*([^\n]+)/i,
  ]);
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
  if (ew.length === 0 || sw.length === 0) return false;
  const shared = ew.filter(w => sw.includes(w)).length;
  const required = Math.min(2, sw.length);
  return shared >= required;
}

function bankMatches(a: string, b: string): boolean {
  const strip = (s: string) => s.toUpperCase().replace(/\s+/g, "").replace(/(BANK|LIMITED|PLC|NIGERIA|MFB)/g, "");
  const sa = strip(a), sb = strip(b);
  return sa === sb || sa.includes(sb) || sb.includes(sa);
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
