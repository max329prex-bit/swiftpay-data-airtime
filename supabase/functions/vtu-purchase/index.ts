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
const GSUBZ_KEY     = Deno.env.get("GSUBZ_API_KEY") ?? "ap_3c7c405fe9cea54cfa07ba460eea05be";
const GSUBZ_AIRTIME_MAP: Record<string,string> = { MTN:"mtn", AIRTEL:"airtel", GLO:"glo", "9MOBILE":"9mobile" };

const GSUBZ_MIN_SUCCESS_RATE = 0.20;
const GSUBZ_SAMPLE_WINDOW    = 100;
const GSUBZ_HOUR_WINDOW_MS   = 60 * 60 * 1000;
const GSUBZ_MIN_AMOUNT       = 100;

function treasuryKey(type: string, prvCode: string): string {
  if (type==="data" && prvCode==="iacafe")          return "iacafe";
  if (type==="data" && prvCode?.startsWith("bsplug")) return "bsplug";
  if (type==="data" && prvCode==="gsubz")           return "iacafe";
  return "gsubz";
}
function genRef(){ return "SP-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).substr(2,5).toUpperCase(); }
function isBundleDown(msg:string){const l=(msg||"").toLowerCase();return l.includes("not available")||l.includes("unavailable")||l.includes("out of stock")||l.includes("package not found")||l.includes("provider down")||l.includes("service down")||l.includes("temporarily")||l.includes("invalid package")||l.includes("invalid bundle");}
async function tg(msg:string){if(!TG_BOT||!TG_CHAT)return;try{await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:TG_CHAT,text:msg,parse_mode:"Markdown"})});}catch{}}

interface PR { success:boolean; ref?:string; msg?:string; meter_token?:string; meter_unit?:string; bundle_down?:boolean; }

