import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { naira } from "@/lib/networks";
import { toast } from "sonner";
import {
  CalendarClock, Plus, Pause, Play, X, AlertTriangle, CheckCircle2,
  Loader2, Clock, Wallet, ChevronRight, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Sched = {
  id: string; type: string; network: string; phone: string;
  recipient_label: string | null; bundle_size: string | null;
  amount: number; frequency: string; interval_days: number | null;
  next_run_at: string; last_run_at: string | null; status: string;
  reserved_amount: number; retry_count: number; last_error: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  cancelled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  completed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  needs_funding: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

const FREQ_LABEL: Record<string, string> = {
  once: "One-time", daily: "Daily", weekly: "Weekly", monthly: "Monthly",
  every_n_days: "Every N days", until_cancelled: "Auto-renew",
};

function relative(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86400000);
  const hrs = Math.floor((abs % 86400000) / 3600000);
  const mins = Math.floor((abs % 3600000) / 60000);
  const prefix = ms < 0 ? "" : "in ";
  const suffix = ms < 0 ? " ago" : "";
  if (days > 0) return `${prefix}${days}d ${hrs}h${suffix}`;
  if (hrs > 0) return `${prefix}${hrs}h ${mins}m${suffix}`;
  return `${prefix}${Math.max(1, mins)}m${suffix}`;
}

export default function Schedules() {
  const { user } = useAuth();
  const { balance, reserved, available } = useWallet();
  const [schedules, setSchedules] = useState<Sched[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const nav = useNavigate();

  async function fetchAll() {
    if (!user) return;
    const { data } = await supabase
      .from("scheduled_purchases" as any)
      .select("*")
      .order("next_run_at", { ascending: true });
    setSchedules((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("schedules-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "scheduled_purchases", filter: `user_id=eq.${user.id}` },
        () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  async function act(id: string, action: "pause" | "resume" | "cancel") {
    setBusyId(id);
    try {
      const fn = action === "pause" ? "pause_schedule" : action === "resume" ? "resume_schedule" : "cancel_schedule";
      const { error } = await supabase.rpc(fn as any, { _id: id });
      if (error) throw error;
      toast.success(action === "cancel" ? "Schedule cancelled" : action === "pause" ? "Paused" : "Resumed");
      fetchAll();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusyId(null); }
  }

  const active = schedules.filter(s => ["active", "paused", "needs_funding"].includes(s.status));
  const upcoming = active.filter(s => s.status === "active").slice(0, 5);

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">BlitzData Scheduler</h1>
          <p className="text-sm text-muted-foreground mt-1">Set it. Forget it. Stay connected.</p>
        </div>
        <Button onClick={() => nav("/app/schedules/new")} size="sm" variant="hero" className="rounded-xl">
          <Plus className="h-4 w-4 mr-1" /> New
        </Button>
      </div>

      {/* Wallet split — 3 lines */}
      <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="rounded-3xl bg-gradient-to-br from-primary/90 to-accent/90 p-5 text-white space-y-3 shadow-glow">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70">
          <Wallet className="h-3.5 w-3.5" /> Wallet split
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-[10px] uppercase text-white/60">Main</div>
            <div className="font-display text-lg font-bold">{naira(balance)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-white/60">Reserved</div>
            <div className="font-display text-lg font-bold">{naira(reserved)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-white/60">Available</div>
            <div className="font-display text-lg font-bold">{naira(available)}</div>
          </div>
        </div>
      </motion.div>

      {/* Upcoming calendar strip */}
      {upcoming.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" /> Next 5 runs
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {upcoming.map(s => {
              const d = new Date(s.next_run_at);
              return (
                <div key={s.id} className="flex-shrink-0 w-32 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="font-display text-xl font-bold leading-none">{d.getDate()}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">{d.toLocaleString("en", { month: "short", weekday: "short" })}</div>
                  <div className="mt-2 text-[11px] font-semibold truncate">{s.network} · {s.bundle_size ?? naira(s.amount)}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{s.recipient_label || s.phone}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="py-12 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : active.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
          <CalendarClock className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="font-semibold">No schedules yet</p>
          <p className="text-xs text-muted-foreground mt-1">Auto-renew data for yourself, family or friends.</p>
          <Button onClick={() => nav("/app/schedules/new")} className="mt-4 rounded-xl" variant="hero">
            <Plus className="h-4 w-4 mr-1" /> Create schedule
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map(s => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">
                      {s.recipient_label || s.phone}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[s.status] ?? STATUS_COLORS.active}`}>
                      {s.status.replace("_", " ").toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {s.network} · {s.bundle_size ?? "Bundle"} · {naira(s.amount)} · {FREQ_LABEL[s.frequency]}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                    <Clock className="h-3 w-3" /> next
                  </div>
                  <div className="text-xs font-semibold">{relative(s.next_run_at)}</div>
                </div>
              </div>

              {s.status === "needs_funding" && (
                <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 px-3 py-2 flex items-center gap-2 text-[11px] text-orange-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Add funds to keep this schedule running.
                </div>
              )}
              {s.last_error && s.status !== "needs_funding" && s.retry_count > 0 && (
                <div className="text-[11px] text-red-400">Last error: {s.last_error} (retry {s.retry_count}/3)</div>
              )}

              <div className="flex gap-2">
                {s.status === "active" ? (
                  <button onClick={() => act(s.id, "pause")} disabled={busyId === s.id}
                    className="flex-1 h-9 rounded-xl bg-white/[0.05] border border-white/10 text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-white/10 transition">
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </button>
                ) : s.status === "paused" ? (
                  <button onClick={() => act(s.id, "resume")} disabled={busyId === s.id}
                    className="flex-1 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-emerald-500/20 transition">
                    <Play className="h-3.5 w-3.5" /> Resume
                  </button>
                ) : (
                  <Link to="/app/wallet" className="flex-1 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-orange-500/20 transition">
                    <Plus className="h-3.5 w-3.5" /> Top up
                  </Link>
                )}
                <button onClick={() => {
                  if (confirm("Cancel this schedule? Reserved funds will be released back to your wallet.")) act(s.id, "cancel");
                }} disabled={busyId === s.id}
                  className="h-9 px-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium flex items-center gap-1 hover:bg-red-500/20 transition">
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Link to="/app/history" className="glass mt-2 flex items-center justify-between rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary/40"><CheckCircle2 className="h-4 w-4" /></span>
          <div>
            <div className="text-sm font-semibold">Run history</div>
            <div className="text-[11px] text-muted-foreground">All past scheduled purchases</div>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </div>
  );
}