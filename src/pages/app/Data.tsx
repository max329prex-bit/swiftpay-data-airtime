import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { detectNetwork, naira, NETWORKS, NetworkId } from "@/lib/networks";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, X, Zap, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Step = "network" | "form" | "pin" | "verifying";
type Duration = "daily" | "weekly" | "monthly";
type NetworkId4 = "MTN" | "AIRTEL" | "GLO" | "9MOBILE";

interface Plan {
  id: string;
  name: string;
  size: string;
  validity: string;
  sell_price: number;
  provider_code: string;
  available: boolean;
  coming_soon: boolean;
  success_rate: number;
  duration: Duration;
  badge?: "most_bought" | "best_value" | "awuf" | "hot";
  is_prime?: boolean;
  network: NetworkId;
  pricePerGb: number;
  bp_value: number;
  tier?: "stable" | "promo";
  health_score?: number;
}

const NC: Record<NetworkId, string> = {
  MTN: "bg-yellow-400 text-black",
  AIRTEL: "bg-red-600 text-white",
  GLO: "bg-green-600 text-white",
  "9MOBILE": "bg-green-500 text-white",
};

const BADGE_CFG = {
  most_bought: { cls: "bg-orange-500/15 border-orange-500/30 text-orange-400", label: "🔥 Most Bought" },
  best_value:  { cls: "bg-amber-400/15 border-amber-400/30 text-amber-400",   label: "⭐ Best Value" },
  awuf:        { cls: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400", label: "✨ AWUF" },
  hot:         { cls: "bg-red-500/15 border-red-500/30 text-red-400",          label: "🔥 Hot" },
} as const;

function parseDuration(validity: string): Duration {
  const n = parseInt(validity);
  if (isNaN(n)) return "daily";
  if (n <= 3) return "daily";
  if (n <= 14) return "weekly";
  return "monthly";
}

/** Gift/awoof plans require non-owing lines */
function isGiftPlan(pkgCode: string): boolean {
  const c = (pkgCode || '').toLowerCase();
  return c.includes('awoof') || c.includes('gifting') || c.includes('gift');
}
function parseGbSize(size: string): number {
  const m = (size || "").match(/(\d+\.?\d*)\s*(MB|GB|TB)/i);
  if (!m) return 1;
  const val = parseFloat(m[1]);
  const unit = m[2].toUpperCase();
  if (unit === "MB") return val / 1024;
  if (unit === "TB") return val * 1024;
  return val;
}

function BadgeChip({ badge }: { badge?: Plan["badge"] }) {
  if (!badge) return null;
  const { cls, label } = BADGE_CFG[badge];
  return <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${cls} mt-0.5 leading-none`}>{label}</span>;
}

function PlanCard({ plan, selected, onSelect }: { plan: Plan; selected: boolean; onSelect: (p: Plan) => void }) {
  const pts = plan.bp_value ?? 1;
  const rate = plan.success_rate ?? 92;
  const blocked = plan.coming_soon || !plan.available;
  return (
    <button onClick={() => !blocked && onSelect(plan)} disabled={blocked} type="button"
      className={["relative flex flex-col items-center gap-0.5 rounded-2xl border p-3 text-center overflow-hidden transition",
        blocked ? "opacity-50 cursor-not-allowed border-white/5 bg-white/[0.02]"
        : selected ? "border-primary bg-primary/10 shadow-[0_0_14px_rgba(139,92,246,0.25)]"
        : "border-white/10 bg-white/[0.03] hover:bg-white/5 active:scale-95"].join(" ")}>
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/5 rounded-t-2xl">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${rate}%` }} />
      </div>
      <div className="font-display text-xl font-black leading-none mt-2 text-foreground">{plan.size}</div>
      <div className="text-[10px] text-muted-foreground leading-none mt-0.5">{plan.validity}</div>
      <div className="text-sm font-bold mt-1.5">{naira(plan.sell_price)}</div>
      <div className="text-[9px] text-accent font-semibold">+{pts} BP</div>
      <BadgeChip badge={plan.badge} />
      {plan.tier === "stable" && (
        <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 leading-none">⚡ Stable</span>
      )}
      {plan.tier === "promo" && plan.available && (
        <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 leading-none">🔥 Hot Deal</span>
      )}
      {plan.coming_soon && (
        <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
          <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-1 rounded-full">Coming Soon</span>
        </div>
      )}
    </button>
  );
}

