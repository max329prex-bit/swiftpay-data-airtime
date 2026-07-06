import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Zap, User, Bell, Lock, Shield, HelpCircle, ChevronRight, LogOut,
  KeyRound, ChevronDown, Copy, Check, Plus, Eye, EyeOff, Terminal, FileText, Trash2, Loader2
} from "lucide-react";

export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [keysOpen, setKeysOpen] = useState(false);
  const [keys, setKeys] = useState<any[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [showGen, setShowGen] = useState(false);
  const [genName, setGenName] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const sections = [
    { icon: User, label: "Edit profile", action: () => navigate("/app/edit-profile") },
    { icon: Bell, label: "Notifications", action: () => toast.info("Coming soon") },
    { icon: Lock, label: "Change password", action: () => toast.info("Coming soon") },
    { icon: Shield, label: "Security", action: () => toast.info("Coming soon") },
    { icon: HelpCircle, label: "Help & support", action: () => toast.info("Coming soon") },
  ];

  const fetchKeys = async () => {
    if (!user?.id) return;
    setLoadingKeys(true);
    try {
      const { data, error } = await supabase.rpc("list_api_keys", { _user_id: user.id });
      if (error) throw error;
      const keyArray = Array.isArray(data) ? data : (data ? [data] : []);
      setKeys(keyArray);
    } catch (e: any) {
      toast.error("Failed to load API keys");
    } finally { setLoadingKeys(false); }
  };

  const toggleKeys = () => {
    if (!keysOpen && keys.length === 0) fetchKeys();
    setKeysOpen(!keysOpen);
  };

  const generateKey = async () => {
    if (!user?.id) return;
    setGenLoading(true);
    try {
      const { data, error } = await supabase.rpc("generate_api_key", { _user_id: user.id, _key_name: genName || "API Key" });
      if (error) throw error;
      if (data?.error) {
        if (data.error?.toLowerCase().includes("balance") || data.error?.toLowerCase().includes("insufficient")) {
          toast.error(`Wallet balance must be at least \u20a6${data.required || 5000}. Current: \u20a6${data.current || 0}`);
        } else {
          toast.error(data.error);
        }
        return;
      }
      setNewKey(data.api_key);
      setShowGen(false);
      setGenName("");
      fetchKeys();
      toast.success(data.message || "API key generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate key");
    } finally { setGenLoading(false); }
  };

  const copyKey = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="min-h-screen bg-background" style={{ backgroundImage: "var(--gradient-aurora)", backgroundAttachment: "fixed" }}>
      {/* Header */}
      <div className="sticky top-0 z-40 glass border-b border-white/10">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3.5">
          <button onClick={() => navigate(-1)} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/5 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-glow">
              <Zap className="h-4 w-4 text-white" fill="white" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              Blitz<span className="text-gradient">Pay</span>
            </span>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight mb-6">Settings</h1>

        {/* Profile summary */}
        <div className="glass-strong rounded-2xl p-5 mb-6 border border-white/10">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-primary shadow-glow grid place-items-center text-lg font-bold text-white">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{user?.email}</p>
              <p className="text-xs text-muted-foreground">{user?.id?.slice(0, 8) || "User"}</p>
            </div>
          </div>
        </div>

        {/* Standard settings */}
        <div className="space-y-1 mb-6">
          {sections.map((s) => (
            <button key={s.label} onClick={s.action} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-white/[0.03] transition-colors text-left">
              <s.icon className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">{s.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
            </button>
          ))}
        </div>

        {/* Developer / API Keys */}
        <div className="glass-strong rounded-2xl border border-white/10 overflow-hidden mb-6">
          <button onClick={toggleKeys} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.03] transition-colors text-left">
            <KeyRound className="h-5 w-5 text-purple-400" />
            <div className="flex-1">
              <p className="text-sm font-medium">Developer</p>
              <p className="text-xs text-muted-foreground">API keys &amp; documentation</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); navigate("/api/docs"); }} className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" /> Docs
              </button>
              {keysOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          </button>

          <AnimatePresence>
            {keysOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-white/10">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">API Keys</h3>
                    <button onClick={() => setShowGen(true)} className="flex items-center gap-1.5 text-xs bg-gradient-primary text-white px-3 py-1.5 rounded-lg font-medium shadow-glow hover:opacity-90 transition-opacity">
                      <Plus className="h-3.5 w-3.5" /> Generate
                    </button>
                  </div>

                  {loadingKeys ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />
                    </div>
                  ) : keys.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-4">No API keys yet. Generate one to get started.</p>
                  ) : (
                    <div className="space-y-2">
                      {keys.map((k) => (
                        <div key={k.id} className="flex items-center gap-3 bg-white/[0.03] rounded-lg px-3 py-2.5">
                          <code className="font-mono text-xs text-purple-300">{k.api_key?.slice(0, 8)}***</code>
                          <span className="text-xs text-muted-foreground">{k.name || "Unnamed"}</span>
                          <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${k.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{k.is_active ? "Active" : "Revoked"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Generate Key Dialog */}
        <AnimatePresence>
          {showGen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowGen(false)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="glass-strong rounded-2xl p-5 w-full max-w-sm border border-white/10" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-display text-lg font-bold mb-1">Generate API Key</h3>
                <p className="text-xs text-muted-foreground mb-4">Requires &nbsp;&#8358;5,000 wallet balance. Key shown only once.</p>
                <Input value={genName} onChange={(e) => setGenName(e.target.value)} placeholder="Key name (e.g. Production)" className="bg-white/5 border-white/10 text-sm mb-4" />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 border-white/10" onClick={() => setShowGen(false)}>Cancel</Button>
                  <Button size="sm" className="flex-1 bg-gradient-primary shadow-glow" onClick={generateKey} disabled={genLoading}>
                    {genLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Show New Key Dialog */}
        <AnimatePresence>
          {newKey && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="glass-strong rounded-2xl p-5 w-full max-w-sm border border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <KeyRound className="h-5 w-5 text-purple-400" />
                  <h3 className="font-display text-lg font-bold">Your New API Key</h3>
                </div>
                <p className="text-xs text-amber-400 mb-3 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Copy now. This key will never be shown again.
                </p>
                <div className="flex items-center gap-2 bg-black/40 rounded-lg p-3 border border-white/5 mb-4">
                  <code className="font-mono text-xs text-purple-300 flex-1 break-all">{showKey ? newKey : newKey.slice(0, 12) + "***"}</code>
                  <button onClick={() => setShowKey(!showKey)} className="text-muted-foreground hover:text-white transition-colors">
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 border-white/10" onClick={() => { setNewKey(null); setShowKey(false); }}>Close</Button>
                  <Button size="sm" className="flex-1 bg-gradient-primary shadow-glow" onClick={() => copyKey(newKey)}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Logout */}
        <button onClick={signOut} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-red-500/10 transition-colors text-left text-red-400">
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-medium">Log out</span>
        </button>
      </main>
    </div>
  );
}
