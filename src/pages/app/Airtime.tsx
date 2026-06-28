import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { detectNetwork, naira, NETWORKS, NetworkId } from "@/lib/networks";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, X, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
const NET_COLORS: Record<NetworkId, string> = { MTN: "bg-yellow-400 text-black", AIRTEL: "bg-red-600 text-white", GLO: "bg-green-600 text-white", "9MOBILE": "bg-green-500 text-white" };
const QUICK = [50, 100, 200, 500, 1000, 2000];
type Step = "form" | "pin" | "verifying";
export default function Airtime() {
  const [phone, setPhone] = useState(""); const [network, setNetwork] = useState<NetworkId>("MTN"); const [phoneOk, setPhoneOk] = useState(false);
  const [amount, setAmount] = useState(0); const [pin, setPin] = useState(""); const [step, setStep] = useState<Step>("form"); const [busy, setBusy] = useState(false);
  const { balance, refresh } = useWallet(); const nav = useNavigate(); const net = NETWORKS.find(n => n.id === network)!;
  useEffect(() => { const d = detectNetwork(phone); if (d) { setNetwork(d); setPhoneOk(phone.replace(/\D/g, "").length === 11); } else setPhoneOk(false); }, [phone]);
  async function pay() {
    if (pin.length < 4) return toast.error("Enter 4-digit PIN"); if (amount < 50) return toast.error("Min N50"); if (amount > balance) return toast.error("Insufficient balance");
    setBusy(true);
    setStep("verifying");
    try {
      const { data, error } = await supabase.functions.invoke("vtu-purchase", {
        body: { type: "airtime", network, phone, amount, pin },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Purchase failed");
      refresh();
      const receiptId = data?.id || data?.reference;
      nav(`/app/receipt/${receiptId}`);
    } catch (e: any) { toast.error(e.message ?? "Failed"); setStep("form"); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center gap-3"><button onClick={() => nav("/app")} className="grid h-9 w-9 place-items-center rounded-full glass"><ArrowLeft className="h-4 w-4" /></button><h1 className="font-display text-xl font-semibold">Buy Airtime</h1><div className={`ml-auto h-10 w-10 rounded-xl ${NET_COLORS[network]} flex items-center justify-center font-bold text-xs`}>{net.name}</div></div>
      <div className="flex items-center justify-between rounded-2xl glass p-4"><div><div className="text-xs text-muted-foreground">Balance</div><div className="font-display text-lg font-bold">{naira(balance)}</div></div><Button size="sm" variant="hero" onClick={() => nav("/app/wallet")} className="rounded-xl">+ Deposit</Button></div>
      <div className="space-y-2"><div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Network</div><div className="grid grid-cols-4 gap-2">{NETWORKS.map(n => (<button key={n.id} onClick={() => setNetwork(n.id)} type="button" className={`flex flex-col items-center gap-1 rounded-2xl border p-3 transition ${network === n.id ? "border-primary bg-primary/10" : "border-white/10 bg-white/[0.03]"}`}><div className={`h-8 w-8 rounded-xl ${NET_COLORS[n.id]} flex items-center justify-center font-bold text-[8px]`}>{n.name}</div><span className="text-[9px] font-semibold">{n.name}</span></button>))}</div></div>
      <div className="space-y-2"><div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Phone Number</div><div className="flex gap-2"><div className="relative flex-1"><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="08030000000" inputMode="tel" className="h-14 rounded-2xl bg-secondary/40 text-base pr-8" />{phone && <button onClick={() => { setPhone(""); setPhoneOk(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-4 w-4" /></button>}</div><button onClick={() => phone.replace(/\D/g, "").length === 11 ? setPhoneOk(true) : toast.error("Enter valid number")} className={`h-14 w-14 rounded-2xl flex items-center justify-center transition ${phoneOk ? "bg-green-500/20 text-green-400" : "bg-primary/20 text-primary"}`}><CheckCircle2 className="h-5 w-5" /></button></div>{phoneOk && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-sm text-green-400"><CheckCircle2 className="h-4 w-4" /> Verified {net.name} Number</motion.div>}</div>
      <div className="space-y-2"><div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Amount</div><Input value={amount || ""} onChange={e => setAmount(Math.max(0, Number(e.target.value.replace(/\D/g, ""))))} placeholder="0" inputMode="numeric" className="h-14 rounded-2xl bg-secondary/40 text-lg font-semibold" /><div className="grid grid-cols-3 gap-2">{QUICK.map(v => (<button key={v} onClick={() => setAmount(v)} type="button" className={`rounded-xl border p-3 text-sm font-semibold transition ${amount === v ? "border-primary bg-primary/10" : "border-white/10 bg-white/[0.03]"}`}>{naira(v)}</button>))}</div></div>
      <Button variant="hero" size="xl" className="w-full" disabled={!phoneOk || amount < 50} onClick={() => setStep("pin")}>Proceed</Button>
      <AnimatePresence>{step === "pin" && <><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60" onClick={() => setStep("form")} /><motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-[#13171f] border-t border-white/10 p-6"><div className="flex items-center justify-between mb-6"><h2 className="font-display text-lg font-bold">Authorization Screen</h2><button onClick={() => setStep("form")} className="grid h-8 w-8 place-items-center rounded-full glass"><X className="h-4 w-4" /></button></div><div className="space-y-3 mb-6">{[{ label: "Product", value: `${net.name} Airtime` }, { label: "Recipient", value: phone, accent: true }, { label: "Amount", value: naira(amount) }, { label: "Total Payable", value: naira(amount), bold: true }].map(row => (<div key={row.label} className="flex justify-between text-sm border-b border-white/5 pb-2"><span className="text-muted-foreground">{row.label}</span><span className={row.accent ? "text-primary font-semibold" : row.bold ? "text-accent font-bold" : "font-semibold"}>{row.value}</span></div>))}</div><div className="space-y-4 text-center"><div className="text-sm font-semibold">Enter Account Pin To Authorize</div><div className="flex justify-center"><InputOTP maxLength={4} value={pin} onChange={setPin}><InputOTPGroup><InputOTPSlot index={0} className="h-14 w-14 text-xl rounded-2xl" /><InputOTPSlot index={1} className="h-14 w-14 text-xl rounded-2xl" /><InputOTPSlot index={2} className="h-14 w-14 text-xl rounded-2xl" /><InputOTPSlot index={3} className="h-14 w-14 text-xl rounded-2xl" /></InputOTPGroup></InputOTP></div><Button variant="hero" size="xl" className="w-full mt-4" disabled={pin.length < 4 || busy} onClick={pay}>{busy ? "Processing..." : "Pay"}</Button></div></motion.div></>}</AnimatePresence>

      {step === "verifying" && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-5 py-12 text-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-primary/30 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
          </div>
          <div>
            <div className="font-semibold text-lg">Confirming with provider...</div>
            <div className="text-sm text-muted-foreground mt-1 max-w-[260px] leading-relaxed">
              Do not retry or close this screen. This usually completes in under 2 minutes.
            </div>
          </div>
          <div className="flex gap-1.5 mt-2">
            {["Processing", "Confirming", "Completing"].map((label, i) => (
              <span key={i} className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${i === 1 ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/5 text-muted-foreground border border-white/10"}`}>
                {label}
              </span>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
