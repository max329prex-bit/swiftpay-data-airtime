import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NetworkPicker } from "@/components/swift/NetworkPicker";
import { DATA_BUNDLES, detectNetwork, naira, NetworkId } from "@/lib/networks";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wifi } from "lucide-react";

export default function Data() {
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState<NetworkId>("MTN");
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { balance, refresh } = useWallet();
  const nav = useNavigate();

  useEffect(() => { const d = detectNetwork(phone); if (d) setNetwork(d); }, [phone]);

  const bundles = DATA_BUNDLES[network];
  const bundle = useMemo(() => bundles.find(b => b.id === picked), [bundles, picked]);

  async function pay() {
    if (phone.replace(/\D/g, "").length < 11) return toast.error("Enter valid phone");
    if (!bundle) return toast.error("Pick a bundle");
    if (bundle.price > balance) return toast.error("Insufficient wallet balance");
    setBusy(true);
    const { data, error } = await supabase.rpc("purchase_vtu", { _type: "data", _network: network, _phone: phone, _amount: bundle.price, _meta: { bundle: bundle.name, size: bundle.size } });
    setBusy(false);
    if (error) return toast.error(error.message);
    refresh();
    nav(`/app/success?ref=${(data as any).reference}&type=data&amount=${bundle.price}&network=${network}&bundle=${encodeURIComponent(bundle.size)}`);
  }

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="font-display text-2xl font-semibold">Buy Data</h1>
        <p className="text-sm text-muted-foreground">Wallet: <span className="text-foreground font-semibold">{naira(balance)}</span></p>
      </div>

      <NetworkPicker value={network} onChange={setNetwork} />

      <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0803 000 0000" inputMode="tel" className="h-14 rounded-2xl bg-secondary/40 text-lg" />

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Bundles</div>
        <div className="grid grid-cols-2 gap-2">
          {bundles.map(b => (
            <button key={b.id} onClick={() => setPicked(b.id)} type="button"
              className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${picked === b.id ? "border-primary bg-primary/10 shadow-glow" : "border-white/10 bg-white/[0.03] hover:bg-white/5"}`}>
              {b.tag && <span className="absolute right-2 top-2 rounded-full bg-gradient-mint px-2 py-0.5 text-[9px] font-bold text-accent-foreground">{b.tag}</span>}
              <Wifi className="h-4 w-4 text-primary" />
              <div className="mt-2 font-display text-lg font-bold">{b.size}</div>
              <div className="text-[11px] text-muted-foreground">{b.validity}</div>
              <div className="mt-2 text-sm font-semibold">{naira(b.price)}</div>
            </button>
          ))}
        </div>
      </div>

      <Button variant="hero" size="xl" className="w-full" disabled={busy || !bundle} onClick={pay}>
        {busy ? "Processing…" : bundle ? `Pay ${naira(bundle.price)}` : "Select a bundle"}
      </Button>
    </div>
  );
}
