import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Zap, Wifi, ShieldCheck, Sparkles, Wallet, Clock, Gift, Lock, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SiteNav } from "@/components/swift/SiteNav";
import { Logo } from "@/components/swift/Logo";
import { PhoneMock } from "@/components/swift/PhoneMock";

const NETWORKS = [
  { id: "MTN", color: "hsl(48 100% 55%)" },
  { id: "Glo", color: "hsl(138 70% 42%)" },
  { id: "Airtel", color: "hsl(0 85% 55%)" },
  { id: "9mobile", color: "hsl(142 60% 35%)" },
];

const FEATURES = [
  { icon: Zap, title: "Lightning fast", desc: "Airtime delivered in seconds. No more endless USSD codes or failed top-ups." },
  { icon: Gift, title: "Cashback on every buy", desc: "Earn up to 4% back on every airtime and data purchase, automatically." },
  { icon: ShieldCheck, title: "Bank-grade security", desc: "PIN-protected payments, biometric login, and end-to-end encrypted data." },
  { icon: Wallet, title: "One smart wallet", desc: "Top up once, spend anywhere. Never enter your card on a small site again." },
  { icon: Clock, title: "Schedule top-ups", desc: "Auto top-up Mum every Monday. Set it once. We handle the rest." },
  { icon: Sparkles, title: "Beneficiaries", desc: "Save numbers with nicknames. Two taps to send airtime to anyone." },
];

const STEPS = [
  { n: "01", t: "Create your wallet", d: "Sign up in 30 seconds with email or Google. No paperwork, no waiting." },
  { n: "02", t: "Top up once", d: "Fund instantly via bank transfer or card. Your balance is ready immediately." },
  { n: "03", t: "Buy & earn cashback", d: "Pick a network, enter the number, tap pay. Earn cashback on every purchase." },
];

const TIERS = [
  { tier: "Starter", base: "0–₦5k / month", cashback: "1.5%", perks: ["No fees", "All networks", "Email support"] },
  { tier: "Plus", base: "₦5k–₦50k / month", cashback: "2.5%", perks: ["Priority delivery", "Schedule top-ups", "Live chat"], featured: true },
  { tier: "Elite", base: "₦50k+ / month", cashback: "4%", perks: ["VIP support", "Bulk uploads", "Free withdrawals"] },
];

const FAQS = [
  { q: "Is SwiftPay free?", a: "Yes. Creating an account, topping up your wallet, and buying airtime or data costs nothing extra. We make money from network commissions and pass the savings back to you as cashback." },
  { q: "Which networks are supported?", a: "All four major Nigerian networks — MTN, Glo, Airtel, and 9mobile — for both airtime and data." },
  { q: "How long does delivery take?", a: "Airtime is typically delivered in under 5 seconds. Data bundles activate within 30 seconds." },
  { q: "Is my money safe?", a: "Your wallet balance is held in a regulated escrow account. Every transaction is PIN-protected and we never store your card details." },
];

