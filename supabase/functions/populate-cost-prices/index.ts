import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPA_URL   = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SYNC_SECRET = Deno.env.get("SYNC_ADMIN_SECRET") ?? "";
const GSUBZ_KEY  = Deno.env.get("GSUBZ_API_KEY") ?? "";
const IACAFE_TOKEN = Deno.env.get("IACAFE_TOKEN") ?? "";
const BSPLUG_TOKEN = Deno.env.get("BSPLUG_TOKEN") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

// Gsubz service codes that map to our packages
const GSUBZ_SERVICES = [
  "mtn_awoof", "mtn_sme", "mtn_cg",
  "airtel_awoof", "airtel_sme", "airtel_cg",
  "glo_awoof", "glo_gifting", "glo_cg",
  "9mobile_awoof", "9mobile_sme",
];

// IACafe budget-data endpoint — returns plan list with prices
const IACAFE_BUDGET_URL = "https://iacafe.com.ng/devapi/v1/data-plans";

// BSPlug data plans endpoint
const BSPLUG_PLANS_URL = "https://bsplug.net/api/data/";

async function fetchGsubzPlans(): Promise<Map<string, number>> {
  const costMap = new Map<string, number>();
  for (const svc of GSUBZ_SERVICES) {
    try {
      const r = await fetch(`https://gsubz.com/api/plans/?service=${svc}`, {
        headers: { "api-key": GSUBZ_KEY },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) continue;
      const d = await r.json();
      const plans: Record<string, unknown>[] = Array.isArray(d?.data) ? d.data
        : Array.isArray(d?.plans) ? d.plans
        : Array.isArray(d) ? d : [];
      for (const p of plans) {
        const id = String(p.id ?? p.plan_id ?? "");
        const price = Number(p.price ?? p.amount ?? p.cost ?? 0);
        if (id && price > 0) {
          // package_code format in DB: GSZ-{service}-{planId}
          costMap.set(`GSZ-${svc}-${id}`, price);
        }
      }
    } catch { /* skip service on error */ }
  }
  return costMap;
}

async function fetchIacafePlans(): Promise<Map<number, number>> {
  const costMap = new Map<number, number>();
  try {
    const r = await fetch(IACAFE_BUDGET_URL, {
      headers: { Authorization: `Bearer ${IACAFE_TOKEN}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return costMap;
    const d = await r.json();
    const plans: Record<string, unknown>[] = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
    for (const p of plans) {
      const id = Number(p.id ?? 0);
      const price = Number(p.price ?? p.amount ?? p.selling_price ?? 0);
      if (id && price > 0) costMap.set(id, price);
    }
  } catch { /* skip */ }
  return costMap;
}

async function fetchBsplugPlans(): Promise<Map<number, number>> {
  const costMap = new Map<number, number>();
  try {
    const r = await fetch(BSPLUG_PLANS_URL, {
      headers: { Authorization: `Token ${BSPLUG_TOKEN}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return costMap;
    const d = await r.json();
    const plans: Record<string, unknown>[] = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
    for (const p of plans) {
      const id = Number(p.id ?? 0);
      const price = Number(p.plan_amount ?? p.price ?? p.amount ?? 0);
      if (id && price > 0) costMap.set(id, price);
    }
  } catch { /* skip */ }
  return costMap;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (d: unknown, s = 200) =>
    new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  // Auth check: require x-admin-secret or service role
  const secret = req.headers.get("x-admin-secret");
  const authHdr = req.headers.get("Authorization") ?? "";
  const isServiceRole = authHdr.includes(SUPA_SVC);
  if (SYNC_SECRET && secret !== SYNC_SECRET && !isServiceRole) {
    return json({ error: "Unauthorized" }, 401);
  }

  const db = createClient(SUPA_URL, SUPA_SVC);

  // Fetch all packages from DB
  const { data: allPkgs, error: pkgErr } = await db
    .from("packages")
    .select("package_code, provider_code, cost_price");
  if (pkgErr) return json({ error: pkgErr.message }, 500);

  // Fetch cost maps from all providers in parallel
  const [gsubzCosts, iacafeCosts, bsplugCosts] = await Promise.all([
    fetchGsubzPlans(),
    fetchIacafePlans(),
    fetchBsplugPlans(),
  ]);

  console.log(`[populate-cost-prices] Gsubz plans: ${gsubzCosts.size}, IACafe: ${iacafeCosts.size}, BSPlug: ${bsplugCosts.size}`);

  let updated = 0;
  const errors: string[] = [];

  for (const pkg of (allPkgs ?? [])) {
    const pc = pkg.package_code as string;
    const prv = (pkg.provider_code as string) ?? "";
    let cost: number | null = null;

    if (pc.startsWith("GSZ-") && gsubzCosts.has(pc)) {
      cost = gsubzCosts.get(pc)!;
    } else if (pc.startsWith("IAC-") && iacafeCosts.size > 0) {
      const id = parseInt(pc.replace("IAC-", ""), 10);
      if (!isNaN(id) && iacafeCosts.has(id)) cost = iacafeCosts.get(id)!;
    } else if (pc.startsWith("BSP-") && bsplugCosts.size > 0) {
      const id = parseInt(pc.replace("BSP-", ""), 10);
      if (!isNaN(id) && bsplugCosts.has(id)) cost = bsplugCosts.get(id)!;
    }

    // Only update if we found a cost and it differs from current
    if (cost !== null && cost > 0 && cost !== pkg.cost_price) {
      const { error: upErr } = await db
        .from("packages")
        .update({ cost_price: cost })
        .eq("package_code", pc);
      if (upErr) {
        errors.push(`${pc}: ${upErr.message}`);
      } else {
        updated++;
      }
    }
  }

  return json({
    success: true,
    updated,
    provider_plan_counts: {
      gsubz: gsubzCosts.size,
      iacafe: iacafeCosts.size,
      bsplug: bsplugCosts.size,
    },
    errors: errors.length > 0 ? errors : undefined,
    at: new Date().toISOString(),
  });
});
