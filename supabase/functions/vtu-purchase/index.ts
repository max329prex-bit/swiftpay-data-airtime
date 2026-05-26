import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret" };
const SUPA_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPA_ANON   = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPA_SVC    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SYNC_SECRET = Deno.env.get("SYNC_ADMIN_SECRET") ?? "";
const TG_BOT      = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT     = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") ?? "";
const AIDAPAY_BASE  = "https://www.aidapay.ng/api/v1";
const AIDAPAY_TOKEN = Deno.env.get("AIDAPAY_TOKEN")!;
const AIDAPAY_PIN   = Deno.env.get("AIDAPAY_ACCOUNT_PIN")!;
const BSPLUG_BASE   = "https://bsplug.net/api";
const BSPLUG_TOKEN  = Deno.env.get("BSPLUG_TOKEN") ?? "";
const IACAFE_BASE   = "https://iacafe.com.ng/devapi/v1";
const IACAFE_TOKEN  = Deno.env.get("IACAFE_TOKEN") ?? "";
const AIRTIME_MAP: Record<string,string> = { MTN:"mtn-airtime", AIRTEL:"airtel-airtime", GLO:"glo-airtime", "9MOBILE":"9mobile-airtime" };
const SYNC_PROVIDERS = [
  { network:"MTN",code:"mtn-sme" },{ network:"MTN",code:"mtn-awuf-data" },
  { network:"AIRTEL",code:"airtel-sme-cg" },{ network:"AIRTEL",code:"airtel-awuf-data" },
  { network:"GLO",code:"glo-gifting" },{ network:"GLO",code:"gloawufdata" },
  { network:"9MOBILE",code:"9mobile-sme" },{ network:"9MOBILE",code:"9mobile-awuf-data" },
];

function genRef() { return "SP-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).substr(2,5).toUpperCase(); }
function parseSize(n:string){const m=n.match(/(\d+\.?\d*\s*(?:GB|MB|TB))/i);return m?m[1].replace(/\s+/g,""):n.split("-")[0].trim();}
function parseValidity(n:string){const m=n.match(/(\d+\s*(?:Day|Days|Month|Months|Week|Weeks|Hour|Hours))/i);return m?m[1]:"30 Days";}
function isBundleDown(msg:string){const l=(msg||"").toLowerCase();return l.includes("not available")||l.includes("unavailable")||l.includes("out of stock")||l.includes("package not found")||l.includes("provider down")||l.includes("service down")||l.includes("temporarily")||l.includes("invalid package")||l.includes("invalid bundle");}
async function tg(msg:string){if(!TG_BOT||!TG_CHAT)return;try{await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:TG_CHAT,text:msg,parse_mode:"Markdown"})});}catch{}}

// ── Provider abstraction layer ───────────────────────────────────────────────
interface PR { success:boolean; ref?:string; msg?:string; meter_token?:string; meter_unit?:string; bundle_down?:boolean; }

