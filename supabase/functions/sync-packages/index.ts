import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPA_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SYNC_SECRET = Deno.env.get("SYNC_ADMIN_SECRET") ?? "";
const AIDAPAY_BASE  = "https://www.aidapay.ng/api/v1";
const AIDAPAY_TOKEN = Deno.env.get("AIDAPAY_TOKEN")!;
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
