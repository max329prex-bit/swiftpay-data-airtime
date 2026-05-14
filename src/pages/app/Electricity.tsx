import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ELECTRICITY_PROVIDERS, naira } from "@/lib/networks";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, X, ChevronDown, Zap, Clock } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const QUICK_AMOUNTS = [1000, 2000, 3000, 5000, 10000, 20000];
type Step = "form" | "pin";

// AidaPay electricity is temporarily unavailable – flip this to true when live
const ELECTRICITY_LIVE = false;

export default function Electricity() {
  const [provider, setProvider] = useState(ELECTRICITY_PROVIDERS[0]);
  const [showProviders, setShowProviders] = useState(false);
  const [meter, setMeter] = useState("");
  const [meterType, setMeterType] = useState<"prepaid" | "postpaid">("prepaid");
  const [customerName, setCustomerName] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [amount, setAmount] = useState(0);
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [busy, setBusy] = useState(false);
  const { balance, refresh } = useWallet();
  const nav = useNavigate();

  if (!ELECTRICITY_LIVE) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20"
        >
          <Clock className="h-9 w-9 text-amber-400" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="font-display text-2xl font-bold mb-2">Electricity Payment</div>
          <div className="font-display text-base font-semibold text-amber-400 mb-2">Coming Soon</div>
          <p className="text-sm text-muted-foreground max-w-xs">
            We are activating electricity payments for all DISCOs. Check back shortly — it will be ready very soon!
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-4 text-xs text-muted-foreground max-w-xs"
        >
          Airtime and data purchases are available right now. 💡
        </motion.div>
        <Button variant="hero" onClick={() => nav("/app")} className="mt-2">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  async function verifyMeter() {
    if (meter.length < 10) return toast.error("Enter valid meter number");
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("vtu-purchase", {
        body: { type: "electricity_verify", provider: provider.code, meter_number: meter, meter_type: meterType }
      });
      if (error) throw error;
      if (data?.customer_name) {
        setCustomerName(data.customer_name);
        setVerified(true);
        toast.success("Meter verified!");
      } else {
        throw new Error(data?.error || "Could not verify meter");
      }
    } catch (e: any) {
      toast.error(e.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  async function pay() {
    if (pin.length < 4) return toast.error("Enter 4-digit PIN");
    if (amount < 1000) return toast.error("Min ₦1,000");
    if (amount > balance) return toast.error("Insufficient balance");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("vtu-purchase", {
        body: { type: "electricity", provider: provider.code, meter, meter_type: meterType, amount, pin }
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Payment failed");
      refresh();
      nav(`/app/success?ref=${data.reference}&type=electricity&amount=${amount}&network=${provider.name}`);
    } catch (e: any) {
      toast.error(e.message || "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => nav("/app")} className="grid h-9 w-9 place-items-center rounded-full glass">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="font-display text-xl font-semibold">Electricity</h1>
      </div>
      <div className="flex items-center justify-between rounded-2xl glass p-4">
        <div>
          <div className="text-xs text-muted-foreground">Balance</div>
          <div className="font-display text-lg font-bold">{naira(balance)}</div>
        </div>
        <Button size="sm" variant="hero" onClick={() => nav("/app/wallet")} className="rounded-xl">+ Deposit</Button>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Provider</div>
        <button onClick={() => setShowProviders(!showProviders)}
          className="glass flex w-full items-center justify-between rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary"><Zap className="h-4 w-4 text-white" /></span>
            <span className="font-semibold text-sm">{provider.name}</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showProviders ? "rotate-180" : ""}`} />
        </button>
        {showProviders && (
          <div className="glass rounded-2xl overflow-hidden">
            {ELECTRICITY_PROVIDERS.map(p => (
              <button key={p.code} onClick={() => { setProvider(p); setShowProviders(false); setVerified(false); setCustomerName(""); }}
                className="flex w-full items-center gap-3 p-4 hover:bg-white/5 text-left">
                <span className="font-medium text-sm">{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        {(["prepaid", "postpaid"] as const).map(t => (
          <button key={t} onClick={() => { setMeterType(t); setVerified(false); setCustomerName(""); }}
            className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${meterType === t ? "bg-primary text-white" : "glass text-muted-foreground"}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Meter Number</div>
        <div className="flex gap-2">
          <Input value={meter} onChange={e => setMeter(e.target.value)} placeholder="Enter meter number" inputMode="numeric"
            className="h-14 rounded-2xl bg-secondary/40 text-base flex-1" />
          <Button onClick={verifyMeter} disabled={verifying || meter.length < 10} variant="hero"
            className="h-14 rounded-2xl px-5">
            {verifying ? "…" : "Verify"}
          </Button>
        </div>
        {verified && customerName && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-sm text-green-400 px-1">
            <CheckCircle2 className="h-4 w-4" /> {customerName}
          </motion.div>
        )}
      </div>
      {verified && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Amount</div>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_AMOUNTS.map(a => (
              <button key={a} onClick={() => setAmount(a)}
                className={`rounded-2xl py-3 text-sm font-semibold transition ${amount === a ? "bg-primary/10 border border-primary text-primary shadow-glow" : "glass hover:bg-white/5"}`}>
                {naira(a)}
              </button>
            ))}
          </div>
          <Input value={amount || ""} onChange={e => setAmount(Number(e.target.value))}
            placeholder="Or enter custom amount" inputMode="numeric" type="number"
            className="h-12 rounded-2xl bg-secondary/40 text-base" />
          <Button variant="hero" size="xl" className="w-full" disabled={amount < 1000 || amount > balance}
            onClick={() => setStep("pin")}>
            Proceed to Pay {amount >= 1000 ? naira(amount) : ""}
          </Button>
        </motion.div>
      )}
      <AnimatePresence>
        {step === "pin" && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60" onClick={() => setStep("form")} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-[#13171f] border-t border-white/10 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-lg font-bold">Authorization</h2>
                <button onClick={() => setStep("form")} className="grid h-8 w-8 place-items-center rounded-full glass"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3 mb-6">
                {[
                  { label: "Service", value: `${provider.name} (${meterType})` },
                  { label: "Meter", value: meter },
                  { label: "Customer", value: customerName },
                  { label: "Amount", value: naira(amount), bold: true },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-sm border-b border-white/5 pb-2">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className={row.bold ? "text-accent font-bold" : "font-semibold"}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-4 text-center">
                <div className="text-sm font-semibold">Enter Transaction PIN</div>
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
                <Button variant="hero" size="xl" className="w-full mt-4" disabled={pin.length < 4 || busy} onClick={pay}>
                  {busy ? "Processing..." : "Confirm Payment"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
