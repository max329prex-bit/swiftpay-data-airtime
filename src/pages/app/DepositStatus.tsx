import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/networks";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, XCircle, RefreshCw, Home, Receipt } from "lucide-react";

type TxStatus = "pending" | "processing" | "success" | "failed" | "verifying";

export default function DepositStatus() {
  const [params] = useSearchParams();
  const ref = params.get("ref") || sessionStorage.getItem("bp_pending_ref") || "";
  const pendingAmount = Number(sessionStorage.getItem("bp_pending_amount") || 0);
  const nav = useNavigate();
  const [tx, setTx] = useState<any>(null);
  const [status, setStatus] = useState<TxStatus>("pending");
  const [dots, setDots] = useState("");

  // Animate dots
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 500);
    return () => clearInterval(t);
  }, []);

  // Poll transaction status
  useEffect(() => {
    if (!ref) return;

    async function check() {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("reference", ref)
        .maybeSingle();
      if (data) {
        setTx(data);
        setStatus(data.status as TxStatus);
        if (data.status === "success") {
          sessionStorage.removeItem("bp_pending_ref");
          sessionStorage.removeItem("bp_pending_amount");
        }
      }
    }

    check();
    // Poll every 4 seconds while pending
    const interval = setInterval(() => {
      if (status === "success" || status === "failed") {
        clearInterval(interval);
        return;
      }
      check();
    }, 4000);

    // Real-time listener
    const ch = supabase.channel("deposit-status")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions" },
        (p) => {
          if (p.new?.reference === ref) {
            setTx(p.new);
            setStatus(p.new.status as TxStatus);
            if (p.new.status === "success") {
              sessionStorage.removeItem("bp_pending_ref");
              sessionStorage.removeItem("bp_pending_amount");
            }
          }
        }
      ).subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(ch);
    };
  }, [ref, status]);

  const amount = tx?.amount || pendingAmount;

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
            { label: "Reference", value: ref || tx?.reference },
            { label: "Amount", value: naira(amount) },
            { label: "Status", value: "Successful" },
          ].map(r => (
            <div key={r.label} className="flex justify-between text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-semibold">{r.value}</span>
            </div>
          ))}
        </div>
        <Link to="/app" className="w-full max-w-sm">
          <button className="w-full h-14 rounded-2xl bg-gradient-primary text-white font-semibold text-base shadow-glow flex items-center justify-center gap-2">
            <Home className="h-4 w-4" /> Back to Home
          </button>
        </Link>
      </motion.div>
    );
  }

  if (status === "failed") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-6 pb-10 px-4">
        <div className="h-24 w-24 rounded-full bg-destructive/10 border border-destructive/30 grid place-items-center">
          <XCircle className="h-12 w-12 text-destructive" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-destructive">Deposit Failed</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs">
            {tx?.failure_reason || "The deposit could not be processed. If you made a transfer, it will be reversed within 24 hours."}
          </p>
        </div>
        <div className="flex gap-3 w-full max-w-sm">
          <button onClick={() => nav("/app/wallet")}
            className="flex-1 h-12 rounded-2xl bg-gradient-primary text-white font-semibold">
            Try Again
          </button>
          <Link to="/app/support" state={{ txRef: ref }}
            className="flex-1 h-12 rounded-2xl glass border border-white/10 font-semibold flex items-center justify-center text-sm">
            Contact Support
          </Link>
        </div>
      </motion.div>
    );
  }

  // Pending / processing / verifying
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-6 pb-10 px-4">
      <div className="relative h-24 w-24">
        <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
        <div className="h-24 w-24 rounded-full bg-primary/10 border border-primary/30 grid place-items-center">
          <Clock className="h-10 w-10 text-primary" />
        </div>
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold">Waiting for Payment</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {amount > 0 ? `Checking ${naira(amount)} deposit` : "Checking your deposit"}{dots}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">This page updates automatically once your transfer is confirmed</p>
      </div>
      {ref && (
        <div className="glass rounded-xl px-5 py-3 text-xs font-mono text-muted-foreground max-w-sm w-full text-center truncate">
          Ref: {ref}
        </div>
      )}
      <div className="flex gap-3 w-full max-w-sm">
        <button onClick={() => nav("/app")} className="flex-1 h-12 rounded-2xl glass border border-white/10 font-semibold text-sm flex items-center justify-center gap-2">
          <Home className="h-4 w-4" /> Go Home
        </button>
        <Link to={`/app/transaction/${tx?.id || ""}`}
          className="flex-1 h-12 rounded-2xl glass border border-white/10 font-semibold text-sm flex items-center justify-center gap-2">
          <Receipt className="h-4 w-4" /> View Transaction
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        Made a transfer but waiting? Bank transfers typically confirm within 1-5 minutes.
      </p>
    </motion.div>
  );
}
