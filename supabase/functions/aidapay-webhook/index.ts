import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const AIDAPAY_TOKEN = Deno.env.get("AIDAPAY_TOKEN")!;
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
serve(async (req) => {
  try {
    const rawBody = await req.text();
    const sig = req.headers.get("Signature") || req.headers.get("signature") || "";
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(AIDAPAY_TOKEN), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
    const sigBytes = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
    const expected = Array.from(new Uint8Array(sigBytes)).map(b=>b.toString(16).padStart(2,"0")).join("");
    if (sig && sig !== expected) { console.error("Bad AidaPay sig"); return new Response("Forbidden",{status:403}); }
    const { transaction_hash, status, meter_token, meter_unit } = JSON.parse(rawBody);
    if (!transaction_hash) return new Response("OK",{status:200});
    const sb = createClient(SUPA_URL, SUPA_SVC);
    const meta: Record<string,unknown> = {};
    if (meter_token) meta.meter_token = meter_token;
    if (meter_unit) meta.meter_unit = meter_unit;
    await sb.rpc("complete_vtu_transaction", { _aidapay_hash:transaction_hash, _status:status, _meta:meta });
    return new Response("OK",{status:200});
  } catch(e) { console.error("aidapay-webhook:", e); return new Response("OK",{status:200}); }
});
