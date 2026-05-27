import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/hooks/useWallet";
import { naira } from "@/lib/networks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Info, Loader2 } from "lucide-react";

const QUICK = [500, 1000, 2000, 5000, 10000, 20000];
const FEE_PCT = 2;

export default function Wallet() {
  const { balance, refresh } = useWallet();
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);

  const fee       = amount > 0 ? Math.round(amount * (FEE_PCT / 100) * 100) / 100 : 0;
  const netCredit = amount - fee;

  async function initiateFunding() {
    if (amount < 100) return toast.error("Minimum deposit is ₦100");
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const redirectBase = `${window.location.origin}/app/deposit-status`;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/korapay-topup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ amount, redirect_base_url: redirectBase })
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to initialize payment");
      // Store ref for status page
      sessionStorage.setItem("bp_pending_ref", data.reference);
      sessionStorage.setItem("bp_pending_amount", String(amount));
      // Redirect directly to Korapay — no confirmation step
      window.location.href = data.checkout_url;
    } catch (e: unknown) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
    // Note: don't set setBusy(false) on success — page is navigating away
  }

  // Live wallet update after return from Korapay
  useEffect(() => {
    const ch = supabase.channel("wallet-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions" },
        (p) => {
          if (p.new?.type === "wallet_fund" && p.new?.status === "success") {
            refresh();
            toast.success(`Wallet funded! +${naira(p.new.amount)}`);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh]);

  return (
    <div className="space-y-5 pb-10">
      <h1 className="font-display text-2xl font-semibold">Deposit</h1>

      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-primary p-6 shadow-glow">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
        <div className="text-xs uppercase tracking-widest text-white/70">Available balance</div>
        <div className="mt-1 font-display text-4xl font-bold text-white">{naira(balance)}</div>
      </motion.div>

      <div className="space-y-3">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Amount to deposit</div>
        <Input value={amount || ""} onChange={e => setAmount(Math.max(0, Number(e.target.value.replace(/\D/g, ""))))}
          placeholder="₦ 0" inputMode="numeric" className="h-14 rounded-2xl bg-secondary/40 text-lg font-semibold" />
        <div className="grid grid-cols-3 gap-2">
          {QUICK.map(v => (
            <button key={v} onClick={() => setAmount(v)} type="button"
              className={`rounded-xl border p-3 text-sm font-semibold transition ${amount === v ? "border-primary bg-primary/10" : "border-white/10 bg-white/[0.03] hover:bg-white/5"}`}>
              {naira(v)}
            </button>
          ))}
        </div>
      </div>

      {amount >= 100 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-xl border border-white/8 bg-white/[0.03] p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Info className="h-3.5 w-3.5" /><span>Breakdown</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">You transfer</span>
            <span className="font-medium">{naira(amount)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Processing fee ({FEE_PCT}%)</span>
            <span className="text-red-400">-{naira(fee)}</span>
          </div>
          <div className="my-1.5 h-px bg-white/8" />
          <div className="flex justify-between text-sm font-semibold">
            <span>Wallet credited</span>
            <span className="text-green-400">{naira(Math.max(0, netCredit))}</span>
          </div>
        </motion.div>
      )}

      <Button onClick={initiateFunding} disabled={busy || amount < 100}
        className="h-14 w-full rounded-2xl text-base font-semibold">
        {busy
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening payment page...</>
          : `Deposit ${amount >= 100 ? naira(amount) : ""}`}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        You will be taken to Korapay to complete your bank transfer. Your wallet updates instantly once confirmed.
      </p>
    </div>
  );
}
