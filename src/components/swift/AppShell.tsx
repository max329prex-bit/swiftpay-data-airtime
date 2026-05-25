import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, Wallet as WalletIcon, Receipt, Settings as SettingsIcon, Bell, X, CheckCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "./Logo";
import { BoltLoader, SplashScreen } from "./BoltLoader";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { naira } from "@/lib/networks";
import { motion, AnimatePresence } from "framer-motion";

const TABS = [
  { to: "/app", icon: Home, label: "Home", end: true },
  { to: "/app/bills", icon: Receipt, label: "Bills" },
  { to: "/app/wallet", icon: WalletIcon, label: "Deposit" },
  { to: "/app/settings", icon: SettingsIcon, label: "Settings" },
];

type Notif = { id: string; title: string; body: string; read: boolean };

export function AppShell() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [, setPinChecked] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  usePushNotifications();

  useEffect(() => {
    if (!loading && !user) nav("/auth", { replace: true });
  }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_transaction_pin").then(({ data }) => {
      if (data === false && window.location.pathname !== "/app/setup-pin") {
        nav("/app/setup-pin", { replace: true });
      }
      setPinChecked(true);
    });
  }, [user, nav]);

  // Load notifications
  useEffect(() => {
    if (!user) return;
    const items: Notif[] = [];

    // Welcome notification (only shown once)
    const welcomedKey = `bp_welcomed_${user.id}`;
    if (!localStorage.getItem(welcomedKey)) {
      items.push({
        id: "welcome",
        title: "🎉 Welcome to BlitzPay!",
        body: "Your account is set up and ready. Fund your wallet to get started.",
        read: false,
      });
      localStorage.setItem(welcomedKey, "1");
    }

    // Load recent wallet top-ups
    supabase.from("transactions")
      .select("id, amount, created_at")
      .eq("user_id", user.id)
      .eq("type", "wallet_topup")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        const txNotifs: Notif[] = (data || []).map(t => ({
          id: t.id,
          title: "💰 Wallet Funded",
          body: `${naira(Number(t.amount))} was added to your wallet.`,
          read: !!localStorage.getItem(`bp_nr_${t.id}`),
        }));
        setNotifs([...items, ...txNotifs]);
      });
  }, [user]);

  const unread = notifs.filter(n => !n.read).length;

  function markAllRead() {
    notifs.forEach(n => localStorage.setItem(`bp_nr_${n.id}`, "1"));
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }

  // Show splash for exactly 5s (regardless of auth speed)
  if (showSplash || loading) return (
    <AnimatePresence>
      <SplashScreen key="splash" onDone={() => setShowSplash(false)} />
    </AnimatePresence>
  );
  if (!user) return null;

  return (
    <div className="relative mx-auto min-h-screen max-w-md pb-28">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/70 border-b border-white/5">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <Logo />
          <button
            onClick={() => setShowNotifs(true)}
            className="relative grid h-9 w-9 place-items-center rounded-full glass"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground shadow">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="px-5 pt-5"><Outlet /></main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-4 left-1/2 z-30 w-[92%] max-w-sm -translate-x-1/2">
        <div className="glass flex items-center justify-around rounded-3xl border border-white/10 px-2 py-2 shadow-glow backdrop-blur-2xl">
          {TABS.map(t => (
            <NavLink key={t.to} to={t.to} end={t.end} className="group relative flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2">
              {({ isActive }) => (
                <>
                  <span className={`grid h-9 w-9 place-items-center rounded-xl transition-all ${isActive ? "bg-gradient-primary text-white shadow-glow scale-110" : "text-muted-foreground group-hover:text-foreground"}`}>
                    <t.icon className="h-4 w-4" />
                  </span>
                  <span className={`text-[10px] font-semibold transition ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{t.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Notification panel */}
      <AnimatePresence>
        {showNotifs && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowNotifs(false)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-[#0f1117] border-t border-white/10"
              style={{ maxHeight: "75vh" }}
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
                <div>
                  <h2 className="font-display text-lg font-bold">Notifications</h2>
                  {unread > 0 && <p className="text-xs text-muted-foreground">{unread} unread</p>}
                </div>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button onClick={markAllRead} className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/10 transition">
                      <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                    </button>
                  )}
                  <button onClick={() => setShowNotifs(false)} className="grid h-8 w-8 place-items-center rounded-full glass">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Notifications list */}
              <div className="overflow-y-auto scrollbar-hide pb-8" style={{ maxHeight: "calc(75vh - 80px)" }}>
                {notifs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                    <Bell className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {notifs.map(n => (
                      <div key={n.id} className={`flex items-start gap-3 px-5 py-4 transition ${n.read ? "opacity-60" : ""}`}>
                        <div className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-accent"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold">{n.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
