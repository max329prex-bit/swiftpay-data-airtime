import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const KP_SK    = Deno.env.get("KORAPAY_SECRET_KEY")!;
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_BOT   = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT  = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") ?? "";
const OK = JSON.stringify({ status: "success" });
const OK_HDR = { "Content-Type": "application/json" };

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function tg(msg: string) {
  if (!TG_BOT || !TG_CHAT) return;
  try { await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ chat_id:TG_CHAT, text:msg, parse_mode:"Markdown" }) }); } catch {}
}

serve(async (req) => {
  try {
    const rawBody = await req.text();
    const kSig = req.headers.get("x-korapay-signature") ?? "";
    if (kSig) {
      const expected = await hmacSha256Hex(KP_SK, rawBody);
      if (kSig !== expected) { console.error("Korapay: bad signature"); return new Response(OK, { status: 200, headers: OK_HDR }); }
    }
    const body = JSON.parse(rawBody);
    const { event, data } = body;
    if (event !== "charge.success") return new Response(OK, { status: 200, headers: OK_HDR });
    const ref = (data?.reference ?? "") as string;
    const amount = Number(data?.amount ?? 0);
    const userId = (data?.metadata?.user_id ?? "") as string;
    if (!ref || !userId || amount < 100) { console.warn("Korapay: missing fields"); return new Response(OK, { status: 200, headers: OK_HDR }); }
    const sb = createClient(SUPA_URL, SUPA_SVC);
    const { error: dupErr } = await sb.from("webhook_events").insert({ event_id: `korapay-${ref}`, provider: "korapay", event_type: event, payload: body });
    if (dupErr) { console.warn("Korapay: duplicate", ref); return new Response(OK, { status: 200, headers: OK_HDR }); }
    const { error: creditErr } = await sb.rpc("credit_wallet_from_korapay", { _user_id: userId, _amount: amount, _korapay_ref: ref });
    if (creditErr) {
      if (!creditErr.message?.includes("DUPLICATE")) {
        console.error("Korapay: credit failed:", creditErr.message);
        await tg(`⚠️ *Korapay credit failed*\nRef: \`${ref}\`\nAmount: ₦${amount}\nError: ${creditErr.message}`);
      }
    } else {
      console.log(`Korapay: credited ₦${amount} to ${userId}`);
      await tg(`✅ *Wallet funded*\n₦${amount.toLocaleString()} credited to ${userId.substring(0,8)}...\nRef: \`${ref}\``);
    }
    return new Response(OK, { status: 200, headers: OK_HDR });
  } catch (e) { console.error("Korapay webhook:", e); return new Response(OK, { status: 200, headers: OK_HDR }); }
});
