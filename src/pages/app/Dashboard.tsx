import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Plus, Zap, Wifi, BatteryCharging, Tv, Sparkles, Gift, Mail, ChevronRight, CalendarClock, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useBlitzPoints } from "@/hooks/useBlitzPoints";
import { useHideBalance } from "@/hooks/useHideBalance";
import { naira } from "@/lib/networks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, SectionHeader, ListRow, IconPlate, StatPill, Skeleton } from "@/components/blitz/ui/Surface";

export default function Dashboard() {
  const { user } = useAuth();
  const { balance, refresh: refreshWallet } = useWallet();
  const { points, refresh: refreshPts } = useBlitzPoints();
  const { hide, toggle: toggleHide } = useHideBalance();
  const [name, setName] = useState("");
  const [recent, setRecent] = useState<any[]>([]);
  const [showRedeem, setShowRedeem] = useState(false);
  const [redeemPhone, setRedeemPhone] = useState("");
  const [redeemNet, setRedeemNet] = useState("MTN");
  const [busy, setBusy] = useState(false);
  const [loadingTx, setLoadingTx] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setName(data?.full_name ?? ""));
    supabase.from("transactions").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(4)
      .then(({ data }) => { setRecent(data ?? []); setLoadingTx(false); });
  }, [user, balance]);

  // Auto-provision permanent deposit account on first login — silent, no UI.
  // Backend uses operator default KYC so the user never has to enter NIN/BVN.
  useEffect(() => {
    if (!user) return;
    const key = `va_provisioned_${user.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    supabase.functions.invoke("payvessel-topup", { body: { type: "static" } })
      .catch(() => { /* silent — Wallet page will retry/show errors if any */ });
  }, [user]);

  // Realtime: keep recent activity in sync + close the balance/tx race condition
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("dashboard-tx-live-" + user.id)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "transactions",
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        // Update the row in recent activity instantly
        setRecent(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t));
        // If a deposit just succeeded, also refresh wallet balance immediately
        if (payload.new?.type === "wallet_fund" && payload.new?.status === "success") {
          refreshWallet();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refreshWallet]);

  const first = name.split(" ")[0] || "there";
  const pct = Math.min(100, (points / 100) * 100);

  async function redeem() {
    if (!/^0\d{10}$/.test(redeemPhone)) return toast.error("Enter valid 11-digit phone");
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("redeem_swift_points", { _network: redeemNet, _phone: redeemPhone });
      if (error) throw error;
      toast.success("Reward sent! 1GB free data delivered.");
      setShowRedeem(false); setRedeemPhone(""); refreshPts();
      nav("/app/success?ref=" + (data as any).reference + "&type=data&amount=0&network=" + redeemNet + "&bundle=1GB%20Reward");
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      {/* Balance card */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[28px] bg-gradient-primary p-6 shadow-[var(--shadow-key)]">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-12 h-44 w-44 rounded-full bg-accent/25 blur-3xl" />
        <Zap className="absolute -right-4 bottom-0 h-32 w-32 text-white/[0.07]" fill="currentColor" strokeWidth={0} />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">Available balance</div>
            <button onClick={toggleHide} className="press grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white/80 backdrop-blur">
              {hide ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="mt-2 font-display text-[42px] font-bold leading-none tracking-tight text-white">
            {hide ? "\u20A6 \u2022\u2022\u2022\u2022\u2022\u2022" : naira(balance)}
          </div>
          <div className="mt-1.5 text-[11px] text-white/70">Hi {first}, ready when you are.</div>
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            <Link to="/app/wallet" className="press flex items-center justify-center gap-2 rounded-2xl bg-white/95 px-4 py-3 text-[13px] font-bold text-[hsl(258_60%_22%)]">
              <Plus className="h-4 w-4" strokeWidth={2.6} /> Fund wallet
            </Link>
            <Link to="/app/history" className="press flex items-center justify-center gap-2 rounded-2xl bg-white/15 px-4 py-3 text-[13px] font-semibold text-white backdrop-blur">
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.4} /> Activity
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Quick actions */}
      <div>
        <SectionHeader title="Pay for" />
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { i: Zap, l: "Airtime", to: "/app/airtime", c: "text-network-mtn bg-network-mtn/12" },
            { i: Wifi, l: "Data", to: "/app/data", c: "text-primary bg-primary/12" },
            { i: BatteryCharging, l: "Power", to: "/app/electricity", c: "text-accent bg-accent/12" },
            { i: Tv, l: "Cable", to: "/app/cable", c: "text-network-airtel bg-network-airtel/12" },
          ].map((a, idx) => (
            <motion.div key={a.l} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * idx, duration: 0.4 }}>
              <Link to={a.to} className="press surface flex flex-col items-center gap-2 rounded-2xl px-1 py-3.5">
                <span className={"grid h-10 w-10 place-items-center rounded-[14px] " + a.c}><a.i className="h-[18px] w-[18px]" strokeWidth={2.2} /></span>
                <span className="text-[10.5px] font-semibold">{a.l}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* BlitzPoints */}
      <Card delay={0.08} className="overflow-hidden p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">BlitzPoints</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="font-display text-[28px] font-bold leading-none">{points}</span>
              <span className="text-[11px] text-muted-foreground">/ 100 BP</span>
            </div>
          </div>
          <button onClick={() => setShowRedeem(true)} disabled={points < 100}
            className={"press flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-bold transition " +
              (points >= 100 ? "bg-gradient-primary text-white shadow-[var(--shadow-key)]" : "bg-foreground/[0.06] text-muted-foreground")}>
            <Gift className="h-3.5 w-3.5" /> Redeem
          </button>
        </div>
        <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-foreground/[0.08]">
          <motion.div initial={{ width: 0 }} animate={{ width: pct + "%" }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="h-full rounded-full bg-gradient-primary" />
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">
          {points >= 100 ? "Reward unlocked. Redeem 1GB free data." : `${100 - points} BP to your free 1GB data reward`}
        </div>
      </Card>

      {/* Feature rows */}
      <Card delay={0.12} className="divide-y divide-[hsl(var(--hairline))] overflow-hidden">
        <ListRow
          onClick={() => nav("/app/schedules")}
          icon={<IconPlate tint="gradient" size="lg"><CalendarClock className="h-[18px] w-[18px]" /></IconPlate>}
          title="BlitzData Scheduler"
          badge={<StatPill tone="info">New</StatPill>}
          subtitle="Auto renew data and airtime on your schedule"
        />
        <ListRow
          onClick={() => nav("/app/support")}
          icon={<IconPlate tint="primary" size="lg"><Mail className="h-[18px] w-[18px]" /></IconPlate>}
          title="Get instant support"
          subtitle="Email or chat with Blitzi"
        />
      </Card>

      {/* Recent */}
      <div>
        <SectionHeader
          title="Recent activity"
          action={<Link to="/app/history" className="flex items-center gap-0.5 text-[11px] font-semibold text-primary">See all <ChevronRight className="h-3 w-3" /></Link>}
        />
        {loadingTx ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-[62px] rounded-2xl" />)}
          </div>
        ) : recent.length === 0 ? (
          <Card className="p-8 text-center">
            <IconPlate tint="muted" size="lg"><Zap className="h-[18px] w-[18px]" /></IconPlate>
            <div className="mt-3 text-[13px] font-semibold">No transactions yet</div>
            <div className="mt-1 text-[11.5px] text-muted-foreground">Your first top up will show up here.</div>
          </Card>
        ) : (
          <Card className="divide-y divide-[hsl(var(--hairline))] overflow-hidden">
            {recent.map(t => {
              const isDeposit = t.type === "wallet_fund" || t.type === "wallet_topup";
              const isSuccess = t.status === "success";
              const displayAmt = isDeposit && t.meta?.net_credit ? naira(Number(t.meta.net_credit)) : naira(Number(t.amount));
              const sign = isDeposit ? (isSuccess ? "+" : "") : "-";
              const isPending = ["pending", "processing", "verifying"].includes(t.status);
              const amtColor = isDeposit
                ? (isSuccess ? "text-success" : isPending ? "text-warning" : "text-muted-foreground")
                : (isSuccess ? "text-foreground" : "text-muted-foreground");
              const statusLabel = !isSuccess
                ? (t.status === "refunded" ? "Refunded" : t.status.charAt(0).toUpperCase() + t.status.slice(1))
                : null;
              const tone = t.status === "failed" || t.status === "refunded" ? "danger" : isPending ? "warning" : "muted";
              const Ico = isDeposit ? Plus : t.type === "data" ? Wifi : t.type === "airtime" ? Zap : t.type === "cable" ? Tv : BatteryCharging;
              return (
                <ListRow
                  key={t.id}
                  onClick={() => nav("/app/history")}
                  icon={<IconPlate tint={isDeposit ? "accent" : "primary"}><Ico className="h-4 w-4" strokeWidth={2.2} /></IconPlate>}
                  title={<span className="capitalize">{t.type.replace("_", " ")}{t.network ? ` \u00b7 ${t.network}` : ""}</span>}
                  subtitle={new Date(t.created_at).toLocaleString()}
                  right={
                    <div className="flex flex-shrink-0 flex-col items-end gap-1">
                      <span className={`text-[13.5px] font-bold ${amtColor}`}>{sign}{displayAmt}</span>
                      {statusLabel && <StatPill tone={tone as any}>{statusLabel}</StatPill>}
                    </div>
                  }
                />
              );
            })}
          </Card>
        )}
      </div>

      {showRedeem && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setShowRedeem(false)} />
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl border-t border-white/10 bg-[#13171f] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-accent" />
              <h2 className="font-display text-lg font-bold">Redeem 1GB Free Data</h2>
            </div>
            <p className="text-xs text-muted-foreground">100 BlitzPoints will be deducted. Reward is non-transferable.</p>
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">Network</div>
              <div className="grid grid-cols-4 gap-2">
                {["MTN","AIRTEL","GLO","9MOBILE"].map(n => (
                  <button key={n} onClick={() => setRedeemNet(n)}
                    className={"rounded-xl px-2 py-2 text-xs font-semibold transition " + (redeemNet === n ? "bg-primary text-white" : "bg-white/5 text-muted-foreground")}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">Phone</div>
              <input value={redeemPhone} onChange={e => setRedeemPhone(e.target.value)} inputMode="tel" placeholder="08030000000"
                className="h-12 w-full rounded-2xl bg-secondary/40 px-4 text-base outline-none border border-white/5" />
            </div>
            <Button variant="hero" size="xl" className="w-full" disabled={busy} onClick={redeem}>
              {busy ? "Redeeming..." : "Confirm Redemption"}
            </Button>
          </motion.div>
        </>
      )}
    </div>
  );
}
