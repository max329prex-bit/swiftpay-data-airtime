import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BoltLoader } from "@/components/blitz/BoltLoader";
import { ArrowLeft, CheckCircle2, AlertCircle, Activity } from "lucide-react";
import { motion } from "framer-motion";

type BundleRow = { network: string; is_available: boolean; health_score: number; fail_count: number; last_success_at: string | null; auto_paused_at: string | null; };

function HealthDot({ score }: { score: number }) {
  if (score >= 80) return <span className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" />;
  if (score >= 50) return <span className="h-2.5 w-2.5 rounded-full bg-warning shadow-[0_0_6px_rgba(251,191,36,0.6)]" />;
  return <span className="h-2.5 w-2.5 rounded-full bg-destructive shadow-[0_0_6px_rgba(239,68,68,0.6)]" />;
}

function healthLabel(score: number) {
  if (score >= 80) return { text: "Healthy", color: "text-green-400" };
  if (score >= 50) return { text: "Degraded", color: "text-warning" };
  return { text: "Down", color: "text-destructive" };
}

const NETWORKS = ["MTN", "AIRTEL", "GLO", "9MOBILE"];

export default function ProviderStatus() {
  const nav = useNavigate();
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("bundle_status").select("network, is_available, health_score, fail_count, last_success_at, auto_paused_at").order("network")
      .then(({ data }) => { setBundles((data || []) as BundleRow[]); setLoading(false); });
  }, []);

  if (loading) return <div className="py-16 grid place-items-center"><BoltLoader size={56} label="Checking providers..." /></div>;

  const byNetwork: Record<string, BundleRow[]> = {};
  for (const b of bundles) {
    const net = b.network.toUpperCase();
    if (!byNetwork[net]) byNetwork[net] = [];
    byNetwork[net].push(b);
  }

  function networkScore(net: string) {
    const rows = byNetwork[net] || [];
    if (!rows.length) return null;
    return Math.round(rows.reduce((s, r) => s + r.health_score, 0) / rows.length);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => nav(-1)} className="grid h-9 w-9 place-items-center rounded-full glass text-muted-foreground"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="font-display text-2xl font-semibold">Network Status</h1>
          <p className="text-xs text-muted-foreground">Real-time provider health</p>
        </div>
      </div>

      <div className="glass rounded-2xl p-4 flex items-center gap-3">
        <Activity className="h-5 w-5 text-accent" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Service Status</p>
          <p className="text-xs text-muted-foreground">{bundles.filter(b => b.is_available).length} of {bundles.length} bundles available</p>
        </div>
        {bundles.every(b => b.is_available)
          ? <div className="flex items-center gap-1 text-green-400 text-xs font-semibold"><CheckCircle2 className="h-4 w-4" /> All Systems Go</div>
          : <div className="flex items-center gap-1 text-warning text-xs font-semibold"><AlertCircle className="h-4 w-4" /> Partial Disruption</div>}
      </div>

      <div className="space-y-2">
        {NETWORKS.map((net) => {
          const score = networkScore(net);
          const rows = byNetwork[net] || [];
          const hl = score !== null ? healthLabel(score) : { text: "No data", color: "text-muted-foreground" };
          const paused = rows.some(r => r.auto_paused_at);
          return (
            <div key={net} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  {score !== null ? <HealthDot score={score} /> : <span className="h-2.5 w-2.5 rounded-full bg-white/20" />}
                  <span className="font-semibold text-sm">{net}</span>
                  {paused && <span className="text-[9px] px-2 py-0.5 rounded-full bg-warning/20 text-warning font-semibold">PAUSED</span>}
                </div>
                <span className={`text-xs font-semibold ${hl.color}`}>{hl.text}</span>
              </div>
              {rows.length > 0 ? (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div className="flex justify-between"><span>Available bundles</span><span className="text-foreground">{rows.filter(r => r.is_available).length}/{rows.length}</span></div>
                  {score !== null && <div className="flex justify-between"><span>Health score</span><span className={hl.color}>{score}/100</span></div>}
                  {rows[0]?.last_success_at && <div className="flex justify-between"><span>Last success</span><span className="text-foreground">{new Date(rows[0].last_success_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}</span></div>}
                </div>
              ) : <p className="text-xs text-muted-foreground">No bundle data available</p>}
            </div>
          );
        })}
      </div>

      <div className="glass rounded-xl p-4 flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">Network health reflects real-time performance. Degraded = some delays. Down = purchases temporarily paused for that network.</p>
      </div>
    </motion.div>
  );
}
