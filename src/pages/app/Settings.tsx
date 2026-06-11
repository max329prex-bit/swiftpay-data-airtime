import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogOut, User, Bell, Shield, Sparkles, ChevronRight, Moon, Sun,
         Monitor, Activity, BookOpen, Megaphone, ShieldAlert, BarChart3, Headphones,
         BadgeCheck, TrendingUp, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHideBalance } from "@/hooks/useHideBalance";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useTheme } from "next-themes";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;

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

  // KYC state
  const [nin, setNin]             = useState("");
  const [bvn, setBvn]             = useState("");
  const [kycStatus, setKycStatus] = useState<"none" | "submitted" | "verified">("none");
  const [kycLoading, setKycLoad]  = useState(false);
  const [kycAccount, setKycAcct]  = useState<{account_number:string;account_name:string;bank_name:string} | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, phone, nin, bvn, kyc_status")
      .eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        setName(data?.full_name ?? "");
        setPhone(data?.phone ?? "");
        setNin(data?.nin ?? "");
        setBvn(data?.bvn ?? "");
        if (data?.kyc_status) setKycStatus(data.kyc_status as "none" | "submitted" | "verified");
      });
  }, [user]);

  const initials = (name || user?.email || "?").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
  const themeLabel = theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";
  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const nextTheme = (theme === "dark" ? "light" : theme === "light" ? "system" : "dark") as "dark" | "light" | "system";

  const cleanNin = nin.replace(/\D/g, "");
  const cleanBvn = bvn.replace(/\D/g, "");

  async function handleVerify() {
    if (!cleanNin && !cleanBvn) return toast.error("Enter your NIN or BVN (or both)");
    if (cleanNin && cleanNin.length !== 11) return toast.error("NIN must be exactly 11 digits");
    if (cleanBvn && cleanBvn.length !== 11) return toast.error("BVN must be exactly 11 digits");
    setKycLoad(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const res = await fetch(`${SUPA_URL}/functions/v1/payvessel-topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type: "static", ...(cleanNin ? { nin: cleanNin } : {}), ...(cleanBvn ? { bvn: cleanBvn } : {}) }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Verification failed. Check your NIN/BVN and try again.");
      setKycStatus("submitted");
      setKycAcct({ account_number: data.account_number, account_name: data.account_name, bank_name: data.bank_name });
      toast.success("Identity verified! Permanent account created.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setKycLoad(false);
    }
  }

  const alreadyVerified = kycStatus !== "none" || !!kycAccount || !!(nin || bvn);

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

      {/* ── VERIFICATION SECTION ────────────────────────────────────── */}
      <div>
        <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Verification</div>
        <div className="glass rounded-2xl overflow-hidden">
          {kycAccount ? (
            /* Just created an account this session */
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-semibold">Permanent account created!</span>
              </div>
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Account Number</p>
                <p className="text-lg font-bold font-mono tracking-wider">{kycAccount.account_number}</p>
                <p className="text-xs text-muted-foreground">{kycAccount.account_name} · {kycAccount.bank_name}</p>
              </div>
              <button onClick={() => nav("/app/wallet")}
                className="w-full h-10 rounded-xl border border-primary/30 text-primary text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/10 transition">
                <ChevronRight className="w-4 h-4" /> View in Wallet
              </button>
            </div>
          ) : alreadyVerified ? (
            /* Has existing NIN/BVN on profile */
            <div className="p-4 flex items-center gap-3">
              <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <BadgeCheck className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Identity submitted</div>
                <div className="text-xs text-muted-foreground">
                  {nin ? `NIN: ${"*".repeat(7)}${nin.slice(-4)}` : ""}{nin && bvn ? " · " : ""}{bvn ? `BVN: ${"*".repeat(7)}${bvn.slice(-4)}` : ""}
                </div>
              </div>
              <button onClick={() => { setNin(""); setBvn(""); setKycStatus("none"); }}
                className="text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded-lg border border-white/10">
                Update
              </button>
            </div>
          ) : (
            /* No KYC yet — show the form */
            <div className="p-4 space-y-4">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-400 mt-0.5">
                  <Shield className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">Unlock Permanent Deposit Account</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Required by Payvessel to create your permanent virtual account number. Enter your NIN, BVN, or both.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground px-1">NIN (National ID Number)</label>
                  <input
                    type="tel" inputMode="numeric" maxLength={11}
                    value={nin} onChange={e => setNin(e.target.value.replace(/\D/g, ""))}
                    placeholder="11-digit NIN"
                    className="w-full h-11 rounded-xl bg-secondary/50 border border-white/10 px-4 text-sm focus:outline-none focus:border-primary/50 transition font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground px-1">BVN (Bank Verification Number)</label>
                  <input
                    type="tel" inputMode="numeric" maxLength={11}
                    value={bvn} onChange={e => setBvn(e.target.value.replace(/\D/g, ""))}
                    placeholder="11-digit BVN"
                    className="w-full h-11 rounded-xl bg-secondary/50 border border-white/10 px-4 text-sm focus:outline-none focus:border-primary/50 transition font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal"
                  />
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground/60 text-center">
                Your data is encrypted and only used for virtual account creation. Not shared with third parties.
              </p>

              <button
                onClick={handleVerify}
                disabled={kycLoading || (!cleanNin && !cleanBvn)}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2 transition hover:opacity-90 active:scale-[0.98]">
                {kycLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying & creating account...</>
                  : <><BadgeCheck className="w-4 h-4" /> Verify & Create Permanent Account</>
                }
              </button>
            </div>
          )}
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
          <Row icon={TrendingUp} label="Margin Report" desc="Provider cost vs sell price" onClick={() => nav("/app/admin/margin")} chevron />
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
