import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const AIDAPAY_TOKEN = Deno.env.get("AIDAPAY_TOKEN") ?? "";
const AIDAPAY_PIN   = Deno.env.get("AIDAPAY_ACCOUNT_PIN") ?? "";
const BSPLUG_TOKEN  = Deno.env.get("BSPLUG_TOKEN") ?? "";
const IACAFE_TOKEN  = Deno.env.get("IACAFE_TOKEN") ?? "";
const GSUBZ_KEY     = Deno.env.get("GSUBZ_API_KEY") ?? "";

type Result = { provider: string; ok: boolean; http?: number; balance?: number | string | null; raw?: string; error?: string; has_credentials: boolean };

async function tryFetch(url: string, init: RequestInit): Promise<{ http: number; text: string } | { error: string }> {
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
    const text = await r.text();
    return { http: r.status, text };
  } catch (e) {
    return { error: String(e) };
  }
}

function pickBalance(d: any): number | string | null {
  if (!d || typeof d !== "object") return null;
  const candidates = [d?.data?.balance, d?.data?.wallet_balance, d?.data?.available_balance, d?.balance, d?.wallet_balance, d?.user?.balance, d?.data?.user?.balance];
  for (const c of candidates) if (c !== undefined && c !== null) return c;
  return null;
}

async function pingAidaPay(): Promise<Result> {
  const has = !!AIDAPAY_TOKEN;
  if (!has) return { provider: "aidapay", ok: false, has_credentials: false, error: "AIDAPAY_TOKEN missing" };
  const paths = ["/transactions", "/user/balance", "/wallet-balance", "/wallet", "/user", "/services"];
  const tried: any[] = [];
  for (const p of paths) {
    const r = await tryFetch(`https://www.aidapay.ng/api/v1${p}`, { headers: { Authorization: `Bearer ${AIDAPAY_TOKEN}`, Accept: "application/json" } });
    if ("error" in r) { tried.push({ p, err: r.error }); continue; }
    tried.push({ p, http: r.http });
    if (r.http >= 200 && r.http < 300) {
      let d: any = null; try { d = JSON.parse(r.text); } catch {}
      return { provider: "aidapay", ok: true, http: r.http, balance: d?.data?.balance ?? pickBalance(d), raw: `${p} → ${r.text.slice(0,260)}`, has_credentials: has };
    }
  }
  return { provider: "aidapay", ok: false, has_credentials: has, error: "no working endpoint", raw: JSON.stringify(tried).slice(0, 400) };
}

async function pingBSPlug(): Promise<Result> {
  const has = !!BSPLUG_TOKEN;
  if (!has) return { provider: "bsplug", ok: false, has_credentials: false, error: "BSPLUG_TOKEN missing" };
  const r = await tryFetch("https://bsplug.net/api/user/", { headers: { Authorization: `Token ${BSPLUG_TOKEN}`, Accept: "application/json" } });
  if ("error" in r) return { provider: "bsplug", ok: false, has_credentials: has, error: r.error };
  let d: any = null; try { d = JSON.parse(r.text); } catch {}
  const ok = r.http >= 200 && r.http < 300;
  return { provider: "bsplug", ok, http: r.http, balance: d?.user?.wallet_balance ?? d?.wallet_balance ?? pickBalance(d), raw: r.text.slice(0, 240), has_credentials: has };
}

async function pingIACafe(): Promise<Result> {
  const has = !!IACAFE_TOKEN;
  if (!has) return { provider: "iacafe", ok: false, has_credentials: false, error: "IACAFE_TOKEN missing" };
  const r = await tryFetch("https://iacafe.com.ng/devapi/v1/wallet", { headers: { Authorization: `Bearer ${IACAFE_TOKEN}`, Accept: "application/json" } });
  if ("error" in r) return { provider: "iacafe", ok: false, has_credentials: has, error: r.error };
  let d: any = null; try { d = JSON.parse(r.text); } catch {}
  const ok = r.http >= 200 && r.http < 300 && d?.success !== false;
  return { provider: "iacafe", ok, http: r.http, balance: d?.data?.balance ?? d?.data?.wallet_balance ?? pickBalance(d), raw: r.text.slice(0, 240), has_credentials: has };
}

async function pingGsubz(): Promise<Result> {
  const has = !!GSUBZ_KEY;
  if (!has) return { provider: "gsubz", ok: false, has_credentials: false, error: "GSUBZ_API_KEY missing" };

  // Try multiple Gsubz balance approaches (they are inconsistent across endpoints)
  const attempts = [
    // 1) GET with api-key header (some Gsubz endpoints expect this)
    { url: "https://gsubz.com/api/balance/",  method: "GET",  headers: { "api-key": GSUBZ_KEY },       body: null,         note: "GET+api-key header" },
    { url: "https://gsubz.com/api/v1/balance", method: "GET",  headers: { "api-key": GSUBZ_KEY },       body: null,         note: "GET+v1+api-key header" },
    // 2) GET with Authorization Bearer (alternative auth style)
    { url: "https://gsubz.com/api/balance/",  method: "GET",  headers: { "Authorization": `Bearer ${GSUBZ_KEY}` }, body: null, note: "GET+Bearer" },
    // 3) POST with api-key header + empty JSON body (matches /pay/ style)
    { url: "https://gsubz.com/api/balance/",  method: "POST", headers: { "api-key": GSUBZ_KEY, "Content-Type": "application/json" }, body: JSON.stringify({}), note: "POST+api-key+JSON" },
    { url: "https://gsubz.com/api/v1/balance", method: "POST", headers: { "api-key": GSUBZ_KEY, "Content-Type": "application/json" }, body: JSON.stringify({}), note: "POST+v1+api-key+JSON" },
    // 4) POST with FormData (original approach)
    { url: "https://gsubz.com/api/balance/",  method: "POST", headers: {}, body: (() => { const fd = new FormData(); fd.append("api-key", GSUBZ_KEY); return fd; })(), note: "POST+FormData" },
    // 5) POST with plain text body (rare but some APIs do this)
    { url: "https://gsubz.com/api/balance/",  method: "POST", headers: { "Content-Type": "text/plain" }, body: `api-key=${GSUBZ_KEY}`, note: "POST+text body" },
  ];

  const tried: any[] = [];
  for (const { url, method, headers, body, note } of attempts) {
    const r = await tryFetch(url, { method, headers: { ...headers, Accept: "application/json" }, body: body || undefined });
    if ("error" in r) { tried.push({ note, error: r.error }); continue; }
    tried.push({ note, http: r.http });
    if (r.http >= 200 && r.http < 300) {
      let d: any = null; try { d = JSON.parse(r.text); } catch {}
      const bal = d?.balance ?? d?.data?.balance ?? d?.data?.wallet_balance ?? pickBalance(d);
      return { provider: "gsubz", ok: true, http: r.http, balance: bal, raw: `${note} → ${r.text.slice(0,260)}`, has_credentials: has };
    }
  }
  return { provider: "gsubz", ok: false, has_credentials: has, error: "no working endpoint", raw: JSON.stringify(tried).slice(0, 400) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const results = await Promise.all([pingAidaPay(), pingBSPlug(), pingIACafe(), pingGsubz()]);
  const summary = {
    ok: results.every(r => r.ok),
    aidapay_pin_set: !!AIDAPAY_PIN,
    checked_at: new Date().toISOString(),
    results,
  };
  return new Response(JSON.stringify(summary, null, 2), { headers: cors });
});
