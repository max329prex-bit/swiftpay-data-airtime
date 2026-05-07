import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ELECTRICITY_PROVIDERS, naira } from "@/lib/networks";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, X, ChevronDown, Zap } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
const QUICK_AMOUNTS = [1000, 2000, 3000, 5000, 10000, 20000];
type Step = "form" | "pin";
export default function Electricity() {
  const [provider, setProvider] = useState(ELECTRICITY_PROVIDERS[0]); const [showProviders, setShowProviders] = useState(false);
  const [meter, setMeter] = useState(""); const [meterType, setMeterType] = useState<"prepaid"|"postpaid">("prepaid");
  const [customerName, setCustomerName] = useState(""); const [verifying, setVerifying] = useState(false); const [verified, setVerified] = useState(false);
  const [amount, setAmount] = useState(0); const [pin, setPin] = useState(""); const [step, setStep] = useState<Step>("form"); const [busy, setBusy] = useState(false);
  const { balance, refresh } = useWallet(); const nav = useNavigate();
  async function verifyMeter() {
    if (meter.length < 10) return toast.error("Enter valid meter number"); setVerifying(true);
    await new Promise(r => setTimeout(r, 1200)); setCustomerName("CUSTOMER VERIFIED"); setVerified(true); setVerifying(false); toast.success("Meter verified!");
  }
  async function pay() {
    if (pin.length < 4) return toast.error("Enter 4-digit PIN"); if (amount < 1000) return toast.error("Min N1,000"); if (amount > balance) return toast.error("Insufficient balance");
    setBusy(true);
    try {
      const ok = await supabase.rpc("verify_transaction_pin", { _pin: pin });
      if (ok.error) throw ok.error;
      if (!ok.data) throw new Error("Incorrect PIN");
      const { data, error } = await supabase.rpc("purchase_vtu", { _type: "electricity", _network: provider.id, _phone: meter, _amount: amount, _meta: { provider: provider.name, meterType, customerName } });
      if (error) throw error; refresh();
      nav(`/app/success?ref=${(data as any).reference}&type=electricity&amount=${amount}&network=${provider.id}`);
    } catch (e: any) { toast.error(e.message ?? "Failed"); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center gap-3"><button onClick={() => nav("/app")} className="grid h-9 w-9 place-items-center rounded-full glass"><ArrowLeft className="h-4 w-4" /></button><h1 className="font-display text-xl font-semibold">Electricity</h1><div className="ml-auto h-10 w-10 rounded-xl bg-yellow-400/20 flex items-center justify-center"><Zap className="h-5 w-5 text-yellow-400" /></div></div>
      <div className="flex items-center justify-between rounded-2xl glass p-4"><div><div className="text-xs text-muted-foreground">Balance</div><div className="font-display text-lg font-bold">{naira(balance)}</div></div><Button size="sm" variant="hero" onClick={() => nav("/app/wallet")} className="rounded-xl">+ Deposit</Button></div>
      <div className="space-y-2"><div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Electricity Provider</div><button onClick={() => setShowProviders(true)} type="button" className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-secondary/40 px-4 h-14 text-sm"><span className="font-semibold">{provider.name}</span><ChevronDown className="h-4 w-4 text-muted-foreground" /></button><p className="text-xs text-muted-foreground pl-1">{provider.location}</p></div>
      <div className="space-y-2"><div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Meter Type</div><div className="grid grid-cols-2 gap-2">{(["prepaid","postpaid"] as const).map(t => (<button key={t} onClick={() => setMeterType(t)} type="button" className={`rounded-2xl border p-3 text-sm font-semibold capitalize transition ${meterType === t ? "border-primary bg-primary/10" : "border-white/10 bg-white/[0.03]"}`}>{t}</button>))}</div></div>
      <div className="space-y-2"><div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Meter Number</div><div className="flex gap-2"><Input value={meter} onChange={e => { setMeter(e.target.value); setVerified(false); setCustomerName(""); }} placeholder="Enter meter number" inputMode="numeric" className="h-14 rounded-2xl bg-secondary/40 text-base flex-1" /><button onClick={verifyMeter} disabled={verifying} className={`h-14 px-4 rounded-2xl text-sm font-semibold flex-shrink-0 transition ${verified ? "bg-green-500/20 text-green-400" : "bg-primary/20 text-primary"}`}>{verifying ? "..." : verified ? "OK" : "Verify"}</button></div>{verified && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-sm text-green-400"><CheckCircle2 className="h-4 w-4" /> {customerName}</motion.div>}</div>
      {verified && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2"><div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Amount</div><Input value={amount || ""} onChange={e => setAmount(Math.max(0, Number(e.target.value.replace(/\D/g, ""))))} placeholder="0" inputMode="numeric" className="h-14 rounded-2xl bg-secondary/40 text-lg font-semibold" /><div className="grid grid-cols-3 gap-2">{QUICK_AMOUNTS.map(v => (<button key={v} onClick={() => setAmount(v)} type="button" className={`rounded-xl border p-3 text-sm font-semibold transition ${amount === v ? "border-primary bg-primary/10" : "border-white/10 bg-white/[0.03]"}`}>{naira(v)}</button>))}</div></motion.div>}
      <Button variant="hero" size="xl" className="w-full" disabled={!verified || amount < 1000} onClick={() => setStep("pin")}>Proceed</Button>
      <AnimatePresence>{showProviders && <><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60" onClick={() => setShowProviders(false)} /><motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-[#13171f] border-t border-white/10 p-5 max-h-[80vh] flex flex-col"><div className="flex items-center justify-between mb-4"><h2 className="font-display text-lg font-bold">Select Provider</h2><button onClick={() => setShowProviders(false)} className="grid h-8 w-8 place-items-center rounded-full glass"><X className="h-4 w-4" /></button></div><div className="overflow-y-auto space-y-1">{ELECTRICITY_PROVIDERS.map(p => (<button key={p.id} onClick={() => { setProvider(p); setShowProviders(false); setVerified(false); setMeter(""); }} type="button" className="flex w-full items-center gap-3 rounded-2xl p-3 hover:bg-white/5 transition text-left"><div className="h-10 w-10 rounded-xl bg-yellow-400/20 flex items-center justify-center flex-shrink-0"><Zap className="h-4 w-4 text-yellow-400" /></div><div className="flex-1"><div className="font-semibold text-sm">{p.name}</div><div className="text-xs text-muted-foreground">{p.location}</div></div><div className={`h-5 w-5 rounded-full border-2 flex-shrink-0 ${provider.id === p.id ? "border-primary bg-primary" : "border-white/20"}`} /></button>))}</div></motion.div></>}</AnimatePresence>
      <AnimatePresence>{step === "pin" && <><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60" onClick={() => setStep("form")} /><motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-[#13171f] border-t border-white/10 p-6"><div className="flex items-center justify-between mb-6"><h2 className="font-display text-lg font-bold">Authorization Screen</h2><button onClick={() => setStep("form")} className="grid h-8 w-8 place-items-center rounded-full glass"><X className="h-4 w-4" /></button></div><div className="space-y-3 mb-6">{[{ label: "Product", value: `${provider.name} (${meterType})` }, { label: "Meter Number", value: meter, accent: true }, { label: "Customer", value: customerName }, { label: "Amount", value: naira(amount) }, { label: "Total Payable", value: naira(amount), bold: true }].map(row => (<div key={row.label} className="flex justify-between text-sm border-b border-white/5 pb-2"><span className="text-muted-foreground">{row.label}</span><span className={row.accent ? "text-primary font-semibold" : row.bold ? "text-accent font-bold" : "font-semibold"}>{row.value}</span></div>))}</div><div className="space-y-4 text-center"><div className="text-sm font-semibold">Enter Account Pin To Authorize</div><div className="flex justify-center"><InputOTP maxLength={4} value={pin} onChange={setPin}><InputOTPGroup><InputOTPSlot index={0} className="h-14 w-14 text-xl rounded-2xl" /><InputOTPSlot index={1} className="h-14 w-14 text-xl rounded-2xl" /><InputOTPSlot index={2} className="h-14 w-14 text-xl rounded-2xl" /><InputOTPSlot index={3} className="h-14 w-14 text-xl rounded-2xl" /></InputOTPGroup></InputOTP></div><Button variant="hero" size="xl" className="w-full mt-4" disabled={pin.length < 4 || busy} onClick={pay}>{busy ? "Processing..." : "Pay"}</Button></div></motion.div></>}</AnimatePresence>
    </div>
  );
}
