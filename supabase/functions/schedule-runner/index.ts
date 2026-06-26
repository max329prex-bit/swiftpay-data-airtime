import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const AIDAPAY_BASE = "https://www.aidapay.ng/api/v1";
const AIDAPAY_TOKEN = Deno.env.get("AIDAPAY_TOKEN")!;
const AIDAPAY_PIN = Deno.env.get("AIDAPAY_ACCOUNT_PIN")!;

const AIRTIME_MAP: Record<string, string> = {
  MTN: "mtn-airtime", AIRTEL: "airtel-airtime", GLO: "glo-airtime", "9MOBILE": "9mobile-airtime",
};

async function aidapayBuy(p: Record<string, string>) {
  try {
    const r = await fetch(`${AIDAPAY_BASE}/buy`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${AIDAPAY_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(p),
      signal: AbortSignal.timeout(30000),
    });
    const d = await r.json();
    if (!d.success) return { success: false, msg: d.message || d.error || "AidaPay failed" };
    const td = d.data?.transaction_data || {};
    return { success: true, ref: td.transaction_hash || "" };
  } catch (e) {
    return { success: false, msg: `AidaPay unreachable: ${e}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Authorise: either Supabase cron with header, or admin curl with header
  const headerSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || (headerSecret !== CRON_SECRET && !authHeader.includes(SUPA_SVC))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const sb = createClient(SUPA_URL, SUPA_SVC);

  const { data: due, error: dueErr } = await sb.rpc("fetch_due_schedules", { _limit: 25 });
  if (dueErr) {
    return new Response(JSON.stringify({ error: dueErr.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const results: any[] = [];

  for (const s of (due ?? [])) {
    const hash = `SCH-${s.id.slice(0, 8)}-${Date.now()}`;
    try {
      // 1) Consume wallet reservation, create pending tx
      const { data: tx, error: cErr } = await sb.rpc("consume_schedule_reservation", {
        _schedule_id: s.id, _aidapay_hash: hash,
      });
      if (cErr) throw new Error(cErr.message);

      // 2) Call provider (AidaPay only for v1)
      let providerResp: { success: boolean; ref?: string; msg?: string };
      if (s.type === "airtime") {
        providerResp = await aidapayBuy({
          service: AIRTIME_MAP[s.network] || "mtn-airtime",
          amount: String(s.amount), phone: s.phone,
          account_pin: AIDAPAY_PIN, request_id: hash,
        });
      } else if (s.type === "data") {
        providerResp = await aidapayBuy({
          service: AIRTIME_MAP[s.network]?.replace("-airtime", "-data") || "mtn-data",
          plan: s.package_code ?? "",
          phone: s.phone, account_pin: AIDAPAY_PIN, request_id: hash,
        });
      } else {
        providerResp = { success: false, msg: `Unsupported scheduled type: ${s.type}` };
      }

      if (!providerResp.success) {
        // Refund this run's spend back to wallet, then schedule retry
        await sb.from("transactions").update({ status: "failed", meta: { error: providerResp.msg } }).eq("id", (tx as any).id);
        await sb.rpc("refund_wallet", { _user_id: s.user_id, _amount: s.amount, _ref: hash });
        await sb.rpc("handle_schedule_failure", { _schedule_id: s.id, _err: providerResp.msg ?? "Unknown" });
        await sb.from("scheduled_runs").insert({
          schedule_id: s.id, user_id: s.user_id, status: "failed",
          attempt_no: (s.retry_count ?? 0) + 1, tx_id: (tx as any).id, error: providerResp.msg,
        });
        results.push({ id: s.id, status: "failed", error: providerResp.msg });
        continue;
      }

      // 3) Mark tx success + award points + advance schedule
      await sb.from("transactions").update({
        status: "success", aidapay_status: "Completed",
        meta: { schedule_id: s.id, provider_ref: providerResp.ref, bundle: s.bundle_size },
      }).eq("id", (tx as any).id);
      if (s.bp_value && s.bp_value > 0) {
        await sb.rpc("redeem_swift_points" as any, {}).catch(() => {}); // no-op; points awarded via direct profile bump
      }
      await sb.rpc("advance_schedule_after_success", { _schedule_id: s.id });
      await sb.from("scheduled_runs").insert({
        schedule_id: s.id, user_id: s.user_id, status: "success",
        attempt_no: 1, tx_id: (tx as any).id,
      });
      results.push({ id: s.id, status: "success", ref: providerResp.ref });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sb.rpc("handle_schedule_failure", { _schedule_id: s.id, _err: msg });
      results.push({ id: s.id, status: "error", error: msg });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});