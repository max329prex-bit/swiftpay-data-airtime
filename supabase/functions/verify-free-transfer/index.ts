import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { ImapFlow } from "npm:imapflow@1";
import { simpleParser } from "npm:mailparser@3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SVC_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GMAIL_USER        = "onojav775@gmail.com";
const GMAIL_PASS        = Deno.env.get("GMAIL_APP_PASSWORD")!;
const OPAY_SENDER       = "no-reply@opay-nigeria.com";

// ── Robust Opay email parser ──
// Handles current format and is resilient to Opay UI changes.
// Fields extracted from labeled lines: "Amount:", "Sender:", "Bank Name:", etc.
function parseOpayEmail(text: string) {
  const field = (key: string): string | null => {
    const re = new RegExp(`${key}[:\s]+([^\n\r]+)`, "i");
    const m = text.match(re);
    return m ? m[1].trim().replace(/\r/g, "") : null;
  };

  // Amount: try labeled field first, then narrative sentence
  let amount: number | null = null;
  const amtField = text.match(/^Amount[:\s]+([0-9,]+\.?[0-9]*)/im);
  if (amtField) {
    amount = parseFloat(amtField[1].replace(/,/g, ""));
  } else {
    const amtNarrative = text.match(/transferred\s+[₦N]?([0-9,]+\.?[0-9]*)\s+to you/i);
    if (amtNarrative) amount = parseFloat(amtNarrative[1].replace(/,/g, ""));
  }

  return {
    amount,
    sender:            field("Sender"),
    bankName:          field("Bank Name"),
    senderAccount:     field("Sender Account"),
    transactionNumber: field("Transaction number"),
    receiptAccount:    field("Receipt account"),
  };
}

// ── Name match: at least 1 matching word (handles partial names) ──
function nameMatches(emailName: string, storedName: string): boolean {
  const clean = (s: string) =>
    s.toUpperCase().replace(/[^A-Z\s]/g, "").trim();
  const ew = clean(emailName).split(/\s+/).filter(w => w.length > 1);
  const sw = clean(storedName).split(/\s+/).filter(w => w.length > 1);
  return ew.some(w => sw.includes(w));
}

// ── Account match: prefix OR suffix of masked account ──
// Email shows "707***7623" → compare first 3 OR last 4 digits
function accountMatches(masked: string, stored: string): boolean {
  const s = stored.replace(/\D/g, "");
  const m = masked.replace(/\s/g, "");
  if (s.length < 6) return false;
  const parts = m.split(/\*+/);
  if (parts.length >= 2) {
    const pre = parts[0];
    const suf = parts[parts.length - 1];
    if (pre && s.startsWith(pre)) return true;
    if (suf && s.endsWith(suf))   return true;
  }
  return s.slice(-4) === m.slice(-4); // fallback: last 4 match
}

