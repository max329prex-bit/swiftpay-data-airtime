import { createClient } from "npm:@supabase/supabase-js@2";

const PV_SECRET = Deno.env.get("PAYVESSEL_SECRET_KEY")!;
const SUPA_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_BOT    = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT   = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") ?? "";

// Payvessel trusted sender IPs
const TRUSTED_IPS = new Set(["3.255.23.38", "162.246.254.36"]);

const OK     = JSON.stringify({ status: "success" });
const OK_HDR = { "Content-Type": "application/json" };

async function hmacSha512(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false, ["sign"]
  );
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

    // IP whitelist check (non-fatal — log only, don't drop)
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const ipTrusted = TRUSTED_IPS.has(clientIp);
    if (!ipTrusted) {
      console.warn(`[payvessel-webhook] untrusted IP: ${clientIp}`);
    }

    // Parse body
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.warn("[payvessel-webhook] invalid JSON body");
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    const { event, order, transaction, metadata } = body as {
      event: string;
      order: Record<string, string>;
      transaction: Record<string, string>;
      metadata: Record<string, string>;
    };

    // Only process successful payments
    if (event !== "transaction.success") {
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    // HMAC SHA-512 signature verification
    const pvSig = req.headers.get("HTTP_PAYVESSEL_HTTP_SIGNATURE") ??
                  req.headers.get("http_payvessel_http_signature") ?? "";
    let sigValid = false;
    if (pvSig) {
      const expected = await hmacSha512(PV_SECRET, rawBody);
      sigValid = pvSig === expected;
      if (!sigValid) {
        console.error(`[payvessel-webhook] signature mismatch — dropping`);
        return new Response(OK, { status: 200, headers: OK_HDR });
      }
    } else if (!ipTrusted) {
      // No sig + untrusted IP = drop
      console.error(`[payvessel-webhook] no sig + untrusted IP — dropping`);
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    // Extract fields
    // settlement_amount = amount after Payvessel fees — this is what we credit
    const settlementAmount = Number(order?.settlement_amount ?? order?.amount ?? 0);
    const ref              = transaction?.reference ?? "";
    // user_id stored in metadata.customer_id when we created the VA
    const userId           = metadata?.customer_id ?? "";

    if (!ref || !userId || settlementAmount < 100) {
      console.warn("[payvessel-webhook] missing fields", { ref, userId, settlementAmount });
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    const sb = createClient(SUPA_URL, SUPA_SVC);

    // Dedup via webhook_events
    const { error: dupErr } = await sb.from("webhook_events").insert({
      event_id: `payvessel-${ref}`,
      provider: "payvessel",
      event_type: event,
      payload: body
    });
    if (dupErr?.code === "23505") {
      console.warn("[payvessel-webhook] duplicate webhook", ref);
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    // Credit wallet atomically
    const { error: creditErr } = await sb.rpc("credit_wallet_from_payvessel", {
      _user_id: userId,
      _amount: settlementAmount,
      _pv_ref: ref
    });

    if (creditErr) {
      if ((creditErr.message ?? "").includes("DUPLICATE")) {
        return new Response(OK, { status: 200, headers: OK_HDR });
      }
      console.error("[payvessel-webhook] credit failed:", creditErr.message);
      await tg(`⚠️ *Payvessel Credit FAILED*\nRef: \`${ref}\`\n₦${settlementAmount}\n${creditErr.message}`);
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    console.log(`[payvessel-webhook] ✅ ₦${settlementAmount} credited to ${userId} ref=${ref}`);
    await tg(`✅ *BlitzPay Deposit (Payvessel)*\n₦${settlementAmount.toLocaleString()} credited\nRef: \`${ref}\`\nSig: ${sigValid}`);
    return new Response(OK, { status: 200, headers: OK_HDR });

  } catch (e) {
    console.error("[payvessel-webhook] crash:", e);
    return new Response(OK, { status: 200, headers: OK_HDR });
  }
});
