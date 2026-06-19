import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const PV_API_KEY  = Deno.env.get("PAYVESSEL_API_KEY") ?? "";
const PV_SECRET   = Deno.env.get("PAYVESSEL_SECRET_KEY") ?? "";
const SUPA_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PV_BASE     = "https://api.payvessel.com/pms/api/external";
const PV_HEADERS  = { "api-key": PV_API_KEY, "api-secret": PV_SECRET, "Content-Type": "application/json" };
const CORS        = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url    = new URL(req.url);
  const action = url.searchParams.get("action") ?? "check"; // check | validate | transfer
  const result: Record<string, unknown> = { action, timestamp: new Date().toISOString() };

  // ── 1. Balance check ────────────────────────────────────────────────────
  try {
    const r = await fetch(`${PV_BASE}/request/wallet/balance/`, {
      method: "GET", headers: PV_HEADERS, signal: AbortSignal.timeout(12000)
    });
    const text = await r.text();
    result.balance_http = r.status;
    result.balance_raw  = text.slice(0, 600);
    try {
      const d = JSON.parse(text);
      result.balance_status  = d.status;
      result.balance_message = d.message;
      result.balance_data    = d.data;
      result.balance_amount  = Number(d?.data?.balance ?? d?.data?.available_balance ?? d?.data?.wallet_balance ?? 0);
    } catch { result.balance_parse_error = true; }
  } catch(e) { result.balance_error = String(e); }

  if (action === "check") {
    return new Response(JSON.stringify(result, null, 2), { headers: CORS });
  }

  // ── 2. Validate iacafe account ──────────────────────────────────────────
  const IACAFE_ACCOUNT = "0965613666";
  const IACAFE_BANK    = "100002";

  try {
    const r = await fetch(`${PV_BASE}/request/wallet/validate-account/`, {
      method: "POST", headers: PV_HEADERS,
      body: JSON.stringify({ account_number: IACAFE_ACCOUNT, bank_code: IACAFE_BANK }),
      signal: AbortSignal.timeout(12000)
    });
    const text = await r.text();
    result.validate_http = r.status;
    result.validate_raw  = text.slice(0, 400);
    try {
      const d = JSON.parse(text);
      result.validate_status = d.status;
      result.validate_data   = d.data;
    } catch {}
  } catch(e) { result.validate_error = String(e); }

  if (action === "validate") {
    return new Response(JSON.stringify(result, null, 2), { headers: CORS });
  }

  // ── 3. Transfer (action=transfer) ──────────────────────────────────────
  if (action === "transfer") {
    const balance = Number(result.balance_amount ?? 0);
    if (balance <= 0) {
      result.transfer_skipped = "Balance is zero or unknown — cannot transfer";
      return new Response(JSON.stringify(result, null, 2), { headers: CORS });
    }

    // Send the full available balance (keeping ₦0 — no reserve needed)
    const transferAmount = balance;
    const ref = `DIAG-IACAFE-${Date.now().toString(36).toUpperCase()}`;

    try {
      const r = await fetch(`${PV_BASE}/request/wallet/transfer/`, {
        method: "POST", headers: PV_HEADERS,
        body: JSON.stringify({
          amount: String(transferAmount),
          account_number: IACAFE_ACCOUNT,
          bank_code: IACAFE_BANK,
          account_name: "IACAFE",
          narration: "BlitzPay treasury refill to iacafe",
          reference: ref
        }),
        signal: AbortSignal.timeout(25000)
      });
      const text = await r.text();
      result.transfer_http = r.status;
      result.transfer_raw  = text.slice(0, 600);
      try {
        const d = JSON.parse(text);
        result.transfer_status    = d.status;
        result.transfer_message   = d.message;
        result.transfer_data      = d.data;
        result.transfer_reference = d.data?.reference ?? ref;
        result.transfer_amount    = transferAmount;
      } catch {}

      // If success, update iacafe balance in Supabase
      if ((result.transfer_status as boolean) === true) {
        const sb = createClient(SUPA_URL, SUPA_SVC);
        await sb.from("provider_treasury")
          .update({ last_refill_at: new Date().toISOString(), transfer_health: "healthy" })
          .eq("provider_code", "iacafe");
        result.db_updated = true;
      }

    } catch(e) { result.transfer_error = String(e); }
  }

  return new Response(JSON.stringify(result, null, 2), { headers: CORS });
});
