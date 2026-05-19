import { Link } from "react-router-dom";
import { ArrowRight, Zap, Wifi, ShieldCheck, Sparkles, Wallet, Clock, Gift, Lock, Smartphone, Download, Check, Star, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const NETWORKS = [
  { id: "MTN", color: "#facc15" },
  { id: "Glo", color: "#22c55e" },
  { id: "Airtel", color: "#ef4444" },
  { id: "9mobile", color: "#16a34a" },
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
  { q: "Is BlitzPay free?", a: "Yes. Creating an account, topping up your wallet, and buying airtime or data costs nothing extra. We make money from network commissions and pass the savings back to you as cashback." },
  { q: "Which networks are supported?", a: "All four major Nigerian networks — MTN, Glo, Airtel, and 9mobile — for both airtime and data." },
  { q: "How long does delivery take?", a: "Airtime is typically delivered in under 5 seconds. Data bundles activate within 30 seconds." },
  { q: "Is my money safe?", a: "Your wallet balance is held in a regulated escrow account. Every transaction is PIN-protected and we never store your card details." },
];

function SiteNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900">
              <Zap className="h-4 w-4 text-white" fill="white" />
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Blitz<span className="text-blue-600">Pay</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Features</a>
            <a href="#how" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">How it works</a>
            <a href="#pricing" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Pricing</a>
            <a href="#faq" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">FAQ</a>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/auth?mode=signup"><Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white">Get started</Button></Link>
          </div>
          <button className="md:hidden" onClick={() => setOpen(!open)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="border-t border-slate-100 py-4 md:hidden space-y-3">
            <a href="#features" className="block text-sm text-slate-600" onClick={() => setOpen(false)}>Features</a>
            <a href="#how" className="block text-sm text-slate-600" onClick={() => setOpen(false)}>How it works</a>
            <a href="#pricing" className="block text-sm text-slate-600" onClick={() => setOpen(false)}>Pricing</a>
            <a href="#faq" className="block text-sm text-slate-600" onClick={() => setOpen(false)}>FAQ</a>
            <div className="flex gap-2 pt-2">
              <Link to="/auth" className="flex-1"><Button variant="outline" className="w-full" size="sm">Sign in</Button></Link>
              <Link to="/auth?mode=signup" className="flex-1"><Button className="w-full bg-slate-900 text-white" size="sm">Get started</Button></Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function PhoneMockLight() {
  return (
    <div className="relative mx-auto w-[260px] sm:w-[300px]">
      <div className="absolute -inset-8 -z-10 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="relative aspect-[9/19] rounded-[2.4rem] border border-slate-200 bg-slate-900 p-2.5 shadow-[0_40px_100px_-20px_rgba(15,23,42,0.3)]">
        <div className="absolute left-1/2 top-2.5 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
        <div className="h-full overflow-hidden rounded-[1.8rem] bg-slate-950 p-4">
          <div className="mt-5 flex items-center justify-between">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-slate-400">Wallet</div>
              <div className="text-xl font-bold text-white">₦48,230</div>
            </div>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-blue-500">
              <ArrowRight className="h-3 w-3 text-white" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[{ i: Zap, l: "Airtime" }, { i: Wifi, l: "Data" }].map(({ i: Ic, l }) => (
              <div key={l} className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <Ic className="h-3.5 w-3.5 text-blue-400" />
                <div className="mt-1.5 text-[10px] font-medium text-white">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="text-[9px] uppercase tracking-widest text-slate-400">Recent</div>
            {[
              { n: "MTN", a: "₦1,500", c: "#facc15" },
              { n: "Airtel Data", a: "₦800", c: "#ef4444" },
              { n: "Glo Topup", a: "₦500", c: "#22c55e" },
            ].map((t) => (
              <div key={t.n} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.c }} />
                  <span className="text-[10px] text-slate-200">{t.n}</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-300">-{t.a}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Index() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteNav />

      {/* HERO */}
      <section className="relative px-4 pt-16 pb-20 sm:pt-24 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[800px] rounded-full bg-blue-50 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-slate-50 blur-3xl" />
        </div>
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
              </span>
              Now live across Nigeria
            </div>
            <h1 className="mt-6 text-5xl font-bold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl text-slate-900">
              Airtime & data,<br />
              <span className="text-blue-600">in a swipe.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-slate-500">
              BlitzPay is the smartest way to top up any Nigerian network and pay your bills — airtime, data, electricity and cable TV, all in one wallet.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/auth?mode=signup"><Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-6">Start free <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
              <a href="#how"><Button variant="outline" size="lg" className="rounded-full px-6 border-slate-200">See how it works</Button></a>
              <a href="/downloads/blitzpay.apk" download><Button variant="outline" size="lg" className="rounded-full px-6 border-slate-200"><Download className="mr-1 h-4 w-4" /> Download App</Button></a>
            </div>
            <div className="mt-10 flex items-center gap-6">
              <div>
                <div className="text-2xl font-bold text-slate-900">120k+</div>
                <div className="text-xs text-slate-400">happy users</div>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div>
                <div className="text-2xl font-bold text-slate-900">₦8.4B</div>
                <div className="text-xs text-slate-400">delivered</div>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div>
                <div className="text-2xl font-bold text-slate-900">4.9★</div>
                <div className="text-xs text-slate-400">avg rating</div>
              </div>
            </div>
          </div>
          <div className="relative flex justify-center">
            <PhoneMockLight />
          </div>
        </div>

        {/* Networks strip */}
        <div className="mx-auto mt-20 max-w-5xl">
          <div className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Works with every major network</div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-6">
            {NETWORKS.map((n) => (
              <div key={n.id} className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-5 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: n.color }} />
                <span className="text-sm font-semibold text-slate-700">{n.id}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="px-4 py-24 bg-slate-50/50">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl text-slate-900">Everything you need.<br /><span className="text-blue-600">Nothing you don't.</span></h2>
            <p className="mt-4 text-slate-500">Built from the ground up for the way Nigerians actually use their phones.</p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="group rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50">
                  <f.icon className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
            <div>
              <h2 className="text-4xl font-bold tracking-tight sm:text-5xl text-slate-900">From zero to topped-up in <span className="text-blue-600">60 seconds</span>.</h2>
            </div>
            <div className="space-y-4">
              {STEPS.map((s) => (
                <div key={s.n} className="flex gap-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                  <div className="text-4xl font-bold text-blue-600/30">{s.n}</div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{s.t}</h3>
                    <p className="mt-1 text-sm text-slate-500">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CASHBACK / PRICING */}
      <section id="pricing" className="px-4 py-24 bg-slate-50/50">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl text-slate-900">Get paid to top up.</h2>
            <p className="mt-4 text-slate-500">The more you use BlitzPay, the more you earn. Cashback is credited instantly to your wallet.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TIERS.map((t) => (
              <div key={t.tier} className={`relative rounded-2xl p-6 ${t.featured ? "bg-slate-900 text-white shadow-xl" : "bg-white border border-slate-100 shadow-sm"}`}>
                {t.featured && <div className="absolute -top-3 left-6 rounded-full bg-blue-500 px-3 py-1 text-xs font-bold text-white">Most popular</div>}
                <div className={`text-sm ${t.featured ? "text-slate-300" : "text-slate-500"}`}>{t.tier}</div>
                <div className={`mt-2 text-5xl font-bold ${t.featured ? "text-white" : "text-slate-900"}`}>{t.cashback}</div>
                <div className={`mt-1 text-xs ${t.featured ? "text-slate-400" : "text-slate-400"}`}>cashback · {t.base}</div>
                <ul className="mt-6 space-y-2 text-sm">
                  {t.perks.map(p => <li key={p} className={`flex items-center gap-2 ${t.featured ? "text-slate-300" : "text-slate-600"}`}><Check className={`h-3.5 w-3.5 ${t.featured ? "text-blue-400" : "text-blue-600"}`} />{p}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-10 text-center sm:p-16">
            <div className="absolute -top-32 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl" />
            <Smartphone className="mx-auto h-10 w-10 text-blue-400" />
            <h2 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">Your wallet. Your network.<br />Your seconds back.</h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300">Join 120,000+ Nigerians who never type a USSD code anymore.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/auth?mode=signup"><Button size="lg" className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-6">Create free account <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
              <a href="/downloads/blitzpay.apk" download><Button variant="outline" size="lg" className="rounded-full px-6 border-slate-600 text-white hover:bg-slate-800 hover:text-white"><Download className="mr-1 h-4 w-4" /> Download App</Button></a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-4 py-24 bg-slate-50/50">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-4xl font-bold tracking-tight sm:text-5xl text-slate-900">Questions? <span className="text-blue-600">Answered.</span></h2>
          <div className="mt-10 space-y-3">
            {FAQS.map((f, i) => (
              <details key={i} className="group rounded-2xl border border-slate-100 bg-white px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-left font-semibold text-slate-900">
                  {f.q}
                  <span className="ml-4 transition group-open:rotate-180"><ArrowRight className="h-4 w-4 rotate-45" /></span>
                </summary>
                <p className="mt-3 text-sm text-slate-500">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 px-4 py-10 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="inline-flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-900">
              <Zap className="h-3.5 w-3.5 text-white" fill="white" />
            </span>
            <span className="text-sm font-bold text-slate-900">BlitzPay</span>
          </div>
          <div className="text-xs text-slate-400">© {new Date().getFullYear()} BlitzPay. All rights reserved.</div>
          <div className="flex items-center gap-2 text-xs text-slate-400"><Lock className="h-3 w-3" /> Secured with bank-grade encryption</div>
        </div>
      </footer>
    </div>
  );
}