// ── Bank name match (fuzzy, strips common suffixes) ──
function bankMatches(emailBank: string, storedBank: string): boolean {
  const strip = (s: string) =>
    s.toUpperCase().replace(/\s+/g, "").replace(/(BANK|LIMITED|PLC|NIGERIA|MICROFINANCE)/g, "");
  const e = strip(emailBank);
  const s = strip(storedBank);
  return e === s || e.includes(s) || s.includes(e);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
    }

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: CORS });
    }

    const body = await req.json().catch(() => ({}));
    const { deposit_id } = body;
    if (!deposit_id) {
      return new Response(JSON.stringify({ error: "deposit_id required" }), { status: 400, headers: CORS });
    }

    const svc = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

    // Load deposit record
    const { data: dep, error: depErr } = await svc
      .from("free_transfer_deposits")
      .select("*")
      .eq("id", deposit_id)
      .eq("user_id", user.id)
      .single();

    if (depErr || !dep) {
      return new Response(JSON.stringify({ success: false, status: "not_found", message: "Deposit not found" }),
        { status: 404, headers: CORS });
    }

    if (dep.status === "verified") {
      return new Response(JSON.stringify({ success: true, status: "already_verified", amount: dep.credited_amount }),
        { headers: CORS });
    }

    // Check expiry
    if (new Date(dep.expires_at) < new Date()) {
      await svc.from("free_transfer_deposits").update({ status: "expired" }).eq("id", deposit_id);
      return new Response(JSON.stringify({
        success: false, status: "expired",
        message: "This deposit request has expired (12 hours). Please send your transfer screenshot to support."
      }), { headers: CORS });
    }

    // Connect to Gmail IMAP
    const imap = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
      logger: false,
    });

    await imap.connect();
    const lock = await imap.getMailboxLock("INBOX");

    let matchedUid: string | null = null;
    let matchedAmount: number | null = null;

    try {
      // Search Opay emails from 30 min before deposit was created
      const since = new Date(dep.created_at);
      since.setMinutes(since.getMinutes() - 30);

      const uids = await imap.search({ from: OPAY_SENDER, since });

      for await (const msg of imap.fetch(uids, { uid: true, source: true })) {
        const uid = String(msg.uid);

        // Skip already-used emails
        const { data: used } = await svc
          .from("opay_used_emails")
          .select("message_uid")
          .eq("message_uid", uid)
          .maybeSingle();
        if (used) continue;

        // Parse email body
        const parsed = await simpleParser(msg.source);
        const text = parsed.text ?? msg.source.toString("utf-8");
        const email = parseOpayEmail(text);

        if (!email.amount) continue;

        const amountOk  = Math.abs(email.amount - dep.amount) < 0.01;
        const nameOk    = email.sender        ? nameMatches(email.sender, dep.account_name)    : false;
        const bankOk    = email.bankName      ? bankMatches(email.bankName, dep.bank_name)      : false;
        const acctOk    = email.senderAccount ? accountMatches(email.senderAccount, dep.account_number) : false;

        // Must match: amount + name + (bank OR account digits)
        if (amountOk && nameOk && (bankOk || acctOk)) {
          matchedUid    = uid;
          matchedAmount = email.amount;
          break;
        }
      }
    } finally {
      lock.release();
      await imap.logout();
    }

    if (!matchedUid || !matchedAmount) {
      return new Response(JSON.stringify({
        success: false, status: "not_found",
        message: "Payment not found yet. Please wait a moment and try again.",
      }), { headers: CORS });
    }

    // Lock this email (unique PRIMARY KEY prevents double-claim)
    const { error: lockErr } = await svc.from("opay_used_emails").insert({
      message_uid: matchedUid,
      deposit_id:  dep.id,
      user_id:     user.id,
      amount:      matchedAmount,
    });
    if (lockErr) {
      return new Response(JSON.stringify({
        success: false, status: "already_used",
        message: "This payment has already been claimed by another deposit.",
      }), { headers: CORS });
    }

    // Store matched email ID for audit
    await svc.from("free_transfer_deposits")
      .update({ matched_email_id: matchedUid })
      .eq("id", dep.id);

    // Credit wallet via RPC (handles 1% fee, idempotency, transaction logging)
    const { data: credited, error: creditErr } = await svc.rpc("credit_wallet_from_free_transfer", {
      _user_id:    user.id,
      _amount:     matchedAmount,
      _deposit_id: dep.id,
    });

    if (creditErr) {
      // Rollback email lock
      await svc.from("opay_used_emails").delete().eq("message_uid", matchedUid);
      console.error("credit_wallet_from_free_transfer failed:", creditErr);
      return new Response(JSON.stringify({ error: "Wallet credit failed. Please contact support." }),
        { status: 500, headers: CORS });
    }

    return new Response(JSON.stringify({
      success: true,
      status:  "verified",
      amount:  credited,
      message: `Deposit verified! ₦${Number(credited).toLocaleString("en-NG", { minimumFractionDigits: 2 })} has been added to your wallet.`,
    }), { headers: CORS });

  } catch (err) {
    console.error("verify-free-transfer:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
