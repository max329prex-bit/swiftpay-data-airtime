import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { naira } from "@/lib/networks";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, X, ChevronDown, Zap, Clock, Loader2, AlertTriangle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const QUICK_AMOUNTS = [1000, 2000, 3000, 5000, 10000, 20000];
type Step = "form" | "pin";

interface ElectricityProvider { name: string; code: string; }

/** Extract a human-readable error from Supabase FunctionsHttpError or any thrown error */
async function extractError(e: unknown, fallback = "Service temporarily unavailable. Please try again."): Promise<string> {
  if (!e) return fallback;
  try {
    const body = await (e as any).context?.json?.().catch(() => null);
    if (body?.error) return body.error;
    if (body?.message) return body.message;
  } catch {}
  return (e as any).message || fallback;
}

// Fallback providers if API fails
const FALLBACK_PROVIDERS: ElectricityProvider[] = [
  { name: "Ikeja Electric (IKEDC)", code: "ikedc-prepaid" },
  { name: "Eko Electricity (EKEDC)", code: "ekedc-prepaid" },
  { name: "Abuja Electricity (AEDC)", code: "aedc-prepaid" },
  { name: "Port Harcourt Electric (PHEDC)", code: "phedc-prepaid" },
  { name: "Enugu Electricity (EEDC)", code: "eedc-prepaid" },
  { name: "Benin Electricity (BEDC)", code: "bedc-prepaid" },
  { name: "Ibadan Electricity (IBEDC)", code: "ibedc-prepaid" },
  { name: "Kaduna Electricity (KAEDCO)", code: "kaedco-prepaid" },
  { name: "Kano Electricity (KEDCO)", code: "kedco-prepaid" },
  { name: "Jos Electricity (JEDC)", code: "jos-prepaid" },
  { name: "Yola Electricity (YEDC)", code: "yedc-prepaid" },
];

export default function Electricity() {
  const [providers, setProviders] = useState<ElectricityProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [provider, setProvider] = useState<ElectricityProvider | null>(null);
  const [showProviders, setShowProviders] = useState(false);
  const [meter, setMeter] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifySkipped, setVerifySkipped] = useState(false);
  const [amount, setAmount] = useState(0);
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [busy, setBusy] = useState(false);
  const { balance, refresh } = useWallet();
  const nav = useNavigate();

  // Load actual provider codes from AidaPay
  useEffect(() => {
    supabase.functions.invoke("get-electricity-providers")
      .then(({ data, error }) => {
        if (!error && data?.success && Array.isArray(data.providers) && data.providers.length > 0) {
          setProviders(data.providers);
          setProvider(data.providers[0]);
        } else {
          // Fallback to hardcoded list
          setProviders(FALLBACK_PROVIDERS);
          setProvider(FALLBACK_PROVIDERS[0]);
        }
      })
      .catch(() => {
        setProviders(FALLBACK_PROVIDERS);
        setProvider(FALLBACK_PROVIDERS[0]);
      })
      .finally(() => setLoadingProviders(false));
  }, []);

  async function verifyMeter() {
    if (!provider) return;
    if (meter.length < 10) return toast.error("Enter valid meter number");
    setVerifying(true);
    try {
      // Pass provider code as-is (already includes meter type from AidaPay)
      const { data, error } = await supabase.functions.invoke("vtu-purchase", {
        body: { type: "electricity_verify", provider_code: provider.code, meter_number: meter }
      });
      if (error) {
        const msg = await extractError(error, "Meter verification failed — please try again");
        throw new Error(msg);
      }
      if (data?.customer_name) {
        setCustomerName(data.customer_name);
        setVerified(true);
        toast.success("Meter verified!");
      } else {
        throw new Error(data?.error || data?.message || "Could not verify meter — check the number and try again");
      }
    } catch (e: any) {
      toast.error(e.message || "Verification failed");
      // Allow user to skip verification and proceed at their own risk
      setVerifySkipped(true);
    } finally {
      setVerifying(false);
    }
  }

  async function pay() {
    if (!provider) return;
    if (pin.length < 4) return toast.error("Enter 4-digit PIN");
    if (amount < 1000) return toast.error("Min \u20a61,000");
    if (amount > balance) return toast.error("Insufficient balance");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("vtu-purchase", {
        body: { type: "electricity", provider_code: provider.code, meter_number: meter, amount, pin }
      });
      if (error) {
        const msg = await extractError(error, "Payment failed — please try again");
        throw new Error(msg);
      }
      const receiptId = data?.id || data?.reference;
      if (!receiptId) {
        toast.error(data?.error || "Purchase could not start. Please try again.");
        setBusy(false);
        return;
      }
      if (!data?.success) {
        nav(`/app/receipt/${receiptId}`);
        return;
      }
      refresh();
      nav(`/app/receipt/${receiptId}`);
    } catch (e: any) {
      toast.error(e.message || "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  if (loadingProviders) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <div className="text-sm text-muted-foreground">Loading electricity providers...</div>
      </div>
    );
  }

  if (!provider) return null;

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
            {providers.map(p => (
              <button key={p.code} onClick={() => { setProvider(p); setShowProviders(false); setVerified(false); setCustomerName(""); setVerifySkipped(false); }}
                className="flex w-full items-center gap-3 p-4 hover:bg-white/5 text-left">
                <span className="font-medium text-sm">{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Meter Number</div>
        <div className="flex gap-2">
          <Input value={meter} onChange={e => { setMeter(e.target.value); setVerifySkipped(false); setVerified(false); setCustomerName(""); }} placeholder="Enter meter number" inputMode="numeric"
            className="h-14 rounded-2xl bg-secondary/40 text-base flex-1" />
          <Button onClick={verifyMeter} disabled={verifying || meter.length < 10} variant="hero"
            className="h-14 rounded-2xl px-5">
            {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
          </Button>
        </div>
        {verified && customerName && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-sm text-green-400 px-1">
            <CheckCircle2 className="h-4 w-4" /> {customerName}
          </motion.div>
        )}
      </div>
      {(verified || verifySkipped) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {verifySkipped && (
              <div className="flex items-center gap-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-3 text-xs text-yellow-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Meter could not be verified. Payment will proceed but the token may not deliver if the meter number is wrong.</span>
              </div>
            )}
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
                  { label: "Service", value: provider.name },
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
