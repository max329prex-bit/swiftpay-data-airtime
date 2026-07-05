import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret" };
const SUPA_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPA_ANON   = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPA_SVC    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_BOT      = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT     = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") ?? "";
const BSPLUG_BASE   = "https://bsplug.net/api";
const BSPLUG_TOKEN  = Deno.env.get("BSPLUG_TOKEN") ?? "";
const IACAFE_BASE   = "https://iacafe.com.ng/devapi/v1";
const IACAFE_TOKEN  = Deno.env.get("IACAFE_TOKEN") ?? "";
const GSUBZ_BASE    = "https://api.gsubz.com/api";
const GSUBZ_KEY     = Deno.env.get("GSUBZ_API_KEY") ?? "";

const GSUBZ_AIRTIME_MAP: Record<string, string> = {
  MTN: "mtn", AIRTEL: "airtel", GLO: "glo", "9MOBILE": "9mobile"
};
const GSUBZ_MIN_SUCCESS_RATE = 0.20;
const GSUBZ_SAMPLE_WINDOW    = 100;
const GSUBZ_HOUR_WINDOW_MS   = 60 * 60 * 1000;
const GSUBZ_MIN_AIRTIME      = 100;

const GSUBZ_FAILURE_KEYWORDS = [
  "not eligible", "not qualified", "reversed", "insufficient", "invalid",
  "failed", "error", "declined", "rejected", "unable", "cannot",
  "unavailable", "out of stock", "does not exist", "doesn't exist",
  "not found", "expired", "cancelled", "already purchased"
];

function isGsubzFailureByText(text: string): boolean {
  const t = (text || "").toLowerCase();
  return GSUBZ_FAILURE_KEYWORDS.some(kw => t.includes(kw));
}

function treasuryKey(type: string, prvCode: string): string {
  if (type === "data" && prvCode === "iacafe")          return "iacafe";
  if (type === "data" && prvCode?.startsWith("bsplug")) return "bsplug";
  if (type === "data" && prvCode === "gsubz")           return "iacafe";
  if (type === "electricity")                           return "iacafe";
  return "gsubz";
}
function genRef() {
  return "SP-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).substr(2, 5).toUpperCase();
}
function isBundleDown(msg: string) {
  const l = (msg || "").toLowerCase();
  return l.includes("not available") || l.includes("unavailable") || l.includes("out of stock") ||
    l.includes("package not found") || l.includes("provider down") || l.includes("service down") ||
    l.includes("temporarily") || l.includes("invalid package") || l.includes("invalid bundle") ||
    l.includes("invalid plan") || l.includes("plan not found") || l.includes("amount below");
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

interface PR { success: boolean; ref?: string; msg?: string; bundle_down?: boolean; converted_to_airtime?: boolean; }

// ── Provider: BSPlug ────────────────────────────────────────────────
async function bsplugBuy(netId: number, planId: number, phone: string): Promise<PR> {
  try {
    const r = await fetch(`${BSPLUG_BASE}/data/`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Token ${BSPLUG_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ mobile_number: phone, Ported_number: false, plan: planId, network: netId }),
      signal: AbortSignal.timeout(30000)
    });
    const d = await r.json();
    const errs: string[] = Array.isArray(d?.error) ? d.error : d?.error ? [String(d.error)] : [];
    if (!r.ok || errs.length) return { success: false, msg: errs.join("; ") || d?.message || "BSPlug failed" };
    return { success: true, ref: String(d?.id || "") };
  } catch (e) { return { success: false, msg: `BSPlug unreachable: ${e}` }; }
}

