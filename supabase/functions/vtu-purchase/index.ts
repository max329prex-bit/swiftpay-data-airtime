import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret" };
const SUPA_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPA_ANON   = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPA_SVC    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_BOT      = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT     = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") ?? "";
const AIDAPAY_BASE  = "https://www.aidapay.ng/api/v1";
const AIDAPAY_TOKEN = Deno.env.get("AIDAPAY_TOKEN")!;
const AIDAPAY_PIN   = Deno.env.get("AIDAPAY_ACCOUNT_PIN")!;
const BSPLUG_BASE   = "https://bsplug.net/api";
const BSPLUG_TOKEN  = Deno.env.get("BSPLUG_TOKEN") ?? "";
const IACAFE_BASE   = "https://iacafe.com.ng/devapi/v1";
const IACAFE_TOKEN  = Deno.env.get("IACAFE_TOKEN") ?? "";
const GSUBZ_BASE    = "https://gsubz.com/api";
const GSUBZ_KEY     = Deno.env.get("GSUBZ_API_KEY") ?? "";
const AIRTIME_MAP: Record<string,string> = { MTN:"mtn-airtime", AIRTEL:"airtel-airtime", GLO:"glo-airtime", "9MOBILE":"9mobile-airtime" };

// Gsubz success-rate threshold: if fewer than 20% of last 100 Gsubz tx succeed, fallback to IACafe
const GSUBZ_MIN_SUCCESS_RATE = 0.20;
const GSUBZ_SAMPLE_WINDOW    = 100; // transactions to sample
const GSUBZ_HOUR_WINDOW_MS   = 60 * 60 * 1000;

function treasuryKey(type: string, prvCode: string): string {
  if (type==="data" && prvCode==="iacafe")          return "iacafe";
  if (type==="data" && prvCode?.startsWith("bsplug")) return "bsplug";
  if (type==="data" && prvCode==="gsubz")           return "iacafe"; // Gsubz shares IACafe float
  return "aidapay";
}
function genRef(){ return "SP-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).substr(2,5).toUpperCase(); }
function isBundleDown(msg:string){const l=(msg||"").toLowerCase();return l.includes("not available")||l.includes("unavailable")||l.includes("out of stock")||l.includes("package not found")||l.includes("provider down")||l.includes("service down")||l.includes("temporarily")||l.includes("invalid package")||l.includes("invalid bundle");}
async function tg(msg:string){if(!TG_BOT||!TG_CHAT)return;try{await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:TG_CHAT,text:msg,parse_mode:"Markdown"})});}catch{}}

interface PR { success:boolean; ref?:string; msg?:string; meter_token?:string; meter_unit?:string; bundle_down?:boolean; }

