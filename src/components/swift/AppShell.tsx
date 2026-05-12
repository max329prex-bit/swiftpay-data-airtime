import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, Wallet as WalletIcon, Receipt, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "./Logo";
import { BoltLoader } from "./BoltLoader";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const TABS = [
  { to: "/app", icon: Home, label: "Home", end: true },
  { to: "/app/wallet", icon: WalletIcon, label: "Deposit" },
  { to: "/app/bills", icon: Receipt, label: "Bills" },
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
    <div className="relative mx-auto min-h-screen max-w-md pb-10">
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-white/5">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <Logo />
          <button onClick={async () => { await supabase.auth.signOut(); nav("/"); }} className="grid h-9 w-9 place-items-center rounded-full glass">
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* Top dash navigation */}
        <nav className="px-5 pb-3">
          <div className="flex items-center justify-between gap-2">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className="group flex flex-1 flex-col items-center gap-2"
              >
                {({ isActive }) => (
                  <>
                    <div className={`flex items-center gap-1.5 text-xs font-semibold transition ${isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/80"}`}>
                      <t.icon className="h-3.5 w-3.5" />
                      <span>{t.label}</span>
                    </div>
                    <div className={`h-1 w-full rounded-full transition-all ${isActive ? "bg-gradient-primary shadow-glow" : "bg-white/10 group-hover:bg-white/20"}`} />
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="px-5 pt-5"><Outlet /></main>
    </div>
  );
}