function PrimeCard({ plan, selected, onSelect }: { plan: Plan; selected: boolean; onSelect: (p: Plan) => void }) {
  const pts = plan.bp_value ?? 1;
  const blocked = plan.coming_soon || !plan.available;
  return (
    <button onClick={() => !blocked && onSelect(plan)} disabled={blocked} type="button"
      className="flex-shrink-0 w-[138px] rounded-2xl p-[1.5px] transition active:scale-95"
      style={{ background: selected ? "linear-gradient(135deg, #f59e0b, #f97316)" : "linear-gradient(135deg, rgba(245,158,11,0.35), rgba(249,115,22,0.20))" }}>
      <div className={["h-full rounded-[13px] bg-[#0f1117] p-3 flex flex-col gap-1 text-left", selected ? "ring-1 ring-amber-400/40" : ""].join(" ")}>
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full leading-none ${NC[plan.network]}`}>{plan.network}</span>
          {plan.badge && <BadgeChip badge={plan.badge} />}
        </div>
        <div className="font-display text-2xl font-black leading-none text-foreground">{plan.size}</div>
        <div className="text-[10px] text-muted-foreground leading-tight">{plan.validity}</div>
        <div className="text-sm font-bold mt-0.5">{naira(plan.sell_price)}</div>
        <div className="text-[9px] text-accent font-semibold">+{pts} BP</div>
        {plan.coming_soon && <span className="text-[9px] text-amber-400 font-bold border border-amber-400/30 rounded-full px-1.5 py-0.5 bg-amber-400/10 w-fit mt-0.5">Soon</span>}
      </div>
    </button>
  );
}

export default function Data() {
  const [step, setStep] = useState<Step>("network");
  const [network, setNetwork] = useState<NetworkId>("MTN");
  const [phone, setPhone] = useState("");
  const [phoneOk, setPhoneOk] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [duration, setDuration] = useState<Duration>("daily");
  const [showMore, setShowMore] = useState(false);
  const [hideGiftPlans, setHideGiftPlans] = useState(false);
  const [allPlans, setAllPlans] = useState<Record<string, Plan[]>>({});
  const [loadingPlans, setLoadingPlans] = useState(true);
  const { balance, refresh } = useWallet();
  const nav = useNavigate();
  const net = NETWORKS.find(n => n.id === network)!;
  const ctaRef = useRef<HTMLDivElement>(null);

  // Fetch live data plans
  useEffect(() => {
    setLoadingPlans(true);
    supabase.functions.invoke("get-packages").then(({ data, error }) => {
      if (error || !data?.packages) { setLoadingPlans(false); return; }
      const mapped: Record<string, Plan[]> = {};
      for (const [netId, pkgs] of Object.entries(data.packages as Record<string, any[]>)) {
        const sorted = [...pkgs].sort((a, b) => a.sell_price - b.sell_price);
        mapped[netId] = sorted.map((p, idx) => {
          const dur = parseDuration(p.validity);
          const gbSize = parseGbSize(p.size || "");
          const pricePerGb = gbSize > 0 ? p.sell_price / gbSize : Infinity;
          let badge: Plan["badge"] = undefined;
          if (idx === 0) badge = "awuf";
          else if (idx === 1) badge = "most_bought";
          else if (p.size?.includes("10") || p.size?.includes("15") || p.size?.includes("20")) badge = "best_value";
          else if ((p.success_rate ?? 92) >= 95) badge = "hot";
          return {
            id: p.package_code || p.id,
            name: p.name,
            size: p.size,
            validity: p.validity,
            sell_price: p.sell_price,
            provider_code: p.provider_code,
            available: p.available !== false,
            coming_soon: p.coming_soon || false,
            success_rate: p.success_rate ?? 92,
            duration: dur,
            badge,
            network: netId as NetworkId,
            pricePerGb,
            bp_value: p.bp_value ?? 1,
            is_prime: false,
          };
        });
      }
      for (const netId of Object.keys(mapped)) {
        const netAvailable = mapped[netId].filter(p => p.available && !p.coming_soon);
        const primeIds = new Set(
          [...netAvailable].sort((a, b) => a.pricePerGb - b.pricePerGb).slice(0, 5).map(p => p.id)
        );
        mapped[netId] = mapped[netId].map(p => ({ ...p, is_prime: primeIds.has(p.id) }));
      }
      setAllPlans(mapped);
      setLoadingPlans(false);
    }).catch(() => setLoadingPlans(false));
  }, []);

  useEffect(() => {
    if (!plan) return;
    const t = setTimeout(() => {
      const el = ctaRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const visibleBottom = window.innerHeight - 130;
      if (rect.bottom > visibleBottom) window.scrollBy({ top: rect.bottom - visibleBottom + 20, behavior: "smooth" });
    }, 280);
    return () => clearTimeout(t);
  }, [plan]);

  useEffect(() => {
    const d = detectNetwork(phone);
    if (d) { setNetwork(d as NetworkId); setPhoneOk(phone.replace(/\D/g, "").length === 11); }
    else setPhoneOk(false);
    setPlan(null);
  }, [phone]);

  useEffect(() => { setPlan(null); setShowMore(false); setDuration("daily"); setHideGiftPlans(false); }, [network]);

  const netPlans = allPlans[network] ?? [];
  const primePlans = netPlans.filter(p => p.is_prime && p.available).sort((a, b) => a.pricePerGb - b.pricePerGb);
  const tabPlans = netPlans.filter(p => p.duration === duration);

  const networkCounts = Object.fromEntries(
    NETWORKS.map(n => [n.id, (allPlans[n.id] ?? []).filter(p => p.available).length])
  );

  async function pay() {
    if (!plan) return;
    if (pin.length < 4) return toast.error("Enter 4-digit PIN");
    if (plan.sell_price > balance) return toast.error("Insufficient balance");
    setBusy(true);
    setStep("verifying");
    try {
      const { data, error } = await supabase.functions.invoke("vtu-purchase", {
        body: { type: "data", network: plan.network, phone, amount: plan.sell_price, pin, bundle: plan.id, provider: plan.provider_code },
      });
      if (error) throw error;
      const receiptId = data?.id || data?.reference;
      if (!receiptId) {
        toast.error(data?.error || "Purchase could not start. Please try again.");
        setStep("form");
        setBusy(false);
        return;
      }
      if (!data?.success) {
        if (data?.code === "BUNDLE_UNAVAILABLE") {
          setPlan(null); setStep("form"); throw new Error("Plan temporarily unavailable \u2014 pick another.");
        }
        nav(`/app/receipt/${receiptId}`);
        return;
      }
      refresh();
      nav(`/app/receipt/${receiptId}`);
    } catch (e: any) {
      let msg = e.message ?? "Failed";
      if (e?.context?.json) {
        try { const body = await e.context.json(); msg = body?.error || msg; } catch {}
      }
      toast.error(msg);
      setStep("form");
    } finally { setBusy(false); }
  }

  // ── Fullscreen verifying overlay ──
  if (step === "verifying") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center gap-5 pt-32 text-center bg-[#0a0c10]">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-primary/30 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
          </div>
        </div>
        <div>
          <div className="font-semibold text-lg">Confirming with provider...</div>
          <div className="text-sm text-muted-foreground mt-1 max-w-[260px] leading-relaxed">
            Do not retry or close this screen.
          </div>
        </div>
        <div className="flex gap-1.5 mt-2">
          {["Processing", "Confirming", "Completing"].map((label, i) => (
            <span key={i} className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${i === 1 ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/5 text-muted-foreground border border-white/10"}`}>
              {label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // ── Network selection ──
  if (step === "network") return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="font-display text-2xl font-semibold">Data Bundle</h1>
        <p className="text-sm text-muted-foreground mt-1">Choose your network</p>
      </div>
      <div className="flex items-center justify-between rounded-2xl glass p-4">
        <div><div className="text-xs text-muted-foreground">Balance</div><div className="font-display text-lg font-bold">{naira(balance)}</div></div>
        <Button size="sm" variant="hero" onClick={() => nav("/app/wallet")} className="rounded-xl">+ Deposit</Button>
      </div>
      {loadingPlans ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading plans\u2026</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {NETWORKS.map(n => {
            const count = networkCounts[n.id] ?? 0;
            const isSupported = count > 0;
            return (
              <button key={n.id} onClick={() => { if (!isSupported) return; setNetwork(n.id as NetworkId); setStep("form"); }}
                disabled={!isSupported} type="button"
                className={["flex flex-col overflow-hidden rounded-3xl border transition",
                  isSupported ? "border-white/10 hover:border-white/20 active:scale-95 cursor-pointer"
                  : "border-white/5 opacity-50 cursor-not-allowed"].join(" ")}>
                <div className={`${n.bg} flex items-center justify-center py-8`}>
                  <span className={`font-black text-2xl ${n.color}`}>{n.name}</span>
                </div>
                <div className="bg-white/[0.03] py-3 px-3 text-left">
                  <div className="text-sm font-semibold">{n.name}</div>
                  <div className="text-[11px] text-muted-foreground">{isSupported ? `${count} plans` : "Coming soon"}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Plan selection ──
  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => step === "form" ? setStep("network") : setStep("form")} className="grid h-9 w-9 place-items-center rounded-full glass">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="font-display text-xl font-semibold">Buy Data</h1>
        <div className={`ml-auto h-10 w-10 rounded-xl ${NC[network]} flex items-center justify-center font-black text-xs`}>{net.name}</div>
      </div>

      <div className="flex items-center justify-between rounded-2xl glass p-4">
        <div><div className="text-xs text-muted-foreground">Balance</div><div className="font-display text-lg font-bold">{naira(balance)}</div></div>
        <Button size="sm" variant="hero" onClick={() => nav("/app/wallet")} className="rounded-xl">+ Deposit</Button>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Phone Number</div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="08030000000" inputMode="tel"
              className="h-14 rounded-2xl bg-secondary/40 text-base pr-8" />
            {phone && <button onClick={() => { setPhone(""); setPhoneOk(false); setPlan(null); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-4 w-4" /></button>}
          </div>
          <button onClick={() => phone.replace(/\D/g, "").length === 11 ? setPhoneOk(true) : toast.error("Enter valid number")}
            className={`h-14 w-14 rounded-2xl flex items-center justify-center transition ${phoneOk ? "bg-green-500/20 text-green-400" : "bg-primary/20 text-primary"}`}>
            <CheckCircle2 className="h-5 w-5" />
          </button>
        </div>
        {phoneOk && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-sm text-green-400"><CheckCircle2 className="h-4 w-4" /> Verified {net.name} Number</motion.div>}
      </div>

      {phoneOk && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {primePlans.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                <span className="text-base font-black" style={{ background: "linear-gradient(90deg, #f59e0b, #f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Blitz Prime</span>
                <span className="text-[10px] text-muted-foreground">Best picks for you</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                {primePlans.map(p => <PrimeCard key={p.id} plan={p} selected={plan?.id === p.id}
                  onSelect={pp => { setPlan(pp); setDuration(pp.duration); }} />)}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex gap-2">
              {(["daily", "weekly", "monthly"] as Duration[]).map(d => (
                <button key={d} onClick={() => { setDuration(d); setShowMore(false); }} type="button"
                  className={["flex-1 rounded-xl py-2 text-xs font-bold capitalize transition",
                    duration === d ? "bg-primary text-primary-foreground shadow-sm" : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07]"].join(" ")}>
                  {d}
                </button>
              ))}
            </div>

            {tabPlans.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-8 glass rounded-2xl">
                {loadingPlans ? "Loading plans\u2026" : "No plans for this duration"}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {tabPlans.slice(0, showMore ? tabPlans.length : Math.min(6, tabPlans.length)).map(p => (
                  <PlanCard key={p.id} plan={p} selected={plan?.id === p.id} onSelect={pp => setPlan(pp)} />
                ))}
              </div>
            )}

            {tabPlans.length > 6 && (
              <button onClick={() => setShowMore(v => !v)} type="button"
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-xs font-semibold text-muted-foreground hover:bg-white/[0.06] transition">
                {showMore ? <><ChevronUp className="h-3.5 w-3.5" /> Show Less</> : <><ChevronDown className="h-3.5 w-3.5" /> More Plans ({tabPlans.length - 6})</>}
              </button>
            )}
          </div>

          {plan && (
            <>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Success Rate</span>
                  <span className={`text-base font-black tabular-nums ${plan.success_rate >= 90 ? "text-green-400" : plan.success_rate >= 75 ? "text-amber-400" : "text-red-400"}`}>
                    {plan.success_rate}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${plan.success_rate}%` }} transition={{ duration: 0.6, ease: "easeOut" }}
                    className={`h-full rounded-full ${plan.success_rate >= 90 ? "bg-gradient-to-r from-green-500 to-emerald-400" : plan.success_rate >= 75 ? "bg-gradient-to-r from-amber-500 to-yellow-400" : "bg-gradient-to-r from-red-500 to-rose-400"}`} />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {plan.success_rate >= 90 ? "High reliability \u2014 this plan delivers consistently"
                    : plan.success_rate >= 75 ? "Mostly available \u2014 minor occasional delays"
                    : "Low availability \u2014 consider choosing another plan"}
                </p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="glass flex items-center justify-between rounded-2xl px-4 py-3 border border-primary/20">
                <div className="text-xs text-muted-foreground">{plan.size} | {plan.validity}</div>
                <div className="font-display text-base font-bold">{naira(plan.sell_price)}</div>
              </motion.div>
            </>
          )}
        </motion.div>
      )}


            {/* Gift/Awoof warning in plan detail */}
            {plan && isGiftPlan(plan.id) && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                <div className="flex items-start gap-2">
                  <span className="text-amber-400 text-lg leading-none mt-0.5">&#9888;</span>
                  <div className="text-xs text-amber-200 leading-relaxed">
                    <span className="font-semibold">Non-owing line only.</span> This bundle only works for numbers that are <span className="font-semibold">not currently owing data</span>. If this number is owing, the purchase will fail and be refunded. <button type="button" onClick={() => { setPlan(null); setHideGiftPlans(true); }} className="text-amber-300 underline font-semibold cursor-pointer hover:text-amber-100 transition">Click here to see plans owing users can get</button>.
                  </div>
                </div>
              </motion.div>
            )}

      <div ref={ctaRef}>
        <Button variant="hero" size="xl" className="w-full" disabled={!plan || !phoneOk} onClick={() => setStep("pin")}>
          {plan ? `Buy ${plan.size} for ${naira(plan.sell_price)}` : "Select a plan to continue"}
        </Button>
      </div>

      <AnimatePresence>
        {step === "pin" && plan && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={() => setStep("form")} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-[#0f1117] border-t border-white/10 p-6">
              <div className="flex items-center justify-between mb-5">
                <div><h2 className="font-display text-lg font-bold">Authorize Purchase</h2><p className="text-xs text-muted-foreground mt-0.5">Review and confirm below</p></div>
                <button onClick={() => setStep("form")} className="grid h-8 w-8 place-items-center rounded-full glass"><X className="h-4 w-4" /></button>
              </div>
              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-4 mb-5 space-y-2.5">
                {[
                  { label: "Product", value: `${net.name} Data \u2014 ${plan.size} (${plan.validity})` },
                  { label: "Recipient", value: phone, accent: true },
                  { label: "Amount", value: naira(plan.sell_price) },
                  { label: "Total Payable", value: naira(plan.sell_price), bold: true },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className={row.accent ? "text-primary font-semibold" : row.bold ? "text-accent font-bold" : "font-semibold"}>{row.value}</span>
                  </div>
                ))}
              </div>
                {/* Gift/Awoof warning in confirmation */}
                {isGiftPlan(plan.id) && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 mt-2">
                    <div className="flex items-start gap-2">
                      <span className="text-amber-400 text-sm leading-none mt-0.5">&#9888;</span>
                      <div className="text-xs text-amber-200 leading-relaxed">
                        <span className="font-semibold">Non-owing line required.</span> If {phone} is currently owing data, this purchase will fail and be refunded. <button type="button" onClick={() => { setStep("form"); setPlan(null); setHideGiftPlans(true); }} className="text-amber-300 underline font-semibold cursor-pointer hover:text-amber-100 transition">Click here to see plans owing users can get</button>.
                      </div>
                    </div>
                  </div>
                )}

              <div className="space-y-4 text-center">
                <div className="text-sm font-semibold">Enter your 4-digit PIN</div>
                <div className="flex justify-center">
                  <InputOTP maxLength={4} value={pin} onChange={setPin}>
                    <InputOTPGroup>{[0, 1, 2, 3].map(i => <InputOTPSlot key={i} index={i} className="h-14 w-14 text-xl rounded-2xl" />)}</InputOTPGroup>
                  </InputOTP>
                </div>
                <Button variant="hero" size="xl" className="w-full" disabled={pin.length < 4 || busy} onClick={pay}>
                  {busy ? "Processing\u2026" : `Pay ${naira(plan.sell_price)}`}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