export default function Index() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <SiteNav />

      {/* HERO */}
      <section className="relative px-4 pt-12 sm:pt-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              Now live across Nigeria
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
              className="mt-5 font-display text-5xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl">
              Airtime & data,<br />
              <span className="text-gradient">in a swipe.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25 }}
              className="mt-6 max-w-lg text-lg text-muted-foreground">
              SwiftPay is the smartest way to top up any Nigerian network. Earn cashback on every purchase, schedule top-ups, and pay friends in two taps.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/auth?mode=signup"><Button variant="hero" size="xl">Start free <ArrowRight /></Button></Link>
              <a href="#how"><Button variant="glass" size="xl">See how it works</Button></a>
            </motion.div>
            <div className="mt-10 flex items-center gap-6">
              <div>
                <div className="font-display text-2xl font-bold">120k+</div>
                <div className="text-xs text-muted-foreground">happy users</div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <div className="font-display text-2xl font-bold">₦8.4B</div>
                <div className="text-xs text-muted-foreground">delivered</div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <div className="font-display text-2xl font-bold">4.9★</div>
                <div className="text-xs text-muted-foreground">avg rating</div>
              </div>
            </div>
          </div>
          <div className="relative">
            <PhoneMock />
          </div>
        </div>

        {/* Networks strip */}
        <div className="mx-auto mt-20 max-w-5xl">
          <div className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">Works with every major network</div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-6">
            {NETWORKS.map((n) => (
              <div key={n.id} className="glass flex items-center gap-3 rounded-2xl px-5 py-3">
                <span className="h-3 w-3 rounded-full" style={{ background: n.color, boxShadow: `0 0 18px ${n.color}` }} />
                <span className="font-display text-lg font-semibold">{n.id}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-4xl font-bold sm:text-5xl">Everything you need.<br /><span className="text-gradient-mint">Nothing you don't.</span></h2>
            <p className="mt-4 text-muted-foreground">Built from the ground up for the way Nigerians actually use their phones.</p>
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.5 }}
                className="group glass relative overflow-hidden rounded-3xl p-6 transition-all hover:border-primary/40 hover:shadow-glow">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
                  <f.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="relative px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
            <div>
              <h2 className="font-display text-4xl font-bold sm:text-5xl">From zero to topped-up in <span className="text-gradient">60 seconds</span>.</h2>
            </div>
            <div className="space-y-3">
              {STEPS.map((s, i) => (
                <motion.div key={s.n} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="glass flex gap-5 rounded-3xl p-6">
                  <div className="font-display text-4xl font-bold text-gradient">{s.n}</div>
                  <div>
                    <h3 className="font-display text-xl font-semibold">{s.t}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CASHBACK / PRICING */}
      <section id="pricing" className="relative px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-4xl font-bold sm:text-5xl">Get paid to top up.</h2>
            <p className="mt-4 text-muted-foreground">The more you use SwiftPay, the more you earn. Cashback is credited instantly to your wallet.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {TIERS.map((t) => (
              <div key={t.tier} className={`relative rounded-3xl p-6 ${t.featured ? "bg-gradient-card border border-primary/40 shadow-glow" : "glass"}`}>
                {t.featured && <div className="absolute -top-3 left-6 rounded-full bg-gradient-mint px-3 py-1 text-xs font-bold text-accent-foreground">Most popular</div>}
                <div className="text-sm text-muted-foreground">{t.tier}</div>
                <div className="mt-2 font-display text-5xl font-bold text-gradient">{t.cashback}</div>
                <div className="mt-1 text-xs text-muted-foreground">cashback • {t.base}</div>
                <ul className="mt-6 space-y-2 text-sm">
                  {t.perks.map(p => <li key={p} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-accent" />{p}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-4 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-card p-10 text-center sm:p-16">
            <div className="absolute -top-32 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/40 blur-3xl" />
            <Smartphone className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-4 font-display text-4xl font-bold sm:text-5xl">Your wallet. Your network.<br />Your seconds back.</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Join 120,000+ Nigerians who never type a USSD code anymore.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/auth?mode=signup"><Button variant="hero" size="xl">Create free account <ArrowRight /></Button></Link>
              <Link to="/app"><Button variant="glass" size="xl">Try the app</Button></Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative px-4 py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center font-display text-4xl font-bold sm:text-5xl">Questions? <span className="text-gradient">Answered.</span></h2>
          <Accordion type="single" collapsible className="mt-10 space-y-3">
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`q${i}`} className="glass rounded-2xl border-none px-5">
                <AccordionTrigger className="text-left font-display text-lg font-semibold hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <footer className="border-t border-border/40 px-4 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Logo />
          <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} SwiftPay. All rights reserved.</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> Secured with bank-grade encryption</div>
        </div>
      </footer>
    </div>
  );
}
