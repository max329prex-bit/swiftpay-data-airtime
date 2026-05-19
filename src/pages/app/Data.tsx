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
  const [apiPackages, setApiPackages] = useState<any[]>([]);
  const [loadingBundles, setLoadingBundles] = useState(false);
  const { balance, refresh } = useWallet();
  const nav = useNavigate();
  const bundles = apiPackages.length > 0 ? apiPackages : (DATA_BUNDLES[network] || []);
  const net = NETWORKS.find((n) => n.id === network)!;
  const filtered = useMemo(() => bundles.filter((b) => b.size.toLowerCase().includes(search.toLowerCase())), [bundles, search]);

  // Fetch live availability from get-packages edge function
  useEffect(() => {
    setBundle(null);
    setLoadingBundles(true);
    supabase.functions.invoke("get-packages")
      .then(({ data, error }) => {
        if (!error && data?.packages?.[network]) {
          setApiPackages(data.packages[network]);
        } else {
          setApiPackages(DATA_BUNDLES[network] || []);
        }
      })
      .catch(() => setApiPackages(DATA_BUNDLES[network] || []))
      .finally(() => setLoadingBundles(false));
  }, [network]);

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
      const { data, error } = await supabase.functions.invoke("vtu-purchase", {
        body: { type: "data", network, phone, amount: bundle.price, pin, bundle: bundle.package_code, provider: bundle.provider_code },
      });
      if (error) throw error;
      if (!data?.success) {
        if (data?.code === "BUNDLE_UNAVAILABLE") {
          // Mark this bundle as unavailable locally & go back to plan selection
          setApiPackages(prev => prev.map((p: any) =>
            p.package_code === bundle.package_code ? { ...p, available: false } : p
          ));
          setBundle(null);
          setStep("form");
          throw new Error("This plan is temporarily unavailable. No payment was taken — please choose another plan.");
        }
        throw new Error(data?.error || "Purchase failed");
      }
      refresh();
      nav("/app/success?ref=" + data.reference + "&type=data&amount=" + bundle.price + "&network=" + network + "&bundle=" + encodeURIComponent(bundle.size));
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
          {loadingBundles ? (
            <div className="text-xs text-muted-foreground text-center py-6 glass rounded-2xl">Loading available plans…</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {bundles.map((b) => {
                const unavail = b.available === false;
                const comingSoon = b.coming_soon === true;
                const blocked = unavail || comingSoon;
                const pts = Math.max(1, Math.floor(b.price / 250) * 5);
                const rate = typeof b.success_rate === "number" ? b.success_rate : 95;
                const selected = bundle?.id === b.id;
                return (
                  <button key={b.id}
                    onClick={() => !blocked && setBundle(b)}
                    disabled={blocked}
                    type="button"
                    className={"relative flex flex-col items-center gap-0.5 rounded-2xl border p-3 transition text-center overflow-hidden " +
                      (comingSoon ? "cursor-not-allowed border-amber-900/30 bg-amber-900/5" :
                       blocked ? "opacity-50 cursor-not-allowed border-white/5 bg-white/[0.02]" :
                       selected ? "border-primary bg-primary/10 shadow-glow" :
                       "border-white/10 bg-white/[0.03] hover:bg-white/5 active:scale-95")}>
                    {/* Success rate bar — thin stripe at very top */}
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/5 rounded-t-2xl">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
                        style={{ width: rate + "%" }} />
                    </div>
                    {/* Data size — most prominent */}
                    <div className="font-display text-xl font-bold leading-none mt-2 text-foreground">{b.size}</div>
                    {/* Validity */}
                    <div className="text-[10px] text-muted-foreground leading-none mt-0.5">{b.validity}</div>
                    {/* Price */}
                    <div className="text-sm font-semibold mt-1.5">{naira(b.price)}</div>
                    {/* BlitzPoints */}
                    <div className="text-[10px] text-accent font-semibold mt-0.5">+{pts} pts</div>
                    {/* Status badges */}
                    {comingSoon && (
                      <div className="text-[9px] text-amber-400 font-bold mt-1 px-1.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20">
                        Coming Soon
                      </div>
                    )}
                    {unavail && !comingSoon && (
                      <div className="text-[9px] text-red-400 mt-1">Unavailable</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {bundle && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass flex items-center justify-between rounded-2xl p-3">
              <div className="text-xs text-muted-foreground">Selected · {bundle.size} · {bundle.validity}</div>
              <div className="font-display text-base font-bold">{naira(bundle.price)}</div>
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
                  <button key={b.id}
                    onClick={() => { if (b.available === false) return; setBundle(b); setShowSheet(false); setSearch(""); }}
                    disabled={b.available === false}
                    type="button"
                    className={"flex w-full items-center gap-3 rounded-2xl p-3 transition text-left " + (b.available === false ? "opacity-50 cursor-not-allowed" : "hover:bg-white/5")}>
                    <div className={"h-10 w-10 rounded-xl " + NC[network] + " flex items-center justify-center font-bold text-xs flex-shrink-0"}>{net.name}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{net.name} {b.size} — {b.validity}</div>
                      <div className="text-xs text-muted-foreground">{naira(b.price)} · <span className="text-accent">+{Math.max(1, Math.floor(b.price/250)*5)} BlitzPoints</span></div>
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
