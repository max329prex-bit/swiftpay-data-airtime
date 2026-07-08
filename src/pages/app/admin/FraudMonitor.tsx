import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BoltLoader } from "@/components/blitz/BoltLoader";
import { ArrowLeft, Shield, Flag, AlertTriangle, User } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

type FlagRow = { id: string; user_id: string; event_type: string; count: number; is_flagged: boolean; flagged_at: string | null; window_start: string; notes: string | null; profiles?: { full_name: string | null; phone: string | null } | null; };

export default function FraudMonitor() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const adminToken = sessionStorage.getItem("blitzpay_admin_session");
    if (adminToken) { setIsAdmin(true); return; }
    if (!user) return;
    supabase.rpc("has_role" as never, { _role: "admin" } as never).then(({ data }) => { setIsAdmin(!!data); if (!data) { toast.error("Admin access required"); nav("/app"); } });
  }, [user, nav]);
  const [rows, setRows] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"flagged" | "high">("flagged");

  async function load() {
    setLoading(true);
    const q = supabase.from("fraud_velocity").select("*, profiles(full_name, phone)").order("created_at", { ascending: false }).limit(100);
    if (tab === "flagged") q.eq("is_flagged", true); else q.gte("count", 5);
    const { data } = await q;
    setRows((data || []) as unknown as FlagRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [tab]);

  async function markReviewed(id: string) {
    await supabase.from("fraud_velocity").update({ reviewed_at: new Date().toISOString() }).eq("id", id);
    toast.success("Marked as reviewed");
    load();
  }

  if (!isAdmin) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => nav(-1)} className="grid h-9 w-9 place-items-center rounded-full glass text-muted-foreground"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="font-display text-2xl font-semibold">Fraud Monitor</h1>
          <p className="text-xs text-muted-foreground">Velocity flags & suspicious patterns</p>
        </div>
      </div>

      <div className="glass flex rounded-xl p-1 gap-1">
        {(["flagged", "high"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${tab === t ? "bg-gradient-primary text-white shadow-glow" : "text-muted-foreground"}`}>
            {t === "flagged" ? "Flagged" : "High Velocity"}
          </button>
        ))}
      </div>

      {loading ? <div className="py-16 grid place-items-center"><BoltLoader size={48} label="Loading..." /></div>
       : rows.length === 0 ? (
        <div className="glass rounded-3xl p-10 grid place-items-center gap-3 text-center">
          <Shield className="h-8 w-8 text-green-400" />
          <p className="text-sm text-muted-foreground">No {tab === "flagged" ? "flagged events" : "high-velocity events"} found.</p>
        </div>
       ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className={`glass rounded-2xl p-4 border ${r.is_flagged ? "border-destructive/30" : "border-warning/20"}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`grid h-9 w-9 place-items-center rounded-xl ${r.is_flagged ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                    {r.is_flagged ? <Flag className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold capitalize">{r.event_type.replace(/_/g, " ")}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(r.window_start).toLocaleString("en-NG", { dateStyle: "short", timeStyle: "short" })}</p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${r.is_flagged ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>x{r.count}</span>
              </div>
              {r.profiles && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <User className="h-3 w-3" />
                  <span>{r.profiles.full_name || "Anonymous"}</span>
                  {r.profiles.phone && <span>· {r.profiles.phone}</span>}
                </div>
              )}
              <button onClick={() => markReviewed(r.id)} className="text-xs bg-white/[0.06] hover:bg-white/[0.1] rounded-lg px-3 py-1.5 transition font-medium">
                Mark Reviewed
              </button>
            </div>
          ))}
        </div>
       )}
    </motion.div>
  );
}
