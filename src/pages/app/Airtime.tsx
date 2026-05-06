import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NetworkPicker } from "@/components/swift/NetworkPicker";
import { detectNetwork, naira, NetworkId } from "@/lib/networks";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

const QUICK = [100, 200, 500, 1000, 2000, 5000];

export default function Airtime() {
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState<NetworkId | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const { balance, refresh } = useWallet();
  const nav = useNavigate();

  useEffect(() => { const d = detectNetwork(phone); if (d) setNetwork(d); }, [phone]);
  const cashback = useMemo(() => Math.round(amount * 0.025), [amount]);

  async function pay() {
    if (!network) return toast.error("Pick a network");
    if (phone.replace(/\D/g, "").length < 11) return toast.error("Enter a valid phone");
    if (amount < 50) return toast.error("Min ₦50");
    if (amount > balance) return toast.error("Insufficient wallet balance");
    setBusy(true);
    const { data, error } = await supabase.rpc("purchase_vtu", { _type: "airtime", _network: network, _phone: phone, _amount: amount, _meta: { cashback } });
    setBusy(false);
    if (error) return toast.error(error.message);
    refresh();
    nav(`/app/success?ref=${(data as any).reference}&type=airtime&amount=${amount}&network=${network}`);
  }

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="font-display text-2xl font-semibold">Buy Airtime</h1>
        <p className="text-sm text-muted-foreground">Wallet: <span className="text-foreground font-semibold">{naira(balance)}</span></p>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Network</div>
        <NetworkPicker value={network} onChange={setNetwork} />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Phone number</div>
        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0803 000 0000" inputMode="tel" className="h-14 rounded-2xl bg-secondary/40 text-lg font-medium" />
      </div>

      <div className="space-y-3">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Amount</div>
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

      {amount > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass flex items-center justify-between rounded-2xl p-4">
          <div className="flex items-center gap-2 text-sm"><Sparkles className="h-4 w-4 text-accent" /> Cashback</div>
          <div className="text-sm font-semibold text-accent">+{naira(cashback)}</div>
        </motion.div>
      )}

      <Button variant="hero" size="xl" className="w-full" disabled={busy || !amount} onClick={pay}>
        {busy ? "Processing…" : `Pay ${amount ? naira(amount) : ""}`}
      </Button>
    </div>
  );
}
