import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, EyeOff, LogOut, User, Bell, Shield, Sparkles, ChevronRight, Moon, Sun,
  Monitor, Activity, BookOpen, Megaphone, ShieldAlert, BarChart3, Headphones,
  BadgeCheck, TrendingUp, KeyRound, FileCode2, ExternalLink, Copy, Check,
  Plus, Trash2, AlertTriangle, Loader2, RefreshCw
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHideBalance } from "@/hooks/useHideBalance";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export default function Settings() {
  const { user } = useAuth();
  const { hide, setHide } = useHideBalance();
  const { balance } = useWallet();
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

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showKeysSection, setShowKeysSection] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, phone").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { setName(data?.full_name ?? ""); setPhone(data?.phone ?? ""); });
  }, [user]);

  // Load API keys
  const loadKeys = async () => {
    if (!user) return;
    setKeysLoading(true);
    const { data, error } = await supabase.rpc("list_api_keys");
    if (error) {
      // Function may not exist yet (migration not run)
      setApiKeys([]);
    } else {
      setApiKeys(data ?? []);
    }
    setKeysLoading(false);
  };

  useEffect(() => {
    if (showKeysSection) loadKeys();
  }, [showKeysSection, user]);

  const initials = (name || user?.email || "?").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
  const themeLabel = theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";
  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const nextTheme = (theme === "dark" ? "light" : theme === "light" ? "system" : "dark") as "dark" | "light" | "system";

  async function generateKey() {
    if (!user) return;
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) { toast.error("Please sign in again"); return; }

    setGenerating(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-keys`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: newKeyName.trim() || "Default" })
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || "Failed to generate key");
        return;
      }
      setGeneratedKey(data.key);
      setNewKeyName("");
      loadKeys();
    } catch (e: any) {
      toast.error(e.message || "Failed to generate key");
    } finally {
      setGenerating(false);
    }
  }

  async function revokeKey(keyId: string) {
    if (!confirm("Revoke this API key? It will stop working immediately.")) return;
    const { error } = await supabase.from("api_keys").update({ is_active: false, revoked_at: new Date().toISOString() }).eq("id", keyId);
    if (error) toast.error("Failed to revoke: " + error.message);
    else { toast.success("Key revoked"); loadKeys(); }
  }

  const copyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-5 pb-6">
      {/* Profile Card */}
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

      <Section title="Account">
        <Row icon={User} label="Edit profile" desc="Name, phone, photo" onClick={() => nav("/app/edit-profile")} chevron />
        <Row icon={Shield} label="Change transaction PIN" onClick={() => nav("/app/setup-pin")} chevron />
        <Row
          icon={BadgeCheck}
          label="Identity Verification (KYC)"
          desc="Set up your permanent deposit account"
          onClick={() => nav("/app/wallet")}
          chevron
        />
      </Section>

      <Section title="Privacy">
        <Row icon={hide ? EyeOff : Eye} label="Hide balance" desc="Mask your wallet amount on the home screen">
          <Switch checked={hide} onCheckedChange={setHide} />
        </Row>
        <Row icon={Bell} label="Push notifications" desc="Deals & transaction alerts">
          <Switch checked={notif} onCheckedChange={(v) => {
            setNotif(v);
            localStorage.setItem("blitzpay:notif", v ? "1" : "0");
            toast.success(v ? "Notifications on" : "Notifications off");
          }} />
        </Row>
        <Row icon={ThemeIcon} label="Theme" desc={themeLabel}
          onClick={() => { setTheme(nextTheme); toast.success(`Switched to ${nextTheme} mode`); }} chevron />
      </Section>

      {/* API Keys Section */}
      <Section title="Developer">
        <button
          onClick={() => setShowKeysSection(!showKeysSection)}
          className="flex w-full items-center gap-3 p-4 text-left hover:bg-white/5 transition"
        >
          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-white/[0.08] text-foreground">
            <KeyRound className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">API Keys</div>
            <div className="text-xs text-muted-foreground">Manage developer access keys</div>
          </div>
          <div className="flex items-center gap-2">
            {apiKeys.filter(k => k.is_active).length > 0 && (
              <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">{apiKeys.filter(k => k.is_active).length} active</span>
            )}
            <ChevronRight className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${showKeysSection ? "rotate-90" : ""}`} />
          </div>
        </button>

        <AnimatePresence>
          {showKeysSection && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-white/5"
            >
              <div className="p-4 space-y-4">
                {/* API Docs Link */}
                <a
                  href="/api/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <FileCode2 className="w-4 h-4" />
                  View API Documentation
                  <ExternalLink className="w-3 h-3" />
                </a>

                {/* Balance Check */}
                {balance < 5000 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300">
                      You need at least \u20a65,000 in your wallet to generate an API key.
                      Current balance: {balance.toLocaleString()}.
                    </p>
                  </div>
                )}

                {/* New Key Button */}
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                  disabled={balance < 5000}
                  onClick={() => { setShowNewKey(true); setGeneratedKey(null); }}
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Generate New Key
                </Button>

                {/* Keys List */}
                {keysLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading keys...
                  </div>
                ) : apiKeys.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No API keys yet.</p>
                ) : (
                  <div className="space-y-2">
                    {apiKeys.map((key) => (
                      <div key={key.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                        <KeyRound className={`w-4 h-4 ${key.is_active ? "text-emerald-400" : "text-red-400"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-mono text-zinc-300">{key.key_prefix}****************</div>
                          <div className="text-xs text-muted-foreground">
                            {key.name || "Unnamed"} · {key.is_active ? "Active" : "Revoked"}
                            {key.last_used_at && ` · Used ${new Date(key.last_used_at).toLocaleDateString()}`}
                          </div>
                        </div>
                        {key.is_active && (
                          <button
                            onClick={() => revokeKey(key.id)}
                            className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Section>

      <Section title="App">
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
        <Row icon={LogOut} label="Sign out" danger onClick={async () => { await supabase.auth.signOut(); nav("/"); }} chevron />
      </Section>

      <div className="pt-2 text-center text-[11px] text-muted-foreground">BlitzPay · v1.0.0</div>

      {/* Generate Key Dialog */}
      <Dialog open={showNewKey} onOpenChange={setShowNewKey}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-400" />
              Generate API Key
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {generatedKey ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                  <p className="text-xs text-emerald-300 font-medium">Your API Key (copy now — never shown again):</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono text-emerald-400 bg-black/30 px-3 py-2 rounded break-all">
                      {generatedKey}
                    </code>
                    <button
                      onClick={copyKey}
                      className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition"
                    >
                      {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button onClick={() => { setShowNewKey(false); setGeneratedKey(null); }} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white">
                  Done
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Key Name (optional)</label>
                  <input
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. Production, Testing"
                    className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Requires \u20a65,000 wallet balance. 2% discount on all API purchases. 100 requests/min.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowNewKey(false)} className="flex-1 border-zinc-700 text-zinc-300">
                    Cancel
                  </Button>
                  <Button
                    onClick={generateKey}
                    disabled={generating || balance < 5000}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    {generating ? "Generating..." : "Generate"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
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
