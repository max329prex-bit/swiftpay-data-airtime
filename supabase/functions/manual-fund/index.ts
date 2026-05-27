import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const KP_SK     = Deno.env.get("KORAPAY_SECRET_KEY")!;
const SUPA_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_SEC = Deno.env.get("MANUAL_FUND_SECRET") ?? "";
const KP_BASE   = "https://api.korapay.com/merchant/api/v1";

const PROVIDERS: Record<string, { bankCode: string; account: string }> = {
  iacafe:  { bankCode: "100002", account: "0965613666" },
  bsplug:  { bankCode: "120001", account: "6587166346" },
  aidapay: { bankCode: "999991", account: "6628650780" },
};

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

function isAuthorized(req: Request): boolean {
  const adminSecret = req.headers.get("x-admin-secret") ?? "";
  const authHeader  = req.headers.get("Authorization") ?? "";
  return (
    (ADMIN_SEC.length > 0 && adminSecret === ADMIN_SEC) ||
    authHeader.includes(SUPA_SVC) ||
    authHeader === SUPA_SVC ||
    authHeader === `Bearer ${SUPA_SVC}`
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Diagnostic: get actual outbound IP
  if (url.pathname.endsWith("/check-ip")) {
    try {
      const ipRes = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(10000) });
      const ipData = await ipRes.json();
      // Also test Korapay balance endpoint
      const kpRes = await fetch(`${KP_BASE}/balances`, {
        headers: { Authorization: `Bearer ${KP_SK}` },
        signal: AbortSignal.timeout(10000)
      });
      const kpData = await kpRes.json();
      return new Response(JSON.stringify({
        supabase_egress_ip: ipData.ip,
        korapay_balance_accessible: kpData.status === true,
        korapay_balance: kpData?.data?.NGN?.available_balance ?? 0,
        korapay_response: kpData
      }), { headers: corsHeaders });
    } catch(e) {
      return new Response(JSON.stringify({ error: String(e) }), { headers: corsHeaders });
    }
  }

  // Main: disburse to provider
  let body: { provider?: string; amount?: number };
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: corsHeaders }); }

  const { provider, amount } = body;
  if (!provider || !amount || amount <= 0)
    return new Response(JSON.stringify({ error: "provider and amount (>0) are required" }), { status: 400, headers: corsHeaders });

  const bankInfo = PROVIDERS[provider];
  if (!bankInfo)
    return new Response(JSON.stringify({ error: `Unknown provider: ${provider}` }), { status: 400, headers: corsHeaders });

  const ref = `MF-${provider.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  console.log(`[manual-fund] Disbursing ₦${amount} to ${provider} (${bankInfo.account}) ref=${ref}`);

  const kpRes = await fetch(`${KP_BASE}/transactions/disburse`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KP_SK}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      reference: ref,
      destination: {
        type: "bank_account", amount, currency: "NGN",
        bank_account: { bank: bankInfo.bankCode, account: bankInfo.account },
        narration: `BlitzPay ${provider} manual fund`,
      },
    }),
  });

  const kpData = await kpRes.json();
  console.log(`[manual-fund] Korapay response:`, JSON.stringify(kpData));

  if (kpData.status) {
    const sb = createClient(SUPA_URL, SUPA_SVC);
    await sb.from("provider_treasury")
      .update({ actual_balance: amount, last_synced_at: new Date().toISOString(), transfer_health: "healthy" })
      .eq("provider_code", provider);
    return new Response(JSON.stringify({ success: true, reference: ref, data: kpData.data }), { headers: corsHeaders });
  }

  return new Response(JSON.stringify({ success: false, error: kpData.message, reference: ref }), { status: 400, headers: corsHeaders });
});
