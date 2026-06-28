import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CABLE_PROVIDERS, CABLE_PACKAGES, naira } from "@/lib/networks";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, X, Tv } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const CABLE_COLORS: Record<string, string> = {
  dstv: "bg-blue-700",
  gotv: "bg-orange-600",
  startimes: "bg-red-700",
};

export default function Cable() {
  const [provider, setProvider] = useState(CABLE_PROVIDERS[0]);
  const [smartcard, setSmartcard] = useState("");
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [customer, setCustomer] = useState("");
  const [pkg, setPkg] = useState<typeof CABLE_PACKAGES[string][number] | null>(null);
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"form" | "pin">("form");
  const [busy, setBusy] = useState(false);
  const { balance, refresh } = useWallet();
  const nav = useNavigate();

  const packages = CABLE_PACKAGES[provider.id] ?? [];

  async function verify() {
    if (smartcard.length < 8) return toast.error("Enter valid smartcard / IUC number");
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("vtu-purchase", {
        body: { type: "cable_verify", phone: smartcard, provider: provider.aidapay_code },
      });
      if (error) throw error;
      if (data?.customer_name) {
        setCustomer(data.customer_name);
        setVerified(true);
        toast.success("Smartcard verified!");
      } else {
        throw new Error(data?.error || "Could not verify smartcard");
      }
    } catch (e: any) {
      toast.error(e.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  async function pay() {
    if (!pkg) return;
    if (pin.length < 4) return toast.error("Enter 4-digit PIN");
    if (pkg.price > balance) return toast.error("Insufficient balance");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("vtu-purchase", {
        body: { type: "cable", network: provider.aidapay_code, phone: smartcard, amount: pkg.price, pin, package_code: pkg.aidapay_code, provider_code: provider.aidapay_code },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Purchase failed");
      refresh();
      const receiptId = data?.id || data?.reference;
      nav(`/app/receipt/${receiptId}`);
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => nav("/app")} className="grid h-9 w-9 place-items-center rounded-full glass"><ArrowLeft className="h-4 w-4" /></button>
        <h1 className="font-display text-xl font-semibold">Cable TV</h1>
        <div className="ml-auto h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center"><Tv className="h-5 w-5 text-primary" /></div>
      </div>

      <div className="flex items-center justify-between rounded-2xl glass p-4">
        <div><div className="text-xs text-muted-foreground">Balance</div><div className="font-display text-lg font-bold">{naira(balance)}</div></div>
        <Button size="sm" variant="hero" onClick={() => nav("/app/wallet")} className="rounded-xl">+ Deposit</Button>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Provider</div>
        <div className="grid grid-cols-4 gap-2">
          {CABLE_PROVIDERS.map(p => {
            const active = provider.id === p.id;
            return (
              <button key={p.id} type="button" onClick={() => { setProvider(p); setPkg(null); }}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition-all ${active ? "border-primary bg-primary/10 shadow-glow" : "border-white/10 bg-white/[0.03]"}`}>
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${CABLE_COLORS[p.id] ?? "bg-slate-600"} text-white text-[10px] font-bold`}>{p.id.slice(0, 3)}</span>
                <span className="text-[10px] font-medium">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Smartcard / IUC Number</div>
        <div className="flex gap-2">
          <Input value={smartcard} onChange={e => { setSmartcard(e.target.value); setVerified(false); }} placeholder="Enter smartcard number" inputMode="numeric" className="h-14 rounded-2xl bg-secondary/40 text-base flex-1" />
          <button onClick={verify} disabled={verifying} className={`h-14 px-4 rounded-2xl text-sm font-semibold flex-shrink-0 ${verified ? "bg-green-500/20 text-green-400" : "bg-primary/20 text-primary"}`}>
            {verifying ? "..." : verified ? "OK" : "Verify"}
          </button>
        </div>
        {verified && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-sm text-green-400"><CheckCircle2 className="h-4 w-4" /> {customer}</motion.div>}
      </div>

      {verified && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Choose Package</div>
          <div className="space-y-2">
            {packages.map(p => {
              const active = pkg?.id === p.id;
              return (
                <button key={p.id} type="button" onClick={() => setPkg(p)}
                  className={`flex w-full items-center justify-between rounded-2xl border p-4 transition ${active ? "border-primary bg-primary/10" : "border-white/10 bg-white/[0.03]"}`}>
                  <span className="text-sm font-semibold">{p.name}</span>
                  <span className="font-display text-sm font-bold">{naira(p.price)}</span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      <Button variant="hero" size="xl" className="w-full" disabled={!verified || !pkg} onClick={() => setStep("pin")}>Proceed</Button>

      <AnimatePresence>
        {step === "pin" && pkg && <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60" onClick={() => setStep("form")} />
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-[#13171f] border-t border-white/10 p-6">
            <div className="flex items-center justify-between mb-6"><h2 className="font-display text-lg font-bold">Authorize Payment</h2><button onClick={() => setStep("form")} className="grid h-8 w-8 place-items-center rounded-full glass"><X className="h-4 w-4" /></button></div>
            <div className="space-y-3 mb-6">
              {[
                { label: "Product", value: `${provider.name} • ${pkg.name}` },
                { label: "Smartcard", value: smartcard, accent: true },
                { label: "Customer", value: customer },
                { label: "Amount", value: naira(pkg.price), bold: true },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-sm border-b border-white/5 pb-2">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className={row.accent ? "text-primary font-semibold" : row.bold ? "text-accent font-bold" : "font-semibold"}>{row.value}</span>
                </div>
              ))}
            </div>
            <div className="space-y-4 text-center">
              <div className="text-sm font-semibold">Enter 4-digit PIN</div>
              <div className="flex justify-center">
                <InputOTP maxLength={4} value={pin} onChange={setPin}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="h-14 w-14 text-xl rounded-2xl" />
                    <InputOTPSlot index={1} className="h-14 w-14 text-xl rounded-2xl" />
                    <InputOTPSlot index={2} className="h-14 w-14 text-xl rounded-2xl" />
                    <InputOTPSlot index={3} className="h-14 w-14 text-xl rounded-2xl" />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button variant="hero" size="xl" className="w-full mt-4" disabled={pin.length < 4 || busy} onClick={pay}>{busy ? "Processing..." : "Pay"}</Button>
            </div>
          </motion.div>
        </>}
      </AnimatePresence>
    </div>
  );
}