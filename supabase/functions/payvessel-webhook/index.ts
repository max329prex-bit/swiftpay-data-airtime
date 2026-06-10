import { createClient } from "npm:@supabase/supabase-js@2";

const PV_SECRET = Deno.env.get("PAYVESSEL_SECRET_KEY")!;
const SUPA_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_BOT    = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT   = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") ?? "";
const TRUSTED_IPS = new Set(["3.255.23.38", "162.246.254.36"]);
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
  try {
    const rawBody = await req.text();
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const ipTrusted = TRUSTED_IPS.has(clientIp);
    if (!ipTrusted) console.warn(`[payvessel-webhook] untrusted IP: ${clientIp}`);

    let body: Record<string, unknown>;
    try { body = JSON.parse(rawBody); }
    catch { return new Response(OK, { status: 200, headers: OK_HDR }); }

    // HMAC verification
    const pvSig = req.headers.get("HTTP_PAYVESSEL_HTTP_SIGNATURE") ??
                  req.headers.get("http_payvessel_http_signature") ?? "";
    if (pvSig) {
      const expected = await hmacSha512(PV_SECRET, rawBody);
      if (pvSig !== expected) {
        console.error("[webhook] signature mismatch — dropping");
        return new Response(OK, { status: 200, headers: OK_HDR });
      }
    } else if (!ipTrusted) {
      console.error("[webhook] no sig + untrusted IP — dropping");
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    const event = body.event as string;
    if (event !== "transaction.success") {
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    const transaction = (body.transaction ?? body.order ?? {}) as Record<string, string>;
    const metadata    = (body.metadata ?? {}) as Record<string, string>;

    // Amount — try multiple fields
    const rawAmt = transaction.amount ?? body.amount ?? transaction.paidAmount ?? "0";
    const amount = parseFloat(String(rawAmt).replace(/[^0-9.]/g, ""));
    if (!amount || amount < 100) {
      console.warn("[webhook] amount too small or missing:", rawAmt);
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    // Reference for idempotency
    const pvRef = transaction.reference ?? transaction.trackingReference ??
                  transaction.transactionRef ?? (body.reference as string) ?? "";

    // Tracking reference for user lookup
    const trackingRef = transaction.trackingReference ?? transaction.tracking_reference ??
                        (body.trackingReference as string) ?? "";

    const admin = createClient(SUPA_URL, SUPA_SVC);
    let userId: string | null = metadata.user_id ?? null;

    // ── User lookup: metadata first, then tracking reference ───────────────
    if (!userId && trackingRef) {
      // Try STATIC accounts
      const { data: staticVA } = await admin
        .from("payvessel_virtual_accounts")
        .select("user_id")
        .eq("tracking_reference", trackingRef)
        .maybeSingle();
      if (staticVA?.user_id) userId = staticVA.user_id;

      if (!userId) {
        // Try DYNAMIC requests
        const { data: dynReq } = await admin
          .from("payvessel_dynamic_requests")
          .select("user_id, is_used")
          .eq("tracking_reference", trackingRef)
          .maybeSingle();
        if (dynReq?.user_id) {
          if (dynReq.is_used) {
            console.warn("[webhook] DYNAMIC account already used:", trackingRef);
            return new Response(OK, { status: 200, headers: OK_HDR });
          }
          userId = dynReq.user_id;
          // Mark dynamic request as used
          await admin.from("payvessel_dynamic_requests")
            .update({ is_used: true })
            .eq("tracking_reference", trackingRef);
        }
      }
    }

    // Fall back to account number lookup
    if (!userId) {
      const acctNum = transaction.accountNumber ?? transaction.account_number ?? "";
      if (acctNum) {
        const { data: va } = await admin
          .from("payvessel_virtual_accounts")
          .select("user_id")
          .eq("account_number", acctNum)
          .maybeSingle();
        if (va?.user_id) userId = va.user_id;
      }
    }

    if (!userId) {
      console.error("[webhook] cannot identify user — trackingRef:", trackingRef, "metadata:", JSON.stringify(metadata));
      await tg(`⚠️ *Payvessel webhook: user not found*\ntracking: ${trackingRef}\namount: ₦${amount}\nref: ${pvRef}`);
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    // Credit wallet (idempotent via reference)
    const { error: creditErr } = await admin.rpc("credit_wallet_from_payvessel", {
      _user_id: userId,
      _amount:  amount,
      _pv_ref:  pvRef || trackingRef
    });

    if (creditErr) {
      if (creditErr.message.includes("DUPLICATE")) {
        console.log("[webhook] duplicate — already credited:", pvRef);
      } else {
        console.error("[webhook] credit error:", creditErr.message);
        await tg(`🚨 *Payvessel credit FAILED*\nUser: ${userId}\n₦${amount}\nRef: ${pvRef}\nErr: ${creditErr.message}`);
      }
    } else {
      console.log(`[webhook] ✅ credited ₦${amount} to ${userId}`);
      await tg(`✅ *Deposit received*\nUser: ${userId}\n₦${amount.toLocaleString()}\nRef: ${pvRef}`);
    }

    return new Response(OK, { status: 200, headers: OK_HDR });
  } catch (e) {
    console.error("[payvessel-webhook] unhandled:", e);
    return new Response(OK, { status: 200, headers: OK_HDR });
  }
});
