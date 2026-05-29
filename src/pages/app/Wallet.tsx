import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/hooks/useWallet";
import { naira } from "@/lib/networks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Info, ArrowRight } from "lucide-react";

const QUICK = [500, 1000, 2000, 5000, 10000, 20000];
const FEE_PCT = 2;

export default function Wallet() {
  const { balance, refresh } = useWallet();
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);

  // Fee model: always ceil to whole naira (prevents bank transfer decimal issues)
  const grossAmount = amount > 0 ? Math.ceil(amount * (1 + FEE_PCT / 100)) : 0;
  const fee         = amount > 0 ? grossAmount - amount : 0;

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
      sessionStorage.setItem("bp_pending_ref", data.reference);
      sessionStorage.setItem("bp_pending_amount", String(amount));  // wallet credit amount
      window.location.href = data.checkout_url;
    } catch (e: unknown) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  // Live wallet update on return from Korapay
  useEffect(() => {
    const ch = supabase.channel("wallet-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions" },
        (p) => {
          if (p.new?.type === "wallet_fund" && p.new?.status === "success") {
            refresh();
            toast.success(`Wallet funded!`);
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
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Amount to add to wallet</div>
        <Input
          value={amount || ""}
          onChange={e => setAmount(Math.max(0, Number(e.target.value.replace(/\D/g, ""))))}
          placeholder="₦ 0" inputMode="numeric"
          className="h-14 rounded-2xl bg-secondary/40 text-lg font-semibold"
        />
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
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-secondary/30 border border-white/5 p-4 space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Wallet credit</span>
            <span className="font-semibold text-foreground">{naira(amount)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              Processing fee (2%)
              <Info className="w-3 h-3" />
            </span>
            <span>+{naira(fee)}</span>
          </div>
          <div className="border-t border-white/10 pt-2 flex justify-between font-semibold">
            <span>You pay on checkout</span>
            <span className="text-primary">{naira(grossAmount)}</span>
          </div>
        </motion.div>
      )}

      <button
        onClick={initiateFunding}
        disabled={busy || amount < 100}
        className="w-full h-14 rounded-2xl bg-gradient-primary text-white font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.98]"
      >
        {busy ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            {amount >= 100 ? `Pay ${naira(grossAmount)} → Fund Wallet` : "Enter amount to continue"}
            {amount >= 100 && <ArrowRight className="w-4 h-4" />}
          </>
        )}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Secured by Korapay · Bank transfer payment
      </p>
    </div>
  );
}
