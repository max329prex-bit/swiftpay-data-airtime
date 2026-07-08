import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPA_URL=Deno.env.get("SUPABASE_URL")!,SUPA_SVC=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_BOT=Deno.env.get("TELEGRAM_BOT_TOKEN")??"",TG_CHAT=Deno.env.get("TELEGRAM_ADMIN_CHAT_ID")??"";
const PAUSE_THRESHOLD=75,RESTORE_THRESHOLD=85,SPIKE_COUNT=5,SPIKE_MIN=10;
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};

async function tg(msg:string){if(!TG_BOT||!TG_CHAT)return;try{await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:TG_CHAT,text:msg,parse_mode:"Markdown"})});}catch{}}
function health(s:number,f:number){const t=s+f;return t<5?100:Math.round((s/t)*100);}

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  const sb=createClient(SUPA_URL,SUPA_SVC);
  const now=new Date().toISOString();
  const spikeWin=new Date(Date.now()-SPIKE_MIN*60*1000).toISOString();
  try{
    const{data:statuses,error:se}=await sb.from("bundle_status").select("*");
    if(se)throw se;
    if(!statuses||statuses.length===0)return new Response(JSON.stringify({updated:0}),{headers:{...cors,"Content-Type":"application/json"}});

    let paused=0,restored=0;const critical:string[]=[];

    for(const row of statuses){
      const score=health(row.success_count||0,row.fail_count||0);

      // Check spike
      const{count:recentFails}=await sb.from("transactions").select("id",{count:"exact",head:true}).eq("status","failed").eq("meta->>provider_code",row.package_code).gte("created_at",spikeWin);
      const hasSpike=(recentFails||0)>=SPIKE_COUNT;
      const shouldPause=score<PAUSE_THRESHOLD||hasSpike;

      await sb.from("bundle_status").update({health_score:score,last_checked_at:now}).eq("package_code",row.package_code);
      await sb.from("packages").update({health_score:score}).eq("package_code",row.package_code);

      if(score<PAUSE_THRESHOLD)critical.push(`• ${row.package_code}: ${score}% health`);

      if(shouldPause&&!row.auto_paused_at){
        const reason=hasSpike?`${recentFails} fails in ${SPIKE_MIN}min`:`Health dropped to ${score}%`;
        await sb.from("packages").update({is_active:false,health_score:score}).eq("package_code",row.package_code);
        await sb.from("bundle_status").update({is_available:false,auto_paused_at:now,auto_paused_reason:reason,last_error:reason}).eq("package_code",row.package_code);
        paused++;console.warn(`Health: paused ${row.package_code} — ${reason}`);
      }else if(!shouldPause&&row.auto_paused_at&&score>=RESTORE_THRESHOLD){
        await sb.from("packages").update({is_active:true,health_score:score}).eq("package_code",row.package_code);
        await sb.from("bundle_status").update({is_available:true,auto_paused_at:null,auto_paused_reason:null}).eq("package_code",row.package_code);
        restored++;console.log(`Health: restored ${row.package_code} — ${score}%`);
      }
    }

    if(critical.length>0){
      await tg(`⚠️ *BlitzPay Health Alert*

Critical:
${critical.join("\n")}

Paused: ${paused} | Restored: ${restored}`);
    }

    return new Response(JSON.stringify({checked:statuses.length,paused,restored,at:now}),{headers:{...cors,"Content-Type":"application/json"}});
  }catch(e){
    return new Response(JSON.stringify({error:e instanceof Error?e.message:"Unknown"}),{status:500,headers:{...cors,"Content-Type":"application/json"}});
  }
});
