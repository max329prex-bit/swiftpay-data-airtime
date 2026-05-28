import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPA_URL=Deno.env.get("SUPABASE_URL")!,SUPA_SVC=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AIDAPAY_BASE="https://www.aidapay.ng/api/v1",AIDAPAY_TOKEN=Deno.env.get("AIDAPAY_TOKEN")!;
const TG_BOT=Deno.env.get("TELEGRAM_BOT_TOKEN")??"",TG_CHAT=Deno.env.get("TELEGRAM_ADMIN_CHAT_ID")??"";
const MAX_RETRIES=5;
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};

async function tg(msg:string){if(!TG_BOT||!TG_CHAT)return;try{await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:TG_CHAT,text:msg,parse_mode:"Markdown"})});}catch{}}

async function checkAidapay(hash:string):Promise<"success"|"failed"|"pending"|"unknown">{
  try{
    const r=await fetch(`${AIDAPAY_BASE}/transaction/${hash}`,{headers:{Authorization:`Bearer ${AIDAPAY_TOKEN}`,Accept:"application/json"},signal:AbortSignal.timeout(10000)});
    if(!r.ok)return"unknown";const d=await r.json();const s=(d?.data?.status||d?.status||"").toLowerCase();
    if(["successful","success","completed"].includes(s))return"success";
    if(["failed","error","cancelled"].includes(s))return"failed";
    if(["pending","processing"].includes(s))return"pending";
    return"unknown";
  }catch{return"unknown";}
}

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  const sb=createClient(SUPA_URL,SUPA_SVC);
  try{
    const cutoff=new Date(Date.now()-2*60*1000).toISOString();
    const{data:stuck,error:qe}=await sb.from("transactions").select("*").in("status",["processing","verifying"]).lt("created_at",cutoff).lt("retry_count",MAX_RETRIES).order("created_at",{ascending:true}).limit(20);
    if(qe)throw qe;
    if(!stuck||stuck.length===0)return new Response(JSON.stringify({checked:0,resolved:0}),{headers:{...cors,"Content-Type":"application/json"}});
    console.log(`Recovery: checking ${stuck.length} stuck txs`);
    let resolved=0;const now=new Date().toISOString();

    for(const tx of stuck){
      try{
        const meta=tx.meta||{};const prvCode=(meta.provider_code as string)||"";
        const newRetry=(tx.retry_count||0)+1;
        let status:"success"|"failed"|"pending"|"unknown"="unknown";

        if(!prvCode.startsWith("bsplug")&&!prvCode.startsWith("iacafe")){
          const hash=(meta.aidapay_ref as string)||tx.provider_reference||tx.aidapay_hash;
          if(hash)status=await checkAidapay(hash);
        }

        if(status==="success"){
          await sb.from("transactions").update({status:"success",last_verification_at:now,failure_reason:null}).eq("id",tx.id);
          resolved++;console.log(`Recovery: ${tx.reference} -> SUCCESS`);
        }else if(status==="failed"){
          await sb.from("transactions").update({status:"failed",failure_reason:"Provider confirmed failed (recovery)",last_verification_at:now}).eq("id",tx.id);
          // Refund via refund_wallet (Korapay-only — no Monnify)
          await sb.rpc("refund_wallet",{_user_id:tx.user_id,_amount:tx.amount,_ref:tx.reference});
          resolved++;console.log(`Recovery: ${tx.reference} -> FAILED + refunded`);
        }else if(newRetry>=MAX_RETRIES){
          await sb.from("transactions").update({status:"failed",retry_count:newRetry,last_verification_at:now,failure_reason:`Max ${MAX_RETRIES} retries. Provider status: ${status}`}).eq("id",tx.id);
          await sb.rpc("refund_wallet",{_user_id:tx.user_id,_amount:tx.amount,_ref:tx.reference});
          await tg(`🚨 *BlitzPay Manual Review*\nRef: \`${tx.reference}\`\nAmount: NGN${tx.amount}\nType: ${tx.type}/${tx.network}\nProvider: ${prvCode||"aidapay"}\nRefunded to wallet.`);
        }else{
          await sb.from("transactions").update({retry_count:newRetry,last_verification_at:now,failure_reason:`Attempt ${newRetry}: provider=${status}`}).eq("id",tx.id);
        }
      }catch(e){console.error(`Recovery tx ${tx.id}:`,e);}
    }
    return new Response(JSON.stringify({checked:stuck.length,resolved,at:now}),{headers:{...cors,"Content-Type":"application/json"}});
  }catch(e){
    return new Response(JSON.stringify({error:e instanceof Error?e.message:"Unknown"}),{status:500,headers:{...cors,"Content-Type":"application/json"}});
  }
});