async function aidapayBuy(p:Record<string,string>):Promise<PR> {
  try {
    const r=await fetch(`${AIDAPAY_BASE}/buy`,{method:"POST",headers:{Accept:"application/json",Authorization:`Bearer ${AIDAPAY_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify(p),signal:AbortSignal.timeout(30000)});
    const d=await r.json();
    console.log("[aidapay] response:", JSON.stringify(d).slice(0,300));
    if(!d.success){const m=d.message||d.error||"AidaPay failed";return{success:false,msg:m,bundle_down:isBundleDown(m)};}
    const td=d.data?.transaction_data||{};
    return{success:true,ref:td.transaction_hash||"",meter_token:td.meter_token,meter_unit:td.meter_unit};
  }catch(e){return{success:false,msg:`AidaPay unreachable: ${e}`};}
}

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

// Core Gsubz buy with raw parameters — works for data, airtime, electricity, cable
async function gsubzBuyRaw(service: string, planId: string, phone: string, reqId: string): Promise<PR> {
  if (!service || !planId || !GSUBZ_KEY) return { success: false, msg: "Gsubz: missing service/plan_id or no API key" };
  try {
    const r = await fetch(`${GSUBZ_BASE}/pay/`, {
      method: "POST",
      headers: { "api-key": GSUBZ_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ service, plan_id: planId, mobile_number: phone, request_id: reqId }),
      signal: AbortSignal.timeout(30000)
    });
    const d = await r.json();
    console.log("[gsubz] response:", JSON.stringify(d).slice(0, 400));
    if (!r.ok || d?.success === false || d?.status === false) {
      const m = d?.message || d?.error || "Gsubz failed";
      return { success: false, msg: m, bundle_down: isBundleDown(m) };
    }
    return { success: true, ref: String(d?.data?.reference || d?.data?.id || d?.reference || reqId) };
  } catch (e) {
    return { success: false, msg: `Gsubz unreachable: ${e}` };
  }
}

// Gsubz: package_code format = "GSZ-{service}-{planId}"  e.g. "GSZ-mtn_awoof-354"
async function gsubzBuy(pkgCode:string, phone:string, reqId:string): Promise<PR> {
  const parts = pkgCode.replace("GSZ-","").split("-");
  const planId = parts[parts.length - 1];
  const service = parts.slice(0, parts.length - 1).join("-");
  return gsubzBuyRaw(service, planId, phone, reqId);
}

// Check Gsubz success rate in last hour — returns true if Gsubz is healthy
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
    if (!rows || rows.length < 5) return true; // not enough data — assume healthy
    const successes = rows.filter(r => r.status === "success").length;
    const rate = successes / rows.length;
    console.log(`[vtu] Gsubz health: ${successes}/${rows.length} = ${(rate*100).toFixed(1)}%`);
    return rate >= GSUBZ_MIN_SUCCESS_RATE;
  } catch {
    return true; // fail open
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

  try {
    const uc=createClient(SUPA_URL,SUPA_ANON,{global:{headers:{Authorization:auth}}});
    const{data:{user},error:ae}=await uc.auth.getUser();
    if(ae||!user)return json({error:"Unauthorized"},401);

    const body=await req.json();
    const{type,network,phone,amount,package_code,provider_code,pin,bundle,provider,meta={},meter_number,meter_type,packageCode}=body;
    const pkgCode=package_code||bundle||packageCode;
    const prvCode=provider_code||provider;

    // ── Electricity / Cable verify ─────────────────────────────────────────
    if(type==="electricity_verify"||type==="cable_verify"){
      const apCode=prvCode;
      const id=meter_number||phone;
      if(!id)return json({error:"Identifier required"},400);
      try{
        const r=await fetch(`${AIDAPAY_BASE}/validation/${encodeURIComponent(apCode)}/${encodeURIComponent(id)}`,{headers:{Accept:"application/json",Authorization:`Bearer ${AIDAPAY_TOKEN}`}});
        const d=await r.json();
        if(!d.data?.verified)return json({error:d.data?.message||d.message||"Verification failed"},400);
        const msg:string=d.data.message||"";
        const cn=msg.includes(":")?msg.split(":").slice(1).join(":").trim():msg||"Verified";
        return json({success:true,customer_name:cn,verified:true});
      }catch{return json({error:"Could not reach verification service"},503);}
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

    // ── Treasury: Reserve liquidity ───────────────────────────────────────
    const tProv = treasuryKey(type, prvCode||"");
    try {
      const{data:rid,error:re}=await admin.rpc("reserve_provider_liquidity",{
        _provider:tProv, _amount:Number(amount||0), _uid:user.id, _tx_ref:ref
      });
      if(re){
        const m=re.message||"";
        if(m.includes("INSUFFICIENT_LIQUIDITY")||m.includes("paused")){
          await tg(`🚨 *Low Float — ${tProv}*\nInsufficient liquidity for ₦${amount}\nUser: ${user.id}`);
          return json({error:"Service temporarily unavailable. Please try again shortly.",code:"LOW_FLOAT"},503);
        }
        console.warn("reserve_liquidity (non-blocking):", m);
      } else {
        reservationId = rid as string;
        console.log(`[vtu] reservation ${reservationId} created for ₦${amount} on ${tProv}`);
      }
    } catch(e){ console.warn("reserve_liquidity exception:", e); }

    let pr:PR={success:false,msg:"No provider matched"};
    let usedProvider = prvCode || "";

    // ── Provider routing ──────────────────────────────────────────────────
    if(type==="data" && prvCode==="gsubz") {
      // Gsubz with IACafe smart fallback
      const reqId = `GSZ-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`;
      txMeta.gsubz_request_id = reqId;

      const gsubzHealthy = await isGsubzHealthy(admin);
      if (gsubzHealthy) {
        pr = await gsubzBuy(pkgCode||"", phone, reqId);
        if (pr.success) {
          usedProvider = "gsubz";
          txMeta.provider_used = "gsubz";
          txMeta.gsubz_ref = pr.ref;
        } else {
          console.warn(`[vtu] Gsubz failed (${pr.msg}), trying IACafe fallback`);
          await tg(`⚠️ *Gsubz fallback triggered*\nPlan: ${pkgCode}\nReason: ${pr.msg}\nSwitching to IACafe`);
        }
      } else {
        console.warn("[vtu] Gsubz success rate below threshold — skipping to IACafe");
        await tg(`⚠️ *Gsubz low success rate — bypassed for this order*`);
      }

      // Fallback if Gsubz failed or unhealthy — supports iacafe, bsplug-X, and aidapay
      if (!pr.success) {
        // Look up fallback provider+code from packages table
        const { data: pkg } = await admin.from("packages")
          .select("fallback_provider_code, fallback_package_code")
          .eq("package_code", pkgCode||"")
          .maybeSingle();
        const fbPrvCode = (pkg as Record<string,string>|null)?.fallback_provider_code || "iacafe";
        const fbPkgCode = (pkg as Record<string,string>|null)?.fallback_package_code || "";

        if (fbPrvCode === "iacafe" && fbPkgCode) {
          // IACafe fallback
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
          // BSPlug fallback
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
          // AidaPay catch-all fallback (airtel-sme-cg, custom codes, etc.)
          const fbReqId = `AP-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`;
          pr = await aidapayBuy({ recipient: phone, provider_code: fbPrvCode, account_pin: AIDAPAY_PIN, package_code: fbPkgCode, ref: fbReqId });
          if (pr.success) {
            usedProvider = "aidapay-fallback";
            txMeta.provider_used = "aidapay_fallback";
            txMeta.aidapay_ref = fbReqId;
          }
        }
      }

    } else if(type==="data" && prvCode==="iacafe"){
      const planId=parseInt((pkgCode||"").replace("IAC-",""),10);
      if(!planId){
        await releaseReservation("failed");
        return json({error:"Invalid IA Cafe plan"},400);
      }
      const reqId=`IAC-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`;
      txMeta.iacafe_request_id=reqId;
      pr=await iacafeBuy(planId,phone,reqId);

    } else if(type==="data" && prvCode?.startsWith("bsplug")){
      const nId=parseInt(prvCode.split("-")[1]||"1",10);
      const pId=parseInt((pkgCode||"").replace("BSP-",""),10);
      if(!pId||!nId){
        await releaseReservation("failed");
        return json({error:"Invalid BSPlug plan"},400);
      }
      pr=await bsplugBuy(nId,pId,phone);

    } else if (type === "airtime" || type === "electricity" || type === "cable") {
      // ── Try GSubz first for airtime/electricity/cable ────────────────────
      let gsubzService = "";
      let gsubzPlanId = "";
      let gsubzPhone = "";

      if (type === "airtime") {
        gsubzService = AIRTIME_MAP[network?.toUpperCase()] || "mtn-airtime";
        gsubzPlanId = String(amount || 0);
        gsubzPhone = phone || "";
      } else if (type === "electricity") {
        gsubzService = prvCode || "";
        gsubzPlanId = String(amount || 0);
        gsubzPhone = meter_number || phone || "";
      } else { // cable
        gsubzService = prvCode || "";
        gsubzPlanId = pkgCode || "";
        gsubzPhone = phone || "";
      }

      const gsubzReqId = `GSZ-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      txMeta.gsubz_request_id = gsubzReqId;

      if (gsubzService && gsubzPlanId && GSUBZ_KEY) {
        pr = await gsubzBuyRaw(gsubzService, gsubzPlanId, gsubzPhone, gsubzReqId);
        if (pr.success) {
          usedProvider = "gsubz";
          txMeta.provider_used = "gsubz";
          txMeta.gsubz_ref = pr.ref;
        } else {
          console.warn(`[vtu] Gsubz ${type} failed (${pr.msg}), falling back to AidaPay`);
          await tg(`⚠️ *Gsubz ${type} fallback*\nService: ${gsubzService}\nReason: ${pr.msg}\nFalling back to AidaPay`);
        }
      }

      // ── Fallback to AidaPay ────────────────────────────────────────────
      if (!pr.success) {
        let apCode: string;
        if (type === "airtime") apCode = AIRTIME_MAP[network?.toUpperCase()] || "mtn-airtime";
        else if (type === "electricity") apCode = prvCode;
        else apCode = prvCode;

        const recipient = type === "electricity" ? (meter_number || phone || "") : (phone || "");
        const ap: Record<string, string> = { recipient, provider_code: apCode, account_pin: AIDAPAY_PIN, ref };
        if (amount) ap.amount = String(amount);
        if (pkgCode) ap.package_code = pkgCode;
        txMeta.aidapay_ref = ref;
        txMeta.aidapay_code = apCode;
        if (type === "electricity") { txMeta.meter_type = meter_type; txMeta.meter_number = recipient; }
        pr = await aidapayBuy(ap);
        if (pr.meter_token) txMeta.meter_token = pr.meter_token;
        if (pr.meter_unit) txMeta.meter_unit = pr.meter_unit;
      }

    } else {
      let apCode:string;
      if(type==="airtime")apCode=AIRTIME_MAP[network?.toUpperCase()]||"mtn-airtime";
      else if(type==="electricity")apCode=prvCode;
      else apCode=prvCode;
      const recipient=type==="electricity"?(meter_number||phone||""):(phone||"");
      const ap:Record<string,string>={recipient,provider_code:apCode,account_pin:AIDAPAY_PIN,ref};
      if(amount)ap.amount=String(amount); if(pkgCode)ap.package_code=pkgCode;
      txMeta.aidapay_ref=ref; txMeta.aidapay_code=apCode;
      if(type==="electricity"){txMeta.meter_type=meter_type;txMeta.meter_number=recipient;}
      pr=await aidapayBuy(ap);
      if(pr.meter_token)txMeta.meter_token=pr.meter_token;
      if(pr.meter_unit)txMeta.meter_unit=pr.meter_unit;
    }

    await releaseReservation(pr.success ? "used" : "failed");

    if(!pr.success){
      const errMsg=pr.msg||"Purchase failed";
      console.error(`[vtu] purchase failed: ${errMsg}`);
      if(pkgCode&&pr.bundle_down){
        admin.rpc("mark_bundle_unavailable",{_package_code:pkgCode,_provider_code:prvCode||"aidapay",_network:network,_error:errMsg}).catch(()=>{});
      }
      return json({error:pr.bundle_down?"This data plan is temporarily unavailable.":errMsg,code:pr.bundle_down?"BUNDLE_UNAVAILABLE":"PURCHASE_FAILED",balance_credited:false},400);
    }

    txMeta.provider_reference=pr.ref||ref;
    const{data:pkgRow}=await admin.from("packages").select("bp_value").eq("package_code",pkgCode||"").maybeSingle();
    const{data:tx,error:te}=await admin.rpc("create_vtu_transaction",{
      _user_id:user.id,
      _type:type,
      _network:network||prvCode||"",
      _phone:type==="electricity"?(meter_number||phone||""):(phone||""),
      _amount:Number(amount||0),
      _aidapay_hash:pr.ref||null,
      _meta:txMeta,
      _bp:pkgRow?.bp_value??null
    });
    if(te){
      console.error("create_vtu_transaction error:", te.message);
      await tg(`⚠️ *CHARGE FAILURE after delivery*\nUser: ${user.id}\n₦${amount} ${type}/${network||prvCode}\nError: ${te.message}`);
    } else {
      console.log(`[vtu] tx created: ${(tx as Record<string,unknown>)?.reference}`);
    }

    if(tx&&(tx as Record<string,unknown>).id){
      await admin.from("transactions").update({
        idempotency_key:`${user.id}-${type}-${pkgCode||""}-${phone||""}-${ref}`,
        provider_reference:pr.ref||ref,
        status:"success"
      }).eq("id",(tx as Record<string,unknown>).id);
    }

    if(pkgCode){
      admin.rpc("mark_bundle_available",{_package_code:pkgCode,_provider_code:usedProvider||prvCode||"aidapay",_network:network}).catch(()=>{});
    }

    const resp:Record<string,unknown>={success:true,reference:(tx as Record<string,unknown>)?.reference||ref,status:"success"};
    if(pr.meter_token)resp.meter_token=pr.meter_token;
    console.log(`[vtu] ✅ purchase complete: ${resp.reference} via ${usedProvider}`);
    return json(resp);

  }catch(e){
    console.error("vtu-purchase unhandled error:",e);
    await releaseReservation("failed");
    return json({error:e instanceof Error?e.message:"Unknown"},500);
  }
});
