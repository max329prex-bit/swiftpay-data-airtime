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
  if (!GSUBZ_KEY) { console.warn("[gsubz] No API key"); return costMap; }
  // Try multiple endpoint patterns
  const endpoints = [
    "https://gsubz.com/api/plans/",
    "https://gsubz.com/api/data-plans/",
    "https://gsubz.com/api/packages/",
  ];
  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        headers: { "api-key": GSUBZ_KEY, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      const text = await r.text();
      console.log(`[gsubz] ${url} → ${r.status} body=${text.slice(0,300)}`);
      if (!r.ok) continue;
      const d = JSON.parse(text);
      const list = Array.isArray(d?.data) ? d.data : Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
      if (list.length === 0) continue;
      for (const p of list) {
        // Plan list format: { id, service, plan_name, price/amount, ... }
        const id = String(p.id ?? p.plan_id ?? "");
        const svc = String(p.service ?? p.service_type ?? "");
        const price = Number(p.price ?? p.amount ?? p.plan_amount ?? 0);
        if (id && price > 0 && svc) {
          costMap.set(`GSZ-${svc}-${id}`, price);
        }
      }
      if (costMap.size > 0) break; // found plans
    } catch(e) { console.warn(`[gsubz] ${url} error:`, e); }
  }
  // If flat list didn't work, try per-service
  if (costMap.size === 0) {
    for (const svc of GSUBZ_SERVICES) {
      try {
        const r = await fetch(`https://gsubz.com/api/plans/?service=${svc}`, {
          headers: { "api-key": GSUBZ_KEY },
          signal: AbortSignal.timeout(8000),
        });
        const text = await r.text();
        console.log(`[gsubz] service=${svc} → ${r.status} body=${text.slice(0,200)}`);
        if (!r.ok) continue;
        const d = JSON.parse(text);
        const plans = Array.isArray(d?.data) ? d.data : Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
        for (const p of plans) {
          const id = String(p.id ?? p.plan_id ?? "");
          const price = Number(p.price ?? p.amount ?? p.plan_amount ?? 0);
          if (id && price > 0) costMap.set(`GSZ-${svc}-${id}`, price);
        }
      } catch { continue; }
    }
  }
  console.log(`[gsubz] total plans: ${costMap.size}`);
  return costMap;
}

async function fetchIacafePlans(): Promise<Map<number, number>> {
  const costMap = new Map<number, number>();
  if (!IACAFE_TOKEN) { console.warn("[iacafe] No token"); return costMap; }
  const urls = [
    "https://iacafe.com.ng/devapi/v1/data-plans",
    "https://iacafe.com.ng/devapi/v1/plans",
    "https://iacafe.com.ng/devapi/v1/budget-data-plans",
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${IACAFE_TOKEN}`, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      const text = await r.text();
      console.log(`[iacafe] ${url} → ${r.status} body=${text.slice(0,300)}`);
      if (!r.ok) continue;
      const d = JSON.parse(text);
      const plans = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
      for (const p of plans) {
        const id = Number(p.id ?? 0);
        const price = Number(p.price ?? p.amount ?? p.selling_price ?? p.plan_amount ?? 0);
        if (id && price > 0) costMap.set(id, price);
      }
      if (costMap.size > 0) break;
    } catch(e) { console.warn(`[iacafe] ${url} error:`, e); }
  }
  console.log(`[iacafe] total plans: ${costMap.size}`);
  return costMap;
}

async function fetchBsplugPlans(): Promise<Map<number, number>> {
  const costMap = new Map<number, number>();
  if (!BSPLUG_TOKEN) { console.warn("[bsplug] No token"); return costMap; }
  const urls = [
    "https://bsplug.net/api/data/",
    "https://bsplug.net/api/data-plans/",
    "https://bsplug.net/api/plans/",
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: { Authorization: `Token ${BSPLUG_TOKEN}`, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      const text = await r.text();
      console.log(`[bsplug] ${url} → ${r.status} body=${text.slice(0,300)}`);
      if (!r.ok) continue;
      const d = JSON.parse(text);
      const plans = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : Array.isArray(d?.results) ? d.results : [];
      for (const p of plans) {
        const id = Number(p.id ?? 0);
        const price = Number(p.plan_amount ?? p.price ?? p.amount ?? 0);
        if (id && price > 0) costMap.set(id, price);
      }
      if (costMap.size > 0) break;
    } catch(e) { console.warn(`[bsplug] ${url} error:`, e); }
  }
  console.log(`[bsplug] total plans: ${costMap.size}`);
  return costMap;
}


// Debug probe: try one endpoint per provider and return raw response
async function probeEndpoints(): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};

  // Gsubz balance check
  try {
    const r = await fetch("https://gsubz.com/api/balance/", {
      headers: { "api-key": GSUBZ_KEY },
      signal: AbortSignal.timeout(8000),
    });
    results.gsubz_balance = { status: r.status, body: (await r.text()).slice(0, 300) };
  } catch(e) { results.gsubz_balance = { error: String(e) }; }

  // Gsubz plans
  try {
    const r = await fetch("https://gsubz.com/api/data-plans/", {
      headers: { "api-key": GSUBZ_KEY },
      signal: AbortSignal.timeout(8000),
    });
    results.gsubz_plans = { status: r.status, body: (await r.text()).slice(0, 300) };
  } catch(e) { results.gsubz_plans = { error: String(e) }; }

  // IACafe plans
  try {
    const r = await fetch("https://iacafe.com.ng/devapi/v1/budget-data", {
      method: "GET",
      headers: { Authorization: `Bearer ${IACAFE_TOKEN}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    results.iacafe_plans = { status: r.status, body: (await r.text()).slice(0, 300) };
  } catch(e) { results.iacafe_plans = { error: String(e) }; }

  // BSPlug plans
  try {
    const r = await fetch("https://bsplug.net/api/data/", {
      method: "GET",
      headers: { Authorization: `Token ${BSPLUG_TOKEN}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    results.bsplug_plans = { status: r.status, body: (await r.text()).slice(0, 300) };
  } catch(e) { results.bsplug_plans = { error: String(e) }; }

  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (d: unknown, s = 200) =>
    new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  // Auth: accept x-admin-secret OR any valid JWT (Supabase validates before reaching here with --no-verify-jwt off)
  const secret = req.headers.get("x-admin-secret");
  const authHdr = req.headers.get("Authorization") ?? "";
  const hasValidAuth = (SYNC_SECRET && secret === SYNC_SECRET) || authHdr.startsWith("Bearer ");
  if (!hasValidAuth) {
    return json({ error: "Unauthorized" }, 401);
  }

  const db = createClient(SUPA_URL, SUPA_SVC);

  // If ?debug=1, run endpoint probe and return
  const url = new URL(req.url);
  if (url.searchParams.get("debug") === "1") {
    const probe = await probeEndpoints();
    return json({ probe, gsubz_key_present: !!GSUBZ_KEY, iacafe_token_present: !!IACAFE_TOKEN, bsplug_token_present: !!BSPLUG_TOKEN });
  }

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
    debug: {
      gsubz_sample: Array.from(gsubzCosts.entries()).slice(0,3).map(([k,v])=>({code:k,cost:v})),
      iacafe_sample: Array.from(iacafeCosts.entries()).slice(0,3).map(([k,v])=>({id:k,cost:v})),
      bsplug_sample: Array.from(bsplugCosts.entries()).slice(0,3).map(([k,v])=>({id:k,cost:v})),
    },
    errors: errors.length > 0 ? errors : undefined,
    at: new Date().toISOString(),
  });
});
