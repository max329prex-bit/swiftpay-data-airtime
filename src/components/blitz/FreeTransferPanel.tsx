import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/networks";
import { toast } from "sonner";
import {
  Gift, Loader2, Copy, CheckCircle2, Building2, User, CreditCard,
  ArrowRight, RefreshCw, AlertCircle, ChevronLeft, Wallet,
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

export default function FreeTransferPanel() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<FreeTransferProfile>({});

  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  const [step, setStep] = useState<"form" | "pay" | "checking" | "success" | "expired" | "failed">("form");
  const [deposit, setDeposit] = useState<FreeTransferDeposit | null>(null);
  const [copiedAcct, setCopiedAcct] = useState(false);
  const [copiedName, setCopiedName] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const pollRef = useRef<number | null>(null);

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
        setProfile(data ?? {});
        if (data?.ft_bank_name) setBankName(data.ft_bank_name);
        if (data?.ft_account_name) setAccountName(data.ft_account_name);
        if (data?.ft_account_number) setAccountNumber(data.ft_account_number);
      });
  }, [user]);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => clearPoll(), [clearPoll]);

  async function copyText(text: string, which: "acct" | "name") {
    await navigator.clipboard.writeText(text);
    if (which === "acct") {
      setCopiedAcct(true);
      setTimeout(() => setCopiedAcct(false), 2500);
    } else {
      setCopiedName(true);
      setTimeout(() => setCopiedName(false), 2500);
    }
    toast.success("Copied!");
  }

  async function handleCreate() {
    const amt = Number(amount.replace(/[^0-9.]/g, ""));
    if (!amt || amt < 50) {
      toast.error("Enter a valid amount (minimum ₦50)");
      return;
    }
    if (!bankName.trim() || !accountName.trim() || !accountNumber.replace(/\D/g, "").trim()) {
      toast.error("Bank name, account name, and account number are required");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");

      const res = await fetch(`${SUPA_URL}/functions/v1/create-free-transfer`, {
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
      });
      const raw = await res.text();
      const data = JSON.parse(raw);
      if (!res.ok || data.error) throw new Error(data.error || "Could not create deposit");

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
      const res = await fetch(`${SUPA_URL}/functions/v1/check-free-transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ deposit_id: depositId }),
      });
      const raw = await res.text();
      const data = JSON.parse(raw);
      if (data.status === "verified") {
        setStep("success");
        setStatusMsg(data.message);
        clearPoll();
      } else if (data.status === "expired") {
        setStep("expired");
        setStatusMsg(data.message);
        clearPoll();
      } else if (data.status === "failed") {
        setStep("failed");
        setStatusMsg(data.message);
        clearPoll();
      } else {
        setStatusMsg(data.message || "Verifying…");
      }
    } catch {
      // ignore poll errors
    }
  }

  async function handleTriggerCheck() {
    if (!deposit) return;
    setStep("checking");
    setStatusMsg("Checking for your payment…");
    clearPoll();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const res = await fetch(`${SUPA_URL}/functions/v1/trigger-email-check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ deposit_id: deposit.deposit_id }),
      });
      const raw = await res.text();
      const data = JSON.parse(raw);
      if (!res.ok || data.error) throw new Error(data.error || "Could not trigger check");

      setStatusMsg(data.message || "Checking for your payment…");
      pollRef.current = window.setInterval(() => checkStatus(deposit.deposit_id), 5000);
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

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {step === "form" && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-4 flex gap-3">
              <Wallet className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-sm text-emerald-100/80">
                Send money to the BlitzPay OPay account from your saved bank. Deposits ≥ ₦500 are free; deposits under ₦500 carry a 1% fee.
              </p>
            </div>

            <div className="space-y-3">
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
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Bank Name
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
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
                  value={accountName}
                  onChange={e => setAccountName(e.target.value.toUpperCase())}
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
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="10-digit account number"
                  className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/50 transition font-mono"
                />
              </div>
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
          <motion.div
            key="pay"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="rounded-2xl bg-secondary/30 border border-emerald-500/20 p-5 space-y-4">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Send exactly</div>
                <div className="text-3xl font-bold text-emerald-400">{naira(deposit.amount)}</div>
                {deposit.fee > 0 && (
                  <div className="text-xs text-orange-300/80 mt-1">1% fee applies (₦{deposit.fee.toFixed(2)})</div>
                )}
              </div>

              <div className="space-y-3">
                <div className="rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3">
                  <div className="text-xs text-muted-foreground">Account Number</div>
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-lg font-semibold">{deposit.pay_to.number}</div>
                    <button onClick={() => copyText(deposit.pay_to.number, "acct")}>
                      {copiedAcct ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Copy className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3">
                  <div className="text-xs text-muted-foreground">Account Name</div>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{deposit.pay_to.name}</div>
                    <button onClick={() => copyText(deposit.pay_to.name, "name")}>
                      {copiedName ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Copy className="w-5 h-5 text-muted-foreground" />
                      )}
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
              onClick={() => setStep("form")}
              className="w-full h-10 text-sm text-muted-foreground flex items-center justify-center gap-1 hover:text-foreground transition"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          </motion.div>
        )}

        {step === "checking" && (
          <motion.div
            key="checking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl bg-secondary/30 border border-white/5 p-8 flex flex-col items-center text-center gap-4"
          >
            <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
            <div className="text-lg font-semibold">Verifying your payment</div>
            <p className="text-sm text-muted-foreground">{statusMsg}</p>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-6 flex flex-col items-center text-center gap-3"
          >
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            <div className="text-lg font-semibold">Deposit received</div>
            <p className="text-sm text-emerald-100/80">{statusMsg}</p>
            <button
              onClick={() => setStep("form")}
              className="mt-2 text-sm text-emerald-400 font-medium hover:underline"
            >
              Make another deposit
            </button>
          </motion.div>
        )}

        {step === "expired" && (
          <motion.div
            key="expired"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl bg-orange-500/10 border border-orange-500/20 p-6 flex flex-col items-center text-center gap-3"
          >
            <AlertCircle className="w-10 h-10 text-orange-400" />
            <div className="text-lg font-semibold">Expired</div>
            <p className="text-sm text-orange-100/80">{statusMsg}</p>
            <button
              onClick={() => setStep("form")}
              className="mt-2 text-sm text-orange-400 font-medium hover:underline"
            >
              Start a new deposit
            </button>
          </motion.div>
        )}

        {step === "failed" && (
          <motion.div
            key="failed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl bg-destructive/10 border border-destructive/20 p-6 flex flex-col items-center text-center gap-3"
          >
            <AlertCircle className="w-10 h-10 text-destructive" />
            <div className="text-lg font-semibold">Verification failed</div>
            <p className="text-sm text-destructive/80">{statusMsg}</p>
            <button
              onClick={() => setStep("form")}
              className="mt-2 text-sm text-destructive font-medium hover:underline"
            >
              Try again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
