import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogOut, User, Bell, Shield, Sparkles, ChevronRight, Moon, Sun,
         Monitor, Activity, BookOpen, Megaphone, ShieldAlert, BarChart3, Headphones,
         BadgeCheck, TrendingUp, KeyRound, Code, Plus, Loader2, Copy, Check } from "lucide-react";
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
  const [notif, setNotif] = useState(() => {
    const old = localStorage.getItem("swiftly:notif");
    if (old !== null) {
      localStorage.setItem("blitzpay:notif", old);
      localStorage.removeItem("swiftly:notif");
    }
    return localStorage.getItem("blitzpay:notif") !== "0";
  });
  const nav = useNavigate();
  const isAdmin = useIsAdmin();

  // -- Developer API state --
  const [devOpen, setDevOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [showGen, setShowGen] = useState(false);
  const [genName, setGenName] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, phone").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { setName(data?.full_name ?? ""); setPhone(data?.phone ?? ""); });
  }, [user]);

  async function loadApiKeys() {
    if (!user?.id) return;
    setLoadingKeys(true);
    try {
      const { data, error } = await supabase.rpc("list_api_keys", { _user_id: user.id });
      if (error) throw error;
      const keyArray = Array.isArray(data) ? data : (data ? [data] : []);
      setApiKeys(keyArray);
    } catch {}
    setLoadingKeys(false);
  }

  async function generateKey() {
    if (!user?.id || !genName.trim()) return;
    setGenLoading(true);
    try {
      const { data, error } = await supabase.rpc("generate_api_key", { _user_id: user.id, _key_name: genName.trim() });
      if (error) throw error;
      const d = data as any;
      if (d?.error) { toast.error(d.error); return; }
      setNewKey(d.api_key);
      setShowGen(false);
      setGenName("");
      loadApiKeys();
      toast.success("API key generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
    setGenLoading(false);
  }

  function copyKey(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Copied");
  }

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
        <Row
          icon={BadgeCheck}
          label="Identity Verification (KYC)"
          desc="Set up your permanent deposit account"
          onClick={() => nav("/app/wallet")}
          chevron
        />
      </Section>

      <Section title="App">
        <Row icon={Bell} label="Push notifications" desc="Deals & transaction alerts">
          <Switch checked={notif} onCheckedChange={(v) => {
            setNotif(v);
            localStorage.setItem("blitzpay:notif", v ? "1" : "0");
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

      {/* Developer API */}
      <Section title="Developer">
        <Row icon={Code} label="API Documentation" desc="Endpoints & integration guide" onClick={() => nav("/api-docs")} chevron />
        <Row icon={KeyRound} label="API Keys" desc="Manage your developer keys" onClick={() => { setDevOpen(o => !o); if (!devOpen) loadApiKeys(); }} chevron />
        {devOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
            <div className="rounded-xl bg-accent/10 border border-accent/20 p-3 text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Requires N5,000 minimum balance.</span>{" "}
              This is a one-time float requirement only — your balance is <strong>not deducted</strong>.
            </div>
            {newKey && (
              <div className="rounded-xl bg-primary/10 border border-primary/30 p-3 space-y-2">
                <div className="text-xs font-semibold text-primary">⚠️ Copy now — shown only once</div>
                <div className="font-mono text-[11px] break-all text-foreground bg-background/40 rounded p-2">{newKey}</div>
                <button onClick={() => copyKey(newKey)} className="flex items-center gap-1.5 text-xs text-primary font-medium">
                  {copied ? <><Check className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy key</>}
                </button>
              </div>
            )}
            {loadingKeys ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading keys…</div>
            ) : apiKeys.length > 0 ? (
              <div className="space-y-1.5">
                {apiKeys.map((k: any, i: number) => (
                  <div key={k.id || i} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5">
                    <div>
                      <div className="text-xs font-semibold">{k.name || "Unnamed"}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{k.api_key?.slice(0,8)}***</div>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${k.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{k.is_active ? "Active" : "Revoked"}</span>
                  </div>
                ))}
              </div>
            ) : !newKey ? <p className="text-xs text-muted-foreground py-1">No API keys yet.</p> : null}
            {showGen ? (
              <div className="space-y-2 pt-1">
                <input placeholder="Key name (e.g. My App)" value={genName} onChange={e => setGenName(e.target.value)} onKeyDown={e => e.key === "Enter" && generateKey()} className="w-full h-9 px-3 text-sm bg-white/5 border border-white/10 rounded-lg text-foreground outline-none focus:border-primary/50" />
                <div className="flex gap-2">
                  <button onClick={generateKey} disabled={genLoading} className="flex-1 h-8 text-xs bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50">{genLoading ? "Generating..." : "Generate"}</button>
                  <button onClick={() => { setShowGen(false); setGenName(""); }} className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowGen(true)} className="flex items-center gap-1.5 text-xs text-primary font-semibold py-1 hover:opacity-80 transition">
                <Plus className="h-3.5 w-3.5" /> Generate new API key
              </button>
            )}
          </div>
        )}
      </Section>

      <Section title="Account">
        <Row icon={User} label="Edit profile" onClick={() => nav("/app/edit-profile")} chevron />
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
