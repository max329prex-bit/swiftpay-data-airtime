import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPA_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KP_SK       = Deno.env.get("KORAPAY_SECRET_KEY")!;
const KP_BASE     = "https://api.korapay.com/merchant/api/v1";
const TG_BOT      = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT     = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const cors        = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

async function tg(msg: string) {
  if (!TG_BOT || !TG_CHAT) return;
  try { await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ chat_id:TG_CHAT, text:msg, parse_mode:"Markdown" }) }); } catch {}
}

async function korapayBalance(): Promise<number> {
  try {
    const r = await fetch(`${KP_BASE}/balances`, { headers:{ Authorization:`Bearer ${KP_SK}` }, signal: AbortSignal.timeout(10000) });
    const d = await r.json();
    return Number(d?.data?.NGN?.available_balance ?? 0);
  } catch { return 0; }
}

async function korapayDisburse(amount:number, bankCode:string, accountNo:string, ref:string) {
  try {
    const r = await fetch(`${KP_BASE}/transactions/disburse`, {
      method:"POST",
      headers:{ Authorization:`Bearer ${KP_SK}`, "Content-Type":"application/json" },
      body: JSON.stringify({ reference:ref, destination:{ type:"bank_account", amount, currency:"NGN", bank_account:{ bank:bankCode, account:accountNo }, narration:"BlitzPay treasury refill" } }),
      signal: AbortSignal.timeout(20000)
    });
    const d = await r.json();
    return d.status ? { success:true, reference:d.data?.reference ?? ref } : { success:false, error:d.message ?? "Disburse failed" };
  } catch(e) { return { success:false, error:`Unreachable: ${e}` }; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // SECURITY: Require cron secret header
  const incoming = req.headers.get("x-cron-secret") ?? "";
  if (!CRON_SECRET || incoming !== CRON_SECRET) {
    console.warn("treasury-manager: unauthorized call rejected");
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const sb = createClient(SUPA_URL, SUPA_SVC);
  try {
    const { data: ks } = await sb.from("app_settings").select("value").eq("key","treasury_automation_enabled").maybeSingle();
    if (ks?.value === false || ks?.value === "false") return new Response(JSON.stringify({ status:"disabled" }), { headers:{...cors,"Content-Type":"application/json"} });

    const { data: providers } = await sb.from("provider_treasury").select("*");
    if (!providers?.length) return new Response(JSON.stringify({ checked:0 }), { headers:{...cors,"Content-Type":"application/json"} });

    const now = new Date();
    const results: Record<string,string> = {};

    for (const prov of providers) {
      try {
        const code = prov.provider_code;
        const today = now.toISOString().split("T")[0];
        if (prov.daily_cap_reset_at !== today) {
          await sb.from("provider_treasury").update({ daily_refilled_today:0, daily_cap_reset_at:today }).eq("provider_code",code);
          prov.daily_refilled_today = 0;
        }
        if (prov.cb_paused_until && new Date(prov.cb_paused_until) > now) { results[code]="circuit_breaker_active"; continue; }

        const { data: reservedRows } = await sb.from("liquidity_reservations").select("amount").eq("provider_code",code).eq("status","pending");
        const reserved = reservedRows?.reduce((s:number,r:any) => s+Number(r.amount), 0) ?? 0;
        const usable = prov.actual_balance - reserved;

        const avgSpend10 = Number(prov.avg_spend_10min) || 0;
        const runwayMin  = avgSpend10 > 0 ? (usable / avgSpend10) * 10 : 9999;
        const { count: pendingCount } = await sb.from("treasury_transfers").select("id",{count:"exact",head:true}).eq("provider_code",code).in("status",["pending","verifying"]);
        const refillPending = (pendingCount ?? 0) > 0;

        if (usable < prov.critical_stop_threshold || (runwayMin < 20 && refillPending)) {
          await sb.from("provider_treasury").update({ transfer_health:"degraded" }).eq("provider_code",code);
          await tg(`[ALERT] ${code.toUpperCase()} critically low. Usable: NGN${usable.toFixed(0)}. Runway: ~${runwayMin.toFixed(0)}min`);
          results[code]="degraded_low_balance"; continue;
        }
        if (usable >= prov.refill_threshold) { results[code]="ok"; continue; }
        if (!prov.bank_account_number || !prov.bank_code) { results[code]="no_bank_details"; continue; }
        if (prov.last_refill_at) {
          const minsSince = (now.getTime() - new Date(prov.last_refill_at).getTime()) / 60000;
          if (minsSince < prov.refill_cooldown_minutes) { results[code]="cooldown"; continue; }
        }
        const refillAmount = Number(prov.refill_target) - Number(prov.actual_balance);
        if (prov.daily_refilled_today + refillAmount > prov.daily_refill_cap) { await tg(`[CAP] ${code.toUpperCase()} daily cap reached`); results[code]="daily_cap"; continue; }
        if (refillPending) { results[code]="refill_pending"; continue; }

        const kpBal = await korapayBalance();
        if (kpBal < refillAmount + 500) { await tg(`[LOW] Korapay low for ${code.toUpperCase()} refill. KP: NGN${kpBal}`); results[code]="korapay_insufficient"; continue; }

        const refRef = `TR-${code.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
        const disburse = await korapayDisburse(refillAmount, prov.bank_code, prov.bank_account_number, refRef);
        if (!disburse.success) {
          const newF = (prov.cb_failures ?? 0) + 1;
          const cbPause = newF >= 3 ? new Date(now.getTime() + 10*60000) : null;
          await sb.from("provider_treasury").update({ cb_failures:newF, ...(cbPause?{cb_paused_until:cbPause.toISOString()}:{}) }).eq("provider_code",code);
          await tg(`[FAIL] ${code.toUpperCase()} refill FAILED (${newF}/3): ${(disburse as any).error}`);
          results[code]="failed"; continue;
        }
        await sb.rpc("record_treasury_transfer", { _provider:code, _amount:refillAmount, _kp_ref:(disburse as any).reference ?? refRef, _bank_code:prov.bank_code, _account:prov.bank_account_number });
        await sb.from("provider_treasury").update({ cb_failures:0, last_refill_at:now.toISOString(), transfer_health:"healthy", daily_refilled_today:prov.daily_refilled_today+refillAmount }).eq("provider_code",code);
        await tg(`[REFILL] ${code.toUpperCase()} refill initiated NGN${refillAmount.toLocaleString()}. Ref: ${(disburse as any).reference ?? refRef}`);
        results[code]=`refilled_NGN${refillAmount}`;
      } catch(e) { console.error(`Treasury error ${prov.provider_code}:`,e); results[prov.provider_code]="error"; }
    }
    return new Response(JSON.stringify({ status:"ok", results, checked:providers.length }), { headers:{...cors,"Content-Type":"application/json"} });
  } catch(e) {
    await tg(`[CRASH] Treasury Manager crashed: ${e}`);
    return new Response(JSON.stringify({ error:String(e) }), { status:500, headers:{...cors,"Content-Type":"application/json"} });
  }
});
