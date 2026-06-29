import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Authorize: either Supabase cron with header, or admin curl with service key
  const headerSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || (headerSecret !== CRON_SECRET && !authHeader.includes(SUPA_SVC))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPA_URL, SUPA_SVC);

  // 1. Fetch due schedules
  const { data: due, error: dueErr } = await sb.rpc("fetch_due_schedules", { _limit: 25 });
  if (dueErr) {
    console.error("[scheduler] fetch_due_schedules error:", dueErr.message);
    return new Response(JSON.stringify({ error: dueErr.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];

  for (const s of (due ?? [])) {
    const hash = `SCH-${s.id.slice(0, 8)}-${Date.now()}`;
    try {
      console.log(`[scheduler] processing schedule ${s.id}: ${s.type} ${s.network} ${s.phone} ₦${s.amount}`);

      // 1) Consume wallet reservation, create pending tx
      const { data: tx, error: cErr } = await sb.rpc("consume_schedule_reservation", {
        _schedule_id: s.id,
        _aidapay_hash: hash,
      });
      if (cErr) throw new Error(cErr.message);
      const txId = (tx as any).id;

      // 2) Call vtu-purchase edge function (reuses our fixed GSubz code)
      // Build a service-role JWT for internal invocation
      const vtuResp = await fetch(`${SUPA_URL}/functions/v1/vtu-purchase`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SUPA_SVC}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: s.type,
          network: s.network,
          phone: s.phone,
          amount: s.amount,
          package_code: s.package_code ?? "",
          provider_code: s.provider_code ?? "",
          pin: "SCHEDULE", // bypass PIN for scheduled purchases
        }),
        signal: AbortSignal.timeout(45000),
      });

      const vtuData = await vtuResp.json();
      console.log(`[scheduler] vtu-purchase response:`, JSON.stringify(vtuData).slice(0, 300));

      if (!vtuData?.success) {
        const errMsg = vtuData?.error || vtuData?.message || "Provider failed";
        // Mark tx failed and refund
        await sb.from("transactions").update({
          status: "failed",
          meta: { error: errMsg, schedule_id: s.id, provider_ref: vtuData?.reference },
        }).eq("id", txId);
        await sb.rpc("refund_wallet", { _user_id: s.user_id, _amount: s.amount, _ref: hash });
        await sb.rpc("handle_schedule_failure", { _schedule_id: s.id, _err: errMsg });
        await sb.from("scheduled_runs").insert({
          schedule_id: s.id, user_id: s.user_id, status: "failed",
          attempt_no: (s.retry_count ?? 0) + 1, tx_id: txId, error: errMsg,
        });
        results.push({ id: s.id, status: "failed", error: errMsg });
        console.log(`[scheduler] schedule ${s.id} failed: ${errMsg}`);
        continue;
      }

      // 3) Success — mark tx success, advance schedule
      await sb.from("transactions").update({
        status: "success",
        meta: {
          schedule_id: s.id,
          provider_ref: vtuData.reference,
          bundle: s.bundle_size,
        },
      }).eq("id", txId);

      if (s.bp_value && s.bp_value > 0) {
        try { await sb.rpc("award_swift_points", { _user_id: s.user_id, _points: s.bp_value, _reason: `Scheduled ${s.type}` }); } catch {}
      }

      await sb.rpc("advance_schedule_after_success", { _schedule_id: s.id });
      await sb.from("scheduled_runs").insert({
        schedule_id: s.id, user_id: s.user_id, status: "success",
        attempt_no: 1, tx_id: txId,
      });
      results.push({ id: s.id, status: "success", ref: vtuData.reference });
      console.log(`[scheduler] schedule ${s.id} success: ${vtuData.reference}`);

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[scheduler] schedule ${s.id} exception:`, msg);
      await sb.rpc("handle_schedule_failure", { _schedule_id: s.id, _err: msg });
      results.push({ id: s.id, status: "error", error: msg });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
