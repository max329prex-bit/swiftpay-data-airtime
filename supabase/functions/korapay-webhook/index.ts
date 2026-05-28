import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const KP_SK    = Deno.env.get("KORAPAY_SECRET_KEY")!;
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_BOT   = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT  = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") ?? "";
const KP_BASE  = "https://api.korapay.com/merchant/api/v1";
const OK = JSON.stringify({ status: "success" });
const OK_HDR = { "Content-Type": "application/json" };

async function hmacHex(secret: string, data: string, algo: "SHA-256" | "SHA-512"): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: algo }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function tg(msg: string) {
  if (!TG_BOT || !TG_CHAT) return;
  try { await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ chat_id:TG_CHAT, text:msg, parse_mode:"Markdown" }) }); } catch {}
}

async function verifyChargeWithKorapay(ref: string): Promise<boolean> {
  try {
    const r = await fetch(`${KP_BASE}/charges/${ref}`, {
      headers: { Authorization: `Bearer ${KP_SK}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) return false;
    const d = await r.json();
    const status = d?.data?.status ?? d?.data?.payment_status ?? "";
    return status === "success" || status === "paid";
  } catch {
    return false; // API unreachable — fall through to webhook payload trust
  }
}

serve(async (req) => {
  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    const { event, data } = body;

    if (event !== "charge.success") return new Response(OK, { status: 200, headers: OK_HDR });

    const ref       = (data?.reference ?? "") as string;
    const amount    = Number(data?.amount ?? 0);
    const netCredit = Number(data?.metadata?.net_credit ?? 0);
    const creditAmount = netCredit > 0 ? netCredit : amount;
    const userId    = (data?.metadata?.user_id ?? "") as string;

    if (!ref || !userId || amount < 100) {
      console.warn("Korapay: missing required fields", { ref, userId, amount });
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    // Signature check — try both SHA-256 and SHA-512 (Korapay uses SHA-256)
    const kSig = req.headers.get("x-korapay-signature") ?? "";
    let sigValid = false;
    if (kSig) {
      const sha256 = await hmacHex(KP_SK, rawBody, "SHA-256");
      const sha512 = await hmacHex(KP_SK, rawBody, "SHA-512");
      sigValid = kSig === sha256 || kSig === sha512;
      if (!sigValid) {
        console.warn(`Korapay: sig mismatch for ${ref}. Got: ${kSig.slice(0,16)}, SHA256: ${sha256.slice(0,16)}, SHA512: ${sha512.slice(0,16)}`);
        // Secondary check: verify directly with Korapay API
        const apiConfirmed = await verifyChargeWithKorapay(ref);
        if (!apiConfirmed) {
          console.error(`Korapay: sig failed AND API verify failed for ${ref}. Dropping.`);
          return new Response(OK, { status: 200, headers: OK_HDR });
        }
        console.log(`Korapay: sig failed but API confirmed ${ref} — proceeding`);
      }
    } else {
      // No signature header — verify with API
      console.warn(`Korapay: no signature header for ${ref}`);
      const apiConfirmed = await verifyChargeWithKorapay(ref);
      if (!apiConfirmed) {
        console.error(`Korapay: unsigned AND API verify failed for ${ref}. Dropping.`);
        return new Response(OK, { status: 200, headers: OK_HDR });
      }
      console.log(`Korapay: no sig but API confirmed ${ref} — proceeding`);
    }

    const sb = createClient(SUPA_URL, SUPA_SVC);

    // Dedup
    const { error: dupErr } = await sb.from("webhook_events").insert({
      event_id: `korapay-${ref}`, provider: "korapay", event_type: event, payload: body
    });
    if (dupErr?.code === "23505") {
      console.warn("Korapay: duplicate webhook", ref);
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    // Credit wallet
    const { error: creditErr } = await sb.rpc("credit_wallet_from_korapay", {
      _user_id: userId, _amount: creditAmount, _korapay_ref: ref
    });

    if (creditErr) {
      if (creditErr.message?.includes("DUPLICATE")) {
        return new Response(OK, { status: 200, headers: OK_HDR });
      }
      console.error("Korapay: credit failed:", creditErr.message);
      await tg(`\u26a0\ufe0f *Credit FAILED*\nRef: \`${ref}\`\n\u20a6${creditAmount}\n${creditErr.message}`);
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    console.log(`Korapay: \u20a6${creditAmount} credited to ${userId} ref=${ref}`);
    await tg(`\u2705 *BlitzPay Deposit*\n\u20a6${creditAmount.toLocaleString()} credited\nRef: \`${ref}\`\nSig valid: ${sigValid}`);
    return new Response(OK, { status: 200, headers: OK_HDR });

  } catch (e: unknown) {
    console.error("Korapay webhook crash:", e);
    return new Response(OK, { status: 200, headers: OK_HDR });
  }
});
