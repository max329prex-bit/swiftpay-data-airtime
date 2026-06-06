import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPA_URL=Deno.env.get("SUPABASE_URL")!,SUPA_SVC=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AIDAPAY_BASE="https://www.aidapay.ng/api/v1",AIDAPAY_TOKEN=Deno.env.get("AIDAPAY_TOKEN")!;
const KORAPAY_SECRET=Deno.env.get("KORAPAY_SECRET_KEY")??Deno.env.get("KORAPAY_SECRET")??"";
const TG_BOT=Deno.env.get("TELEGRAM_BOT_TOKEN")??"",TG_CHAT=Deno.env.get("TELEGRAM_ADMIN_CHAT_ID")??"";
const CRON_SECRET=Deno.env.get("CRON_SECRET")??"";
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

async function checkKorapay(reference:string):Promise<"success"|"failed"|"pending"|"unknown">{
  if(!KORAPAY_SECRET){console.error("KORAPAY_SECRET_KEY not set");return"unknown";}
  try{
    const r=await fetch(`https://api.korapay.com/merchant/api/v1/charges/${reference}`,{
      headers:{Authorization:`Bearer ${KORAPAY_SECRET}`,Accept:"application/json"},
      signal:AbortSignal.timeout(10000)
    });
    if(!r.ok){console.log(`Korapay check ${reference}: HTTP ${r.status}`);return"unknown";}
    const d=await r.json();
    const s=(d?.data?.status||"").toLowerCase();
    console.log(`Korapay check ${reference}: status=${s}`);
    if(["success","successful","completed"].includes(s))return"success";
    if(["failed","error","cancelled","declined"].includes(s))return"failed";
    return"pending";
  }catch(e){console.error("checkKorapay error:",e);return"unknown";}
}

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});

  const incoming=req.headers.get("x-cron-secret")??"";
  if(!CRON_SECRET||incoming!==CRON_SECRET){
    console.warn("transaction-recovery: unauthorized call rejected");
    return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
  }

  const sb=createClient(SUPA_URL,SUPA_SVC);
  try{
    const cutoff=new Date(Date.now()-2*60*1000).toISOString();

    // Fetch stuck service txs AND stuck Korapay deposits (pending wallet_fund)
    const[{data:stuck,error:qe},{data:stuckDeposits,error:de}]=await Promise.all([
      sb.from("transactions").select("*").in("status",["processing","verifying"]).lt("created_at",cutoff).lt("retry_count",MAX_RETRIES).order("created_at",{ascending:true}).limit(20),
      sb.from("transactions").select("*").eq("status","pending").eq("type","wallet_fund").lt("created_at",cutoff).order("created_at",{ascending:true}).limit(20)
    ]);
    if(qe)throw qe;

    // Merge by id (no duplicates)
    const allTxMap=new Map<string,Record<string,unknown>>();
    for(const tx of (stuck||[]))allTxMap.set(tx.id,{...tx,_isKorapayDeposit:false});
    for(const tx of (stuckDeposits||[]))if(!allTxMap.has(tx.id))allTxMap.set(tx.id,{...tx,_isKorapayDeposit:true});
    const allTx=[...allTxMap.values()];

    if(allTx.length===0)return new Response(JSON.stringify({checked:0,resolved:0}),{headers:{...cors,"Content-Type":"application/json"}});
    console.log(`Recovery: checking ${allTx.length} txs (${(stuckDeposits||[]).length} Korapay deposits)`);
    let resolved=0;const now=new Date().toISOString();

    for(const tx of allTx){
      try{
        const meta=(tx.meta as Record<string,unknown>)||{};
        const prvCode=(meta.provider_code as string)||"";
        const newRetry=(tx.retry_count as number||0)+1;
        const isKorapayDeposit=tx._isKorapayDeposit as boolean;
        let status:"success"|"failed"|"pending"|"unknown"="unknown";

        if(isKorapayDeposit){
          // Korapay deposit — verify via Korapay API
          const ref=(meta.korapay_reference as string)||tx.provider_reference as string||tx.reference as string;
          if(ref)status=await checkKorapay(ref);
        }else if(!prvCode.startsWith("bsplug")&&!prvCode.startsWith("iacafe")){
          const hash=(meta.aidapay_ref as string)||tx.provider_reference as string||tx.aidapay_hash as string;
          if(hash)status=await checkAidapay(hash);
        }

        if(status==="success"){
          if(isKorapayDeposit){
            // Use the dedicated RPC — handles wallet credit + tx status atomically + duplicate protection
            const ref=(meta.korapay_reference as string)||tx.provider_reference as string||tx.reference as string;
            const{error:rpcErr}=await sb.rpc("credit_wallet_from_korapay",{
              _user_id:tx.user_id,
              _amount:tx.amount,
              _korapay_ref:ref
            });
            if(rpcErr){
              // DUPLICATE means already credited — still mark success
              if((rpcErr.message||"").includes("DUPLICATE")){
                console.log(`Recovery: ${tx.reference} already credited, skipping`);
              }else{
                console.error(`Recovery: credit_wallet_from_korapay failed:`,rpcErr.message);
                continue;
              }
            }
            resolved++;
            console.log(`Recovery: Korapay deposit ${tx.reference} -> CREDITED NGN${tx.amount}`);
            await tg(`✅ Deposit recovered: NGN${tx.amount} credited. Ref: ${tx.reference}`);
          }else{
            await sb.from("transactions").update({status:"success",last_verification_at:now,failure_reason:null}).eq("id",tx.id);
            resolved++;console.log(`Recovery: ${tx.reference} -> SUCCESS`);
          }
        }else if(status==="failed"){
          await sb.from("transactions").update({status:"failed",failure_reason:"Provider confirmed failed (recovery)",last_verification_at:now}).eq("id",tx.id);
          if(!isKorapayDeposit){
            await sb.rpc("refund_wallet",{_user_id:tx.user_id,_amount:tx.amount,_ref:tx.reference});
          }
          resolved++;console.log(`Recovery: ${tx.reference} -> FAILED`);
        }else if(!isKorapayDeposit&&newRetry>=MAX_RETRIES){
          await sb.from("transactions").update({status:"failed",retry_count:newRetry,last_verification_at:now,failure_reason:`Max ${MAX_RETRIES} retries. Provider status: ${status}`}).eq("id",tx.id);
          await sb.rpc("refund_wallet",{_user_id:tx.user_id,_amount:tx.amount,_ref:tx.reference});
          await tg(`[REVIEW] BlitzPay Manual Review needed. Ref: ${tx.reference}. Amount: NGN${tx.amount}. Type: ${tx.type}/${tx.network}. Refunded.`);
        }else{
          await sb.from("transactions").update({retry_count:newRetry,last_verification_at:now,failure_reason:`Attempt ${newRetry}: provider=${status}`}).eq("id",tx.id);
        }
      }catch(e){console.error(`Recovery tx ${tx.id}:`,e);}
    }
    return new Response(JSON.stringify({checked:allTx.length,resolved,at:now}),{headers:{...cors,"Content-Type":"application/json"}});
  }catch(e){
    return new Response(JSON.stringify({error:e instanceof Error?e.message:"Unknown"}),{status:500,headers:{...cors,"Content-Type":"application/json"}});
  }
});
