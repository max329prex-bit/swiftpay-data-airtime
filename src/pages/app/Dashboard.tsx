import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Plus, Zap, Wifi, ArrowUpRight, BatteryCharging, Tv, Sparkles, Gift } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useSwiftPoints } from "@/hooks/useSwiftPoints";
import { useHideBalance } from "@/hooks/useHideBalance";
import { naira } from "@/lib/networks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { user } = useAuth();
  const { balance } = useWallet();
  const { points, refresh: refreshPts } = useSwiftPoints();
  const { hide, toggle: toggleHide } = useHideBalance();
  const [name, setName] = useState("");
  const [recent, setRecent] = useState<any[]>([]);
  const [showRedeem, setShowRedeem] = useState(false);
  const [redeemPhone, setRedeemPhone] = useState("");
  const [redeemNet, setRedeemNet] = useState("MTN");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle().then(({ data }) => setName(data?.full_name ?? ""));
    supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(4)
      .then(({ data }) => setRecent(data ?? []));
  }, [user, balance]);

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
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-sm text-muted-foreground">Hi {first} 👋</div>
        <div className="font-display text-2xl font-semibold">Let's get you topped up.</div>
      </motion.div>

      {/* Wallet card */}
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-primary p-6 shadow-glow">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-accent/30 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-widest text-white/70">Wallet balance</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="font-display text-4xl font-bold text-white">{hide ? "₦ ••••••" : naira(balance)}</div>
              <button onClick={toggleHide} className="text-white/70 hover:text-white">
                {hide ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Link to="/app/wallet" className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur hover:bg-white/25">
            <Plus className="h-4 w-4 text-white" />
          </Link>
        </div>
        <div className="relative mt-6 text-xs text-white/80">Tap + to fund your wallet instantly.</div>
      </motion.div>

      {/* BlitzPoint rewards card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-accent/20 via-primary/10 to-background p-5">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/20 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <div className="text-xs font-semibold uppercase tracking-widest text-accent">BlitzPoints</div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="font-display text-3xl font-bold">{points}</div>
              <div className="text-sm text-muted-foreground">/ 100 pts</div>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div initial={{ width: 0 }} animate={{ width: pct + "%" }} transition={{ duration: 0.8 }}
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent" />
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              {points >= 100 ? "🎉 Reward unlocked! Redeem 1GB free." : `${100 - points} pts to your free 1GB data reward`}
            </div>
          </div>
          <button onClick={() => setShowRedeem(true)} disabled={points < 100}
            className={"flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-semibold transition " +
              (points >= 100 ? "bg-gradient-primary text-white shadow-glow hover:scale-105" : "bg-white/5 text-muted-foreground cursor-not-allowed")}>
            <Gift className="h-5 w-5" />
            Redeem
          </button>
        </div>
      </motion.div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { i: Zap, l: "Airtime", to: "/app/airtime" },
          { i: Wifi, l: "Data", to: "/app/data" },
          { i: BatteryCharging, l: "Electric", to: "/app/electricity" },
          { i: Tv, l: "Cable TV", to: "/app/cable" },
        ].map(a => (
          <Link key={a.l} to={a.to} className="glass flex flex-col items-center gap-2 rounded-2xl p-3 hover:border-primary/40 transition">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary"><a.i className="h-4 w-4 text-white" /></span>
            <span className="text-[11px] font-medium">{a.l}</span>
          </Link>
        ))}
      </div>

      {/* Recent */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="font-display text-base font-semibold">Recent activity</div>
          <Link to="/app/history" className="text-xs text-primary">See all</Link>
        </div>
        {recent.length === 0 ? (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">No transactions yet — your first top-up will appear here.</div>
        ) : (
          <div className="space-y-2">
            {recent.map(t => (
              <div key={t.id} className="glass flex items-center justify-between rounded-2xl p-4">
                <div>
                  <div className="text-sm font-medium capitalize">{t.type.replace("_", " ")}{t.network ? ` · ${t.network}` : ""}</div>
                  <div className="text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                </div>
                <div className={`text-sm font-semibold ${t.type === "wallet_topup" ? "text-accent" : ""}`}>
                  {t.type === "wallet_topup" ? "+" : "-"}{naira(Number(t.amount))}
                </div>
              </div>
            ))}
          </div>
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
            <p className="text-xs text-muted-foreground">100 BlitzPoints will be deducted. Reward is non-transferable and cannot be converted to cash.</p>
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
