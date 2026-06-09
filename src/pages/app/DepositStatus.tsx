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
  const txnStatus = params.get("txn-status") || "";  // Korapay's redirect status
  const pendingAmount = Number(sessionStorage.getItem("bp_pending_amount") || 0);
  const [tx, setTx] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<TxStatus>("pending");
  const [dots, setDots] = useState("");
  const statusRef = useRef<TxStatus>("pending");
  const verifiedRef = useRef(false);  // prevent double-verify

  function updateStatus(s: TxStatus, txData?: Record<string, unknown>) {
    setStatus(s);
    statusRef.current = s;
    if (txData) setTx(txData);
    if (s === "success") {
      sessionStorage.removeItem("bp_pending_ref");
      sessionStorage.removeItem("bp_pending_amount");
    }
  }

  // When Korapay redirects back with txn-status=success, immediately verify + credit
  useEffect(() => {
    if (!ref || !txnStatus || verifiedRef.current) return;
    if (txnStatus !== "success" && txnStatus !== "paid") return;
    verifiedRef.current = true;

    async function verifyNow() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-deposit`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ reference: ref })
          }
        );
        const data = await res.json();
        if (data.success) {
          console.log("[DepositStatus] verify-deposit confirmed credit");
          // Poll will pick it up within 4s — no need to force state here
        }
      } catch (e) {
        console.warn("[DepositStatus] verify-deposit call failed:", e);
      }
    }
    verifyNow();
  }, [ref, txnStatus]);

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

    const interval = setInterval(() => {
      if (statusRef.current === "success" || statusRef.current === "failed") {
        clearInterval(interval);
        return;
      }
      check();
    }, 4000);

    const ch = supabase.channel("deposit-status-" + ref)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" },
        (p) => {
          const row = p.new as Record<string, unknown> | undefined;
          if (row && row.reference === ref) {
            updateStatus(row.status as TxStatus, row);
          }
        }
      ).subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(ch);
    };
  }, [ref]);

  // net_credit is what goes into the wallet (gross = Korapay charge, net = wallet credit)
  const walletCredit = tx?.meta && typeof tx.meta === 'object' && (tx.meta as Record<string, unknown>).net_credit
    ? Number((tx.meta as Record<string, unknown>).net_credit)
    : (tx?.amount ? Number(tx.amount) : pendingAmount);
  const amount = walletCredit;
  // pendingDisplayAmount: always use sessionStorage amount (what the user originally typed).
  // walletCredit can be unreliable if the initial DB insert failed or meta was overwritten.
  const pendingDisplayAmount = pendingAmount > 0 ? pendingAmount : walletCredit;

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
            { label: "Amount credited to wallet", value: naira(amount) },
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-6 pb-10 px-4">
      <div className="h-24 w-24 rounded-full bg-primary/15 border border-primary/30 grid place-items-center">
        <Clock className="h-12 w-12 text-primary animate-pulse" />
      </div>
      <div>
        <h1 className="font-display text-3xl font-bold">Verifying Payment{dots}</h1>
        {pendingDisplayAmount > 0 && <p className="mt-2 text-muted-foreground">{naira(pendingDisplayAmount)} payment in progress</p>}
        <p className="mt-3 text-xs text-muted-foreground max-w-xs mx-auto">
          Complete the bank transfer on the Korapay page. This screen updates automatically once confirmed.
        </p>
      </div>
      <Link to="/app" className="text-sm text-muted-foreground underline">
        Back to Home (payment continues in background)
      </Link>
    </motion.div>
  );
}
