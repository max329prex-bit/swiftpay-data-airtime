import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/hooks/useWallet";
import { naira } from "@/lib/networks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Copy, CheckCircle2, Building2, RefreshCw, Info } from "lucide-react";

interface VirtualAccount {
  account_number: string;
  account_name: string;
  bank_name: string;
  bank_code?: string;
  is_existing?: boolean;
}

export default function Wallet() {
  const { balance, refresh } = useWallet();
  const [va, setVa]           = useState<VirtualAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // ── Fetch / create virtual account ────────────────────────────────────────
  const fetchVA = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payvessel-topup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({})
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Could not get account details");
      setVa(data as VirtualAccount);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      if (!silent) toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load VA on mount
  useEffect(() => { fetchVA(); }, [fetchVA]);

  // ── Real-time wallet update listener ──────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel("wallet-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions" },
        (p) => {
          if (p.new?.type === "wallet_fund" && p.new?.status === "success") {
            refresh();
            toast.success("Wallet funded! Your balance has been updated.");
          }
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" },
        (p) => {
          if (p.new?.type === "wallet_fund" && p.new?.status === "success") {
            refresh();
            toast.success("Deposit received!");
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh]);

  // ── Copy account number ───────────────────────────────────────────────────
  async function copyAccNum() {
    if (!va?.account_number) return;
    await navigator.clipboard.writeText(va.account_number);
    setCopied(true);
    toast.success("Account number copied!");
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="space-y-5 pb-10">
      <h1 className="font-display text-2xl font-semibold">Deposit</h1>

      {/* Balance card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-primary p-6 shadow-glow"
      >
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
        <div className="text-xs uppercase tracking-widest text-white/70">Available balance</div>
        <div className="mt-1 font-display text-4xl font-bold text-white">{naira(balance)}</div>
      </motion.div>

      {/* How it works */}
      <div className="rounded-2xl bg-secondary/20 border border-white/5 p-4 flex gap-3 text-sm text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 text-primary/70 shrink-0" />
        <p>Transfer any amount to your personal wallet account below. Your balance updates automatically within seconds.</p>
      </div>

      {/* Virtual account card */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="rounded-2xl bg-secondary/30 border border-white/5 p-6 flex items-center justify-center gap-3 text-muted-foreground"
          >
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Setting up your deposit account…</span>
          </motion.div>
        )}

        {!loading && error && (
          <motion.div key="error"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl bg-destructive/10 border border-destructive/20 p-5 space-y-3"
          >
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={() => fetchVA()}
              className="flex items-center gap-2 text-sm font-medium text-primary"
            >
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
          </motion.div>
        )}

        {!loading && va && (
          <motion.div key="va"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-secondary/30 border border-primary/20 p-5 space-y-4"
          >
            {/* Bank header */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Deposit to</div>
                <div className="text-sm font-semibold">{va.bank_name || "Wema Bank"}</div>
              </div>
              <div className="ml-auto">
                <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">
                  Active
                </span>
              </div>
            </div>

            {/* Account number — big, tappable */}
            <button
              onClick={copyAccNum}
              className="w-full rounded-xl bg-white/[0.04] border border-white/10 p-4 flex items-center justify-between group hover:bg-white/[0.07] active:scale-[0.98] transition"
            >
              <div className="text-left">
                <div className="text-xs text-muted-foreground mb-1">Account Number</div>
                <div className="font-display text-2xl font-bold tracking-wider text-foreground">
                  {va.account_number}
                </div>
              </div>
              <div className="ml-4 shrink-0">
                {copied ? (
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                ) : (
                  <Copy className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition" />
                )}
              </div>
            </button>

            {/* Account name */}
            <div className="rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3">
              <div className="text-xs text-muted-foreground mb-0.5">Account Name</div>
              <div className="text-sm font-semibold">{va.account_name}</div>
            </div>

            {/* Tap to copy hint */}
            <p className="text-center text-xs text-muted-foreground">
              Tap account number to copy · No minimum, no checkout
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Refresh button */}
      {va && (
        <button
          onClick={() => fetchVA(true)}
          className="w-full h-11 rounded-xl border border-white/10 text-sm text-muted-foreground flex items-center justify-center gap-2 hover:bg-white/5 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh balance
        </button>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Secured by Payvessel · Instant bank transfer
      </p>
    </div>
  );
}
