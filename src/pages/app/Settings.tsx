import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogOut, User, Bell, Shield, Sparkles, ChevronRight, Moon, Sun, Monitor, Activity, BookOpen, Megaphone, ShieldAlert, BarChart3, Headphones } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHideBalance } from "@/hooks/useHideBalance";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useTheme } from "next-themes";

function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setIsAdmin(data?.role === "admin"));
  }, [user]);
  return isAdmin;
}

export default function Settings() {
  const { user } = useAuth();
  const { hide, setHide } = useHideBalance();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notif, setNotif] = useState(() => localStorage.getItem("swiftly:notif") !== "0");
  const nav = useNavigate();
  const isAdmin = useIsAdmin();

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, phone").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { setName(data?.full_name ?? ""); setPhone(data?.phone ?? ""); });
  }, [user]);

  const initials = (name || user?.email || "?").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
  const themeLabel = theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";
  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const nextTheme = (theme === "dark" ? "light" : theme === "light" ? "system" : "dark") as "dark" | "light" | "system";

  return (
    <div className="space-y-5 pb-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-6 shadow-glow">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/20 backdrop-blur font-display text-xl font-bold text-white">{initials}</div>
          <div className="min-w-0">
            <div className="font-display text-xl font-bold text-white truncate">{name || "Add your name"}</div>
            <div className="text-xs text-white/80 truncate">{user?.email}</div>
            {phone && <div className="text-xs text-white/70">{phone}</div>}
          </div>
        </div>
      </div>

      <Section title="Privacy">
        <Row icon={hide ? EyeOff : Eye} label="Hide balance" desc="Mask your wallet amount on the home screen">
          <Switch checked={hide} onCheckedChange={setHide} />
        </Row>
        <Row icon={Shield} label="Change transaction PIN" onClick={() => nav("/app/setup-pin")} chevron />
      </Section>

      <Section title="App">
        <Row icon={Bell} label="Push notifications" desc="Deals & transaction alerts">
          <Switch checked={notif} onCheckedChange={(v) => {
            setNotif(v);
            localStorage.setItem("swiftly:notif", v ? "1" : "0");
            toast.success(v ? "Notifications on" : "Notifications off");
          }} />
        </Row>
        <Row icon={ThemeIcon} label="Theme" desc={themeLabel}
          onClick={() => { setTheme(nextTheme); toast.success(`Switched to ${nextTheme} mode`); }} chevron />
        <Row icon={Sparkles} label="BlitzPoints info" desc="Earn points on every purchase" />
      </Section>

      <Section title="Tools">
        <Row icon={Activity} label="Network Status" desc="View live provider health" onClick={() => nav("/app/provider-status")} chevron />
        <Row icon={BookOpen} label="Wallet Ledger" desc="Full balance movement history" onClick={() => nav("/app/ledger")} chevron />
      </Section>

      {isAdmin && (
        <Section title="Admin">
          <Row icon={BarChart3} label="Treasury Dashboard" desc="Provider float and health" onClick={() => nav("/app/admin/treasury")} chevron />
          <Row icon={Headphones} label="Support Center" desc="Manage user tickets" onClick={() => nav("/app/admin/support")} chevron />
          <Row icon={Megaphone} label="Broadcast" desc="Send system-wide alerts" onClick={() => nav("/app/admin/broadcast")} chevron />
          <Row icon={ShieldAlert} label="Fraud Monitor" desc="Velocity flags and suspicious activity" onClick={() => nav("/app/admin/fraud")} chevron />
        </Section>
      )}

      <Section title="Account">
        <Row icon={User} label="Edit profile" onClick={() => toast("Coming soon")} chevron />
        <Row icon={LogOut} label="Sign out" danger onClick={async () => { await supabase.auth.signOut(); nav("/"); }} chevron />
      </Section>

      <div className="pt-2 text-center text-[11px] text-muted-foreground">BlitzPay · v1.0.0</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="glass divide-y divide-white/5 rounded-2xl overflow-hidden">{children}</div>
    </div>
  );
}

function Row({ icon: Icon, label, desc, children, onClick, chevron, danger }: {
  icon: any; label: string; desc?: string; children?: React.ReactNode;
  onClick?: () => void; chevron?: boolean; danger?: boolean;
}) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className={`flex w-full items-center gap-3 p-4 text-left ${onClick ? "hover:bg-white/5 transition" : ""}`}>
      <span className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl ${danger ? "bg-destructive/15 text-destructive" : "bg-white/[0.08] text-foreground"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${danger ? "text-destructive" : ""}`}>{label}</div>
        {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
      </div>
      {children}
      {chevron && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
    </Comp>
  );
}
