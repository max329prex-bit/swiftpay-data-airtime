import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, Wallet as WalletIcon, Receipt, Settings as SettingsIcon, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "./Logo";
import { BoltLoader } from "./BoltLoader";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const TABS = [
  { to: "/app", icon: Home, label: "Home", end: true },
  { to: "/app/bills", icon: Receipt, label: "Bills" },
  { to: "/app/wallet", icon: WalletIcon, label: "Deposit" },
  { to: "/app/settings", icon: SettingsIcon, label: "Settings" },
];

export function AppShell() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [, setPinChecked] = useState(false);
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

  if (loading) return <div className="grid min-h-screen place-items-center"><BoltLoader size={72} label="Loading..." /></div>;
  if (!user) return null;

  return (
    <div className="relative mx-auto min-h-screen max-w-md pb-28">
      {/* Minimal app header — distinct from website */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/70 border-b border-white/5">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <Logo />
          <NavLink to="/app/settings" className="relative grid h-9 w-9 place-items-center rounded-full glass">
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent shadow-glow" />
          </NavLink>
        </div>
      </header>

      <main className="px-5 pt-5"><Outlet /></main>

      {/* Floating bottom navigation */}
      <nav className="fixed bottom-4 left-1/2 z-30 w-[92%] max-w-sm -translate-x-1/2">
        <div className="glass flex items-center justify-around rounded-3xl border border-white/10 px-2 py-2 shadow-glow backdrop-blur-2xl">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className="group relative flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2"
            >
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
    </div>
  );
}
