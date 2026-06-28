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
  const r = await tryFetch("https://www.aidapay.ng/api/v1/user", { headers: { Authorization: `Bearer ${AIDAPAY_TOKEN}`, Accept: "application/json" } });
  if ("error" in r) return { provider: "aidapay", ok: false, has_credentials: has, error: r.error };
  let d: any = null; try { d = JSON.parse(r.text); } catch {}
  const ok = r.http >= 200 && r.http < 300 && (d?.success !== false);
  return { provider: "aidapay", ok, http: r.http, balance: pickBalance(d), raw: r.text.slice(0, 240), has_credentials: has };
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
  const r = await tryFetch("https://iacafe.com.ng/devapi/v1/user", { headers: { Authorization: `Bearer ${IACAFE_TOKEN}`, Accept: "application/json" } });
  if ("error" in r) return { provider: "iacafe", ok: false, has_credentials: has, error: r.error };
  let d: any = null; try { d = JSON.parse(r.text); } catch {}
  const ok = r.http >= 200 && r.http < 300 && (d?.code !== "error");
  return { provider: "iacafe", ok, http: r.http, balance: pickBalance(d), raw: r.text.slice(0, 240), has_credentials: has };
}

async function pingGsubz(): Promise<Result> {
  const has = !!GSUBZ_KEY;
  if (!has) return { provider: "gsubz", ok: false, has_credentials: false, error: "GSUBZ_API_KEY missing" };
  const r = await tryFetch("https://gsubz.com/api/balance/", { headers: { "api-key": GSUBZ_KEY, Accept: "application/json" } });
  if ("error" in r) return { provider: "gsubz", ok: false, has_credentials: has, error: r.error };
  let d: any = null; try { d = JSON.parse(r.text); } catch {}
  const ok = r.http >= 200 && r.http < 300 && d?.status !== false;
  return { provider: "gsubz", ok, http: r.http, balance: d?.balance ?? pickBalance(d), raw: r.text.slice(0, 240), has_credentials: has };
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