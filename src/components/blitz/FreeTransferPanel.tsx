import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { naira } from "@/lib/networks";
import {
  Loader2, Copy, CheckCircle2, Building2, ShieldCheck, User, CreditCard,
  Clock, Send, AlertTriangle, RefreshCw, Gift, ChevronRight,
} from "lucide-react";

type Defaults = {
  ft_bank_name: string | null;
  ft_account_name: string | null;
  ft_account_number: string | null;
};

type PayTo = { number: string; name: string; bank: string };

type Stage = "loading" | "setup" | "amount" | "pay" | "verifying" | "success" | "expired" | "waiting";

export default function FreeTransferPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>("loading");
  const [defaults, setDefaults] = useState<Defaults>({
    ft_bank_name: null, ft_account_name: null, ft_account_number: null,
  });

  // Setup form
  const [sBank, setSBank] = useState("");
  const [sName, setSName] = useState("");
  const [sAcct, setSAcct] = useState("");
  const [saving, setSaving] = useState(false);

  // Amount + override
  const [amount, setAmount] = useState("");
  const [useOther, setUseOther] = useState(false);
  const [oBank, setOBank] = useState("");
  const [oName, setOName] = useState("");
  const [oAcct, setOAcct] = useState("");
  const [creating, setCreating] = useState(false);

  // Deposit
  const [depositId, setDepositId] = useState<string | null>(null);
  const [payTo, setPayTo] = useState<PayTo | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>("");
  const [credited, setCredited] = useState<number | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load defaults
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("ft_bank_name, ft_account_name, ft_account_number")
        .eq("user_id", user.id).maybeSingle();
      if (data) {
        setDefaults(data);
        if (data.ft_account_name && data.ft_account_number && data.ft_bank_name) {
          setStage("amount");
        } else {
          setStage("setup");
        }
      } else {
        setStage("setup");
      }
    })();
  }, [user]);

  // Countdown
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0) { setCountdown("Expired"); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setCountdown(`${h}h ${m}m`);
    };
    tick();
    cdRef.current = setInterval(tick, 60000);
    return () => { if (cdRef.current) clearInterval(cdRef.current); };
  }, [expiresAt]);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (cdRef.current) clearInterval(cdRef.current);
  }, []);

  const feeInfo = (() => {
    const n = Number(amount);
    if (!n || n <= 0) return null;
    if (n >= 500) return { fee: 0, net: n, free: true };
    const fee = Math.round(n * 0.01 * 100) / 100;
    return { fee, net: n - fee, free: false };
  })();

  async function copy(text: string, field: string) {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast.success("Copied!");
  }

  async function saveDefaults() {
    if (!user) return;
    const bank = sBank.trim();
    const name = sName.trim();
    const acct = sAcct.replace(/\D/g, "");
    if (!bank || name.split(/\s+/).filter(Boolean).length < 2 || acct.length !== 10) {
      toast.error("Enter bank name, full name (first + last), and a 10-digit account number");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      ft_bank_name: bank, ft_account_name: name.toUpperCase(), ft_account_number: acct,
    }).eq("user_id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setDefaults({ ft_bank_name: bank, ft_account_name: name.toUpperCase(), ft_account_number: acct });
    setSBank(""); setSName(""); setSAcct("");
    setStage("amount");
    toast.success("Defaults saved");
  }

  async function createDeposit() {
    const amt = Number(amount);
    if (!amt || amt < 100) { toast.error("Minimum ₦100"); return; }
    let bank: string, name: string, acct: string;
    if (useOther) {
      bank = oBank.trim();
      name = oName.trim();
      acct = oAcct.replace(/\D/g, "");
      if (!bank || name.split(/\s+/).filter(Boolean).length < 2 || acct.length !== 10) {
        toast.error("Fill bank name, full name, and 10-digit account number");
        return;
      }
    } else {
      bank = defaults.ft_bank_name!;
      name = defaults.ft_account_name!;
      acct = defaults.ft_account_number!;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("create-free-transfer", {
      body: { amount: amt, bank_name: bank, account_name: name, account_number: acct },
    });
    setCreating(false);
    if (error || !data?.success) {
      toast.error(data?.error || error?.message || "Could not create deposit");
      return;
    }
    setDepositId(data.deposit_id);
    setPayTo(data.pay_to);
    setExpiresAt(data.expires_at);
    setStage("pay");
  }

  function iMadePayment() {
    if (!depositId) return;
    setStage("verifying");
    let attempts = 0;
    const maxAttempts = 36; // 3 minutes at 5s
    const check = async () => {
      attempts++;
      const { data } = await supabase.functions.invoke("check-free-transfer", {
        body: { deposit_id: depositId },
      });
      if (data?.status === "verified") {
        if (pollRef.current) clearInterval(pollRef.current);
        setCredited(Number(data.credited_amount));
        setStage("success");
        toast.success(`₦${Number(data.credited_amount).toLocaleString()} credited!`);
        setTimeout(() => navigate("/app/history"), 2500);
        return;
      }
      if (data?.status === "expired") {
        if (pollRef.current) clearInterval(pollRef.current);
        setStage("expired");
        return;
      }
      if (attempts >= maxAttempts) {
        if (pollRef.current) clearInterval(pollRef.current);
        setStage("waiting");
      }
    };
    check();
    pollRef.current = setInterval(check, 5000);
  }

  function resetToAmount() {
    if (pollRef.current) clearInterval(pollRef.current);
    setDepositId(null); setPayTo(null); setExpiresAt(null);
    setAmount(""); setUseOther(false);
    setStage("amount");
  }

  // ─── Renders ─────────────────────────────────────────────
  if (stage === "loading") {
    return (
      <div className="rounded-2xl bg-secondary/30 border border-white/5 p-6 flex items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Free banner */}
      <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex gap-3">
        <Gift className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
        <div className="text-sm">
          <div className="font-semibold text-emerald-400">Free Deposits ≥ ₦500</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Transfer directly to BlitzPay's OPay account. Auto-verified from OPay's email in seconds.
            Deposits under ₦500 have a 1% fee.
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* SETUP */}
        {stage === "setup" && (
          <motion.div key="setup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-secondary/30 border border-primary/20 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-sm">One-time setup</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Save the account you'll transfer from — we'll match it automatically.
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Bank Name
                </label>
                <input value={sBank} onChange={e => setSBank(e.target.value)}
                  placeholder="e.g. OPay, GTBank, Kuda"
                  className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Account Name
                </label>
                <input value={sName} onChange={e => setSName(e.target.value)}
                  placeholder="Exactly as on your bank account"
                  className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Account Number
                </label>
                <input value={sAcct} onChange={e => setSAcct(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10 digits" inputMode="numeric"
                  className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-primary/50" />
              </div>
            </div>

            <button onClick={saveDefaults} disabled={saving}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Save & continue <ChevronRight className="w-4 h-4" /></>}
            </button>
          </motion.div>
        )}

        {/* AMOUNT */}
        {stage === "amount" && (
          <motion.div key="amount" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-3">
            <div className="rounded-2xl bg-secondary/30 border border-white/5 p-5 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Amount to deposit</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">₦</span>
                  <input value={amount}
                    onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                    placeholder="0.00" inputMode="decimal"
                    className="w-full rounded-xl bg-white/[0.04] border border-white/10 pl-9 pr-4 py-4 text-2xl font-display font-bold focus:outline-none focus:border-primary/50" />
                </div>
                {feeInfo && (
                  <div className="mt-2 text-xs">
                    {feeInfo.free
                      ? <span className="text-emerald-400">✓ Free — you'll receive {naira(feeInfo.net)}</span>
                      : <span className="text-yellow-400/90">1% fee ({naira(feeInfo.fee)}) — you'll receive {naira(feeInfo.net)}</span>}
                  </div>
                )}
              </div>

              {/* Sender */}
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Sending from</div>
                {!useOther ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{defaults.ft_account_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {defaults.ft_bank_name} · ****{defaults.ft_account_number?.slice(-4)}
                      </div>
                    </div>
                    <button onClick={() => setUseOther(true)} className="text-xs text-primary shrink-0">Different bank</button>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <input value={oBank} onChange={e => setOBank(e.target.value)} placeholder="Bank name"
                      className="w-full rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
                    <input value={oName} onChange={e => setOName(e.target.value)} placeholder="Account name"
                      className="w-full rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
                    <input value={oAcct} onChange={e => setOAcct(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="Account number" inputMode="numeric"
                      className="w-full rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
                    <button onClick={() => setUseOther(false)} className="text-xs text-muted-foreground">← Use my saved default</button>
                  </div>
                )}
              </div>
            </div>

            <button onClick={createDeposit} disabled={creating || !amount}
              className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50 shadow-glow">
              {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ChevronRight className="w-5 h-5" /></>}
            </button>
          </motion.div>
        )}

        {/* PAY */}
        {stage === "pay" && payTo && (
          <motion.div key="pay" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-3">
            <div className="rounded-2xl bg-primary/5 border border-primary/30 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Transfer <span className="font-bold text-foreground">{naira(Number(amount))}</span> to</div>
                {countdown && (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="w-3 h-3" />{countdown}
                  </div>
                )}
              </div>

              <button onClick={() => copy(payTo.number, "num")}
                className="w-full rounded-xl bg-white/[0.05] border border-white/10 p-4 flex items-center justify-between hover:bg-white/[0.08] active:scale-[0.98] transition">
                <div className="text-left">
                  <div className="text-xs text-muted-foreground mb-1">Account Number</div>
                  <div className="font-display text-2xl font-bold tracking-wider">{payTo.number}</div>
                </div>
                {copiedField === "num" ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <Copy className="w-6 h-6 text-muted-foreground" />}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bank</div>
                  <div className="text-sm font-semibold">{payTo.bank}</div>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Name</div>
                  <div className="text-sm font-semibold truncate">{payTo.name}</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-400/90 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Transfer <strong>exactly {naira(Number(amount))}</strong> from your saved bank. Different amounts won't match.</span>
            </div>

            <button onClick={iMadePayment}
              className="w-full h-14 rounded-2xl bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 shadow-glow">
              <Send className="w-5 h-5" /> I've Made Payment
            </button>
            <button onClick={resetToAmount} className="w-full text-xs text-muted-foreground">Cancel</button>
          </motion.div>
        )}

        {/* VERIFYING */}
        {stage === "verifying" && (
          <motion.div key="verifying" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl bg-secondary/30 border border-primary/20 p-8 text-center space-y-3">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
            <div className="text-sm font-semibold">Verifying your payment…</div>
            <div className="text-xs text-muted-foreground">
              Checking OPay for your transfer. This usually takes under 2 minutes.
            </div>
          </motion.div>
        )}

        {/* SUCCESS */}
        {stage === "success" && (
          <motion.div key="success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-8 text-center space-y-3">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
            <div className="font-display text-xl font-bold">Deposit Successful!</div>
            <div className="text-2xl font-bold text-emerald-400">{naira(credited || 0)}</div>
            <div className="text-xs text-muted-foreground">Redirecting to history…</div>
          </motion.div>
        )}

        {/* WAITING (soft timeout) */}
        {stage === "waiting" && (
          <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl bg-secondary/30 border border-white/5 p-6 text-center space-y-3">
            <Clock className="w-10 h-10 text-muted-foreground mx-auto" />
            <div className="text-sm font-semibold">Still waiting for OPay's email</div>
            <div className="text-xs text-muted-foreground">
              We'll credit your wallet automatically when it arrives. You can close this and check History shortly.
            </div>
            <button onClick={iMadePayment}
              className="mt-2 mx-auto text-sm text-primary flex items-center gap-1">
              <RefreshCw className="w-4 h-4" /> Check again
            </button>
          </motion.div>
        )}

        {/* EXPIRED */}
        {stage === "expired" && (
          <motion.div key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl bg-destructive/10 border border-destructive/20 p-6 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
            <div className="text-sm font-semibold">Deposit expired</div>
            <div className="text-xs text-muted-foreground">
              This deposit was not verified within 12 hours. Please email your transfer screenshot to
              <span className="text-foreground font-medium"> onojav775@gmail.com</span> and admin will credit you.
            </div>
            <button onClick={resetToAmount}
              className="mt-2 mx-auto text-sm text-primary">Start a new deposit</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}