// ── Provider: IA Cafe ────────────────────────────────────────────────
async function iacafeBuy(planId: number, phone: string, reqId: string): Promise<PR> {
  try {
    const r = await fetch(`${IACAFE_BASE}/budget-data`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${IACAFE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: reqId, phone, data_plan: planId }),
      signal: AbortSignal.timeout(30000)
    });
    const d = await r.json();
    if (!r.ok || d?.code === "error" || d?.success === false)
      return { success: false, msg: d?.error?.message || d?.message || d?.error || "IA Cafe failed" };

    // ── Owing check: detect if data was converted to airtime ──────────────────
    // IACafe may deliver "success" but the carrier converts data to airtime if customer is owing
    const respText = JSON.stringify(d).toLowerCase();
    const isOwingConversion = respText.includes("airtime") || respText.includes("owing") || respText.includes("borrowed") ||
                               respText.includes("converted") || respText.includes("not data") ||
                               (d?.data?.type && String(d.data.type).toLowerCase() === "airtime");
    if (isOwingConversion) {
      return {
        success: false,
        msg: "This line has an outstanding data loan. The purchase was converted to airtime instead of data. Please clear your outstanding balance with your network provider first, then retry.",
        converted_to_airtime: true,
        bundle_down: false,
      };
    }

    const isSuccess = d?.success === true || d?.status === "success" || d?.code === "success" || (r.ok && d?.data != null);
    if (!isSuccess) return { success: false, msg: d?.message || d?.error || "IA Cafe: unexpected response format" };
    return { success: true, ref: String(d?.data?.order_id || d?.data?.id || reqId) };
  } catch (e) { return { success: false, msg: `IA Cafe unreachable: ${e}` }; }
}

// ── IA Cafe Electricity ──────────────────────────────────────────────────────
async function iacafeVerifyMeter(serviceID: string, customerId: string, type: string): Promise<{ ok: boolean; name?: string; error?: string }> {
  if (!IACAFE_TOKEN) return { ok: false, error: "IA Cafe API key not configured" };
  try {
    const r = await fetch(`${IACAFE_BASE}/verify`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${IACAFE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ service_id: serviceID, customer_id: customerId, variation_id: type }),
      signal: AbortSignal.timeout(15000)
    });
    const d = await r.json();
    if (!r.ok || d?.success === false) {
      const msg = d?.error?.message || d?.message || d?.error || "Verification failed";
      return { ok: false, error: msg };
    }
    const name = d?.data?.name || d?.data?.customer_name || d?.data?.Customer_Name || d?.name || d?.customer_name;
    if (name && typeof name === "string" && name.length > 1) return { ok: true, name };
    return { ok: false, error: d?.message || "Could not verify meter." };
  } catch (e) {
    return { ok: false, error: "Verification service unavailable." };
  }
}
async function iacafeElectricity(serviceID: string, customerId: string, amount: number, phone: string, reqId: string): Promise<PR> {
  if (!IACAFE_TOKEN) return { success: false, msg: "IA Cafe API key not configured" };
  try {
    const r = await fetch(`${IACAFE_BASE}/electricity`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${IACAFE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: reqId, service_id: serviceID, customer_id: customerId, variation_id: "prepaid", amount: String(amount), phone }),
      signal: AbortSignal.timeout(30000)
    });
    const d = await r.json();
    if (!r.ok || d?.success === false || d?.code === "error") {
      const m = d?.error?.message || d?.message || d?.error || "IA Cafe electricity failed";
      return { success: false, msg: m, bundle_down: isBundleDown(m) };
    }
    const ok = d?.success === true || d?.status === "success" || d?.code === "success";
    if (!ok) return { success: false, msg: d?.message || "Unexpected response from IA Cafe", bundle_down: isBundleDown(d?.message || "") };
    return { success: true, ref: String(d?.data?.request_id || d?.data?.order_id || d?.data?.id || reqId) };
  } catch (e) {
    return { success: false, msg: `IA Cafe unreachable: ${e}` };
  }
}

