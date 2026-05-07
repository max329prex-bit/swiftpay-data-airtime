import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DATA_BUNDLES, detectNetwork, naira, NETWORKS, NetworkId } from "@/lib/networks";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, ChevronDown, Search, X } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Step = "network" | "form" | "pin";
const NC: Record<NetworkId, string> = { MTN: "bg-yellow-400 text-black", AIRTEL: "bg-red-600 text-white", GLO: "bg-green-600 text-white", "9MOBILE": "bg-green-500 text-white" };
const DR: Record<NetworkId, number> = { MTN: 96, AIRTEL: 91, GLO: 88, "9MOBILE": 85 };

export default function Data() {
  const [step, setStep] = useState<Step>("network");
  const [network, setNetwork] = useState<NetworkId>("MTN");
  const [phone, setPhone] = useState("");
  const [phoneOk, setPhoneOk] = useState(false);
  const [bundle, setBundle] = useState<any>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [search, setSearch] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const { balance, refresh } = useWallet();
  const nav = useNavigate();
  const bundles = DATA_BUNDLES[network] || [];
  const net = NETWORKS.find((n) => n.id === network)!;
  const filtered = useMemo(() => bundles.filter((b) => b.size.toLowerCase().includes(search.toLowerCase())), [bundles, search]);

  useEffect(() => {
    const d = detectNetwork(phone);
    if (d) { setNetwork(d); setPhoneOk(phone.replace(/\D/g, "").length === 11); }
    else setPhoneOk(false);
  }, [phone]);

  async function pay() {
    if (pin.length < 4) return toast.error("Enter 4-digit PIN");
    if (!bundle || bundle.price > balance) return toast.error("Insufficient balance");
    setBusy(true);
    try {
      const ok = await supabase.rpc("verify_transaction_pin", { _pin: pin });
      if (ok.error) throw ok.error;
      if (!ok.data) throw new Error("Incorrect PIN");
      const { data, error } = await supabase.rpc("purchase_vtu", {
        _type: "data", _network: network, _phone: phone,
        _amount: bundle.price, _meta: { bundle: bundle.name, size: bundle.size },
      });
      if (error) throw error;
      refresh();
      nav("/app/success?ref=" + (data as any).reference + "&type=data&amount=" + bundle.price + "&network=" + network + "&bundle=" + encodeURIComponent(bundle.size));
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  }

  if (step === "network") return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="font-display text-2xl font-semibold">Data Bundle</h1>
        <p className="text-sm text-muted-foreground mt-1">Select your network</p>
      </div>
      <div className="flex items-center justify-between rounded-2xl glass p-4">
        <div>
          <div className="text-xs text-muted-foreground">Balance</div>
          <div className="font-display text-lg font-bold">{naira(balance)}</div>
        </div>
        <Button size="sm" variant="hero" onClick={() => nav("/app/wallet")} className="rounded-xl">+ Deposit</Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {NETWORKS.map((n) => (
          <button key={n.id} onClick={() => { setNetwork(n.id); setBundle(null); setPhone(""); setPhoneOk(false); setStep("form"); }} type="button"
            className="flex flex-col items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:bg-white/5 active:scale-95">
            <div className={"h-16 w-16 rounded-2xl " + NC[n.id] + " flex items-center justify-center font-bold text-sm"}>{n.name}</div>
            <span className="font-semibold text-sm">{n.name}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => (step === "form" ? setStep("network") : setStep("form"))} className="grid h-9 w-9 place-items-center rounded-full glass">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="font-display text-xl font-semibold">Buy Data Bundle</h1>
        <div className={"ml-auto h-10 w-10 rounded-xl " + NC[network] + " flex items-center justify-center font-bold text-xs"}>{net.name}</div>
      </div>

      <div className="flex items-center justify-between rounded-2xl glass p-4">
        <div>
          <div className="text-xs text-muted-foreground">Balance</div>
          <div className="font-display text-lg font-bold">{naira(balance)}</div>
        </div>
        <Button size="sm" variant="hero" onClick={() => nav("/app/wallet")} className="rounded-xl">+ Deposit</Button>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{net.name} Delivery Rate Nationwide</span>
          <span>{DR[network]}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: DR[network] + "%" }} transition={{ duration: 1 }}
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Phone Number</div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08030000000"
              inputMode="tel" className="h-14 rounded-2xl bg-secondary/40 text-base pr-8" />
            {phone && (
              <button onClick={() => { setPhone(""); setPhoneOk(false); setBundle(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button onClick={() => phone.replace(/\D/g, "").length === 11 ? setPhoneOk(true) : toast.error("Enter valid number")}
            className={"h-14 w-14 rounded-2xl flex items-center justify-center transition " + (phoneOk ? "bg-green-500/20 text-green-400" : "bg-primary/20 text-primary")}>
            <CheckCircle2 className="h-5 w-5" />
          </button>
        </div>
        {phoneOk && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-sm text-green-400">
            <CheckCircle2 className="h-4 w-4" /> Verified {net.name} Number
          </motion.div>
        )}
      </div>

      {phoneOk && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Select Package</div>
          <button onClick={() => setShowSheet(true)} type="button"
            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-secondary/40 px-4 h-14 text-sm">
            <span className={bundle ? "text-foreground font-semibold" : "text-muted-foreground"}>
              {bundle ? bundle.size + " — " + naira(bundle.price) : "Select Package"}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="flex flex-wrap gap-2">
            {bundles.slice(0, 7).map((b) => (
              <button key={b.id} onClick={() => setBundle(b)} type="button"
                className={"rounded-xl border px-3 py-2 text-xs font-semibold transition " + (bundle && bundle.id === b.id ? "border-primary bg-primary/10 text-primary" : "border-white/10 bg-white/[0.03] text-muted-foreground")}>
                {b.size}
              </button>
            ))}
          </div>
          {bundle && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass flex items-center justify-between rounded-2xl p-4">
              <div className="text-sm text-muted-foreground">Amount</div>
              <div className="font-display text-lg font-bold">{naira(bundle.price)}</div>
            </motion.div>
          )}
        </motion.div>
      )}

      <Button variant="hero" size="xl" className="w-full" disabled={!bundle || !phoneOk} onClick={() => setStep("pin")}>
        Proceed
      </Button>

      <AnimatePresence>
        {showSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60" onClick={() => setShowSheet(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-[#13171f] border-t border-white/10 p-5 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-bold">Select Packages</h2>
                <button onClick={() => setShowSheet(false)} className="grid h-8 w-8 place-items-center rounded-full glass"><X className="h-4 w-4" /></button>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-10 rounded-2xl bg-secondary/40" />
              </div>
              <div className="overflow-y-auto space-y-1 flex-1">
                {filtered.map((b) => (
                  <button key={b.id} onClick={() => { setBundle(b); setShowSheet(false); setSearch(""); }} type="button"
                    className="flex w-full items-center gap-3 rounded-2xl p-3 hover:bg-white/5 transition text-left">
                    <div className={"h-10 w-10 rounded-xl " + NC[network] + " flex items-center justify-center font-bold text-xs flex-shrink-0"}>{net.name}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{net.name} {b.size} — {b.validity}</div>
                      <div className="text-xs text-muted-foreground">{naira(b.price)}</div>
                    </div>
                    <div className={"h-5 w-5 rounded-full border-2 flex-shrink-0 transition " + (bundle && bundle.id === b.id ? "border-primary bg-primary" : "border-white/20")} />
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {step === "pin" && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60" onClick={() => setStep("form")} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-[#13171f] border-t border-white/10 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-lg font-bold">Authorization Screen</h2>
                <button onClick={() => setStep("form")} className="grid h-8 w-8 place-items-center rounded-full glass"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3 mb-6">
                {[
                  { label: "Product", value: net.name + " Data / " + (bundle ? bundle.size : "") + " (" + (bundle ? bundle.validity : "") + ")" },
                  { label: "Recipient", value: phone, accent: true },
                  { label: "Amount", value: naira(bundle ? bundle.price : 0) },
                  { label: "Total Payable", value: naira(bundle ? bundle.price : 0), bold: true },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between text-sm border-b border-white/5 pb-2">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className={row.accent ? "text-primary font-semibold" : row.bold ? "text-accent font-bold" : "font-semibold"}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-4 text-center">
                <div className="text-sm font-semibold">Enter Account Pin To Authorize</div>
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
                  {busy ? "Processing..." : "Pay"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
