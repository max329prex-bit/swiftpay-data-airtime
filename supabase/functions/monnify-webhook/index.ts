import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const MONNIFY_SECRET = Deno.env.get("MONNIFY_SECRET_KEY")!;
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OK = JSON.stringify({ responseCode:"00", responseMessage:"Approved" });
serve(async (req) => {
  try {
    const rawBody = await req.text();
    const mSig = req.headers.get("monnify-signature") || "";
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(MONNIFY_SECRET), {name:"HMAC",hash:"SHA-512"}, false, ["sign"]);
    const sigBytes = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
    const expected = Array.from(new Uint8Array(sigBytes)).map(b=>b.toString(16).padStart(2,"0")).join("");
    if (mSig && mSig !== expected) { console.error("Bad Monnify sig"); return new Response(OK,{status:200}); }
    const { eventType, eventData } = JSON.parse(rawBody);
    if (!["SUCCESSFUL_TRANSACTION","PAID"].includes(eventType)) return new Response(OK,{status:200});
    const txRef = eventData?.transactionReference || "";
    const amount = Number(eventData?.amountPaid || 0);
    const accountRef = eventData?.destinationAccountInformation?.accountReference || eventData?.product?.reference || "";
    const userId = accountRef.replace(/^SP-/,"");
    if (!userId || amount <= 0) return new Response(OK,{status:200});
    const sb = createClient(SUPA_URL, SUPA_SVC);
    await sb.rpc("credit_wallet_from_monnify", { _user_id:userId, _amount:amount, _monnify_ref:txRef });
    return new Response(OK,{status:200,headers:{"Content-Type":"application/json"}});
  } catch(e) { console.error("monnify-webhook:", e); return new Response(OK,{status:200}); }
});
