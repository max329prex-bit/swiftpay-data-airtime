import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogOut, User, Bell, Shield, Sparkles, ChevronRight, Moon, Sun,
         Monitor, Activity, BookOpen, Megaphone, ShieldAlert, BarChart3, Headphones,
         BadgeCheck, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHideBalance } from "@/hooks/useHideBalance";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// ── KYC Section ────────────────────────────────────────────────
function KycSection({ userId }: { userId: string }) {
  const [nin,       setNin]       = useState("");
  const [bvn,       setBvn]       = useState("");
  const [status,    setStatus]    = useState<"none"|"submitted"|"verified">("none");
  const [locked,    setLocked]    = useState(false);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    supabase.from("profiles")
      .select("nin, bvn, kyc_status")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setStatus((data.kyc_status as "none"|"submitted"|"verified") ?? "none");
        // Lock fields once submitted — NIN/BVN are write-once
        if (data.nin || data.bvn) {
          setLocked(true);
          setNin(data.nin ? "***" + data.nin.slice(-3) : "");
          setBvn(data.bvn ? "***" + data.bvn.slice(-3) : "");
        }
      });
  }, [userId]);

  const save = async () => {
    const cleanNin = nin.replace(/\D/g, "");
    const cleanBvn = bvn.replace(/\D/g, "");
    if (cleanNin.length !== 11) { toast.error("NIN must be exactly 11 digits"); return; }
    if (cleanBvn.length !== 11) { toast.error("BVN must be exactly 11 digits"); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      nin: cleanNin, bvn: cleanBvn, kyc_status: "submitted"
    }).eq("user_id", userId);
    setSaving(false);
    if (error) { toast.error("Save failed: " + error.message); return; }
    toast.success("KYC details saved! Your permanent account will be upgraded.");
    setStatus("submitted");
    setLocked(true);
    setNin("***" + cleanNin.slice(-3));
    setBvn("***" + cleanBvn.slice(-3));
  };

  const statusEl = status === "verified"
    ? <span className="flex items-center gap-1 text-xs text-green-400 font-medium"><CheckCircle2 className="h-3.5 w-3.5"/>Verified</span>
    : status === "submitted"
    ? <span className="flex items-center gap-1 text-xs text-yellow-400 font-medium"><AlertCircle className="h-3.5 w-3.5"/>Submitted — pending upgrade</span>
    : <span className="text-xs text-muted-foreground">Not submitted</span>;

  return (
    <Section title="Identity Verification (KYC)">
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium">Verify your identity</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              NIN + BVN unlocks a guaranteed permanent deposit account — no expiry, no limits.
            </p>
          </div>
          <BadgeCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Status</span>
          {statusEl}
        </div>

        {status === "verified" ? (
          <div className="flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/20 p-3 text-xs text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0"/>
            Identity verified. Your permanent account is active.
          </div>
        ) : locked ? (
          <div className="flex items-center gap-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-3 text-xs text-yellow-300">
            <Lock className="h-4 w-4 shrink-0"/>
            Details submitted. Contact support if you need to update them.
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">NIN (11 digits)</label>
              <Input
                value={nin} onChange={e => setNin(e.target.value)}
                placeholder="e.g. 12345678901" maxLength={11}
                inputMode="numeric" className="glass border-white/10 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">BVN (11 digits)</label>
              <Input
                value={bvn} onChange={e => setBvn(e.target.value)}
                placeholder="e.g. 22345678901" maxLength={11}
                inputMode="numeric" className="glass border-white/10 text-sm"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Your NIN and BVN are encrypted and used only for payment account verification. They are never shared.
            </p>
            <Button
              className="w-full" size="sm" onClick={save} disabled={saving || !nin || !bvn}
            >
              {saving ? "Saving…" : "Submit KYC Details"}
            </Button>
          </div>
        )}
      </div>
    </Section>
  );
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

      {user && <KycSection userId={user.id} />}

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
