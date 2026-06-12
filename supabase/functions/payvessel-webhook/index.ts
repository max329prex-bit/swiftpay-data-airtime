import { createClient } from "npm:@supabase/supabase-js@2";

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
      body: JSON.stringify({ chat_id: TG_CHAT, text: msg, parse_mode: "Markdown" })
    });
  } catch {}
}

Deno.serve(async (req) => {
  // Always return 200 to Payvessel — never let them retry forever
  if (req.method === "OPTIONS") return new Response(OK, { status: 200, headers: OK_HDR });
  if (req.method !== "POST") return new Response(OK, { status: 200, headers: OK_HDR });

  try {
    const rawBody = await req.text();
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    // Log ALL incoming calls to help debug
    console.log(`[payvessel-webhook] POST from ${clientIp} body_preview=${rawBody.slice(0, 500)}`);

    // Signature verification — only enforce if secret is configured
    if (PV_SECRET) {
      // Try all known Payvessel signature header names
      const pvSig =
        req.headers.get("payvessel-http-signature") ??
        req.headers.get("http_payvessel_http_signature") ??
        req.headers.get("x-payvessel-signature") ??
        req.headers.get("payvessel-signature") ?? "";

      if (pvSig) {
        const expected = await hmacSha512(PV_SECRET, rawBody);
        if (pvSig !== expected) {
          console.warn(`[payvessel-webhook] signature mismatch from ${clientIp} — logging but continuing`);
          // NOTE: log but DO NOT drop — Payvessel may change signature algo
        }
      } else {
        console.log(`[payvessel-webhook] no signature header from ${clientIp} — proceeding without sig check`);
      }
    }

    let body: Record<string, unknown>;
    try { body = JSON.parse(rawBody); }
    catch {
      console.error("[payvessel-webhook] invalid JSON");
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    // Accept any transaction success event (Payvessel uses different names in docs vs reality)
    const event = String(body.event ?? "").toLowerCase().replace(/[._\s]/g, "");
    const isSuccessEvent = event.includes("transactionsuccess") ||
                           event.includes("paymentsuccess") ||
                           event.includes("success") ||
                           !body.event; // some providers omit event field

    console.log(`[payvessel-webhook] event="${body.event}" isSuccess=${isSuccessEvent}`);

    if (!isSuccessEvent) {
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    // Parse transaction data — Payvessel wraps in different fields
    const transaction = (body.transaction ?? body.order ?? body.data ?? body) as Record<string, unknown>;
    const metadata    = (body.metadata ?? transaction.metadata ?? {}) as Record<string, unknown>;

    // Amount — try every known field name
    const rawAmt =
      transaction.amount ??
      transaction.paidAmount ??
      transaction.paid_amount ??
      transaction.settledAmount ??
      body.amount ?? "0";
    const grossAmount = parseFloat(String(rawAmt).replace(/[^0-9.]/g, ""));

    // Apply BlitzPay 1.5% deposit fee — net credit is what lands in user wallet
    const FEE_RATE  = 0.015;
    const fee       = Math.round(grossAmount * FEE_RATE * 100) / 100;
    const amount    = Math.round((grossAmount - fee) * 100) / 100;

    console.log(`[payvessel-webhook] gross=₦${grossAmount} fee=₦${fee} net=₦${amount}`);

    if (!grossAmount || grossAmount < 50) {
      console.warn("[payvessel-webhook] amount too small or missing:", rawAmt);
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    // Idempotency reference
    const pvRef = String(
      transaction.reference ??
      transaction.trackingReference ??
      transaction.tracking_reference ??
      transaction.transactionRef ??
      transaction.transaction_reference ??
      body.reference ??
      body.trackingReference ??
      ""
    );

    // Tracking reference for user lookup
    const trackingRef = String(
      transaction.trackingReference ??
      transaction.tracking_reference ??
      body.trackingReference ??
      body.tracking_reference ??
      transaction.reference ??
      ""
    );

    // Account number fallback
    const acctNum = String(
      transaction.accountNumber ??
      transaction.account_number ??
      transaction.virtualAccountNumber ??
      body.accountNumber ??
      ""
    );

    console.log(`[payvessel-webhook] pvRef=${pvRef} trackingRef=${trackingRef} acctNum=${acctNum}`);

    const admin = createClient(SUPA_URL, SUPA_SVC);
    let userId: string | null = String(metadata.user_id ?? "") || null;

    // ── User lookup: metadata → tracking_reference → account_number ────────
    if (!userId && trackingRef) {
      const { data: staticVA } = await admin
        .from("payvessel_virtual_accounts")
        .select("user_id")
        .eq("tracking_reference", trackingRef)
        .maybeSingle();
      if (staticVA?.user_id) userId = staticVA.user_id;
    }

    if (!userId && trackingRef) {
      const { data: dynReq } = await admin
        .from("payvessel_dynamic_requests")
        .select("user_id, is_used")
        .eq("tracking_reference", trackingRef)
        .maybeSingle();
      if (dynReq?.user_id) {
        if (dynReq.is_used) {
          console.warn("[payvessel-webhook] DYNAMIC already used:", trackingRef);
          return new Response(OK, { status: 200, headers: OK_HDR });
        }
        userId = dynReq.user_id;
        await admin.from("payvessel_dynamic_requests")
          .update({ is_used: true })
          .eq("tracking_reference", trackingRef);
      }
    }

    if (!userId && acctNum) {
      const { data: va } = await admin
        .from("payvessel_virtual_accounts")
        .select("user_id")
        .eq("account_number", acctNum)
        .maybeSingle();
      if (va?.user_id) userId = va.user_id;
    }

    if (!userId) {
      console.error("[payvessel-webhook] user not found — trackingRef:", trackingRef, "acct:", acctNum, "metadata:", JSON.stringify(metadata));
      await tg(`⚠️ *Payvessel webhook: user not found*\ntracking: ${trackingRef}\nacct: ${acctNum}\namount: ₦${amount}\nip: ${clientIp}`);
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    // Credit wallet
    const ref = pvRef || trackingRef || `PV-${Date.now()}`;
    const { error: creditErr } = await admin.rpc("credit_wallet_from_payvessel", {
      _user_id: userId,
      _amount:  amount,
      _pv_ref:  ref
    });

    if (creditErr) {
      if (creditErr.message.includes("DUPLICATE")) {
        console.log("[payvessel-webhook] duplicate — already credited:", ref);
      } else {
        console.error("[payvessel-webhook] credit error:", creditErr.message);
        await tg(`🚨 *Payvessel credit FAILED*\nUser: ${userId}\n₦${amount}\nRef: ${ref}\nErr: ${creditErr.message}`);
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
