import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AIDAPAY_TOKEN = Deno.env.get("AIDAPAY_TOKEN")!;
const SUPA_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig  = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  try {
    const rawBody = await req.text();
    const sig     = req.headers.get("Signature") || req.headers.get("signature") || "";

    // Check 1: HMAC-SHA256 signature
    const expected = await hmacSha256Hex(AIDAPAY_TOKEN, rawBody);
    if (sig && sig !== expected) {
      console.error("AidaPay: bad signature");
      return new Response("Forbidden", { status: 403 });
    }

    const body = JSON.parse(rawBody);
    const { transaction_hash, status, meter_token, meter_unit, ref } = body;
    if (!transaction_hash) return new Response("OK", { status: 200 });

    const sb = createClient(SUPA_URL, SUPA_SVC);

    // Check 2: verify reference exists in our DB (if ref provided)
    if (ref) {
      const { data: txRow } = await sb.from("transactions")
        .select("id, status").eq("provider_reference", ref).maybeSingle();
      if (txRow?.status === "success") {
        console.warn("AidaPay: tx already SUCCESS, skipping");
        return new Response("OK", { status: 200 });
      }
    }

    // Check 3 & 4: event dedup for success events (prevents double-credit)
    const isSuccess = ["successful", "success"].includes((status || "").toLowerCase());
    if (isSuccess) {
      const eventId = `aidapay-${transaction_hash}`;
      const { error: dupErr } = await sb.from("webhook_events").insert({
        event_id: eventId, provider: "aidapay", event_type: status, payload: body,
      });
      if (dupErr) {
        console.warn("AidaPay: duplicate success event, skipping:", eventId);
        return new Response("OK", { status: 200 });
      }
    }

    // All checks passed — resolve transaction
    const meta: Record<string, unknown> = {};
    if (meter_token) meta.meter_token = meter_token;
    if (meter_unit)  meta.meter_unit  = meter_unit;

    const { error: resolveErr } = await sb.rpc("complete_vtu_transaction", {
      _aidapay_hash: transaction_hash, _status: status, _meta: meta,
    });
    if (resolveErr) {
      console.error("AidaPay: complete_vtu_transaction failed:", resolveErr.message);
    } else {
      console.log(`AidaPay: resolved ${transaction_hash} -> ${status}`);
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("AidaPay webhook error:", e);
    return new Response("OK", { status: 200 });
  }
});
