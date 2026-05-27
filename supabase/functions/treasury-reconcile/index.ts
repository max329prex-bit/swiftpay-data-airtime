import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPA_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_BOT    = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT   = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") ?? "";
const AIDAPAY_TOK = Deno.env.get("AIDAPAY_TOKEN") ?? "";
const BSPLUG_TOK  = Deno.env.get("BSPLUG_TOKEN") ?? "";
const IACAFE_TOK  = Deno.env.get("IACAFE_TOKEN") ?? "";
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type" };

async function tg(msg:string){if(!TG_BOT||!TG_CHAT)return;try{await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:TG_CHAT,text:msg,parse_mode:"Markdown"})});}catch{}}

async function fetchBalance(code:string):Promise<number|null>{
  try{
    if(code==="aidapay"){const r=await fetch("https://www.aidapay.ng/api/v1/balance",{headers:{Authorization:`Bearer ${AIDAPAY_TOK}`,Accept:"application/json"},signal:AbortSignal.timeout(10000)});const d=await r.json();return Number(d?.data?.balance??d?.balance??null);}
    if(code==="bsplug"){const r=await fetch("https://bsplug.net/api/balance/",{headers:{Authorization:`Token ${BSPLUG_TOK}`,Accept:"application/json"},signal:AbortSignal.timeout(10000)});const d=await r.json();return Number(d?.wallet?.balance??d?.balance??null);}
    if(code==="iacafe"){const r=await fetch("https://iacafe.com.ng/devapi/v1/balance",{headers:{Authorization:`Bearer ${IACAFE_TOK}`,Accept:"application/json"},signal:AbortSignal.timeout(10000)});const d=await r.json();return Number(d?.data?.wallet_balance??d?.balance??null);}
  }catch(e){console.warn(`Balance fetch failed ${code}:`,e);}
  return null;
}

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  const sb=createClient(SUPA_URL,SUPA_SVC);
  const now=new Date();
  try{
    const report:Record<string,unknown>={};

    // Release stale reservations
    const{count:stale}=await sb.from("liquidity_reservations").update({status:"expired"}).eq("status","pending").lt("expires_at",now.toISOString()).select("id",{count:"exact",head:true});
    report.stale_released=stale??0;

    // Check pending transfers
    const{data:pending}=await sb.from("treasury_transfers").select("*").in("status",["pending","verifying"]).order("initiated_at",{ascending:true});
    let confirmed=0,degraded=0;
    for(const t of pending??[]){
      const ageMin=(now.getTime()-new Date(t.initiated_at).getTime())/60000;
      const liveBalance=await fetchBalance(t.provider_code);
      if(liveBalance!==null&&liveBalance>=(t.balance_before??0)+t.amount*0.90){
        await sb.rpc("confirm_treasury_transfer",{_transfer_id:t.id,_new_balance:liveBalance});
        confirmed++;continue;
      }
      if(ageMin>15){
        await sb.from("treasury_transfers").update({status:"verifying",last_checked_at:now.toISOString(),retries:(t.retries??0)+1}).eq("id",t.id);
        await sb.from("provider_treasury").update({transfer_health:"degraded"}).eq("provider_code",t.provider_code);
        degraded++;
        await tg(`⚠️ *${t.provider_code.toUpperCase()} transfer unconfirmed*\n${ageMin.toFixed(0)}min old\nAmount: ₦${t.amount}\nRef: \`${t.korapay_reference}\``);
      }else{
        await sb.from("treasury_transfers").update({last_checked_at:now.toISOString(),status:"verifying"}).eq("id",t.id);
      }
    }
    report.confirmed=confirmed;report.degraded=degraded;

    // Balance reconciliation
    const{data:providers}=await sb.from("provider_treasury").select("*");
    const mismatches:string[]=[];
    for(const prov of providers??[]){
      const live=await fetchBalance(prov.provider_code);
      if(live===null)continue;
      const drift=Math.abs(live-prov.actual_balance);
      const driftPct=prov.actual_balance>0?(drift/prov.actual_balance)*100:0;
      await sb.from("provider_treasury").update({actual_balance:live,last_synced_at:now.toISOString()}).eq("provider_code",prov.provider_code);
      if(driftPct>10&&drift>500)mismatches.push(`${prov.provider_code}: DB=₦${prov.actual_balance} Live=₦${live}`);
      if(live>prov.refill_threshold&&prov.transfer_health==="degraded"){
        const{count:pc}=await sb.from("treasury_transfers").select("id",{count:"exact",head:true}).eq("provider_code",prov.provider_code).in("status",["pending","verifying"]);
        if((pc??0)===0){await sb.from("provider_treasury").update({transfer_health:"healthy"}).eq("provider_code",prov.provider_code);}
      }
    }
    if(mismatches.length>0)await tg(`🔍 *Balance drift*\n${mismatches.join("\n")}`);
    report.mismatches=mismatches;
    return new Response(JSON.stringify({status:"ok",...report}),{headers:{...cors,"Content-Type":"application/json"}});
  }catch(e){await tg(`🆘 *Reconcile crashed*\n${e}`);return new Response(JSON.stringify({error:String(e)}),{status:500,headers:{...cors,"Content-Type":"application/json"}});}
});
