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
  if(!KORAPAY_SECRET)return"unknown";
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
    if(["failed","failed","error","cancelled","declined"].includes(s))return"failed";
    if(["pending","processing","initiated"].includes(s))return"pending";
    return"unknown";
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

    // Fetch stuck service transactions (processing/verifying) AND stuck Korapay deposits (pending wallet_fund)
    const[{data:stuck,error:qe},{data:stuckDeposits,error:de}]=await Promise.all([
      sb.from("transactions").select("*").in("status",["processing","verifying"]).lt("created_at",cutoff).lt("retry_count",MAX_RETRIES).order("created_at",{ascending:true}).limit(20),
      sb.from("transactions").select("*").eq("status","pending").eq("type","wallet_fund").lt("created_at",cutoff).order("created_at",{ascending:true}).limit(20)
    ]);
    if(qe)throw qe;

    // Merge and deduplicate by id
    const allTxMap=new Map<string,Record<string,unknown>>();
    for(const tx of (stuck||[]))allTxMap.set(tx.id,tx);
    for(const tx of (stuckDeposits||[]))allTxMap.set(tx.id,{...tx,_korapay:true});
    const allTx=[...allTxMap.values()];

    if(allTx.length===0)return new Response(JSON.stringify({checked:0,resolved:0}),{headers:{...cors,"Content-Type":"application/json"}});
    console.log(`Recovery: checking ${allTx.length} stuck txs (${(stuckDeposits||[]).length} Korapay deposits)`);
    let resolved=0;const now=new Date().toISOString();

    for(const tx of allTx){
      try{
        const meta=tx.meta||{};const prvCode=(meta.provider_code as string)||"";
        const newRetry=(tx.retry_count||0)+1;
        let status:"success"|"failed"|"pending"|"unknown"="unknown";
        const isKorapayDeposit=tx.type==="wallet_fund"||(tx._korapay as boolean);

        if(isKorapayDeposit){
          // Use Korapay API to verify deposit
          const ref=(meta.korapay_reference as string)||tx.provider_reference||tx.reference;
          if(ref)status=await checkKorapay(ref);
        }else if(!prvCode.startsWith("bsplug")&&!prvCode.startsWith("iacafe")){
          const hash=(meta.aidapay_ref as string)||tx.provider_reference||tx.aidapay_hash;
          if(hash)status=await checkAidapay(hash);
        }

        if(status==="success"){
          if(isKorapayDeposit){
            // Credit wallet for confirmed Korapay deposit
            const{error:we}=await sb.rpc("credit_wallet",{_user_id:tx.user_id,_amount:tx.amount,_ref:tx.reference}).single().catch(()=>({error:"rpc_missing"}));
            if(we&&typeof we==="string"&&we==="rpc_missing"){
              // Fallback: direct wallet update
              await sb.from("wallets").update({balance:sb.rpc("coalesce",[]) as unknown as number}).eq("user_id",tx.user_id);
              // Safe fallback: increment balance directly
              await sb.rpc("increment_wallet",{_user_id:tx.user_id,_amount:tx.amount}).catch(async()=>{
                await sb.from("wallets").select("balance").eq("user_id",tx.user_id).single().then(async({data:w})=>{
                  if(w)await sb.from("wallets").update({balance:(w.balance||0)+tx.amount,updated_at:now}).eq("user_id",tx.user_id);
                });
              });
            }
            await sb.from("transactions").update({status:"success",last_verification_at:now,failure_reason:null}).eq("id",tx.id);
            resolved++;
            console.log(`Recovery: Korapay deposit ${tx.reference} -> CREDITED NGN${tx.amount}`);
            await tg(`✅ Deposit recovered: NGN${tx.amount} credited to user ${tx.user_id}. Ref: ${tx.reference}`);
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
          await tg(`[REVIEW] BlitzPay Manual Review needed. Ref: ${tx.reference}. Amount: NGN${tx.amount}. Type: ${tx.type}/${tx.network}. Provider: ${prvCode||"aidapay"}. Refunded to wallet.`);
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
