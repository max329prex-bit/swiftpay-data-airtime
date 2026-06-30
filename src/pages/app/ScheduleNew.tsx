import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, CheckCircle2, Calendar, Users, Repeat, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { detectNetwork, naira, NETWORKS, NetworkId } from "@/lib/networks";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "sonner";
/** Gift/awoof plans require non-owing lines */
function isGiftPlan(pkgCode: string): boolean {
  const c = (pkgCode || '').toLowerCase();
  return c.includes('awoof') || c.includes('gifting') || c.includes('gift');
}

type Plan = {
  id: string; name: string; size: string; validity: string;
  sell_price: number; provider_code: string; bp_value: number;
  available: boolean;
};
type Step = "recipient" | "bundle" | "when" | "confirm";
type Frequency = "once" | "daily" | "weekly" | "monthly" | "every_n_days" | "until_cancelled";

const FREQ_OPTIONS: { id: Frequency; label: string; sub: string }[] = [
  { id: "once",            label: "One-time",        sub: "Just this date" },
  { id: "weekly",          label: "Weekly",          sub: "Every 7 days" },
  { id: "monthly",         label: "Monthly",         sub: "Every month" },
  { id: "until_cancelled", label: "Auto-renew",      sub: "Forever, until cancelled" },
];

export default function ScheduleNew() {
  const nav = useNavigate();
  const { available } = useWallet();
  const [step, setStep] = useState<Step>("recipient");

  // Recipient
  const [recipientLabel, setRecipientLabel] = useState("");
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState<NetworkId>("MTN");
  const [bens, setBens] = useState<any[]>([]);

  // Bundle
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);

  // When
  const [freq, setFreq] = useState<Frequency>("monthly");
  const [date, setDate] = useState<string>(() => {
    const d = new Date(Date.now() + 25 * 3600 * 1000);
    return d.toISOString().slice(0, 16);
  });

  // Confirm
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("beneficiaries").select("*").order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => setBens(data ?? []));
  }, []);

  useEffect(() => {
    const d = detectNetwork(phone);
    if (d) setNetwork(d as NetworkId);
  }, [phone]);

  useEffect(() => {
    if (step !== "bundle") return;
    setLoadingPlans(true);
    supabase.functions.invoke("get-packages").then(({ data }) => {
      const pkgs = (data?.packages?.[network] ?? []) as any[];
      setPlans(pkgs.filter(p => p.available !== false).slice(0, 30).map(p => ({
        id: p.package_code || p.id, name: p.name, size: p.size, validity: p.validity,
        sell_price: p.sell_price, provider_code: p.provider_code,
        bp_value: p.bp_value ?? 1, available: true,
      })));
    }).finally(() => setLoadingPlans(false));
  }, [step, network]);

  const phoneOk = phone.replace(/\D/g, "").length === 11;
  const dateOk = useMemo(() => new Date(date).getTime() > Date.now() + 10 * 60 * 1000, [date]);
  const fundsOk = plan ? available >= plan.sell_price : false;

  async function create() {
    if (!plan || !dateOk || !phoneOk || pin.length !== 4) return;
    if (!fundsOk) return toast.error("Insufficient available balance to reserve");
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("create_schedule" as any, {
        _type: "data", _network: network, _phone: phone,
        _amount: plan.sell_price, _package_code: plan.id,
        _provider_code: plan.provider_code, _bundle_size: plan.size,
        _bp_value: plan.bp_value, _frequency: freq, _interval_days: null,
        _first_run_at: new Date(date).toISOString(),
        _recipient_label: recipientLabel || null, _pin: pin, _meta: {},
      });
      if (error) throw error;
      toast.success("Schedule created! Funds reserved.");
      nav("/app/schedules");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => step === "recipient" ? nav(-1) :
          setStep(step === "bundle" ? "recipient" : step === "when" ? "bundle" : "when")}
          className="grid h-9 w-9 place-items-center rounded-full glass">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="font-display text-xl font-semibold">New Schedule</h1>
        <span className="ml-auto text-xs text-muted-foreground">Available {naira(available)}</span>
      </div>

      {/* Progress */}
      <div className="flex gap-1.5">
        {["recipient", "bundle", "when", "confirm"].map((s, i) => {
          const idx = ["recipient", "bundle", "when", "confirm"].indexOf(step);
          return <div key={s} className={`h-1 flex-1 rounded-full transition ${i <= idx ? "bg-primary" : "bg-white/10"}`} />;
        })}
      </div>

      {/* STEP 1: Recipient */}
      {step === "recipient" && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Phone</label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="08030000000"
              inputMode="tel" className="h-14 rounded-2xl mt-1.5" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Label (Family & Friends)</label>
            <Input value={recipientLabel} onChange={e => setRecipientLabel(e.target.value)}
              placeholder="e.g. Dad's MTN, My second SIM" className="h-12 rounded-2xl mt-1.5" />
          </div>
          {bens.length > 0 && (
            <div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-2">
                <Users className="h-3 w-3" /> Recents
              </div>
              <div className="flex flex-wrap gap-2">
                {bens.map((b: any) => (
                  <button key={b.id} onClick={() => { setPhone(b.phone); setRecipientLabel(b.name ?? ""); }}
                    className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/10">
                    {b.name || b.phone}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Button disabled={!phoneOk} onClick={() => setStep("bundle")} variant="hero" className="w-full h-12 rounded-2xl">
            Continue
          </Button>
        </motion.div>
      )}

      {/* STEP 2: Bundle */}
      {step === "bundle" && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Pick a bundle · {network}</div>
          {loadingPlans ? (
            <div className="py-10 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {plans.map(p => (
                <button key={p.id} onClick={() => setPlan(p)}
                  className={`rounded-2xl p-3 border text-left transition ${plan?.id === p.id ? "border-primary bg-primary/10" : "border-white/10 bg-white/[0.03] hover:bg-white/5"}`}>
                  <div className="font-display text-lg font-black">{p.size}</div>
                  <div className="text-[10px] text-muted-foreground">{p.validity}</div>
                  <div className="text-sm font-bold mt-1">{naira(p.sell_price)}</div>
                  <div className="text-[9px] text-accent font-semibold">+{p.bp_value} BP</div>
                </button>
              ))}
            </div>
          )}

          {/* Gift/Awoof warning */}
          {plan && isGiftPlan(plan.id) && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 text-lg leading-none mt-0.5">&#9888;</span>
                <div className="text-xs text-amber-200 leading-relaxed">
                  <span className="font-semibold">Non-owing line only.</span> This bundle only works for numbers that are <span className="font-semibold">not currently owing data</span>. If this number is owing, the purchase will fail and your money will be refunded.
                </div>
              </div>
            </div>
          )}

          <Button disabled={!plan} onClick={() => setStep("when")} variant="hero" className="w-full h-12 rounded-2xl">
            Continue
          </Button>
        </motion.div>
      )}

      {/* STEP 3: When */}
      {step === "when" && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> First run
            </label>
            <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)}
              className="w-full h-14 rounded-2xl bg-secondary/40 border border-white/10 px-4 mt-1.5 text-sm focus:outline-none focus:border-primary/50" />
            {!dateOk && <p className="text-[11px] text-red-400 mt-1">Must be at least 10 minutes in the future.</p>}
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Repeat className="h-3 w-3" /> Repeat
            </label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {FREQ_OPTIONS.map(o => (
                <button key={o.id} onClick={() => setFreq(o.id)}
                  className={`rounded-2xl p-3 border text-left transition ${freq === o.id ? "border-primary bg-primary/10" : "border-white/10 bg-white/[0.03] hover:bg-white/5"}`}>
                  <div className="text-sm font-semibold">{o.label}</div>
                  <div className="text-[10px] text-muted-foreground">{o.sub}</div>
                </button>
              ))}
            </div>
          </div>
          <Button disabled={!dateOk} onClick={() => setStep("confirm")} variant="hero" className="w-full h-12 rounded-2xl">
            Review
          </Button>
        </motion.div>
      )}

      {/* STEP 4: Confirm */}
      {step === "confirm" && plan && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
            <div className="flex items-center gap-2 text-primary text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" /> RESERVED IMMEDIATELY
            </div>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-muted-foreground">Recipient</span>
              <span className="text-right font-medium truncate">{recipientLabel || phone}</span>
              <span className="text-muted-foreground">Network</span>
              <span className="text-right font-medium">{network}</span>
              <span className="text-muted-foreground">Bundle</span>
              <span className="text-right font-medium">{plan.size} · {plan.validity}</span>
              <span className="text-muted-foreground">Amount</span>
              <span className="text-right font-bold">{naira(plan.sell_price)}</span>
              <span className="text-muted-foreground">Frequency</span>
              <span className="text-right font-medium">{FREQ_OPTIONS.find(f => f.id === freq)?.label}</span>
              <span className="text-muted-foreground">First run</span>
              <span className="text-right font-medium">{new Date(date).toLocaleString()}</span>
            </div>
            {/* Gift/Awoof warning in confirmation */}
            {isGiftPlan(plan.id) && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                <div className="flex items-start gap-2">
                  <span className="text-amber-400 text-sm leading-none mt-0.5">&#9888;</span>
                  <div className="text-xs text-amber-200 leading-relaxed">
                    <span className="font-semibold">Non-owing line required.</span> If {phone} is currently owing data, this purchase will fail and be refunded. <button type="button" onClick={() => setPlan(null)} className="text-amber-300 underline font-semibold cursor-pointer hover:text-amber-100 transition">Click here to see plans owing users can get</button>.
                  </div>
                </div>
              </div>
            )}

            {!fundsOk && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-[12px] text-red-400">
                Insufficient available balance. You have {naira(available)}, need {naira(plan.sell_price)}.
              </div>
            )}
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Confirm with PIN</label>
            <div className="mt-2 flex justify-center">
              <InputOTP maxLength={4} value={pin} onChange={setPin}>
                <InputOTPGroup>
                  {[0, 1, 2, 3].map(i => <InputOTPSlot key={i} index={i} className="h-14 w-14 text-xl" />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          <Button onClick={create} disabled={busy || pin.length !== 4 || !fundsOk}
            variant="hero" className="w-full h-14 rounded-2xl text-base">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle2 className="h-5 w-5 mr-2" /> Reserve & Schedule</>}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
