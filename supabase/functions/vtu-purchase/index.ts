import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret" };
const AIDAPAY_BASE = "https://www.aidapay.ng/api/v1";
const AIDAPAY_TOKEN = Deno.env.get("AIDAPAY_TOKEN")!;
const AIDAPAY_PIN = Deno.env.get("AIDAPAY_ACCOUNT_PIN")!;
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SYNC_SECRET = Deno.env.get("SYNC_ADMIN_SECRET") ?? "";

const AIRTIME_MAP: Record<string,string> = { MTN:"mtn-airtime", AIRTEL:"airtel-airtime", GLO:"glo-airtime", "9MOBILE":"9mobile-airtime" };

// Provider codes to sync packages for (all AidaPay data/airtime providers)
const SYNC_PROVIDERS: Array<{ network: string; code: string }> = [
  { network:"MTN",     code:"mtn-sme" },
  { network:"MTN",     code:"mtn-awuf-data" },
  { network:"AIRTEL",  code:"airtel-sme-cg" },
  { network:"AIRTEL",  code:"airtel-awuf-data" },
  { network:"GLO",     code:"glo-gifting" },
  { network:"GLO",     code:"gloawufdata" },
  { network:"9MOBILE", code:"9mobile-sme" },
  { network:"9MOBILE", code:"9mobile-awuf-data" },
];

function isBundleUnavailable(msg: string): boolean {
  const lower = (msg || "").toLowerCase();
  return lower.includes("not available")||lower.includes("unavailable")||lower.includes("out of stock")||lower.includes("package not found")||lower.includes("provider down")||lower.includes("service down")||lower.includes("temporarily")||lower.includes("invalid package")||lower.includes("invalid bundle")||lower.includes("bundle not")||lower.includes("plan not")||lower.includes("product not");
}

async function aidapayFetch(path: string, options: RequestInit = {}) {
  const url = `${AIDAPAY_BASE}${path}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${AIDAPAY_TOKEN}`,
    ...(options.headers as Record<string, string> || {})
  };
  try {
    const r = await fetch(url, { ...options, headers });
    const text = await r.text();
    try { return { ok: r.ok, status: r.status, data: JSON.parse(text) }; }
    catch { return { ok: false, status: r.status, data: { success: false, message: `AidaPay error ${r.status}` } }; }
  } catch (e) {
    return { ok: false, status: 0, data: { success: false, message: "Cannot reach AidaPay" } };
  }
}