async function aidapayBuy(payload:Record<string,string>):Promise<PR> {
  try {
    const r=await fetch(`${AIDAPAY_BASE}/buy`,{method:"POST",headers:{Accept:"application/json",Authorization:`Bearer ${AIDAPAY_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
    const d=await r.json();
    if(!d.success){const m=d.message||d.error||"AidaPay failed";return{success:false,msg:m,bundle_down:isBundleDown(m)};}
    const td=d.data?.transaction_data||{};
    return{success:true,ref:td.transaction_hash||"",meter_token:td.meter_token,meter_unit:td.meter_unit};
  } catch(e){return{success:false,msg:`AidaPay unreachable: ${e}`};}
}

async function bsplugBuy(netId:number,planId:number,phone:string):Promise<PR> {
  try {
    const r=await fetch(`${BSPLUG_BASE}/data/`,{method:"POST",headers:{Accept:"application/json",Authorization:`Token ${BSPLUG_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({mobile_number:phone,Ported_number:false,plan:planId,network:netId}),signal:AbortSignal.timeout(30000)});
    const d=await r.json();
    const errs:string[]=Array.isArray(d?.error)?d.error:d?.error?[String(d.error)]:[];
    if(!r.ok||errs.length)return{success:false,msg:errs.join("; ")||d?.message||"BSPlug failed"};
    return{success:true,ref:String(d?.id||"")};
  } catch(e){return{success:false,msg:`BSPlug unreachable: ${e}`};}
}

async function iacafeBuy(planId:number,phone:string,reqId:string):Promise<PR> {
  try {
    const r=await fetch(`${IACAFE_BASE}/budget-data`,{method:"POST",headers:{Accept:"application/json",Authorization:`Bearer ${IACAFE_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({request_id:reqId,phone,data_plan:planId}),signal:AbortSignal.timeout(30000)});
    const d=await r.json();
    if(!r.ok||d?.code==="error"||d?.success===false)return{success:false,msg:d?.error?.message||d?.message||"IA Cafe failed"};
    return{success:true,ref:String(d?.data?.order_id||reqId)};
  } catch(e){return{success:false,msg:`IA Cafe unreachable: ${e}`};}
}

// ── Fraud velocity check ─────────────────────────────────────────────────────
async function fraudCheck(sb:ReturnType<typeof createClient>,uid:string):Promise<boolean> {
  const win=new Date(Date.now()-2*60*1000).toISOString();
  const{count}=await sb.from("transactions").select("id",{count:"exact",head:true}).eq("user_id",uid).eq("status","failed").gte("created_at",win);
  return (count||0)>=5;
}

serve(async (req) => {
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});

  // Admin sync
  const adminSec=req.headers.get("x-admin-secret");
  if(adminSec&&SYNC_SECRET&&adminSec===SYNC_SECRET){
    const body=await req.json().catch(()=>({}));
    if((body as Record<string,unknown>).type==="sync_packages"){
      const db=createClient(SUPA_URL,SUPA_SVC);const results:Record<string,number>={};const seen=new Set<string>();const seenPer:Record<string,string[]>={};
      for(const{network,code}of SYNC_PROVIDERS){
        try{
          const r=await fetch(`${AIDAPAY_BASE}/packages/${code}`,{headers:{Accept:"application/json",Authorization:`Bearer ${AIDAPAY_TOKEN}`}});
          const res=await r.json();const pkgs:Record<string,unknown>[]=Array.isArray(res?.data)?res.data:[];
          if(!seenPer[code])seenPer[code]=[];
          for(const pkg of pkgs){const pc=pkg.package_api_code as string;if(!pc||seen.has(pc))continue;seen.add(pc);seenPer[code].push(pc);const name=(pkg.package_name as string)||pc;const price=Number(pkg.package_amount||0);await db.from("packages").upsert({network,name,size:parseSize(name),validity:parseValidity(name),price,provider_code:code,package_code:pc,sort_order:price,is_active:true,coming_soon:false},{onConflict:"package_code"});results[`${network}/${code}`]=(results[`${network}/${code}`]||0)+1;}
          if(seenPer[code].length>0){const cl=seenPer[code].map(c=>`"${c}"`).join(",");await db.from("packages").update({is_active:false}).eq("provider_code",code).eq("is_active",true).not("package_code","in",`(${cl})`);}
        }catch(e){console.error(`Sync ${code}:`,e);}
      }
      return json({success:true,synced:results,at:new Date().toISOString()});
    }
  }

  // Normal purchase flow
  const auth=req.headers.get("Authorization");
  if(!auth)return json({error:"Unauthorized"},401);

  try {
    const uc=createClient(SUPA_URL,SUPA_ANON,{global:{headers:{Authorization:auth}}});
    const{data:{user},error:ae}=await uc.auth.getUser();
    if(ae||!user)return json({error:"Unauthorized"},401);

    const body=await req.json();
    const{type,network,phone,amount,package_code,provider_code,pin,bundle,provider,meta={},meter_number,meter_type,packageCode}=body;
    const pkgCode=package_code||bundle||packageCode;
    const prvCode=provider_code||provider;
    const admin=createClient(SUPA_URL,SUPA_SVC);

    // Verify/cable (no PIN)
    if(type==="electricity_verify"||type==="cable_verify"){
      const apCode=type==="electricity_verify"?`${prvCode}-${meter_type||"prepaid"}`:prvCode;
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

    // PIN
    const{data:pv,error:pe}=await uc.rpc("verify_transaction_pin",{_pin:pin});
    if(pe||!pv)return json({error:"Incorrect PIN"},403);

    // Fraud check
    if(await fraudCheck(admin,user.id)){await tg(`⚠️ *BlitzPay Fraud Alert*
User ${user.id} — 5+ failures in 2min`);return json({error:"Too many failed attempts. Wait a few minutes."},429);}

    // Idempotency key
    const ref=genRef();
    const txMeta:Record<string,unknown>={...meta,provider_code:prvCode||"",package_code:pkgCode||""};
    let pr:PR={success:false,msg:"No provider matched"};

    if(type==="data"&&prvCode==="iacafe"){
      const planId=parseInt((pkgCode||"").replace("IAC-",""),10);
      if(!planId)return json({error:"Invalid IA Cafe plan"},400);
      const reqId=`IAC-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`;
      txMeta.iacafe_request_id=reqId;pr=await iacafeBuy(planId,phone,reqId);
    } else if(type==="data"&&prvCode?.startsWith("bsplug")){
      const nId=parseInt(prvCode.split("-")[1]||"1",10);
      const pId=parseInt((pkgCode||"").replace("BSP-",""),10);
      if(!pId||!nId)return json({error:"Invalid BSPlug plan"},400);
      pr=await bsplugBuy(nId,pId,phone);
    } else {
      let apCode:string;
      if(type==="airtime")apCode=AIRTIME_MAP[network?.toUpperCase()]||"mtn-airtime";
      else if(type==="electricity")apCode=`${prvCode}-${meter_type||"prepaid"}`;
      else apCode=prvCode;
      const recipient=type==="electricity"?(meter_number||phone||""):(phone||"");
      const ap:Record<string,string>={recipient,provider_code:apCode,account_pin:AIDAPAY_PIN,ref};
      if(amount)ap.amount=String(amount);if(pkgCode)ap.package_code=pkgCode;
      txMeta.aidapay_ref=ref;txMeta.aidapay_code=apCode;
      if(type==="electricity"){txMeta.meter_type=meter_type;txMeta.meter_number=recipient;}
      pr=await aidapayBuy(ap);
      if(pr.meter_token)txMeta.meter_token=pr.meter_token;
      if(pr.meter_unit)txMeta.meter_unit=pr.meter_unit;
    }

    if(!pr.success){
      const errMsg=pr.msg||"Purchase failed";
      if(pkgCode&&pr.bundle_down){admin.rpc("mark_bundle_unavailable",{_package_code:pkgCode,_provider_code:prvCode||"aidapay",_network:network,_error:errMsg}).catch(console.error);}
      return json({error:pr.bundle_down?"This data plan is temporarily unavailable.":errMsg,code:pr.bundle_down?"BUNDLE_UNAVAILABLE":"PURCHASE_FAILED",balance_credited:false},400);
    }

    txMeta.provider_reference=pr.ref||ref;
    const{data:pkgRow}=await admin.from("packages").select("bp_value").eq("package_code",pkgCode||"").maybeSingle();
    const{data:tx,error:te}=await admin.rpc("create_vtu_transaction",{_user_id:user.id,_type:type,_network:network||prvCode||"",_phone:type==="electricity"?(meter_number||phone||""):(phone||""),_amount:Number(amount||0),_aidapay_hash:pr.ref||null,_meta:txMeta,_bp:pkgRow?.bp_value??null});
    if(te)console.error("create_vtu_transaction error:",te.message);

    // Update with idempotency + provider ref
    if(tx&&(tx as Record<string,unknown>).id){
      await admin.from("transactions").update({idempotency_key:`${user.id}-${type}-${pkgCode||""}-${phone||""}-${ref}`,provider_reference:pr.ref||ref,status:"success"}).eq("id",(tx as Record<string,unknown>).id);
    }
    if(pkgCode){admin.rpc("mark_bundle_available",{_package_code:pkgCode,_provider_code:prvCode||"aidapay",_network:network}).catch(console.error);}

    const resp:Record<string,unknown>={success:true,reference:(tx as Record<string,unknown>)?.reference||ref,status:"success"};
    if(pr.meter_token)resp.meter_token=pr.meter_token;
    return json(resp);
  } catch(e){
    console.error("vtu-purchase error:",e);
    return json({error:e instanceof Error?e.message:"Unknown"},500);
  }
});
