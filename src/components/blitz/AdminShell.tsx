import { NavLink, Outlet, useNavigate } from "react-router-dom";
  import { LayoutDashboard, MessageSquare, Shield, Megaphone, TrendingUp, LogOut, Zap, Users } from "lucide-react";
  import { useEffect, useState } from "react";
  import { supabase } from "@/integrations/supabase/client";
  import { useAuth } from "@/hooks/useAuth";
  import { toast } from "sonner";
  import { BoltLoader } from "./BoltLoader";

  const ADMIN_TABS = [
    { to: "/app/admin/treasury", icon: LayoutDashboard, label: "Treasury" },
    { to: "/app/admin/users", icon: Users, label: "Users" },
    { to: "/app/admin/support", icon: MessageSquare, label: "Support" },
    { to: "/app/admin/fraud", icon: Shield, label: "Fraud" },
    { to: "/app/admin/broadcast", icon: Megaphone, label: "Broadcast" },
    { to: "/app/admin/margin", icon: TrendingUp, label: "Margins" },
  ];

  export function AdminShell() {
    const { user, loading: authLoading } = useAuth();
    const nav = useNavigate();
    const [isAdmin, setIsAdmin] = useState(false);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
      const adminToken = sessionStorage.getItem("blitzpay_admin_session");
      if (adminToken) {
        setIsAdmin(true);
        setChecked(true);
        return;
      }
      if (authLoading) return;
      if (!user) {
        setChecked(true);
        return;
      }
      supabase.rpc("has_role" as never, { _role: "admin" } as never).then(({ data }) => {
        setIsAdmin(!!data);
        setChecked(true);
        if (!data) {
          toast.error("Admin access required");
          nav("/app");
        }
      });
    }, [user, authLoading, nav]);

    if (checked && !isAdmin) {
      return (
        <div className="min-h-screen grid place-items-center bg-background">
          <div className="text-center space-y-3">
            <div className="text-sm text-muted-foreground">Admin access required</div>
            <button onClick={() => nav("/admin")} className="text-xs text-primary hover:underline">
              Go to admin login
            </button>
          </div>
        </div>
      );
    }

    if (!checked) {
      return (
        <div className="min-h-screen grid place-items-center bg-background">
          <BoltLoader size={40} label="Checking admin access..." />
        </div>
      );
    }

    const logout = () => {
      sessionStorage.removeItem("blitzpay_admin_session");
      nav("/admin");
    };

    return (
      <div className="min-h-screen bg-background text-foreground">
        {/* Admin top nav */}
        <header className="sticky top-0 z-40 border-b border-white/10 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="relative grid h-7 w-7 place-items-center rounded-lg bg-gradient-primary shadow-glow">
                <Zap className="h-4 w-4 text-white" strokeWidth={2.5} fill="white" />
              </span>
              <span className="text-sm font-bold tracking-tight">Admin Panel</span>
            </div>
            <button onClick={logout} className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition">
              <LogOut className="h-3.5 w-3.5" />
              Exit Admin
            </button>
          </div>
          {/* Admin tab nav */}
          <nav className="mx-auto max-w-5xl px-4 pb-2">
            <div className="flex gap-1 overflow-x-auto">
              {ADMIN_TABS.map(t => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  className={({ isActive }) =>
                    "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition " +
                    (isActive
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:text-white/70 hover:bg-white/5")
                  }
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </NavLink>
              ))}
            </div>
          </nav>
        </header>

        {/* Page content */}
        <main className="mx-auto max-w-5xl px-4 py-6">
          <Outlet />
        </main>
      </div>
    );
  }
  