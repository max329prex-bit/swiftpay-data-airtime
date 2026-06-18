import { createClient } from "npm:@supabase/supabase-js@2";

// payvessel-webhook — fixed 2026-06-17
// PayVessel payload structure (per docs):
//   body.event   = "transaction.success"
//   body.order   = { amount, settlement_amount, fee, currency, status }  ← AMOUNT IS HERE
//   body.transaction = { reference, channel, status, customer_email, paid_at }
//   body.metadata = { customer_id, order_id, user_id? }
//
// Bug was: code read amount from body.transaction.amount (always empty) → grossAmount=0 → deposit dropped

const PV_SECRET = Deno.env.get("PAYVESSEL_SECRET_KEY") ?? "";
const SUPA_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_BOT    = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT   = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") ?? "";
const OK     = JSON.stringify({ status: "success" });
const OK_HDR = { "Content-Type": "application/json" };

async function hmacSha512(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function tg(msg: string) {
  if (!TG_BOT || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text: msg, parse_mode: "Markdown" }),
    });
  } catch {}
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(OK, { status: 200, headers: OK_HDR });
  if (req.method !== "POST") return new Response(OK, { status: 200, headers: OK_HDR });

  try {
    const rawBody = await req.text();
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    // Log ALL incoming calls — critical for debugging
    console.log(`[payvessel-webhook] POST from ${clientIp}`);
    console.log(`[payvessel-webhook] FULL_BODY=${rawBody.slice(0, 2000)}`);

    // Signature check (non-blocking — log mismatch but continue)
    if (PV_SECRET) {
      const pvSig =
        req.headers.get("payvessel-http-signature") ??
        req.headers.get("http_payvessel_http_signature") ??
        req.headers.get("x-payvessel-signature") ??
        req.headers.get("payvessel-signature") ?? "";
      if (pvSig) {
        const expected = await hmacSha512(PV_SECRET, rawBody);
        if (pvSig !== expected) {
          console.warn(`[payvessel-webhook] sig mismatch from ${clientIp} — continuing anyway`);
        }
      }
    }

    let body: Record<string, unknown>;
    try { body = JSON.parse(rawBody); }
    catch {
      console.error("[payvessel-webhook] invalid JSON");
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    // ── Event detection ────────────────────────────────────────────────────
    // PayVessel sends: event = "transaction.success"
    // After strip: "transactionsuccess" → includes "success" → true
    const eventRaw = String(body.event ?? "").toLowerCase().replace(/[._\s]/g, "");
    const isSuccessEvent =
      eventRaw.includes("transactionsuccess") ||
      eventRaw.includes("paymentsuccess") ||
      eventRaw.includes("success") ||
      eventRaw.includes("credit") ||
      eventRaw.includes("collection") ||
      !body.event;

    console.log(`[payvessel-webhook] event="${body.event}" normalized="${eventRaw}" isSuccess=${isSuccessEvent}`);
    if (!isSuccessEvent) return new Response(OK, { status: 200, headers: OK_HDR });

    // ── Amount extraction ──────────────────────────────────────────────────
    // PayVessel standard: amount lives in body.order (NOT body.transaction)
    // body.order = { amount, settlement_amount, fee, currency, status }
    const order       = (body.order ?? {}) as Record<string, unknown>;
    const transaction = (body.transaction ?? body.data ?? body) as Record<string, unknown>;
    const metadata    = (body.metadata ?? transaction.metadata ?? order.metadata ?? {}) as Record<string, unknown>;

    const rawAmt =
      order.amount ??               // ✅ PayVessel standard: body.order.amount
      order.settlement_amount ??    // net after PayVessel fee
      transaction.amount ??         // legacy / other providers
      transaction.paidAmount ??
      transaction.paid_amount ??
      transaction.settledAmount ??
      body.amount ?? "0";

    const grossAmount = parseFloat(String(rawAmt).replace(/[^0-9.]/g, ""));

    // Apply BlitzPay 1.5% deposit fee
    const FEE_RATE = 0.015;
    const fee      = Math.round(grossAmount * FEE_RATE * 100) / 100;
    const amount   = Math.round((grossAmount - fee) * 100) / 100;

    console.log(`[payvessel-webhook] gross=₦${grossAmount} fee=₦${fee} net=₦${amount}`);

    if (!grossAmount || grossAmount < 50) {
      console.warn("[payvessel-webhook] amount too small or missing:", rawAmt);
      console.warn("[payvessel-webhook] order object:", JSON.stringify(order).slice(0, 300));
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    // ── Reference (idempotency key) ────────────────────────────────────────
    // PayVessel: transaction.reference
    const pvRef = String(
      transaction.reference ??
      transaction.trackingReference ??
      transaction.tracking_reference ??
      transaction.transactionRef ??
      body.reference ??
      body.trackingReference ??
      order.reference ??
      `PV-${Date.now()}`
    );

    // ── Tracking reference (for account lookup) ────────────────────────────
    const trackingRef = String(
      transaction.trackingReference ??
      transaction.tracking_reference ??
      body.trackingReference ??
      body.tracking_reference ??
      transaction.reference ??
      ""
    );

    // ── Account number (for user lookup fallback) ──────────────────────────
    const acctNum = String(
      transaction.accountNumber ??
      transaction.account_number ??
      transaction.virtualAccountNumber ??
      order.accountNumber ??
      order.account_number ??
      body.accountNumber ??
      ""
    );

    console.log(`[payvessel-webhook] pvRef=${pvRef} trackingRef=${trackingRef} acctNum=${acctNum}`);
    console.log(`[payvessel-webhook] metadata=${JSON.stringify(metadata)}`);

    const admin = createClient(SUPA_URL, SUPA_SVC);
    // Only trust metadata.user_id if it looks like a UUID — PayVessel also sends
    // metadata.customer_id (their own ID, not our UUID) which must NOT be used for lookup.
    const _rawMetaUid = String(metadata.user_id ?? "");
    const _isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(_rawMetaUid);
    let userId: string | null = _isUuid ? _rawMetaUid : null;

    // ── User lookup chain ──────────────────────────────────────────────────
    // 1. metadata.user_id (set at account creation)
    // (already set above)

    // 2. payvessel_virtual_accounts by tracking_reference
    if (!userId && trackingRef) {
      const { data: va } = await admin.from("payvessel_virtual_accounts")
        .select("user_id").eq("tracking_reference", trackingRef).maybeSingle();
      if (va?.user_id) userId = va.user_id;
    }

    // 3. payvessel_dynamic_requests by tracking_reference
    if (!userId && trackingRef) {
      const { data: dynReq } = await admin.from("payvessel_dynamic_requests")
        .select("user_id, is_used").eq("tracking_reference", trackingRef).maybeSingle();
      if (dynReq?.user_id) {
        if (dynReq.is_used) {
          console.warn("[payvessel-webhook] DYNAMIC already used:", trackingRef);
          return new Response(OK, { status: 200, headers: OK_HDR });
        }
        userId = dynReq.user_id;
        await admin.from("payvessel_dynamic_requests").update({ is_used: true }).eq("tracking_reference", trackingRef);
      }
    }

    // 4. payvessel_virtual_accounts by account_number
    if (!userId && acctNum) {
      const { data: va } = await admin.from("payvessel_virtual_accounts")
        .select("user_id").eq("account_number", acctNum).maybeSingle();
      if (va?.user_id) userId = va.user_id;
    }

    // 5. Alternative account number field aliases
    if (!userId) {
      const altAcct = String(
        transaction.accountNo ?? transaction.virtualAccountNo ??
        order.accountNo ?? body.accountNo ?? body.virtualAccountNo ?? ""
      );
      if (altAcct) {
        const { data: va2 } = await admin.from("payvessel_virtual_accounts")
          .select("user_id").eq("account_number", altAcct).maybeSingle();
        if (va2?.user_id) userId = va2.user_id;
      }
    }

    if (!userId) {
      console.error("[payvessel-webhook] user not found — trackingRef:", trackingRef, "acct:", acctNum, "metadata:", JSON.stringify(metadata));
      await tg(`⚠️ *PayVessel webhook: user not found*\ntracking: ${trackingRef}\nacct: ${acctNum}\namount: ₦${amount}\nip: ${clientIp}\nfull_body_preview: ${rawBody.slice(0, 300)}`);
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    // ── Credit wallet ──────────────────────────────────────────────────────
    const ref = pvRef;
    const { error: creditErr } = await admin.rpc("credit_wallet_from_payvessel", {
      _user_id: userId,
      _amount:  amount,
      _pv_ref:  ref,
    });

    if (creditErr) {
      if (creditErr.message.includes("DUPLICATE")) {
        console.log("[payvessel-webhook] duplicate — already credited:", ref);
      } else {
        console.error("[payvessel-webhook] credit error:", creditErr.message);
        await tg(`🚨 *PayVessel credit FAILED*\nUser: ${userId}\n₦${amount}\nRef: ${ref}\nErr: ${creditErr.message}`);
      }
    } else {
      console.log(`[payvessel-webhook] ✅ credited ₦${amount} to ${userId} ref=${ref}`);
      await tg(`✅ *Deposit received*\nUser: ${userId}\nGross: ₦${grossAmount} | Fee: ₦${fee} | Net: ₦${amount}\nRef: ${ref}`);
    }

    return new Response(OK, { status: 200, headers: OK_HDR });

  } catch (e) {
    console.error("[payvessel-webhook] unhandled:", e);
    return new Response(OK, { status: 200, headers: OK_HDR });
  }
});
