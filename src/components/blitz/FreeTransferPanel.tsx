import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/networks";
import { toast } from "sonner";
import {
  Loader2, Copy, CheckCircle2, Building2, User, CreditCard,
  ArrowRight, RefreshCw, AlertCircle, ChevronLeft, Wallet,
  Edit3, Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface FreeTransferDeposit {
  deposit_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  expires_at: string;
  pay_to: { number: string; name: string; bank: string };
}

interface FreeTransferProfile {
  ft_bank_name?: string | null;
  ft_account_name?: string | null;
  ft_account_number?: string | null;
}

async function parseJsonResponse<T = any>(res: Response): Promise<{ ok: boolean; data: T }> {
  const raw = await res.text();
  try {
    return { ok: res.ok, data: JSON.parse(raw) as T };
  } catch {
    return { ok: false, data: { error: "Service returned an unexpected response." } as T };
  }
}

export default function FreeTransferPanel() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<FreeTransferProfile>({});

  // Setup state (first-time + edit)
  const [setupBankName, setSetupBankName] = useState("");
  const [setupAccountName, setSetupAccountName] = useState("");
  const [setupAccountNumber, setSetupAccountNumber] = useState("");
  const [savingDefaults, setSavingDefaults] = useState(false);

  // Amount + one-off override state
  const [amount, setAmount] = useState("");
  const [override, setOverride] = useState(false);
  const [overrideBankName, setOverrideBankName] = useState("");
  const [overrideAccountName, setOverrideAccountName] = useState("");
  const [overrideAccountNumber, setOverrideAccountNumber] = useState("");

  // Flow state
  const [step, setStep] = useState<"setup" | "amount" | "pay" | "checking" | "success" | "expired" | "failed">("setup");
  const [deposit, setDeposit] = useState<FreeTransferDeposit | null>(null);
  const [copiedAcct, setCopiedAcct] = useState(false);
  const [copiedName, setCopiedName] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [pollFailures, setPollFailures] = useState(0);

  const pollRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("ft_bank_name, ft_account_name, ft_account_number")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          toast.error("Could not load your saved bank details");
          return;
        }
        const p = data ?? {};
        setProfile(p);
        if (p.ft_bank_name) setSetupBankName(p.ft_bank_name);
        if (p.ft_account_name) setSetupAccountName(p.ft_account_name);
        if (p.ft_account_number) setSetupAccountNumber(p.ft_account_number);
        if (p.ft_bank_name && p.ft_account_name && p.ft_account_number) {
          setStep("amount");
        } else {
          setStep("setup");
        }
      });
  }, [user]);

  const clearAll = useCallback(() => {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    setPollFailures(0);
  }, []);

  useEffect(() => () => clearAll(), [clearAll]);

  async function copyText(text: string, which: "acct" | "name") {
    await navigator.clipboard.writeText(text);
    if (which === "acct") { setCopiedAcct(true); setTimeout(() => setCopiedAcct(false), 2500); }
    else { setCopiedName(true); setTimeout(() => setCopiedName(false), 2500); }
    toast.success("Copied!");
  }

  async function accountNumberIsTaken(accountNumber: string, excludeUserId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("ft_account_number", accountNumber.replace(/\D/g, ""))
      .neq("user_id", excludeUserId)
      .maybeSingle();
    if (error) return false; // fail open on query error; DB constraint is the guard
    return !!data;
  }

  function validateSetup(): string | null {
    if (!setupBankName.trim()) return "Bank name is required";
    if (!setupAccountName.trim()) return "Account name is required";
    const acct = setupAccountNumber.replace(/\D/g, "");
    if (acct.length < 10) return "Account number must be at least 10 digits";
    return null;
  }

  async function handleSaveDefaults() {
    if (!user) return;
    const error = validateSetup();
    if (error) { toast.error(error); return; }

    const acct = setupAccountNumber.replace(/\D/g, "").slice(0, 10);
    const taken = await accountNumberIsTaken(acct, user.id);
    if (taken) { toast.error("This account number is already registered by another user. Use a different account number."); return; }

    setSavingDefaults(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          user_id: user.id,
          ft_bank_name: setupBankName.trim(),
          ft_account_name: setupAccountName.trim().toUpperCase(),
          ft_account_number: acct,
        }, { onConflict: "user_id" });
      if (error) {
        if (error.message.includes("idx_profiles_ft_account_number")) {
          toast.error("This account number is already registered by another user.");
        } else {
          toast.error("Failed to save: " + error.message);
        }
        return;
      }
      setProfile({
        ft_bank_name: setupBankName.trim(),
        ft_account_name: setupAccountName.trim().toUpperCase(),
        ft_account_number: acct,
      });
      toast.success("Default bank saved");
      setStep("amount");
    } finally {
      setSavingDefaults(false);
    }
  }

  function validateAmount(): string | null {
    const amt = Number(amount.replace(/[^0-9.]/g, ""));
    if (!amt || amt < 50) return "Enter a valid amount (minimum ₦50)";
    return null;
  }

  function validateOverride(): string | null {
    if (!override) return null;
    if (!overrideBankName.trim()) return "Bank name is required";
    if (!overrideAccountName.trim()) return "Account name is required";
    const acct = overrideAccountNumber.replace(/\D/g, "");
    if (acct.length < 10) return "Account number must be at least 10 digits";
    return null;
  }

  async function handleCreate() {
    if (!user) return;
    const error = validateAmount() || validateOverride();
    if (error) { toast.error(error); return; }

    const amt = Number(amount.replace(/[^0-9.]/g, ""));
    const bankName = override ? overrideBankName.trim() : (profile.ft_bank_name ?? "");
    const accountName = override ? overrideAccountName.trim().toUpperCase() : (profile.ft_account_name ?? "");
    const accountNumber = override ? overrideAccountNumber.replace(/\D/g, "").slice(0, 10) : (profile.ft_account_number ?? "");

    if (!bankName || !accountName || !accountNumber) {
      toast.error("Your default bank details are incomplete. Please update them.");
      setStep("setup");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");

      const { ok, data } = await parseJsonResponse(await fetch(`${SUPA_URL}/functions/v1/create-free-transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          amount: amt,
          bank_name: bankName,
          account_name: accountName,
          account_number: accountNumber,
        }),
      }));
      if (!ok || data.error) throw new Error(data.error || "Could not create deposit");

      setDeposit({
        deposit_id: data.deposit_id,
        amount: data.amount,
        fee: data.fee,
        net_amount: data.net_amount,
        expires_at: data.expires_at,
        pay_to: data.pay_to,
      });
      setStep("pay");
    } catch (e: any) {
      toast.error(e.message || "Failed to create deposit");
    } finally {
      setSubmitting(false);
    }
  }

  async function checkStatus(depositId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { ok, data } = await parseJsonResponse(await fetch(`${SUPA_URL}/functions/v1/check-free-transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ deposit_id: depositId }),
      }));

      if (!ok || data.error) {
        setPollFailures(prev => {
          const next = prev + 1;
          if (next >= 3) {
            clearAll();
            setStep("failed");
            setStatusMsg("Verification check failed repeatedly. Please try again or contact support.");
          }
          return next;
        });
        return;
      }
      setPollFailures(0);

      if (data.status === "verified") {
        setStep("success");
        setStatusMsg(data.message);
        clearAll();
      } else if (data.status === "expired") {
        setStep("expired");
        setStatusMsg(data.message);
        clearAll();
      } else if (data.status === "failed") {
        setStep("failed");
        setStatusMsg(data.message);
        clearAll();
      } else {
        // 60 ticks × 3s = 3 minutes, then let the user retry
        setPollFailures(prev => {
          const next = prev + 1;
          if (next >= 60) {
            clearAll();
            setStep("pay");
            setStatusMsg("Verification is taking longer than expected. Please tap \"I have made payment\" again in a moment.");
          }
          return next;
        });
        setStatusMsg(data.message || "Verifying…");
      }
    } catch (e: any) {
      setPollFailures(prev => {
        const next = prev + 1;
        if (next >= 3) {
          clearAll();
          setStep("failed");
          setStatusMsg("Verification check failed. Please try again or contact support.");
        }
        return next;
      });
    }
  }

  async function handleTriggerCheck() {
    if (!deposit || !user) return;

    setStep("checking");
    setStatusMsg("Checking for your payment…");
    clearAll();

    try {
      // Subscribe to realtime first so we don't miss the status update.
      const ch = supabase.channel(`free-transfer-${deposit.deposit_id}`)
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `reference=eq.FT-${deposit.deposit_id}`,
        }, (payload) => {
          const tx = payload.new as any;
          if (tx?.status === "success") {
            setStep("success");
            setStatusMsg(`Deposit successful! ${naira(tx.amount)} has been added to your wallet.`);
            clearAll();
          } else if (tx?.status === "failed") {
            setStep("failed");
            setStatusMsg("Verification failed. Please contact support.");
            clearAll();
          }
        })
        .subscribe();
      channelRef.current = ch;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");

      const { ok, data } = await parseJsonResponse(await fetch(`${SUPA_URL}/functions/v1/trigger-email-check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ deposit_id: deposit.deposit_id }),
      }));
      if (!ok || data.error) throw new Error(data.error || "Could not trigger check");

      setStatusMsg(data.message || "Checking for your payment…");
      // Poll every 3 seconds as a fallback.
      pollRef.current = window.setInterval(() => checkStatus(deposit.deposit_id), 3000);
    } catch (e: any) {
      toast.error(e.message || "Failed to check payment");
      setStep("pay");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const feePreview = (() => {
    const amt = Number(amount.replace(/[^0-9.]/g, ""));
    if (!amt) return null;
    const fee = amt >= 500 ? 0 : Math.round(amt * 0.01 * 100) / 100;
    const net = amt - fee;
    return { fee, net };
  })();

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {step === "setup" && (
          <motion.div key="setup" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-4 flex gap-3">
              <Wallet className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-sm text-emerald-100/80">
                Set up the bank account you'll transfer from. Deposits ≥ ₦500 are free; deposits under ₦500 carry a 1% fee.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Bank Name
                </label>
                <input
                  type="text"
                  value={setupBankName}
                  onChange={e => setSetupBankName(e.target.value)}
                  placeholder="e.g. OPay, GTBank"
                  className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 transition"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Account Name
                </label>
                <input
                  type="text"
                  value={setupAccountName}
                  onChange={e => setSetupAccountName(e.target.value.toUpperCase())}
                  placeholder="JOHN DOE"
                  className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 transition"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Account Number
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={setupAccountNumber}
                  onChange={e => setSetupAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit account number"
                  className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 transition font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleSaveDefaults}
              disabled={savingDefaults}
              className="w-full h-12 rounded-xl bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50 shadow-glow"
            >
              {savingDefaults ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              ) : (
                <>Save & Continue <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </motion.div>
        )}

        {step === "amount" && (
          <motion.div key="amount" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-4 flex gap-3">
              <Wallet className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-sm text-emerald-100/80">
                Send money from your saved bank to the BlitzPay OPay account. Deposits ≥ ₦500 are free; deposits under ₦500 carry a 1% fee.
              </p>
            </div>

            <div className="rounded-2xl bg-secondary/20 border border-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Transferring from</div>
                  <div className="text-sm font-semibold truncate">{profile.ft_bank_name} — {profile.ft_account_name}</div>
                  <div className="text-xs font-mono text-muted-foreground">{profile.ft_account_number}</div>
                </div>
                <button onClick={() => setStep("setup")} className="text-xs text-emerald-400 flex items-center gap-1 shrink-0">
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              </div>
              <button onClick={() => setOverride(o => !o)} className="text-xs text-muted-foreground hover:text-foreground underline">
                {override ? "Use my saved bank" : "I'm sending from a different bank"}
              </button>
            </div>

            {override && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Bank Name
                  </label>
                  <input
                    type="text"
                    value={overrideBankName}
                    onChange={e => setOverrideBankName(e.target.value)}
                    placeholder="e.g. OPay, GTBank"
                    className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Account Name
                  </label>
                  <input
                    type="text"
                    value={overrideAccountName}
                    onChange={e => setOverrideAccountName(e.target.value.toUpperCase())}
                    placeholder="JOHN DOE"
                    className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" /> Account Number
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={overrideAccountNumber}
                    onChange={e => setOverrideAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="10-digit account number"
                    className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 transition font-mono"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount (₦)</label>
              <input
                type="number"
                min="50"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="500"
                className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-lg font-semibold placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 transition"
              />
              {feePreview && (
                <div className="text-xs text-muted-foreground mt-1.5">
                  {feePreview.fee > 0
                    ? `1% fee: ${naira(feePreview.fee)} · You'll receive ${naira(feePreview.net)}`
                    : `Free deposit · You'll receive ${naira(feePreview.net)}`}
                </div>
              )}
            </div>

            <button
              onClick={handleCreate}
              disabled={submitting}
              className="w-full h-12 rounded-xl bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50 shadow-glow"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
              ) : (
                <>Continue <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </motion.div>
        )}

        {step === "pay" && deposit && (
          <motion.div key="pay" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-4 flex gap-3">
              <Info className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-sm text-emerald-100/80">
                Make <strong>exact amount</strong> from your <strong>{override ? overrideBankName : profile.ft_bank_name}</strong> bank to this account. Once done, come back and click <strong>I have made payment</strong>.
              </p>
            </div>

            <div className="rounded-2xl bg-secondary/30 border border-emerald-500/20 p-5 space-y-4">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Send exactly</div>
                <div className="text-3xl font-bold text-emerald-400">{naira(deposit.amount)}</div>
                {deposit.fee > 0 ? (
                  <div className="text-xs text-orange-300/80 mt-1">1% fee applies ({naira(deposit.fee)})</div>
                ) : (
                  <div className="text-xs text-emerald-300/80 mt-1">Free deposit</div>
                )}
              </div>

              <div className="space-y-3">
                <div className="rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3">
                  <div className="text-xs text-muted-foreground">Account Number</div>
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-lg font-semibold">{deposit.pay_to.number}</div>
                    <button onClick={() => copyText(deposit.pay_to.number, "acct")}>
                      {copiedAcct ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5 text-muted-foreground" />}
                    </button>
                  </div>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3">
                  <div className="text-xs text-muted-foreground">Account Name</div>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{deposit.pay_to.name}</div>
                    <button onClick={() => copyText(deposit.pay_to.name, "name")}>
                      {copiedName ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5 text-muted-foreground" />}
                    </button>
                  </div>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3">
                  <div className="text-xs text-muted-foreground">Bank</div>
                  <div className="font-semibold">{deposit.pay_to.bank}</div>
                </div>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Expires {new Date(deposit.expires_at).toLocaleString()}
              </p>
            </div>

            <button
              onClick={handleTriggerCheck}
              className="w-full h-12 rounded-xl bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition shadow-glow"
            >
              <RefreshCw className="w-4 h-4" /> I have made payment
            </button>

            <button
              onClick={() => setStep("amount")}
              className="w-full h-10 text-sm text-muted-foreground flex items-center justify-center gap-1 hover:text-foreground transition"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          </motion.div>
        )}

        {step === "checking" && (
          <motion.div key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-2xl bg-secondary/30 border border-white/5 p-8 flex flex-col items-center text-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
            <div className="text-lg font-semibold">Verifying your payment</div>
            <p className="text-sm text-muted-foreground">{statusMsg}</p>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-6 flex flex-col items-center text-center gap-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            <div className="text-lg font-semibold">Deposit received</div>
            <p className="text-sm text-emerald-100/80">{statusMsg}</p>
            <button onClick={() => setStep("amount")} className="mt-2 text-sm text-emerald-400 font-medium hover:underline">
              Make another deposit
            </button>
          </motion.div>
        )}

        {step === "expired" && (
          <motion.div key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-2xl bg-orange-500/10 border border-orange-500/20 p-6 flex flex-col items-center text-center gap-3">
            <AlertCircle className="w-10 h-10 text-orange-400" />
            <div className="text-lg font-semibold">Expired</div>
            <p className="text-sm text-orange-100/80">{statusMsg}</p>
            <button onClick={() => setStep("amount")} className="mt-2 text-sm text-orange-400 font-medium hover:underline">
              Start a new deposit
            </button>
          </motion.div>
        )}

        {step === "failed" && (
          <motion.div key="failed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-2xl bg-destructive/10 border border-destructive/20 p-6 flex flex-col items-center text-center gap-3">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <div className="text-lg font-semibold">Verification failed</div>
            <p className="text-sm text-destructive/80">{statusMsg}</p>
            <button onClick={() => setStep("pay")} className="mt-2 text-sm text-destructive font-medium hover:underline">
              Try again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
