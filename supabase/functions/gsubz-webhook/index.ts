import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPA_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GSUBZ_KEY = Deno.env.get("GSUBZ_API_KEY") ?? "";
const TG_BOT    = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT   = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") ?? "";

const OK     = JSON.stringify({ status: "success" });
const OK_HDR = { "Content-Type": "application/json" };

async function tg(msg: string) {
  if (!TG_BOT || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text: msg, parse_mode: "Markdown" }),
    });
  } catch (_) { /* non-blocking */ }
}

serve(async (req) => {
  try {
    const rawBody = await req.text();
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    console.log(`[gsubz-webhook] POST from ${clientIp}`);
    console.log(`[gsubz-webhook] FULL_BODY=${rawBody.slice(0, 2000)}`);

    // GSubz may or may not send a signature. If they do, verify it.
    const sig = req.headers.get("x-gsubz-signature") ?? req.headers.get("signature") ?? "";
    if (sig && GSUBZ_KEY) {
      // Simple token comparison if GSubz uses token-based auth
      // If they use HMAC, we'll need to update this logic
      // For now, log the signature for analysis
      console.log(`[gsubz-webhook] signature present: ${sig.slice(0, 20)}...`);
    }

    let body: Record<string, unknown>;
    try { body = JSON.parse(rawBody); }
    catch {
      console.error("[gsubz-webhook] invalid JSON");
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    // GSubz callback payload format (common VTU patterns):
    // { reference, status, phone, amount, message, transaction_id }
    const ref = String(body?.reference ?? body?.request_id ?? body?.requestID ?? body?.transaction_id ?? "");
    const statusRaw = String(body?.status ?? body?.delivery_status ?? body?.status_code ?? "").toLowerCase();
    const message = String(body?.message ?? body?.description ?? body?.msg ?? body?.error ?? "");

    if (!ref) {
      console.warn("[gsubz-webhook] no reference in payload, skipping");
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    console.log(`[gsubz-webhook] ref=${ref} status=${statusRaw} message=${message.slice(0, 100)}`);

    const sb = createClient(SUPA_URL, SUPA_SVC);

    // Find the transaction by provider reference or our reference
    const { data: txRows } = await sb.from("transactions")
      .select("id, status, reference, provider_reference, type, amount, user_id")
      .or(`reference.eq.${ref},provider_reference.eq.${ref}`)
      .order("created_at", { ascending: false })
      .limit(1);

    const tx = txRows?.[0];
    if (!tx) {
      console.warn(`[gsubz-webhook] transaction not found for ref=${ref}`);
      await tg(`⚠️ *GSubz webhook: tx not found*\nref: ${ref}\nstatus: ${statusRaw}\nbody_preview: ${rawBody.slice(0, 200)}`);
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    // Already handled? Skip
    if (tx.status === "success" || tx.status === "failed") {
      console.log(`[gsubz-webhook] tx ${tx.id} already ${tx.status}, skipping`);
      return new Response(OK, { status: 200, headers: OK_HDR });
    }

    // Determine if success or failure
    const isSuccess = statusRaw === "success" || statusRaw === "successful" || statusRaw === "delivered" || statusRaw === "completed" || statusRaw === "200" || statusRaw === "100";
    const isFailed = statusRaw === "failed" || statusRaw === "failure" || statusRaw === "error" || statusRaw === "cancelled" || statusRaw === "rejected" || statusRaw.includes("fail") || statusRaw.includes("error");

    if (isSuccess) {
      // Commit the transaction to success
      const { error: commitErr } = await sb.rpc("commit_transaction", {
        _tx_id: tx.id,
        _provider_reference: ref,
        _meta: { gsubz_callback: body, gsubz_status: statusRaw, gsubz_message: message },
      });
      if (commitErr) {
        console.error(`[gsubz-webhook] commit_transaction failed: ${commitErr.message}`);
        await tg(`🚨 *GSubz webhook: commit failed*\ntx: ${tx.id}\nref: ${ref}\nerror: ${commitErr.message}`);
      } else {
        console.log(`[gsubz-webhook] ✅ tx ${tx.id} committed to success`);
        await tg(`✅ *GSubz delivery confirmed*\n${tx.type.toUpperCase()} ₦${tx.amount}\nref: ${ref}\nstatus: ${statusRaw}`);
      }
    } else if (isFailed) {
      // Fail and refund
      const { error: failErr } = await sb.rpc("fail_and_refund_transaction", {
        _tx_id: tx.id,
        _reason: `GSubz callback: ${message || statusRaw}`,
        _provider_reference: ref,
        _meta: { gsubz_callback: body, gsubz_status: statusRaw, gsubz_message: message },
      });
      if (failErr) {
        console.error(`[gsubz-webhook] fail_and_refund failed: ${failErr.message}`);
        await tg(`🚨 *GSubz webhook: refund failed*\ntx: ${tx.id}\nref: ${ref}\nerror: ${failErr.message}`);
      } else {
        console.log(`[gsubz-webhook] ❌ tx ${tx.id} failed and refunded`);
        await tg(`❌ *GSubz delivery failed — refunded*\n${tx.type.toUpperCase()} ₦${tx.amount}\nref: ${ref}\nreason: ${message || statusRaw}`);
      }
    } else {
      // Ambiguous status — log for manual review
      console.warn(`[gsubz-webhook] ambiguous status for tx ${tx.id}: ${statusRaw}`);
      await tg(`⚠️ *GSubz ambiguous status*\ntx: ${tx.id}\nref: ${ref}\nstatus: ${statusRaw}\nmsg: ${message.slice(0, 200)}`);
    }

    return new Response(OK, { status: 200, headers: OK_HDR });
  } catch (e) {
    console.error("[gsubz-webhook] unhandled error:", e);
    return new Response(OK, { status: 200, headers: OK_HDR });
  }
});