function parseSize(name: string): string {
  const m = name.match(/(\d+\.?\d*\s*(?:GB|MB|TB))/i);
  return m ? m[1].replace(/\s+/g, "") : name.split("-")[0].trim();
}
function parseValidity(name: string): string {
  const m = name.match(/(\d+\s*(?:Day|Days|Month|Months|Week|Weeks|Hour|Hours))/i);
  return m ? m[1] : "30 Days";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // ── ADMIN: sync packages from AidaPay ──────────────────────
  const adminSecret = req.headers.get("x-admin-secret");
  if (adminSecret && SYNC_SECRET && adminSecret === SYNC_SECRET) {
    const body = await req.json().catch(() => ({}));
    if ((body as any).type === "sync_packages") {
      const db = createClient(SUPA_URL, SUPA_SVC);
      const results: Record<string, number> = {};
      const seen = new Set<string>();

      for (const { network, code } of SYNC_PROVIDERS) {
        const res = await aidapayFetch(`/packages/${code}`);
        const pkgs: any[] = Array.isArray(res.data?.data) ? res.data.data : [];
        console.log(`${network}/${code}: ${pkgs.length} packages`);

        for (const pkg of pkgs) {
          const packageCode = pkg.package_api_code;
          if (!packageCode || seen.has(packageCode)) continue;
          seen.add(packageCode);

          const name = pkg.package_name || packageCode;
          const price = Number(pkg.package_amount || 0);
          const { error } = await db.from("packages").upsert({
            network, name,
            size: parseSize(name),
            validity: parseValidity(name),
            price,
            provider_code: code,
            package_code: packageCode,
            sort_order: price,
            is_active: true,
            coming_soon: false,
          }, { onConflict: "package_code" });
          if (!error) results[`${network}/${code}`] = (results[`${network}/${code}`] || 0) + 1;
        }
      }

      return new Response(JSON.stringify({ success: true, synced: results, at: new Date().toISOString() }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }
  }

  // ── NORMAL AUTH FLOW ───────────────────────────────────────
  const auth = req.headers.get("Authorization");
  if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const userClient = createClient(SUPA_URL, SUPA_ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: ae } = await userClient.auth.getUser();
    if (ae || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { type, network, phone, amount, package_code, provider_code, pin, bundle, provider, meta, meter_number, meter_type, packageCode } = body;
    const pkgCode = package_code || bundle || packageCode;
    const prvCode = provider_code || provider;

    if (type === "electricity_verify") {
      const apCode = `${prvCode}-${meter_type || "prepaid"}`;
      const identifier = meter_number || phone;
      if (!identifier) return new Response(JSON.stringify({ error: "Meter number required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      const res = await aidapayFetch(`/validation/${encodeURIComponent(apCode)}/${encodeURIComponent(identifier)}`);
      if (!res.data?.data?.verified) {
        return new Response(JSON.stringify({ error: res.data?.data?.message || res.data?.message || "Could not verify meter. Check the number and try again." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const msg: string = res.data.data.message || "";
      const customer_name = msg.includes(":") ? msg.split(":").slice(1).join(":").trim() : msg || "Verified";
      return new Response(JSON.stringify({ success: true, customer_name, verified: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (type === "cable_verify") {
      const identifier = phone || meter_number;
      if (!identifier || !prvCode) return new Response(JSON.stringify({ error: "Smartcard and provider required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      const res = await aidapayFetch(`/validation/${encodeURIComponent(prvCode)}/${encodeURIComponent(identifier)}`);
      if (!res.data?.data?.verified) {
        return new Response(JSON.stringify({ error: res.data?.data?.message || res.data?.message || "Could not verify smartcard." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const msg: string = res.data.data.message || "";
      const customer_name = msg.includes(":") ? msg.split(":").slice(1).join(":").trim() : msg || "Verified";
      return new Response(JSON.stringify({ success: true, customer_name, verified: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { data: pinValid, error: pe } = await userClient.rpc("verify_transaction_pin", { _pin: pin });
    if (pe || !pinValid) return new Response(JSON.stringify({ error: "Incorrect PIN" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });

    let apCode: string;
    if (type === "airtime") { apCode = AIRTIME_MAP[network?.toUpperCase()] || "mtn-airtime"; }
    else if (type === "electricity") { apCode = `${prvCode}-${meter_type || "prepaid"}`; }
    else { apCode = prvCode; }

    const recipient = type === "electricity" ? (meter_number || phone || "") : (phone || "");
    const ref = `SP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const payload: Record<string, string> = { recipient, provider_code: apCode, account_pin: AIDAPAY_PIN, ref };
    if (amount) payload.amount = String(amount);
    if (pkgCode) payload.package_code = pkgCode;

    const apRes = await aidapayFetch("/buy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const apData = apRes.data;
    const adminClient = createClient(SUPA_URL, SUPA_SVC);

    if (!apData.success) {
      const errMsg = apData.message || apData.error || "Purchase failed";
      const bundleDown = type === "data" && isBundleUnavailable(errMsg);
      if (pkgCode && (prvCode || apCode)) adminClient.rpc("mark_bundle_unavailable", { _package_code: pkgCode, _provider_code: prvCode || apCode, _network: network, _error: errMsg }).catch(console.error);
      return new Response(JSON.stringify({ error: bundleDown ? "Selected data plan is temporarily unavailable." : errMsg, code: bundleDown ? "BUNDLE_UNAVAILABLE" : "PURCHASE_FAILED", balance_credited: false }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const txHash = apData.data?.transaction_data?.transaction_hash;
    const paid = Number(amount || apData.data?.transaction_data?.amount_paid || 0);
    const txMeta: Record<string, unknown> = { ...meta, aidapay_ref: ref, provider_code: apCode, package_code: pkgCode };
    if (type === "electricity") { txMeta.meter_type = meter_type; txMeta.meter_number = recipient; }
    if (apData.data?.transaction_data?.meter_token) txMeta.meter_token = apData.data.transaction_data.meter_token;
    if (apData.data?.transaction_data?.meter_unit)  txMeta.meter_unit  = apData.data.transaction_data.meter_unit;

    const { data: tx, error: te } = await adminClient.rpc("create_vtu_transaction", { _user_id: user.id, _type: type, _network: network || apCode, _phone: recipient, _amount: paid, _aidapay_hash: txHash, _meta: txMeta });
    if (te) console.error("tx error:", te);
    if (pkgCode && (prvCode || apCode)) adminClient.rpc("mark_bundle_available", { _package_code: pkgCode, _provider_code: prvCode || apCode, _network: network }).catch(console.error);

    const resp: Record<string, unknown> = { success: true, reference: (tx as any)?.reference || ref, aidapay_hash: txHash, status: "Processing" };
    if (apData.data?.transaction_data?.meter_token) resp.meter_token = apData.data.transaction_data.meter_token;
    return new Response(JSON.stringify(resp), { headers: { ...cors, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("vtu-purchase:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