// ── Provider: GSubz (raw) ─────────────────────────────────────────────────────
async function gsubzBuyRaw(params: Record<string, string>): Promise<PR> {
  const key = (GSUBZ_KEY || "").trim();
  if (!key) return { success: false, msg: "Gsubz API key not configured. Contact support." };
  try {
    const fd = new FormData();
    for (const [k, v] of Object.entries(params)) { if (v !== undefined && v !== null) fd.append(k, String(v)); }
    fd.append("api", key);
    const r = await fetch(`${GSUBZ_BASE}/pay/`, {
      method: "POST", headers: { "Authorization": `Bearer ${key}` }, body: fd,
      signal: AbortSignal.timeout(30000)
    });
    const d = await r.json();

    const statusStr   = typeof d?.status === "string"   ? d.status.toLowerCase() : "";
    const codeStr     = typeof d?.code === "string"     ? d.code : "";
    const descStr     = typeof d?.description === "string" ? d.description : "";
    const msgStr      = typeof d?.message === "string"  ? d.message : "";
    const respBody    = JSON.stringify(d);

    const isHardFailed = !r.ok || d?.success === false || d?.status === false || d?.code === "error" ||
      statusStr.includes("failed") || statusStr.includes("error") ||
      ["401","400","403","500","502","503"].includes(codeStr) ||
      (codeStr && codeStr !== "100" && codeStr !== "200" && codeStr !== "success");

    if (isHardFailed) {
      const m = descStr || msgStr || d?.error || d?.msg || d?.status || "Gsubz failed";
      console.error("[gsubz] HARD FAIL:", JSON.stringify(d));
      return { success: false, msg: m, bundle_down: isBundleDown(m) };
    }

    const allText = (descStr + " " + msgStr + " " + respBody).toLowerCase();
    if (isGsubzFailureByText(allText)) {
      const m = descStr || msgStr || "GSubz declined: " + respBody.slice(0,200);
      console.error("[gsubz] SOFT FAIL detected:", JSON.stringify(d));
      return { success: false, msg: m, bundle_down: isBundleDown(m) };
    }

    return { success: true, ref: String(d?.data?.reference || d?.data?.id || d?.reference || d?.requestId || params.requestID || "") };
  } catch (e) { return { success: false, msg: `Gsubz unreachable: ${e}` }; }
}

// ── Provider: GSubz (data bundle) ────────────────────────────────────────
async function gsubzData(pkgCode: string, phone: string, reqId: string): Promise<PR> {
  const cleanCode = pkgCode.replace(/^GSZ-/, "");
  const parts = cleanCode.split("-");
  const planId = parts[parts.length - 1];
  const service = parts.length > 1 ? parts.slice(0, parts.length - 1).join("-").replace(/-/g, "_") : "";
  if (!planId || !service) return { success: false, msg: "Gsubz: invalid data plan code" };
  return gsubzBuyRaw({ serviceID: service, plan: planId, api: GSUBZ_KEY, phone, requestID: reqId, amount: "" });
}

// ── Provider: GSubz (airtime) ───────────────────────────────────────────────────
async function gsubzAirtime(network: string, phone: string, amount: number): Promise<PR> {
  const serviceID = GSUBZ_AIRTIME_MAP[network?.toUpperCase()] || "mtn";
  return gsubzBuyRaw({ serviceID, api: GSUBZ_KEY, amount: String(amount), phone });
}

async function isGsubzHealthy(admin: ReturnType<typeof createClient>): Promise<boolean> {
  try {
    const since = new Date(Date.now() - GSUBZ_HOUR_WINDOW_MS).toISOString();
    const { data: rows } = await admin.from("transactions").select("status").eq("type", "data")
      .contains("meta", { provider_code: "gsubz" }).gte("created_at", since)
      .order("created_at", { ascending: false }).limit(GSUBZ_SAMPLE_WINDOW);
    if (!rows || rows.length < 5) return true;
    return (rows.filter(r => r.status === "success").length / rows.length) >= GSUBZ_MIN_SUCCESS_RATE;
  } catch { return true; }
}

async function fraudCheck(sb: ReturnType<typeof createClient>, uid: string): Promise<boolean> {
  const win = new Date(Date.now() - 2*60*1000).toISOString();
  const { count } = await sb.from("transactions").select("id", { count: "exact", head: true })
    .eq("user_id", uid).eq("status", "failed").gte("created_at", win);
  return (count || 0) >= 5;
}

