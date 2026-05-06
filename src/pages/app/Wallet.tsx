import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/hooks/useWallet";
import { naira } from "@/lib/networks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, CreditCard, Plus } from "lucide-react";

const QUICK = [500, 1000, 2000, 5000, 10000, 20000];

export default function Wallet() {
  const { balance, refresh } = useWallet();
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<"transfer" | "card">("transfer");
  const [busy, setBusy] = useState(false);

  async function topup() {
    if (amount < 100) return toast.error("Min ₦100");
    setBusy(true);
    const { error } = await supabase.rpc("topup_wallet", { _amount: amount, _method: method });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Wallet funded with ${naira(amount)}`);
    refresh(); setAmount(0);
  }

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="font-display text-2xl font-semibold">Wallet</h1>
      </div>

      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-primary p-6 shadow-glow">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
        <div className="text-xs uppercase tracking-widest text-white/70">Available balance</div>
        <div className="mt-1 font-display text-4xl font-bold text-white">{naira(balance)}</div>
      </motion.div>

      <div className="space-y-3">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Top-up amount</div>
        <Input value={amount || ""} onChange={e => setAmount(Math.max(0, Number(e.target.value.replace(/\D/g, ""))))} placeholder="₦ 0" inputMode="numeric" className="h-14 rounded-2xl bg-secondary/40 text-lg font-semibold" />
        <div className="grid grid-cols-3 gap-2">
          {QUICK.map(v => (
            <button key={v} onClick={() => setAmount(v)} type="button"
              className={`rounded-xl border p-3 text-sm font-semibold transition ${amount === v ? "border-primary bg-primary/10" : "border-white/10 bg-white/[0.03] hover:bg-white/5"}`}>
              {naira(v)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Pay with</div>
        {[
          { id: "transfer", icon: Building2, label: "Bank transfer", sub: "Free • Instant" },
          { id: "card", icon: CreditCard, label: "Debit card", sub: "1.5% fee" },
        ].map((m: any) => (
          <button key={m.id} onClick={() => setMethod(m.id)} type="button"
            className={`flex w-full items-center justify-between rounded-2xl border p-4 transition ${method === m.id ? "border-primary bg-primary/10" : "border-white/10 bg-white/[0.03]"}`}>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary"><m.icon className="h-4 w-4 text-white" /></span>
              <div className="text-left"><div className="text-sm font-semibold">{m.label}</div><div className="text-[11px] text-muted-foreground">{m.sub}</div></div>
            </div>
            <span className={`h-4 w-4 rounded-full border ${method === m.id ? "border-accent bg-accent" : "border-white/20"}`} />
          </button>
        ))}
      </div>

      <Button variant="hero" size="xl" className="w-full" disabled={busy || !amount} onClick={topup}>
        <Plus /> {busy ? "Processing…" : `Add ${amount ? naira(amount) : "funds"}`}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">Demo mode — funds are credited instantly. Real payment gateway integration available on request.</p>
    </div>
  );
}
