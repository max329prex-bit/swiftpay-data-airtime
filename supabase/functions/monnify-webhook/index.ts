import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MONNIFY_SECRET = Deno.env.get("MONNIFY_SECRET_KEY")!;
const SUPA_URL       = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OK             = JSON.stringify({ responseCode: "00", responseMessage: "Approved" });
const OK_HEADERS     = { "Content-Type": "application/json" };

async function hmacSha512Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig  = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  try {
    const rawBody = await req.text();
    const mSig    = req.headers.get("monnify-signature") || "";

    // Check 1: HMAC-SHA512 signature
    const expected = await hmacSha512Hex(MONNIFY_SECRET, rawBody);
    if (mSig && mSig !== expected) {
      console.error("Monnify: bad signature");
      return new Response(OK, { status: 200, headers: OK_HEADERS });
    }

    const body = JSON.parse(rawBody);
    const { eventType, eventData } = body;

    // Check 2: event type filter
    if (!["SUCCESSFUL_TRANSACTION", "PAID"].includes(eventType)) {
      return new Response(OK, { status: 200, headers: OK_HEADERS });
    }

    const txRef      = eventData?.transactionReference || "";
    const amount     = Number(eventData?.amountPaid || 0);
    const accountRef = eventData?.destinationAccountInformation?.accountReference || eventData?.product?.reference || "";
    const userIdRaw  = accountRef.replace(/^SP-/, "");

    if (!userIdRaw || amount <= 0 || !txRef) {
      console.warn("Monnify: missing fields", { userIdRaw, amount, txRef });
      return new Response(OK, { status: 200, headers: OK_HEADERS });
    }

    // Check 3: amount sanity
    if (amount < 50) {
      console.warn("Monnify: suspiciously low amount", amount);
      return new Response(OK, { status: 200, headers: OK_HEADERS });
    }

    // Check 4: timestamp freshness (reject if > 30 min old)
    const eventTsStr = eventData?.createdOn || eventData?.completedOn;
    if (eventTsStr) {
      const ageMs = Date.now() - new Date(eventTsStr).getTime();
      if (!isNaN(ageMs) && ageMs > 30 * 60 * 1000) {
        console.warn("Monnify: stale event age ms:", ageMs);
        return new Response(OK, { status: 200, headers: OK_HEADERS });
      }
    }

    const sb = createClient(SUPA_URL, SUPA_SVC);

    // Check 5: event ID deduplication (replay attack prevention)
    const eventId = `monnify-${txRef}`;
    const { error: dupErr } = await sb.from("webhook_events").insert({
      event_id: eventId, provider: "monnify", event_type: eventType, payload: body,
    });
    if (dupErr) {
      console.warn("Monnify: duplicate event, skipping:", eventId);
      return new Response(OK, { status: 200, headers: OK_HEADERS });
    }

    // All 5 checks passed — credit wallet
    const { error: creditErr } = await sb.rpc("credit_wallet_from_monnify", {
      _user_id: userIdRaw, _amount: amount, _monnify_ref: txRef,
    });
    if (creditErr) {
      console.error("Monnify: credit failed:", creditErr.message);
    } else {
      console.log(`Monnify: credited NGN${amount} to user ${userIdRaw}`);
    }

    return new Response(OK, { status: 200, headers: OK_HEADERS });
  } catch (e) {
    console.error("Monnify webhook error:", e);
    return new Response(OK, { status: 200, headers: OK_HEADERS });
  }
});
