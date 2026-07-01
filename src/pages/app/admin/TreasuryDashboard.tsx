import { useEffect, useState } from "react";
  import { useNavigate } from "react-router-dom";
  import { ArrowLeft, RefreshCw, AlertTriangle, TrendingUp, Building2 } from "lucide-react";
  import { supabase } from "@/integrations/supabase/client";
  import { useAuth } from "@/hooks/useAuth";
  import { naira } from "@/lib/networks";
  import { Button } from "@/components/ui/button";
  import { BoltLoader } from "@/components/swift/BoltLoader";
  import { toast } from "sonner";
  type TRow={id:string;provider_code:string;actual_balance:number;reserved_balance:number;refill_threshold:number;refill_target:number;critical_stop_threshold:number;transfer_health:string;cb_failures:number;last_refill_at:string|null;daily_refilled_today:number;bank_name:string|null;bank_account_number:string|null;avg_spend_1hr:number;};
  type XRow={id:string;provider_code:string;amount:number;status:string;initiated_at:string;};
  function HealthPill({h}:{h:string}){const m:Record<string,string>={healthy:"bg-green-500/10 text-green-400 border-green-500/20",degraded:"bg-yellow-500/10 text-yellow-400 border-yellow-500/20",paused:"bg-red-500/10 text-red-400 border-red-500/20"};return<span className={"text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border "+(m[h]??m.degraded)}>{h}</span>;}
  export default function TreasuryDashboard(){
    const{user}=useAuth();const nav=useNavigate();const[rows,setRows]=useState<TRow[]>([]);const[transfers,setTransfers]=useState<XRow[]>([]);const[loading,setLoading]=useState(true);const[isAdmin,setIsAdmin]=useState(false);
    useEffect(()=>{
      const adminToken = sessionStorage.getItem("blitzpay_admin_session");
      if (adminToken) { setIsAdmin(true); return; }
      if(!user)return;supabase.rpc("has_role" as never,{_role:"admin"} as never).then(({data})=>{setIsAdmin(!!data);if(!data){toast.error("Admin access required");nav("/app");}});
    },[user,nav]);
    type PingResult={provider:string;ok:boolean;http?:number;balance?:number|string|null;raw?:string;error?:string;has_credentials:boolean};
  const load=()=>{setLoading(true);
  Promise.all([
    supabase.functions.invoke("provider-ping").then(({data})=>data?.results as PingResult[]|undefined).catch(()=>undefined),
    supabase.from("provider_treasury").select("*").order("provider_code"),
    supabase.from("treasury_transfers").select("*").order("initiated_at",{ascending:false}).limit(15)
  ]).then(([pings,t,x])=>{
    const dbRows=(t.data as TRow[])??[];
    const transfers=(x.data as XRow[])??[];
    // Build rows from live pings, falling back to DB
    const liveRows:TRow[]=(pings??[]).map(p=>{
      const db=dbRows.find(r=>r.provider_code===p.provider);
      const bal=typeof p.balance==="number"?p.balance:typeof p.balance==="string"?parseFloat(p.balance)||0:0;
      return{
        id:db?.id||p.provider,
        provider_code:p.provider,
        actual_balance:bal,
        reserved_balance:db?.reserved_balance||0,
        refill_threshold:db?.refill_threshold||50000,
        refill_target:db?.refill_target||200000,
        critical_stop_threshold:db?.critical_stop_threshold||10000,
        transfer_health:p.ok?"healthy":(p.has_credentials?"degraded":"paused"),
        cb_failures:db?.cb_failures||0,
        last_refill_at:db?.last_refill_at||null,
        daily_refilled_today:db?.daily_refilled_today||0,
        bank_name:db?.bank_name||null,
        bank_account_number:db?.bank_account_number||null,
        avg_spend_1hr:db?.avg_spend_1hr||0,
      };
    });
    // Add any DB-only providers not in pings
    const seen=new Set(liveRows.map(r=>r.provider_code));
    for(const d of dbRows){if(!seen.has(d.provider_code))liveRows.push(d);}
    setRows(liveRows);
    setTransfers(transfers);
    setLoading(false);
  });};
    useEffect(()=>{if(isAdmin)load();},[isAdmin]);
    if(!isAdmin)return null;
    return(<div className="space-y-5 pb-10">
      <div className="flex items-center justify-between"><div className="flex items-center gap-3"><button onClick={()=>nav(-1)} className="p-2 rounded-xl glass"><ArrowLeft className="h-5 w-5"/></button><h1 className="font-display text-xl font-semibold">Treasury</h1></div><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={()=>nav("/app/admin/margin")} className="text-xs gap-1"><TrendingUp className="h-3.5 w-3.5"/>Margins</Button><Button variant="soft" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5"/></Button></div></div>
      {loading?<div className="py-10 grid place-items-center"><BoltLoader size={48}/></div>:(<>
        {rows.length===0?(
          <div className="py-16 grid place-items-center text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">No treasury data yet</div>
              <div className="text-xs text-muted-foreground mt-1 max-w-[240px]">Could not fetch live provider balances. Check that your provider API keys are configured in Supabase secrets.</div>
            </div>
            <Button variant="outline" size="sm" onClick={load} className="text-xs">
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh
            </Button>
          </div>
        ):(rows.map(r=>{const usable=r.actual_balance-r.reserved_balance;const pct=Math.min(100,(usable/r.refill_target)*100);const crit=usable<=r.critical_stop_threshold;const low=usable<=r.refill_threshold;
          return(<div key={r.id} className="glass rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between"><div><div className="font-semibold capitalize">{r.provider_code}</div>{r.bank_name&&<div className="text-xs text-muted-foreground">{r.bank_name} - {r.bank_account_number}</div>}</div><HealthPill h={r.transfer_health}/></div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="glass rounded-xl p-2"><div className={"text-sm font-bold "+(crit?"text-red-400":low?"text-yellow-400":"text-green-400")}>{naira(usable)}</div><div className="text-[10px] text-muted-foreground">Usable</div></div>
              <div className="glass rounded-xl p-2"><div className="text-sm font-bold">{naira(r.reserved_balance)}</div><div className="text-[10px] text-muted-foreground">Reserved</div></div>
              <div className="glass rounded-xl p-2"><div className="text-sm font-bold">{naira(r.daily_refilled_today)}</div><div className="text-[10px] text-muted-foreground">Today</div></div>
            </div>
            {crit&&<div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-300"><AlertTriangle className="h-4 w-4 shrink-0"/> Critical: auto-pause active.</div>}
            {!crit&&low&&<div className="flex items-center gap-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-2.5 text-xs text-yellow-300"><AlertTriangle className="h-4 w-4 shrink-0"/> Low float - auto-refill should trigger.</div>}
            <div><div className="flex justify-between text-[10px] text-muted-foreground mb-1"><span>Float level</span><span>{Math.round(pct)}% of target</span></div><div className="h-2 rounded-full bg-border overflow-hidden"><div className={"h-full rounded-full "+(crit?"bg-red-500":low?"bg-yellow-400":"bg-gradient-primary")} style={{width:pct+"%"}}/></div></div>
            <div className="text-[10px] text-muted-foreground">Threshold: {naira(r.refill_threshold)} - Target: {naira(r.refill_target)} - Stop: {naira(r.critical_stop_threshold)}{r.avg_spend_1hr>0?" - Burn 1hr: "+naira(r.avg_spend_1hr):""}{r.cb_failures>0?" - CB: "+r.cb_failures:""}</div>
          </div>);}))}
        {transfers.length>0&&rows.length>0&&<div className="glass rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border/30 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-muted-foreground"/><h2 className="text-sm font-semibold">Recent Transfers</h2></div>
          {transfers.map(x=>(
            <div key={x.id} className="flex items-center justify-between p-3 border-b border-border/20 last:border-0">
              <div><div className="text-xs font-medium capitalize">{x.provider_code} - {naira(Number(x.amount))}</div><div className="text-[10px] text-muted-foreground">{new Date(x.initiated_at).toLocaleString("en-NG")}</div></div>
              <span className={"text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full "+(x.status==="confirmed"?"bg-green-500/10 text-green-400":x.status==="pending"?"bg-yellow-500/10 text-yellow-400":"bg-red-500/10 text-red-400")}>{x.status}</span>
            </div>))}
        </div>}
      </>)}
    </div>);}