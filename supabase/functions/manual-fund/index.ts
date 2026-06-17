import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// manual-fund: KoraPay disbursement has been removed.
// Provider treasury refills should now be done manually via PayVessel dashboard.
// This endpoint retains the /check-ip diagnostic and the treasury update mechanism.

const SUPA_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_SEC = Deno.env.get("MANUAL_FUND_SECRET") ?? "";

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
      return new Response(JSON.stringify({
        supabase_egress_ip: ipData.ip,
        note: "KoraPay removed. Use PayVessel dashboard for provider treasury refills.",
      }), { headers: corsHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { headers: corsHeaders });
    }
  }

  // Manual treasury balance update (admin marks a provider as funded after doing it via PayVessel dashboard)
  let body: { provider?: string; amount?: number };
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: corsHeaders }); }

  const { provider, amount } = body;
  if (!provider || !amount || amount <= 0) {
    return new Response(JSON.stringify({ error: "provider and amount (>0) are required" }), { status: 400, headers: corsHeaders });
  }

  // Update treasury balance in DB (admin confirms they funded via PayVessel dashboard)
  const sb = createClient(SUPA_URL, SUPA_SVC);
  const { error } = await sb.from("provider_treasury")
    .update({ actual_balance: amount, last_synced_at: new Date().toISOString(), transfer_health: "healthy" })
    .eq("provider_code", provider);

  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 400, headers: corsHeaders });
  }

  const ref = `MF-${provider.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  console.log(`[manual-fund] Treasury updated for ${provider}: ₦${amount} ref=${ref}`);

  return new Response(JSON.stringify({
    success: true,
    reference: ref,
    message: `Treasury for ${provider} marked as ₦${amount}. Actual PayVessel transfer must be done via dashboard.`,
  }), { headers: corsHeaders });
});
