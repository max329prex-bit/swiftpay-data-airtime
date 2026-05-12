import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogOut, User, Bell, Shield, Sparkles, ChevronRight, Moon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHideBalance } from "@/hooks/useHideBalance";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const { hide, setHide } = useHideBalance();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notif, setNotif] = useState(() => localStorage.getItem("swiftly:notif") !== "0");
  const nav = useNavigate();

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, phone").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { setName(data?.full_name ?? ""); setPhone(data?.phone ?? ""); });
  }, [user]);

  const initials = (name || user?.email || "?").split(" ").map(s => s[0]).slice(0,2).join("").toUpperCase();

  return (
    <div className="space-y-5 pb-6">
      {/* Profile header */}
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

      {/* Privacy */}
      <Section title="Privacy">
        <Row icon={hide ? EyeOff : Eye} label="Hide balance" desc="Mask your wallet amount on the home screen">
          <Switch checked={hide} onCheckedChange={setHide} />
        </Row>
        <Row icon={Shield} label="Change transaction PIN" onClick={() => nav("/app/setup-pin")} chevron />
      </Section>

      {/* App */}
      <Section title="App">
        <Row icon={Bell} label="Push notifications" desc="Deals & transaction alerts">
          <Switch checked={notif} onCheckedChange={(v) => { setNotif(v); localStorage.setItem("swiftly:notif", v ? "1" : "0"); toast.success(v ? "Notifications on" : "Notifications off"); }} />
        </Row>
        <Row icon={Moon} label="Theme" desc="Dark (default)" />
        <Row icon={Sparkles} label="SwiftPoints info" desc="Earn points on every purchase" />
      </Section>

      {/* Account */}
      <Section title="Account">
        <Row icon={User} label="Edit profile" onClick={() => toast("Coming soon")} chevron />
        <Row icon={LogOut} label="Sign out" danger onClick={async () => { await supabase.auth.signOut(); nav("/"); }} chevron />
      </Section>

      <div className="pt-2 text-center text-[11px] text-muted-foreground">SwiftlyPay · v1.0.0</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="glass divide-y divide-white/5 rounded-2xl">{children}</div>
    </div>
  );
}

function Row({ icon: Icon, label, desc, children, onClick, chevron, danger }: { icon: any; label: string; desc?: string; children?: React.ReactNode; onClick?: () => void; chevron?: boolean; danger?: boolean }) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className={`flex w-full items-center gap-3 p-4 text-left ${onClick ? "hover:bg-white/5 transition" : ""}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${danger ? "bg-destructive/15 text-destructive" : "bg-white/5 text-foreground"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${danger ? "text-destructive" : ""}`}>{label}</div>
        {desc && <div className="text-[11px] text-muted-foreground truncate">{desc}</div>}
      </div>
      {children}
      {chevron && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </Comp>
  );
}