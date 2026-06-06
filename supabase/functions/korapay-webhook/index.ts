import { createClient } from "npm:@supabase/supabase-js@2";

const KP_SK    = Deno.env.get("KORAPAY_SECRET_KEY")!;
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_BOT   = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT  = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") ?? "";
const KP_BASE  = "https://api.korapay.com/merchant/api/v1";
const OK       = JSON.stringify({ status: "success" });
const OK_HDR   = { "Content-Type": "application/json" };

async function hmacHex(secret: string, data: string, algo: "SHA-256" | "SHA-512"): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: algo }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function tg(msg: string) {
  if (!TG_BOT || !TG_CHAT) return;
  try { await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: TG_CHAT, text: msg, parse_mode: "Markdown" }) }); } catch {}
}

async function verifyChargeWithKorapay(ref: string): Promise<boolean> {
  try {
    const r = await fetch(`${KP_BASE}/charges/${ref}`, {
      headers: { Authorization: `Bearer ${KP_SK}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) return false;
    const d = await r.json();
    const status = (d?.data?.status ?? d?.data?.payment_status ?? "").toLowerCase();
    return status === "success" || status === "paid";
  } catch { return false; }
}

Deno.serve(async (req) => {
  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    const { event, data } = body;

    // Always return 200 to Korapay immediately — even for non-credit events
    if (event !== "charge.success") return new Response(OK, { status: 200, headers: OK_HDR });

    const ref          = (data?.reference ?? "") as string;
    const amount       = Number(data?.amount ?? 0);
    const netCredit    = Number(data?.metadata?.net_credit ?? 0);
    const creditAmount = netCredit > 0 ? netCredit : amount;
    const userId       = (data?.metadata?.user_id ?? "") as string;

    if (!ref || !userId || amount < 100) {
      console.warn("Korapay: missing fields", { ref, userId, amount });
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    // Verify signature — SHA-256 is Korapay standard
    const kSig = req.headers.get("x-korapay-signature") ?? "";
    let sigValid = false;
    if (kSig) {
      const sha256 = await hmacHex(KP_SK, rawBody, "SHA-256");
      const sha512 = await hmacHex(KP_SK, rawBody, "SHA-512");
      sigValid = kSig === sha256 || kSig === sha512;
      if (!sigValid) {
        console.warn(`Korapay: sig mismatch ${ref} — falling back to API verify`);
        const ok = await verifyChargeWithKorapay(ref);
        if (!ok) { console.error(`Korapay: sig+API both failed ${ref} — dropping`); return new Response(OK, { status: 200, headers: OK_HDR }); }
        console.log(`Korapay: API confirmed ${ref} despite sig mismatch`);
      }
    } else {
      console.warn(`Korapay: no sig header ${ref} — verifying with API`);
      const ok = await verifyChargeWithKorapay(ref);
      if (!ok) { console.error(`Korapay: unsigned+API failed ${ref} — dropping`); return new Response(OK, { status: 200, headers: OK_HDR }); }
      console.log(`Korapay: API confirmed ${ref} (no sig header)`);
    }

    const sb = createClient(SUPA_URL, SUPA_SVC);

    // Dedup via webhook_events
    const { error: dupErr } = await sb.from("webhook_events").insert({
      event_id: `korapay-${ref}`, provider: "korapay", event_type: event, payload: body
    });
    if (dupErr?.code === "23505") {
      console.warn("Korapay: duplicate webhook", ref);
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    // Credit wallet atomically
    const { error: creditErr } = await sb.rpc("credit_wallet_from_korapay", {
      _user_id: userId, _amount: creditAmount, _korapay_ref: ref
    });

    if (creditErr) {
      if ((creditErr.message ?? "").includes("DUPLICATE")) return new Response(OK, { status: 200, headers: OK_HDR });
      console.error("Korapay credit failed:", creditErr.message);
      await tg(`⚠️ *Credit FAILED*\nRef: \`${ref}\`\n₦${creditAmount}\n${creditErr.message}`);
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    console.log(`Korapay: ₦${creditAmount} credited to ${userId} ref=${ref}`);
    await tg(`✅ *BlitzPay Deposit*\n₦${creditAmount.toLocaleString()} credited\nRef: \`${ref}\`\nSig valid: ${sigValid}`);
    return new Response(OK, { status: 200, headers: OK_HDR });

  } catch (e) {
    console.error("Korapay webhook crash:", e);
    return new Response(OK, { status: 200, headers: OK_HDR });
  }
});
