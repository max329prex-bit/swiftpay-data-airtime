import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPA_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SYNC_SECRET = Deno.env.get("SYNC_ADMIN_SECRET") ?? "";
const AIDAPAY_BASE  = "https://www.aidapay.ng/api/v1";
const AIDAPAY_TOKEN = Deno.env.get("AIDAPAY_TOKEN")!;
const IACAFE_BASE   = "https://iacafe.com.ng/devapi/v1";
const IACAFE_TOKEN  = Deno.env.get("IACAFE_TOKEN") ?? "";
const TG_BOT      = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT     = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret"
};

const SYNC_PROVIDERS = [
  { network: "MTN",     code: "mtn-sme" },
  { network: "MTN",     code: "mtn-awuf-data" },
  { network: "AIRTEL",  code: "airtel-sme-cg" },
  { network: "AIRTEL",  code: "airtel-awuf-data" },
  { network: "GLO",     code: "glo-gifting" },
  { network: "GLO",     code: "gloawufdata" },
  { network: "9MOBILE", code: "9mobile-sme" },
  { network: "9MOBILE", code: "9mobile-awuf-data" },
];

function parseSize(n: string): string {
  const m = n.match(/(\d+\.?\d*\s*(?:GB|MB|TB))/i);
  return m ? m[1].replace(/\s+/g, "") : n.split("-")[0].trim();
}
function parseValidity(n: string): string {
  const m = n.match(/(\d+\s*(?:Day|Days|Month|Months|Week|Weeks|Hour|Hours))/i);
  return m ? m[1] : "30 Days";
}
// BlitzPoints: 5 BP per ₦250 spent
function calcBpValue(price: number): number {
  return Math.max(1, Math.floor(price / 250) * 5);
}
// promo = awuf/gifting bundles (unstable, thin margin); stable = named carrier plans
function calcTier(providerCode: string): string {
  const promoProviders = ["mtn-awuf-data","airtel-awuf-data","gloawufdata","9mobile-awuf-data","glo-gifting"];
  return promoProviders.includes(providerCode) ? "promo" : "stable";
}
function isNonOwingPlan(pkgCode: string): boolean {
  const c = (pkgCode || "").toLowerCase();
  return c.includes("awoof") || c.includes("gifting") || c.includes("gift") || c.startsWith("iac-");
}
async function tg(msg: string) {
  if (!TG_BOT || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text: msg, parse_mode: "Markdown" })
    });
  } catch {}
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (d: unknown, s = 200) =>
    new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  const secret = req.headers.get("x-admin-secret");
  if (!SYNC_SECRET || secret !== SYNC_SECRET) return json({ error: "Unauthorized" }, 401);

  const db = createClient(SUPA_URL, SUPA_SVC);
  const results: Record<string, number> = {};
  const errors: Record<string, string> = {};
  const seen = new Set<string>();
  const seenPerProvider: Record<string, string[]> = {};
  let totalUpserted = 0;
  let totalDeactivated = 0;
  const startMs = Date.now();

  for (const { network, code } of SYNC_PROVIDERS) {
    seenPerProvider[code] = seenPerProvider[code] ?? [];
    try {
      const r = await fetch(`${AIDAPAY_BASE}/packages/${code}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${AIDAPAY_TOKEN}` },
        signal: AbortSignal.timeout(15000)
      });
      if (!r.ok) { errors[code] = `HTTP ${r.status}`; continue; }
      const res = await r.json();
      const pkgs: Record<string, unknown>[] = Array.isArray(res?.data) ? res.data : [];

      for (const pkg of pkgs) {
        const pc = pkg.package_api_code as string;
        if (!pc || seen.has(pc)) continue;
        seen.add(pc);
        seenPerProvider[code].push(pc);
        const name    = (pkg.package_name as string) || pc;
        const price   = Number(pkg.package_amount || 0);
        const { error: ue } = await db.from("packages").upsert({
          network, name,
          size: parseSize(name), validity: parseValidity(name),
          price, provider_code: code, package_code: pc,
          sort_order: price, is_active: true, coming_soon: false,
          bp_value: calcBpValue(price),
          tier: calcTier(code)
        }, { onConflict: "package_code" });
        if (!ue) { results[`${network}/${code}`] = (results[`${network}/${code}`] || 0) + 1; totalUpserted++; }
      }

      if (seenPerProvider[code].length > 0) {
        const codeList = seenPerProvider[code].map(c => `"${c}"`).join(",");
        const { count } = await db.from("packages").update({ is_active: false })
          .eq("provider_code", code).eq("is_active", true)
          .not("package_code", "in", `(${codeList})`);
        if (count) totalDeactivated += count;
      }
    } catch (e) {
      errors[code] = e instanceof Error ? e.message : String(e);
      console.error(`sync [${code}]:`, errors[code]);
    }
  }

  // ── Sync IA Cafe plans (budget-data) ────────────────────────────────────
  if (IACAFE_TOKEN) {
    try {
      const r = await fetch(`${IACAFE_BASE}/budget-data/plans`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${IACAFE_TOKEN}` },
        signal: AbortSignal.timeout(15000)
      });
      if (!r.ok) {
        errors["iacafe"] = `HTTP ${r.status}`;
      } else {
        const res = await r.json();
        const plans: Record<string, unknown>[] = Array.isArray(res?.data) ? res.data : [];
        const seenIacafe: string[] = [];

        const netMap: Record<number, string> = { 1: "MTN", 2: "AIRTEL", 3: "GLO", 4: "9MOBILE", 6: "MTN" };

        for (const p of plans) {
          const pc    = String(p.data_plan || "");
          const netId = Number(p.network_id || 0);
          const net   = netMap[netId] || (p.network_name as string)?.toUpperCase() || "MTN";
          if (!pc || seen.has(`iacafe-${pc}`)) continue;
          seen.add(`iacafe-${pc}`);
          seenIacafe.push(pc);

          const name   = (p.name as string) || `${p.data_type} ${p.plan || ""}`;
          const price  = Number(p.api_user_price || 0);
          const size   = parseSize(name);
          const validity = (p.validity as string) || parseValidity(name);
          const dataType = (p.data_type as string)?.toLowerCase() || "";
          const tier   = dataType.includes("sme") || dataType.includes("sme2") ? "stable" : "promo";

          const { error: ue } = await db.from("packages").upsert({
            network: net, name: `${name} (IA Cafe)`,
            size, validity,
            price, provider_code: "iacafe", package_code: `IAC-${pc}`,
            sort_order: price, is_active: true, coming_soon: false,
            bp_value: calcBpValue(price),
            tier,
            requires_non_owing_line: isNonOwingPlan(`IAC-${pc}`)
          }, { onConflict: "package_code" });
          if (!ue) { results[`${net}/iacafe`] = (results[`${net}/iacafe`] || 0) + 1; totalUpserted++; }
        }

        if (seenIacafe.length > 0) {
          const codeList = seenIacafe.map(c => `"IAC-${c}"`).join(",");
          const { count } = await db.from("packages").update({ is_active: false })
            .eq("provider_code", "iacafe").eq("is_active", true)
            .not("package_code", "in", `(${codeList})`);
          if (count) totalDeactivated += count;
        }
      }
    } catch (e) {
      errors["iacafe"] = e instanceof Error ? e.message : String(e);
      console.error("sync [iacafe]:", errors["iacafe"]);
    }
  }

  const hasErrors = Object.keys(errors).length > 0;
  if (hasErrors) {
    await tg(`⚠️ *sync-packages partial failure*\nErrors: ${JSON.stringify(errors)}\nUpserted: ${totalUpserted}`);
  }

  return json({
    success: !hasErrors || totalUpserted > 0,
    upserted: totalUpserted, deactivated: totalDeactivated,
    by_provider: results,
    errors: hasErrors ? errors : undefined,
    duration_ms: Date.now() - startMs,
    at: new Date().toISOString()
  });
});