// ── Main handler ─────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(SUPA_URL, SUPA_SVC);
  let reservationId: string | null = null;
  let pendingTxId: string | null = null;

  async function releaseReservation(outcome: "used" | "failed"): Promise<void> {
    if (!reservationId) return;
    const id = reservationId; reservationId = null;
    try { await admin.rpc("release_provider_liquidity", { _reservation_id: id, _outcome: outcome }); } catch {}
  }

  async function failAndRefund(reason: string): Promise<void> {
    if (!pendingTxId) return;
    try {
      const { error: revErr } = await admin.rpc("fail_and_refund_transaction", { _tx_id: pendingTxId, _reason: reason });
      if (revErr) await tg(`🚨 *CRITICAL: refund failed*\nTx: ${pendingTxId}\nReason: ${reason}`);
    } catch {}
    pendingTxId = null;
  }

  try {
    const uc = createClient(SUPA_URL, SUPA_ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: ae } = await uc.auth.getUser();
    if (ae || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { type, network, phone, amount, package_code, provider_code, pin, bundle, provider, meta = {}, meter_number, meter_type, packageCode } = body;
    const pkgCode = package_code || bundle || packageCode || "";
    const prvCode = provider_code || provider || "";
    const sellPrice = Number(amount || 0);

    if (type === "airtime" && sellPrice < GSUBZ_MIN_AIRTIME) {
      return json({ success: false, error: `GSubz airtime minimum is ₦${GSUBZ_MIN_AIRTIME}. Please enter ₦${GSUBZ_MIN_AIRTIME} or more.`, code: "AMOUNT_BELOW_MIN", balance_credited: false }, 200);
    }

    if (type === "electricity_verify") {
      const v = await iacafeVerifyMeter(prvCode || "", meter_number || phone || "", "prepaid");
      if (v.ok && v.name) {
        return json({ success: true, customer_name: v.name, meter_number: meter_number || phone || "" });
      }
      return json({ success: false, error: v.error || "Could not verify meter. Check number and provider." }, 200);
    }
    if (type === "cable_verify") {
      const key = (GSUBZ_KEY || "").trim();
      if (!key) return json({ success: false, error: "GSubz API key not configured" }, 200);
      try {
        const fd = new FormData();
        fd.append("serviceID", prvCode || "");
        fd.append("smartcard", meter_number || phone || "");
        fd.append("api", key);
        const r = await fetch(GSUBZ_BASE + "/verify/", {
          method: "POST", headers: { "Authorization": "Bearer " + key }, body: fd,
          signal: AbortSignal.timeout(15000)
        });
        const d = await r.json();
        const errorText = d?.description || d?.message || "";
        const isErrorResponse = /ACCESS_NOT_ALLOWED|INVALID|ERROR|FAILED|DENIED|UNAUTHORIZED/i.test(errorText);
        if (isErrorResponse) {
          return json({ success: false, error: errorText }, 200);
        }
        const customerName = d?.content?.Customer_Name || d?.content?.customer_name || d?.customer_name || d?.Customer_Name || d?.data?.customer_name || d?.name;
        if (customerName && typeof customerName === "string" && customerName.length > 1 && !/ACCESS_NOT_ALLOWED|INVALID|ERROR/i.test(customerName)) {
          return json({ success: true, customer_name: customerName, smartcard: meter_number || phone || "" });
        }
        return json({ success: false, error: errorText || "Could not verify smartcard." }, 200);
      } catch (e) {
        return json({ success: false, error: "Verification service unavailable." }, 200);
      }
    }

    const { data: pv, error: pe } = await uc.rpc("verify_transaction_pin", { _pin: pin });
    if (pe || !pv) return json({ error: "Incorrect PIN" }, 403);

    if (await fraudCheck(admin, user.id)) {
      await tg(`⚠️ *BlitzPay Fraud Alert*\nUser ${user.id} — 5+ failures in 2min`);
      return json({ error: "Too many failed attempts. Wait a few minutes." }, 429);
    }

    const ref = genRef();
    const txMeta: Record<string, unknown> = { ...meta, provider_code: prvCode || "", package_code: pkgCode || "" };

    const { data: pendingTx, error: pendingErr } = await admin.rpc("debit_and_create_transaction", {
      _user_id: user.id, _type: type, _network: network || prvCode || "",
      _phone: type === "electricity" ? (meter_number || phone || "") : (phone || ""),
      _amount: sellPrice, _reference: ref, _meta: txMeta,
    });
    if (pendingErr || !pendingTx) {
      await tg(`🚨 *Critical: debit+pending creation failed*\nUser: ${user.id}\n₦${sellPrice} ${type}\n${pendingErr?.message || ""}`);
      return json({ success: false, error: "Could not initiate purchase. Please try again.", code: "INIT_FAILED", balance_credited: false, reference: ref }, 200);
    }
    pendingTxId = (pendingTx as Record<string, unknown>).id as string;
    const txReference = (pendingTx as Record<string, unknown>).reference as string || ref;

    const tProv = treasuryKey(type, prvCode || "");
    try {
      const { data: rid, error: re } = await admin.rpc("reserve_provider_liquidity", {
        _provider: tProv, _amount: sellPrice, _uid: user.id, _tx_ref: ref
      });
      if (re) {
        const m = re.message || "";
        if (m.includes("INSUFFICIENT_LIQUIDITY") || m.includes("paused")) {
          await failAndRefund("Liquidity reservation failed");
          return json({ success: false, error: "Service temporarily unavailable. Please try again shortly.", code: "LOW_FLOAT", balance_credited: true }, 200);
        }
      } else { reservationId = rid as string; }
    } catch {}

    let pr: PR = { success: false, msg: "No provider matched" };
    let usedProvider = prvCode || "";

    if (type === "data" && prvCode === "gsubz") {
      const reqId = `GSZ-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`;
      txMeta.gsubz_request_id = reqId;
      const gsubzHealthy = await isGsubzHealthy(admin);
      if (gsubzHealthy) {
        pr = await gsubzData(pkgCode, phone, reqId);
        if (pr.success) { usedProvider = "gsubz"; txMeta.provider_used = "gsubz"; txMeta.gsubz_ref = pr.ref; }
      }
      if (!pr.success) {
        const { data: pkg } = await admin.from("packages").select("fallback_provider_code, fallback_package_code")
          .eq("package_code", pkgCode || "").maybeSingle();
        const fbPrvCode = (pkg as Record<string, string> | null)?.fallback_provider_code || "iacafe";
        const fbPkgCode = (pkg as Record<string, string> | null)?.fallback_package_code || "";
        if (fbPrvCode === "iacafe" && fbPkgCode) {
          const planId = parseInt(fbPkgCode.replace("IAC-", ""), 10);
          if (planId) {
            const fbReqId = `IAC-${Date.now()}`;
            pr = await iacafeBuy(planId, phone, fbReqId);
            if (pr.success) { usedProvider = "iacafe-fallback"; txMeta.provider_used = "iacafe_fallback"; }
            else if (pr.converted_to_airtime) {
              // Owing line: data became airtime. Refund and notify.
              await failAndRefund(pr.msg || "Customer has outstanding data loan");
              await releaseReservation("failed");
              await tg(`⚠️ *IACafe Owing Line*\nUser: ${user.id}\nPhone: ${phone}\nPlan: ${pkgCode}\n₦${sellPrice} converted to airtime. Refunded.`);
              return json({ success: false, error: pr.msg || "This line has an outstanding data loan. Please clear it with your network provider first.", code: "OWING_LINE", balance_credited: true, id: pendingTxId }, 200);
            }
          }
        } else if (fbPrvCode?.startsWith("bsplug") && fbPkgCode) {
          const nId = parseInt(fbPrvCode.split("-")[1] || "1", 10); const pId = parseInt(fbPkgCode.replace("BSP-", ""), 10);
          if (pId && nId) { pr = await bsplugBuy(nId, pId, phone); if (pr.success) { usedProvider = "bsplug-fallback"; txMeta.provider_used = "bsplug_fallback"; } }
        }
      }
    } else if (type === "data" && prvCode === "iacafe") {
      const planId = parseInt((pkgCode || "").replace("IAC-", ""), 10);
      if (!planId) { await failAndRefund("Invalid IA Cafe plan"); await releaseReservation("failed"); return json({ success: false, error: "Invalid IA Cafe plan", code: "INVALID_PLAN", balance_credited: true }, 200); }
      const reqId = `IAC-${Date.now()}`; txMeta.iacafe_request_id = reqId; pr = await iacafeBuy(planId, phone, reqId);
      if (!pr.success && pr.converted_to_airtime) {
        await failAndRefund(pr.msg || "Customer has outstanding data loan");
        await releaseReservation("failed");
        return json({ success: false, error: pr.msg || "This line has an outstanding data loan.", code: "OWING_LINE", balance_credited: true, id: pendingTxId }, 200);
      }
    } else if (type === "data" && prvCode?.startsWith("bsplug")) {
      const nId = parseInt(prvCode.split("-")[1] || "1", 10); const pId = parseInt((pkgCode || "").replace("BSP-", ""), 10);
      if (!pId || !nId) { await failAndRefund("Invalid BSPlug plan"); await releaseReservation("failed"); return json({ success: false, error: "Invalid BSPlug plan", code: "INVALID_PLAN", balance_credited: true }, 200); }
      pr = await bsplugBuy(nId, pId, phone);
    } else if (type === "airtime") {
      pr = await gsubzAirtime(network || "", phone || "", sellPrice);
      if (pr.success) { usedProvider = "gsubz"; txMeta.provider_used = "gsubz"; txMeta.gsubz_ref = pr.ref; }
    } else if (type === "electricity") {
      const reqId = `IAC-EL-${Date.now()}`; txMeta.iacafe_request_id = reqId;
      pr = await iacafeElectricity(prvCode || "", meter_number || phone || "", sellPrice, phone || meter_number || "", reqId);
      if (pr.success) { usedProvider = "iacafe"; txMeta.provider_used = "iacafe"; txMeta.iacafe_ref = pr.ref; }
    } else if (type === "cable") {
      const reqId = `GSZ-${Date.now()}`; txMeta.gsubz_request_id = reqId;
      pr = await gsubzBuyRaw({ serviceID: prvCode || "", plan: pkgCode || String(sellPrice || 0), api: GSUBZ_KEY, phone: meter_number || phone || "", requestID: reqId, callback_url: "https://blitz.com.ng/webhook/gsubz" });
      if (pr.success) { usedProvider = "gsubz"; txMeta.provider_used = "gsubz"; txMeta.gsubz_ref = pr.ref; }
    } else {
      await failAndRefund("Service type unavailable"); await releaseReservation("failed");
      return json({ success: false, error: "This service type is not currently available.", code: "SERVICE_UNAVAILABLE", balance_credited: true, id: pendingTxId }, 200);
    }

    await releaseReservation(pr.success ? "used" : "failed");

    if (!pr.success) {
      const errMsg = pr.msg || "Purchase failed";
      if (pkgCode && pr.bundle_down) { try { await admin.rpc("mark_bundle_unavailable", { _package_code: pkgCode, _provider_code: prvCode || "gsubz", _network: network, _error: errMsg }); } catch {} }
      await failAndRefund(errMsg);
      return json({ success: false, error: pr.bundle_down ? "This data plan is temporarily unavailable." : errMsg, code: pr.bundle_down ? "BUNDLE_UNAVAILABLE" : "PURCHASE_FAILED", balance_credited: true, id: pendingTxId }, 200);
    }

    txMeta.provider_reference = pr.ref || ref;
    const { data: committedTx, error: commitErr } = await admin.rpc("commit_transaction", {
      _tx_id: pendingTxId, _provider_reference: pr.ref || ref, _meta: txMeta,
    });
    if (commitErr) {
      await tg(`🚨 *CRITICAL: commit failed after delivery*\nUser: ${user.id}\nTx: ${pendingTxId}\n₦${sellPrice} ${type}`);
      return json({ success: true, warning: "Purchase delivered but status update delayed.", id: pendingTxId, reference: txReference, status: "pending" }, 200);
    }

    if (pkgCode) { try { await admin.rpc("mark_bundle_available", { _package_code: pkgCode, _provider_code: usedProvider || prvCode || "gsubz", _network: network }); } catch {} }
    const resp: Record<string, unknown> = { success: true, reference: (committedTx as Record<string, unknown>)?.reference || txReference, status: "success" };
    if (pendingTxId) resp.id = pendingTxId;
    return json(resp);

  } catch (e) {
    console.error("vtu-purchase unhandled error:", e);
    await failAndRefund("Unhandled error"); await releaseReservation("failed");
    return json({ success: false, error: e instanceof Error ? e.message : "Unknown", code: "SYSTEM_ERROR", balance_credited: true, id: pendingTxId }, 200);
  }
});
