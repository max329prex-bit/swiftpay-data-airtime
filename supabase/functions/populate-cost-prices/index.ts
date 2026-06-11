import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPA_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SYNC_SECRET = Deno.env.get("SYNC_ADMIN_SECRET") ?? "";
const GSUBZ_KEY   = Deno.env.get("GSUBZ_API_KEY") ?? "";
const IACAFE_TOKEN = Deno.env.get("IACAFE_TOKEN") ?? "";
const BSPLUG_TOKEN = Deno.env.get("BSPLUG_TOKEN") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

// ── Gsubz ──────────────────────────────────────────────────────────────────
// Correct endpoint: GET https://gsubz.com/api/v1/data/plans
// Auth: Authorization: Bearer KEY  (from official Postman docs)
// Package code format: GSZ-{service}-{planId}  e.g. GSZ-mtn_sme-354
async function fetchGsubzPlans(): Promise<{ byCode: Map<string,number>; byPlanId: Map<string,number> }> {
  const byCode   = new Map<string, number>(); // GSZ-{service}-{planId} → price
  const byPlanId = new Map<string, number>(); // {planId} → price (fallback)
  if (!GSUBZ_KEY) { console.warn("[gsubz] No API key"); return { byCode, byPlanId }; }

  const attempts = [
    // Correct v1 endpoint per official Postman docs (Bearer auth)
    { url: "https://gsubz.com/api/v1/data/plans",  authHeader: { "Authorization": `Bearer ${GSUBZ_KEY}` } },
    // Fallback: same base as buy endpoint (api-key auth)
    { url: "https://gsubz.com/api/data/plans",     authHeader: { "api-key": GSUBZ_KEY } },
    { url: "https://gsubz.com/api/data-plans/",    authHeader: { "api-key": GSUBZ_KEY } },
    { url: "https://gsubz.com/api/v1/plans",       authHeader: { "Authorization": `Bearer ${GSUBZ_KEY}` } },
  ];

  for (const { url, authHeader } of attempts) {
    try {
      const r = await fetch(url, {
        headers: { ...authHeader, Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      });
      const text = await r.text();
      console.log(`[gsubz] ${url} → ${r.status} body_preview=${text.slice(0,400)}`);
      if (!r.ok) continue;

      const d = JSON.parse(text);
      // Response may be: { data_plans: [...] }  OR  { data: [...] }  OR  [...]
      const list: unknown[] = Array.isArray(d?.data_plans) ? d.data_plans
        : Array.isArray(d?.data)   ? d.data
        : Array.isArray(d?.plans)  ? d.plans
        : Array.isArray(d)         ? d
        : [];

      if (list.length === 0) { console.log(`[gsubz] ${url} returned empty list`); continue; }
      console.log(`[gsubz] ${url} returned ${list.length} plans, sample:`, JSON.stringify(list[0]));

      for (const p of list as Record<string,unknown>[]) {
        const planId = String(p.plan_id ?? p.id ?? p.planId ?? "");
        const service = String(p.service ?? p.service_type ?? p.serviceID ?? "");
        const network = String(p.network ?? "").toLowerCase();
        const price   = Number(p.price ?? p.amount ?? p.plan_amount ?? p.selling_price ?? 0);

        if (!planId || price <= 0) continue;

        // Store by plan_id as fallback
        byPlanId.set(planId, price);

        // Best match: if service field exists, build exact code
        if (service) {
          byCode.set(`GSZ-${service}-${planId}`, price);
        }
        // Also try network-based key for partial matching
        if (network) {
          byCode.set(`GSZ-${network}-${planId}`, price);
        }
      }

      if (byCode.size > 0 || byPlanId.size > 0) break; // found plans
    } catch(e) { console.warn(`[gsubz] ${url} error:`, e); }
  }

  console.log(`[gsubz] byCode: ${byCode.size}, byPlanId: ${byPlanId.size}`);
  return { byCode, byPlanId };
}

// ── IACafe ─────────────────────────────────────────────────────────────────
// Package code format: IAC-{planId}  (numeric)
// Buy endpoint: POST /devapi/v1/budget-data → plan list probably GET /devapi/v1/budget-data-plans
async function fetchIacafePlans(): Promise<Map<number, number>> {
  const costMap = new Map<number, number>();
  if (!IACAFE_TOKEN) { console.warn("[iacafe] No token"); return costMap; }

  const urls = [
    "https://iacafe.com.ng/devapi/v1/budget-data-plans",
    "https://iacafe.com.ng/devapi/v1/budget-data",       // same as buy, GET may return list
    "https://iacafe.com.ng/devapi/v1/data-plans",
    "https://iacafe.com.ng/devapi/v1/plans",
    "https://iacafe.com.ng/devapi/v1/data",
  ];

  for (const url of urls) {
    try {
      const r = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${IACAFE_TOKEN}`, Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      });
      const text = await r.text();
      console.log(`[iacafe] GET ${url} → ${r.status} body_preview=${text.slice(0,400)}`);
      if (!r.ok) continue;

      const d = JSON.parse(text);
      const plans: unknown[] = Array.isArray(d?.data) ? d.data
        : Array.isArray(d?.results) ? d.results
        : Array.isArray(d) ? d
        : [];

      if (plans.length === 0) continue;
      console.log(`[iacafe] ${url} returned ${plans.length} plans, sample:`, JSON.stringify(plans[0]));

      for (const p of plans as Record<string,unknown>[]) {
        const id    = Number(p.id ?? p.plan_id ?? 0);
        const price = Number(p.price ?? p.amount ?? p.selling_price ?? p.plan_amount ?? 0);
        if (id > 0 && price > 0) costMap.set(id, price);
      }
      if (costMap.size > 0) break;
    } catch(e) { console.warn(`[iacafe] ${url} error:`, e); }
  }

  console.log(`[iacafe] costMap size: ${costMap.size}`);
  return costMap;
}

// ── BSPlug ─────────────────────────────────────────────────────────────────
// Package code format: BSP-{planId}  (numeric)
// Buy: POST /api/data/ with Token auth → GET /api/data/ should return list (DRF style)
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
        method: "GET",
        headers: { Authorization: `Token ${BSPLUG_TOKEN}`, Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      });
      const text = await r.text();
      console.log(`[bsplug] GET ${url} → ${r.status} body_preview=${text.slice(0,400)}`);
      if (!r.ok) continue;

      const d = JSON.parse(text);
      const plans: unknown[] = Array.isArray(d) ? d
        : Array.isArray(d?.results) ? d.results
        : Array.isArray(d?.data)    ? d.data
        : [];

      if (plans.length === 0) continue;
      console.log(`[bsplug] ${url} returned ${plans.length} plans, sample:`, JSON.stringify(plans[0]));

      for (const p of plans as Record<string,unknown>[]) {
        const id    = Number(p.id ?? 0);
        const price = Number(p.plan_amount ?? p.price ?? p.amount ?? 0);
        if (id > 0 && price > 0) costMap.set(id, price);
      }
      if (costMap.size > 0) break;
    } catch(e) { console.warn(`[bsplug] ${url} error:`, e); }
  }

  console.log(`[bsplug] costMap size: ${costMap.size}`);
  return costMap;
}

// ── Debug probe ────────────────────────────────────────────────────────────
async function probeEndpoints(): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};

  // Gsubz wallet balance (POST /api/v1/wallet/balance per docs)
  for (const [label, req] of [
    ["gsubz_plans_v1", { url: "https://gsubz.com/api/v1/data/plans",    method:"GET", hdrs:{ "Authorization": `Bearer ${GSUBZ_KEY}` } }],
    ["gsubz_plans_old", { url: "https://gsubz.com/api/data-plans/",       method:"GET", hdrs:{ "api-key": GSUBZ_KEY } }],
  ] as [string, { url:string; method:string; hdrs:Record<string,string> }][]) {
    try {
      const r = await fetch(req.url, { method: req.method, headers: req.hdrs, signal: AbortSignal.timeout(8000) });
      results[label] = { status: r.status, body: (await r.text()).slice(0, 500) };
    } catch(e) { results[label] = { error: String(e) }; }
  }

  // IACafe
  try {
    const r = await fetch("https://iacafe.com.ng/devapi/v1/budget-data-plans", {
      headers: { Authorization: `Bearer ${IACAFE_TOKEN}` }, signal: AbortSignal.timeout(8000) });
    results.iacafe_probe = { status: r.status, body: (await r.text()).slice(0, 500) };
  } catch(e) { results.iacafe_probe = { error: String(e) }; }

  // BSPlug
  try {
    const r = await fetch("https://bsplug.net/api/data/", {
      headers: { Authorization: `Token ${BSPLUG_TOKEN}` }, signal: AbortSignal.timeout(8000) });
    results.bsplug_probe = { status: r.status, body: (await r.text()).slice(0, 500) };
  } catch(e) { results.bsplug_probe = { error: String(e) }; }

  return results;
}

// ── Main handler ───────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (d: unknown, s = 200) =>
    new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  // Auth: accept x-admin-secret OR any valid JWT
  const secret  = req.headers.get("x-admin-secret");
  const authHdr = req.headers.get("Authorization") ?? "";
  const hasValidAuth = (SYNC_SECRET && secret === SYNC_SECRET) || authHdr.startsWith("Bearer ");
  if (!hasValidAuth) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);

  // ?debug=1 → raw endpoint probe
  if (url.searchParams.get("debug") === "1") {
    const probe = await probeEndpoints();
    return json({ probe, keys: { gsubz: !!GSUBZ_KEY, iacafe: !!IACAFE_TOKEN, bsplug: !!BSPLUG_TOKEN } });
  }

  const db = createClient(SUPA_URL, SUPA_SVC);

  // Fetch all packages from DB
  const { data: allPkgs, error: pkgErr } = await db
    .from("packages")
    .select("package_code, provider_code, cost_price");
  if (pkgErr) return json({ error: pkgErr.message }, 500);

  // Fetch cost maps in parallel
  const [gsubzResult, iacafeCosts, bsplugCosts] = await Promise.all([
    fetchGsubzPlans(),
    fetchIacafePlans(),
    fetchBsplugPlans(),
  ]);

  const { byCode: gsubzByCode, byPlanId: gsubzByPlanId } = gsubzResult;

  console.log(`[populate] DB packages: ${allPkgs?.length}, Gsubz: ${gsubzByCode.size}(+${gsubzByPlanId.size} by-id), IACafe: ${iacafeCosts.size}, BSPlug: ${bsplugCosts.size}`);

  let updated = 0;
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const pkg of (allPkgs ?? [])) {
    const pc  = pkg.package_code as string;
    const pcL = pc.toLowerCase();
    let cost: number | null = null;

    if (pcL.startsWith("gsz-")) {
      // Try exact code match first
      if (gsubzByCode.has(pc)) {
        cost = gsubzByCode.get(pc)!;
      } else {
        // Fallback: match by plan_id suffix  e.g. GSZ-mtn_sme-354 → planId=354
        const parts  = pc.split("-");
        const planId = parts[parts.length - 1];
        if (planId && gsubzByPlanId.has(planId)) {
          cost = gsubzByPlanId.get(planId)!;
        }
      }
    } else if (pcL.startsWith("iac-") && iacafeCosts.size > 0) {
      const id = parseInt(pc.replace(/^IAC-/i, ""), 10);
      if (!isNaN(id) && iacafeCosts.has(id)) cost = iacafeCosts.get(id)!;
    } else if (pcL.startsWith("bsp-") && bsplugCosts.size > 0) {
      const id = parseInt(pc.replace(/^BSP-/i, ""), 10);
      if (!isNaN(id) && bsplugCosts.has(id)) cost = bsplugCosts.get(id)!;
    }

    if (cost !== null && cost > 0 && cost !== pkg.cost_price) {
      const { error: upErr } = await db
        .from("packages")
        .update({ cost_price: cost })
        .eq("package_code", pc);
      if (upErr) errors.push(`${pc}: ${upErr.message}`);
      else updated++;
    } else if (cost === null) {
      skipped.push(pc);
    }
  }

  return json({
    success: true,
    updated,
    total_packages: allPkgs?.length ?? 0,
    provider_plan_counts: {
      gsubz_by_code:   gsubzByCode.size,
      gsubz_by_planid: gsubzByPlanId.size,
      iacafe:          iacafeCosts.size,
      bsplug:          bsplugCosts.size,
    },
    skipped_count: skipped.length,
    skipped_sample: skipped.slice(0, 10),
    errors: errors.length > 0 ? errors : undefined,
    at: new Date().toISOString(),
  });
});
