import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { BoltLoader } from "@/components/swift/BoltLoader";
import { toast } from "sonner";
type TRow={id:string;ticket_ref:string;user_id:string;intent:string;status:string;message:string|null;related_transaction_id:string|null;created_at:string;};
const FO=["all","open","in_progress","resolved"] as const;
export default function SupportCenter(){
  const{user}=useAuth();const nav=useNavigate();const[rows,setRows]=useState<TRow[]>([]);const[filter,setFilter]=useState<typeof FO[number]>("open");const[loading,setLoading]=useState(true);const[isAdmin,setIsAdmin]=useState(false);
  useEffect(()=>{
    const adminToken = sessionStorage.getItem("blitzpay_admin_session");
    if (adminToken) { setIsAdmin(true); return; }
    if(!user)return;supabase.rpc("has_role" as never,{_role:"admin"} as never).then(({data})=>{setIsAdmin(!!data);if(!data){toast.error("Admin access required");nav("/app");}});
  },[user,nav]);
  const load=()=>{setLoading(true);const q=supabase.from("support_tickets").select("*").order("created_at",{ascending:false}).limit(100);(filter==="all"?q:q.eq("status",filter)).then(({data})=>{setRows((data as TRow[])??[]);setLoading(false);});};
  useEffect(()=>{if(isAdmin)load();},[isAdmin,filter]);
  const counts={open:rows.filter(r=>r.status==="open").length,in_progress:rows.filter(r=>r.status==="in_progress").length,resolved:rows.filter(r=>r.status==="resolved").length};
  async function updateStatus(id:string,status:string){await supabase.from("support_tickets").update({status,updated_at:new Date().toISOString()}).eq("id",id);setRows(prev=>prev.map(r=>r.id===id?{...r,status}:r));toast.success("Updated");}
  if(!isAdmin)return null;
  return(<div className="space-y-5 pb-10">
    <div className="flex items-center justify-between"><div className="flex items-center gap-3"><button onClick={()=>nav(-1)} className="p-2 rounded-xl glass"><ArrowLeft className="h-5 w-5"/></button><h1 className="font-display text-xl font-semibold">Support</h1></div><Button variant="soft" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5"/></Button></div>
    <div className="grid grid-cols-3 gap-2"><div className="glass rounded-2xl p-3 text-center"><div className="text-xl font-bold text-red-400">{counts.open}</div><div className="text-[10px] text-muted-foreground">Open</div></div><div className="glass rounded-2xl p-3 text-center"><div className="text-xl font-bold text-yellow-400">{counts.in_progress}</div><div className="text-[10px] text-muted-foreground">In Progress</div></div><div className="glass rounded-2xl p-3 text-center"><div className="text-xl font-bold text-green-400">{counts.resolved}</div><div className="text-[10px] text-muted-foreground">Resolved</div></div></div>
    <div className="flex gap-2">{FO.map(f=><button key={f} onClick={()=>setFilter(f)} className={"flex-1 rounded-xl py-2 text-xs font-semibold capitalize transition-all "+(filter===f?"bg-gradient-primary text-white":"glass text-muted-foreground")}>{f==="all"?"All":f.replace("_"," ")}</button>)}</div>
    {loading?<div className="py-10 grid place-items-center"><BoltLoader size={48}/></div>:rows.length===0?<div className="py-8 text-center text-sm text-muted-foreground">No tickets.</div>:(
      <div className="space-y-2">{rows.map(r=>{
        const SI=r.status==="resolved"?CheckCircle:r.status==="in_progress"?Clock:AlertCircle;
        return(<div key={r.id} className="glass rounded-2xl p-4 space-y-2">
          <div className="flex items-start justify-between gap-2"><div><div className="flex items-center gap-2"><SI className={"h-3.5 w-3.5 "+(r.status==="resolved"?"text-green-400":r.status==="in_progress"?"text-yellow-400":"text-red-400")}/><span className="text-xs font-mono font-semibold">{r.ticket_ref}</span></div><div className="text-sm font-medium capitalize mt-1">{r.intent.replace(/_/g," ")}</div>{r.message&&<div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.message}</div>}</div><div className="text-[10px] text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleDateString("en-NG")}</div></div>
          {r.related_transaction_id&&<Link to={"/app/transaction/"+r.related_transaction_id} className="text-[10px] text-primary">View transaction</Link>}
          {r.status!=="resolved"&&<div className="flex gap-2 pt-1">{r.status==="open"&&<Button variant="soft" size="sm" className="text-xs" onClick={()=>updateStatus(r.id,"in_progress")}>In progress</Button>}<Button variant="soft" size="sm" className="text-xs" onClick={()=>updateStatus(r.id,"resolved")}>Resolve</Button></div>}
        </div>);
      })}</div>)}
  </div>);}
