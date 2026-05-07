import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, Wifi, Zap, Wallet, Receipt, LogOut, BatteryCharging } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "./Logo";

const TABS = [
  { to: "/app", icon: Home, label: "Home", end: true },
  { to: "/app/data", icon: Wifi, label: "Data" },
  { to: "/app/airtime", icon: Zap, label: "Airtime" },
  { to: "/app/electricity", icon: BatteryCharging, label: "Electric" },
  { to: "/app/wallet", icon: Wallet, label: "Wallet" },
  { to: "/app/history", icon: Receipt, label: "History" },
];

export function AppShell() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav("/auth", { replace: true });
  }, [user, loading, nav]);

  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading...</div>;
  if (!user) return null;

  return (
    <div className="relative mx-auto min-h-screen max-w-md pb-28">
      <header className="sticky top-0 z-20 flex items-center justify-between px-5 pt-4 pb-3 backdrop-blur-xl bg-background/70">
        <Logo />
        <button onClick={async () => { await supabase.auth.signOut(); nav("/"); }} className="grid h-9 w-9 place-items-center rounded-full glass">
          <LogOut className="h-4 w-4" />
        </button>
      </header>
      <main className="px-5"><Outlet /></main>

      <nav className="fixed bottom-4 left-1/2 z-30 w-[min(96vw,420px)] -translate-x-1/2">
        <div className="gloss-strong flex items-center justify-around rounded-full px-2 py-2 shadow-card">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-full px-1.5 py-2 text-[9px] font-medium transition-all min-w-0 ${
                isActive ? "bg-gradient-primary text-white shadow-glow" : "text-muted-foreground hover:text-foreground"
              }`}>
              <t.icon className="h-Ä w-4 flex-shrink-0" />
              <span className="truncate w-full text-center">{t.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
