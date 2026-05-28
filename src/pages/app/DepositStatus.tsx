import { useEffect, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/networks";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, XCircle, RefreshCw, Home } from "lucide-react";

type TxStatus = "pending" | "processing" | "success" | "failed" | "verifying";

export default function DepositStatus() {
  const [params] = useSearchParams();
  const ref = params.get("ref") || sessionStorage.getItem("bp_pending_ref") || "";
  const pendingAmount = Number(sessionStorage.getItem("bp_pending_amount") || 0);
  const [tx, setTx] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<TxStatus>("pending");
  const [dots, setDots] = useState("");
  // FIX: use ref to track latest status inside interval (avoids stale closure)
  const statusRef = useRef<TxStatus>("pending");

  function updateStatus(s: TxStatus, txData?: Record<string, unknown>) {
    setStatus(s);
    statusRef.current = s;
    if (txData) setTx(txData);
    if (s === "success") {
      sessionStorage.removeItem("bp_pending_ref");
      sessionStorage.removeItem("bp_pending_amount");
    }
  }

  // Animate dots
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 500);
    return () => clearInterval(t);
  }, []);

  // Poll + realtime listener
  useEffect(() => {
    if (!ref) return;

    async function check() {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("reference", ref)
        .maybeSingle();
      if (data) {
        updateStatus(data.status as TxStatus, data as Record<string, unknown>);
      }
    }

    check();

    // FIX: check statusRef.current (not stale state variable) to stop polling
    const interval = setInterval(() => {
      if (statusRef.current === "success" || statusRef.current === "failed") {
        clearInterval(interval);
        return;
      }
      check();
    }, 4000);

    // Real-time listener
    const ch = supabase.channel("deposit-status-" + ref)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions" },
        (p) => {
          if (p.new?.reference === ref) {
            updateStatus(p.new.status as TxStatus, p.new as Record<string, unknown>);
          }
        }
      ).subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(ch);
    };
  }, [ref]); // only depends on ref — status changes don't re-create the interval

  const amount = tx?.amount ? Number(tx.amount) : pendingAmount;

  if (status === "success") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-6 pb-10 px-4">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="h-24 w-24 rounded-full bg-green-400/15 border border-green-400/30 grid place-items-center">
          <CheckCircle2 className="h-12 w-12 text-green-400" />
        </motion.div>
        <div>
          <h1 className="font-display text-3xl font-bold text-green-400">Wallet Funded!</h1>
          {amount > 0 && <p className="mt-2 text-muted-foreground">+{naira(amount)} added to your wallet</p>}
        </div>
        <div className="glass rounded-2xl p-5 w-full max-w-sm text-left space-y-2">
          {[
            { label: "Reference", value: ref || String(tx?.reference) },
            { label: "Amount credited", value: naira(amount) },
            { label: "Status", value: "Successful" },
          ].map(r => (
            <div key={r.label} className="flex justify-between text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-semibold">{r.value}</span>
            </div>
          ))}
        </div>
        <Link to="/app" className="w-full max-w-sm">
          <button className="w-full h-14 rounded-2xl bg-gradient-primary text-white font-semibold text-base flex items-center justify-center gap-2">
            <Home className="w-4 h-4" /> Back to Home
          </button>
        </Link>
      </motion.div>
    );
  }

  if (status === "failed") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-6 pb-10 px-4">
        <div className="h-24 w-24 rounded-full bg-red-400/15 border border-red-400/30 grid place-items-center">
          <XCircle className="h-12 w-12 text-red-400" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-red-400">Payment Failed</h1>
          <p className="mt-2 text-muted-foreground text-sm">Your wallet was not charged. Try again.</p>
        </div>
        <Link to="/app/wallet" className="w-full max-w-sm">
          <button className="w-full h-14 rounded-2xl bg-gradient-primary text-white font-semibold text-base flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </Link>
      </motion.div>
    );
  }

  // Pending / processing / verifying
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-6 pb-10 px-4">
      <div className="h-24 w-24 rounded-full bg-primary/15 border border-primary/30 grid place-items-center">
        <Clock className="h-12 w-12 text-primary animate-pulse" />
      </div>
      <div>
        <h1 className="font-display text-3xl font-bold">Verifying Payment{dots}</h1>
        {amount > 0 && <p className="mt-2 text-muted-foreground">{naira(amount)} payment in progress</p>}
        <p className="mt-3 text-xs text-muted-foreground max-w-xs mx-auto">
          Complete the bank transfer on the Korapay page. This screen will update automatically once your payment is confirmed.
        </p>
      </div>
      <Link to="/app" className="text-sm text-muted-foreground underline">Back to Home (payment continues in background)</Link>
    </motion.div>
  );
}