async function bsplugBuy(netId:number,planId:number,phone:string):Promise<PR> {
  try {
    const r=await fetch(`${BSPLUG_BASE}/data/`,{method:"POST",headers:{Accept:"application/json",Authorization:`Token ${BSPLUG_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({mobile_number:phone,Ported_number:false,plan:planId,network:netId}),signal:AbortSignal.timeout(30000)});
    const d=await r.json();
    console.log("[bsplug] response:", JSON.stringify(d).slice(0,300));
    const errs:string[]=Array.isArray(d?.error)?d.error:d?.error?[String(d.error)]:[];
    if(!r.ok||errs.length)return{success:false,msg:errs.join("; ")||d?.message||"BSPlug failed"};
    return{success:true,ref:String(d?.id||"")};
  }catch(e){return{success:false,msg:`BSPlug unreachable: ${e}`};}
}

async function iacafeBuy(planId:number,phone:string,reqId:string):Promise<PR> {
  try {
    const r=await fetch(`${IACAFE_BASE}/budget-data`,{method:"POST",headers:{Accept:"application/json",Authorization:`Bearer ${IACAFE_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({request_id:reqId,phone,data_plan:planId}),signal:AbortSignal.timeout(30000)});
    const d=await r.json();
    console.log("[iacafe] http_status:", r.status, "response:", JSON.stringify(d).slice(0,500));
    if(!r.ok||d?.code==="error"||d?.success===false)return{success:false,msg:d?.error?.message||d?.message||d?.error||"IA Cafe failed"};
    const isSuccess = d?.success===true || d?.status==="success" || d?.code==="success" || (r.ok && d?.data != null);
    if(!isSuccess)return{success:false,msg:d?.message||d?.error||"IA Cafe: unexpected response format"};
    return{success:true,ref:String(d?.data?.order_id||d?.data?.id||reqId)};
  }catch(e){return{success:false,msg:`IA Cafe unreachable: ${e}`};}
}

async function gsubzBuyRaw(params: Record<string, string>): Promise<PR> {
  const key = (GSUBZ_KEY || "").trim();
  console.log("[gsubz] key length:", key.length, "key first 10 chars:", key.substring(0,10));
  if (!key) {
    console.error("[gsubz] GSUBZ_API_KEY is empty or not configured");
    return { success: false, msg: "Gsubz API key not configured. Contact support." };
  }
  try {
    const fd = new FormData();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) fd.append(k, String(v));
    }
    // Ensure api key is in the form data too
    fd.append("api", key);
    const r = await fetch(`${GSUBZ_BASE}/pay/`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}` },
      body: fd,
      signal: AbortSignal.timeout(30000)
    });
    const d = await r.json();
    console.log("[gsubz] status:", r.status, "response:", JSON.stringify(d).slice(0, 400));
    const statusStr = typeof d?.status === "string" ? d.status.toLowerCase() : "";
    const codeStr   = typeof d?.code === "string" ? d.code : "";
    const isFailed  = !r.ok
      || d?.success === false
      || d?.status === false
      || d?.code === "error"
      || statusStr.includes("failed")
      || statusStr.includes("error")
      || codeStr === "401"
      || codeStr === "400"
      || codeStr === "403"
      || codeStr === "500"
      || codeStr === "502"
      || codeStr === "503"
      || (codeStr && codeStr !== "100" && codeStr !== "200" && codeStr !== "success");

    if (isFailed) {
      const m = d?.description || d?.message || d?.error || d?.msg || d?.status || "Gsubz failed";
      console.error("[gsubz] FAILED response:", JSON.stringify(d));
      return { success: false, msg: m, bundle_down: isBundleDown(m) };
    }
    return { success: true, ref: String(d?.data?.reference || d?.data?.id || d?.reference || d?.requestId || params.requestID || "") };
  } catch (e) {
    return { success: false, msg: `Gsubz unreachable: ${e}` };
  }
}

// FIX: GSubz data bundles require BOTH plan ID and amount.
// Without amount, the API returns AMOUNT_BELOW_MIN (code 402).
async function gsubzBuy(pkgCode:string, phone:string, reqId:string, sellPrice?: number): Promise<PR> {
  const parts = pkgCode.replace("GSZ-","").split("-");
  const planId = parts[parts.length - 1];
  const service = parts.slice(0, parts.length - 1).join("-");
  if (!planId || !service) return { success:false, msg:"Gsubz: invalid plan code" };
  const params: Record<string, string> = {
    serviceID: service,
    plan: planId,
    api: GSUBZ_KEY,
    phone: phone,
    requestID: reqId
  };
  // GSubz data requires amount field for validation. The actual pricing is by plan ID.
  // We pass the sell price as amount. GSubz internally maps plan ID to actual cost.
  if (sellPrice && sellPrice >= GSUBZ_MIN_AMOUNT) {
    params.amount = String(Math.round(sellPrice));
  }
  return gsubzBuyRaw(params);
}

async function isGsubzHealthy(admin: ReturnType<typeof createClient>): Promise<boolean> {
  try {
    const since = new Date(Date.now() - GSUBZ_HOUR_WINDOW_MS).toISOString();
    const { data: rows } = await admin
      .from("transactions")
      .select("status")
      .eq("type", "data")
      .contains("meta", { provider_code: "gsubz" })
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(GSUBZ_SAMPLE_WINDOW);
    if (!rows || rows.length < 5) return true;
    const successes = rows.filter(r => r.status === "success").length;
    const rate = successes / rows.length;
    console.log(`[vtu] Gsubz health: ${successes}/${rows.length} = ${(rate*100).toFixed(1)}%`);
    return rate >= GSUBZ_MIN_SUCCESS_RATE;
  } catch {
    return true;
  }
}

async function fraudCheck(sb:ReturnType<typeof createClient>,uid:string):Promise<boolean> {
  const win=new Date(Date.now()-2*60*1000).toISOString();
  const{count}=await sb.from("transactions").select("id",{count:"exact",head:true}).eq("user_id",uid).eq("status","failed").gte("created_at",win);
  return (count||0)>=5;
}

serve(async (req) => {
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});

  const auth=req.headers.get("Authorization");
  if(!auth)return json({error:"Unauthorized"},401);

  const admin = createClient(SUPA_URL, SUPA_SVC);
  let reservationId: string | null = null;
  let pendingTxId: string | null = null;

  async function releaseReservation(outcome: "used" | "failed"): Promise<void> {
    if (!reservationId) return;
    const id = reservationId;
    reservationId = null;
    try {
      await admin.rpc("release_provider_liquidity", { _reservation_id: id, _outcome: outcome });
      console.log(`[vtu] reservation ${id} released: ${outcome}`);
    } catch(e) {
      console.error(`[vtu] release_reservation failed (${outcome}):`, e);
    }
  }

  async function failAndRefund(reason: string): Promise<void> {
    if (!pendingTxId) return;
    try {
      const { data: rev, error: revErr } = await admin.rpc("fail_and_refund_transaction", { _tx_id: pendingTxId, _reason: reason });
      if (revErr) {
        console.error(`[vtu] fail_and_refund failed for tx ${pendingTxId}:`, revErr.message);
        await tg(`🚨 *CRITICAL: refund failed*\nTx: ${pendingTxId}\nReason: ${reason}\nError: ${revErr.message}`);
      } else {
        console.log(`[vtu] refunded tx ${pendingTxId}: ${reason}`);
      }
    } catch (e) {
      console.error(`[vtu] exception during refund for tx ${pendingTxId}:`, e);
    }
    pendingTxId = null;
  }

  try {
    const uc=createClient(SUPA_URL,SUPA_ANON,{global:{headers:{Authorization:auth}}});
    const{data:{user},error:ae}=await uc.auth.getUser();
    if(ae||!user)return json({error:"Unauthorized"},401);

    const body=await req.json();
    const{type,network,phone,amount,package_code,provider_code,pin,bundle,provider,meta={},meter_number,meter_type,packageCode}=body;
    const pkgCode=package_code||bundle||packageCode;
    const prvCode=provider_code||provider;
    const sellPrice = Number(amount || 0);

    // ── Electricity / Cable verify ─────────────────────────────────────────
    if(type==="electricity_verify"||type==="cable_verify"){
      return json({error:"Verification temporarily unavailable. Please contact support."},503);
    }

    // ── PIN verify ────────────────────────────────────────────────────────
    const{data:pv,error:pe}=await uc.rpc("verify_transaction_pin",{_pin:pin});
    if(pe||!pv)return json({error:"Incorrect PIN"},403);

    // ── Fraud check ───────────────────────────────────────────────────────
    if(await fraudCheck(admin,user.id)){
      await tg(`⚠️ *BlitzPay Fraud Alert*\nUser ${user.id} — 5+ failures in 2min`);
      return json({error:"Too many failed attempts. Wait a few minutes."},429);
    }

    const ref=genRef();
    const txMeta:Record<string,unknown>={...meta,provider_code:prvCode||"",package_code:pkgCode||""};

    // ── STEP 1: Debit wallet + create PENDING transaction (ATOMIC) ─────────
    const { data: pendingTx, error: pendingErr } = await admin.rpc("debit_and_create_transaction", {
      _user_id: user.id,
      _type: type,
      _network: network || prvCode || "",
      _phone: type === "electricity" ? (meter_number || phone || "") : (phone || ""),
      _amount: sellPrice,
      _reference: ref,
      _meta: txMeta,
    });
    if (pendingErr || !pendingTx) {
      console.error("[vtu] FAILED to debit wallet / create pending transaction:", pendingErr?.message);
      await tg(`🚨 *Critical: debit+pending creation failed*\nUser: ${user.id}\n₦${sellPrice} ${type}\n${pendingErr?.message || ""}`);
      return json({ success:false, error: "Could not initiate purchase. Please try again.", code: "INIT_FAILED", balance_credited: false, reference: ref }, 200);
    }
    pendingTxId = (pendingTx as Record<string,unknown>).id as string;
    const txReference = (pendingTx as Record<string,unknown>).reference as string || ref;
    console.log(`[vtu] wallet debited, pending tx ${pendingTxId} created, ref=${txReference}`);

    // ── Treasury: Reserve liquidity ───────────────────────────────────────
    const tProv = treasuryKey(type, prvCode||"");
    try {
      const{data:rid,error:re}=await admin.rpc("reserve_provider_liquidity",{
        _provider:tProv, _amount:sellPrice, _uid:user.id, _tx_ref:ref
      });
      if(re){
        const m=re.message||"";
        if(m.includes("INSUFFICIENT_LIQUIDITY")||m.includes("paused")){
          await failAndRefund("Liquidity reservation failed");
          await tg(`🚨 *Low Float — ${tProv}*\nInsufficient liquidity for ₦${sellPrice}\nUser: ${user.id}`);
          return json({success:false,error:"Service temporarily unavailable. Please try again shortly.",code:"LOW_FLOAT",balance_credited:true},200);
        }
        console.warn("reserve_liquidity (non-blocking):", m);
      } else {
        reservationId = rid as string;
        console.log(`[vtu] reservation ${reservationId} created for ₦${sellPrice} on ${tProv}`);
      }
    } catch(e){ console.warn("reserve_liquidity exception:", e); }

    let pr:PR={success:false,msg:"No provider matched"};
    let usedProvider = prvCode || "";

    // ── Provider routing ───────────────────────────────────────────────────
    if(type==="data" && prvCode==="gsubz") {
      const reqId = `GSZ-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`;
      txMeta.gsubz_request_id = reqId;

      const gsubzHealthy = await isGsubzHealthy(admin);
      if (gsubzHealthy) {
        // FIX: Pass sellPrice so GSubz data bundles get the required amount field
        pr = await gsubzBuy(pkgCode||"", phone, reqId, sellPrice);
        if (pr.success) {
          usedProvider = "gsubz";
          txMeta.provider_used = "gsubz";
          txMeta.gsubz_ref = pr.ref;
        } else {
          console.warn(`[vtu] Gsubz failed (${pr.msg}), trying fallback`);
          await tg(`⚠️ *Gsubz fallback triggered*\nPlan: ${pkgCode}\nReason: ${pr.msg}\nChecking fallback from packages table`);
        }
      } else {
        console.warn("[vtu] Gsubz success rate below threshold — skipping to fallback");
        await tg(`⚠️ *Gsubz low success rate — bypassed for this order*`);
      }

      if (!pr.success) {
        const { data: pkg } = await admin.from("packages")
          .select("fallback_provider_code, fallback_package_code")
          .eq("package_code", pkgCode||"")
          .maybeSingle();
        const fbPrvCode = (pkg as Record<string,string>|null)?.fallback_provider_code || "iacafe";
        const fbPkgCode = (pkg as Record<string,string>|null)?.fallback_package_code || "";

        if (fbPrvCode === "iacafe" && fbPkgCode) {
          const planId = parseInt(fbPkgCode.replace("IAC-",""), 10);
          if (planId) {
            const fbReqId = `IAC-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`;
            pr = await iacafeBuy(planId, phone, fbReqId);
            if (pr.success) {
              usedProvider = "iacafe-fallback";
              txMeta.provider_used = "iacafe_fallback";
              txMeta.iacafe_request_id = fbReqId;
            }
          }
        } else if (fbPrvCode?.startsWith("bsplug") && fbPkgCode) {
          const nId = parseInt(fbPrvCode.split("-")[1] || "1", 10);
          const pId = parseInt(fbPkgCode.replace("BSP-",""), 10);
          if (pId && nId) {
            pr = await bsplugBuy(nId, pId, phone);
            if (pr.success) {
              usedProvider = "bsplug-fallback";
              txMeta.provider_used = "bsplug_fallback";
            }
          }
        } else if (fbPrvCode && fbPkgCode) {
          const fbReqId = `FB-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`;
          // FIX: Pass amount for fallback GSubz data attempts too
          const fbParams: Record<string, string> = { serviceID: fbPrvCode, plan: fbPkgCode, api: GSUBZ_KEY, phone, requestID: fbReqId, callback_url: "https://blitz.com.ng/webhook/gsubz" };
          if (sellPrice >= GSUBZ_MIN_AMOUNT) fbParams.amount = String(Math.round(sellPrice));
          pr = await gsubzBuyRaw(fbParams);
          if (pr.success) {
            usedProvider = `${fbPrvCode}-fallback`;
            txMeta.provider_used = `${fbPrvCode}_fallback`;
          }
        }
      }

    } else if(type==="data" && prvCode==="iacafe"){
      const planId=parseInt((pkgCode||"").replace("IAC-",""),10);
      if(!planId){
        await failAndRefund("Invalid IA Cafe plan");
        await releaseReservation("failed");
        return json({success:false,error:"Invalid IA Cafe plan",code:"INVALID_PLAN",balance_credited:true},200);
      }
      const reqId=`IAC-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`;
      txMeta.iacafe_request_id=reqId;
      pr=await iacafeBuy(planId,phone,reqId);

    } else if(type==="data" && prvCode?.startsWith("bsplug")){
      const nId=parseInt(prvCode.split("-")[1]||"1",10);
      const pId=parseInt((pkgCode||"").replace("BSP-",""),10);
      if(!pId||!nId){
        await failAndRefund("Invalid BSPlug plan");
        await releaseReservation("failed");
        return json({success:false,error:"Invalid BSPlug plan",code:"INVALID_PLAN",balance_credited:true},200);
      }
      pr=await bsplugBuy(nId,pId,phone);

    } else if (type === "airtime" || type === "electricity" || type === "cable") {
      const reqId = `GSZ-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`;
      txMeta.gsubz_request_id = reqId;

      let serviceID = "";
      let plan = "";
      let gsubzPhone = phone || "";
      let extra: Record<string, string> = {};

      if (type === "airtime") {
        serviceID = GSUBZ_AIRTIME_MAP[network?.toUpperCase()] || "mtn";
        plan = String(sellPrice || 0);
      } else if (type === "electricity") {
        serviceID = prvCode || "";
        plan = String(sellPrice || 0);
        gsubzPhone = meter_number || phone || "";
        extra = { meter: meter_number || phone || "" };
      } else {
        serviceID = prvCode || "";
        plan = pkgCode || "";
      }

      pr = await gsubzBuyRaw({
        serviceID,
        plan,
        api: GSUBZ_KEY,
        phone: gsubzPhone,
        requestID: reqId,
        callback_url: "https://blitz.com.ng/webhook/gsubz",
        ...extra
      });

      if (pr.success) {
        usedProvider = "gsubz";
        txMeta.provider_used = "gsubz";
        txMeta.gsubz_ref = pr.ref;
      }

    } else {
      await failAndRefund("Service type unavailable");
      await releaseReservation("failed");
      return json({success:false,error:"This service type is not currently available.",code:"SERVICE_UNAVAILABLE",balance_credited:true,id:pendingTxId},200);
    }

    // ── STEP 2: Provider result ──────────────────────────────────────────
    await releaseReservation(pr.success ? "used" : "failed");

    if(!pr.success){
      const errMsg=pr.msg||"Purchase failed";
      console.error(`[vtu] purchase failed: ${errMsg}`);
      if(pkgCode&&pr.bundle_down){
        try{ await admin.rpc("mark_bundle_unavailable",{_package_code:pkgCode,_provider_code:prvCode||"gsubz",_network:network,_error:errMsg}); }catch{}
      }
      await failAndRefund(errMsg);
      return json({success:false,error:pr.bundle_down?"This data plan is temporarily unavailable.":errMsg,code:pr.bundle_down?"BUNDLE_UNAVAILABLE":"PURCHASE_FAILED",balance_credited:true,id:pendingTxId},200);
    }

    // ── STEP 3: COMMIT transaction to success ────────────────────────────
    txMeta.provider_reference = pr.ref || ref;
    const{data:committedTx,error:commitErr}=await admin.rpc("commit_transaction",{
      _tx_id: pendingTxId,
      _provider_reference: pr.ref || ref,
      _meta: txMeta,
    });
    if(commitErr){
      console.error("[vtu] COMMIT failed after provider success:", commitErr.message);
      await tg(`🚨 *CRITICAL: commit failed after delivery*\nUser: ${user.id}\nTx: ${pendingTxId}\n₦${sellPrice} ${type}/${network||prvCode}\nError: ${commitErr.message}`);
      return json({success:true,warning:"Purchase delivered but status update delayed. Contact support if needed.",id:pendingTxId,reference:txReference,status:"pending"},200);
    }
    console.log(`[vtu] committed tx ${pendingTxId}: ${(committedTx as Record<string,unknown>)?.reference}`);

    // Mark bundle available
    if(pkgCode){
      try{ await admin.rpc("mark_bundle_available",{_package_code:pkgCode,_provider_code:usedProvider||prvCode||"gsubz",_network:network}); }catch{}
    }

    const resp:Record<string,unknown>={success:true,reference:(committedTx as Record<string,unknown>)?.reference||txReference,status:"success"};
    if(pendingTxId) resp.id = pendingTxId;
    if(pr.meter_token) resp.meter_token = pr.meter_token;
    console.log(`[vtu] ✅ purchase complete: ${resp.reference} via ${usedProvider}`);
    return json(resp);

  }catch(e){
    console.error("vtu-purchase unhandled error:",e);
    await failAndRefund("Unhandled error");
    await releaseReservation("failed");
    return json({success:false,error:e instanceof Error?e.message:"Unknown",code:"SYSTEM_ERROR",balance_credited:true,id:pendingTxId},200);
  }
});
