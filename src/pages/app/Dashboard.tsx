import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Plus, Zap, Wifi, ArrowUpRight, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { naira } from "@/lib/networks";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const { user } = useAuth();
  const { balance } = useWallet();
  const [hide, setHide] = useState(false);
  const [name, setName] = useState("");
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle().then(({ data }) => setName(data?.full_name ?? ""));
    supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(4)
      .then(({ data }) => setRecent(data ?? []));
  }, [user, balance]);

  const first = name.split(" ")[0] || "there";

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
              <button onClick={() => setHide(!hide)} className="text-white/70 hover:text-white">
                {hide ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Link to="/app/wallet" className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur hover:bg-white/25">
            <Plus className="h-4 w-4 text-white" />
          </Link>
        </div>
        <div className="relative mt-6 flex items-center gap-2 text-xs text-white/80">
          <Sparkles className="h-3 w-3" />
          You earn 2.5% cashback on every purchase
        </div>
      </motion.div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { i: Zap, l: "Airtime", to: "/app/airtime" },
          { i: Wifi, l: "Data", to: "/app/data" },
          { i: Plus, l: "Top up", to: "/app/wallet" },
          { i: ArrowUpRight, l: "History", to: "/app/history" },
        ].map(a => (
          <Link key={a.l} to={a.to} className="glass flex flex-col items-center gap-2 rounded-2xl p-3 hover:border-primary/40 transition">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary"><a.i className="h-4 w-4 text-white" /></span>
            <span className="text-[11px] font-medium">{a.l}</span>
          </Link>
        ))}
      </div>

      {/* Promo */}
      <div className="relative overflow-hidden rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/15 to-primary/10 p-5">
        <Sparkles className="absolute right-4 top-4 h-5 w-5 text-accent" />
        <div className="font-display text-lg font-semibold">Earn ₦500 free 🎁</div>
        <p className="mt-1 text-xs text-muted-foreground">Refer a friend who tops up their first ₦1,000.</p>
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
    </div>
  );
}
