import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useWallet } from "@/hooks/useWallet";
import { naira } from "@/lib/networks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Clock, ArrowLeft, RefreshCw } from "lucide-react";

// DepositStatus: PayVessel-only.
// Listens for real-time wallet updates and shows deposit status.
// PayVessel deposits credit automatically via the payvessel-webhook function.

export default function DepositStatus() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { balance, refresh } = useWallet();

  const reference  = params.get("ref") ?? "";
  const [status, setStatus]   = useState<"pending" | "success" | "failed" | "checking">("checking");
  const [amount, setAmount]   = useState<number | null>(null);
  const [checking, setCheck]  = useState(false);

  const checkStatus = useCallback(async () => {
    if (!reference) { setStatus("pending"); return; }
    setCheck(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");

      const { data: tx } = await supabase
        .from("transactions")
        .select("status, amount")
        .eq("reference", reference)
        .maybeSingle();

      if (tx?.status === "success") {
        setStatus("success");
        setAmount(Number(tx.amount));
        refresh();
      } else if (tx?.status === "failed") {
        setStatus("failed");
      } else {
        setStatus("pending");
      }
    } catch {
      setStatus("pending");
    } finally { setCheck(false); }
  }, [reference, refresh]);

  // Poll + real-time update
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 15000); // poll every 15s
    const ch = supabase.channel("deposit-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, (p) => {
        if (p.new?.reference === reference && p.new?.status === "success") {
          setStatus("success");
          setAmount(Number(p.new.amount));
          refresh();
          toast.success("Deposit confirmed!");
        }
      })
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(ch); };
  }, [checkStatus, reference, refresh]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Back */}
        <button onClick={() => navigate("/app/wallet")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} /> Back to Wallet
        </button>

        {/* Status card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border rounded-2xl p-8 text-center space-y-4"
        >
          {status === "checking" || checking ? (
            <>
              <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin" />
              <h2 className="text-lg font-semibold">Checking deposit…</h2>
              <p className="text-sm text-muted-foreground">Please wait.</p>
            </>
          ) : status === "success" ? (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
              <h2 className="text-lg font-semibold text-green-500">Deposit confirmed!</h2>
              {amount && <p className="text-2xl font-bold">{naira(amount)}</p>}
              <p className="text-sm text-muted-foreground">Your wallet has been credited.</p>
              <p className="text-sm font-medium">New balance: {naira(balance)}</p>
              <button onClick={() => navigate("/app")}
                className="w-full mt-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold">
                Go to Dashboard
              </button>
            </>
          ) : status === "failed" ? (
            <>
              <XCircle className="mx-auto h-12 w-12 text-destructive" />
              <h2 className="text-lg font-semibold text-destructive">Deposit failed</h2>
              <p className="text-sm text-muted-foreground">The deposit could not be processed. Contact support if money was deducted.</p>
              <button onClick={() => navigate("/app/wallet")}
                className="w-full mt-2 py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold">
                Back to Wallet
              </button>
            </>
          ) : (
            <>
              <Clock className="mx-auto h-12 w-12 text-amber-500" />
              <h2 className="text-lg font-semibold">Waiting for deposit</h2>
              <p className="text-sm text-muted-foreground">
                {reference
                  ? "Transfer money to your PayVessel virtual account. This page updates automatically."
                  : "Make a bank transfer to your permanent virtual account number to fund your wallet."}
              </p>
              <p className="text-xs text-muted-foreground">Deposits typically reflect within 1–5 minutes.</p>
              <button onClick={checkStatus} disabled={checking}
                className="flex items-center gap-2 mx-auto text-sm text-primary hover:underline">
                <RefreshCw size={14} className={checking ? "animate-spin" : ""} />
                Check again
              </button>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
