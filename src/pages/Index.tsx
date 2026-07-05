import { Link } from "react-router-dom";
import { ArrowRight, Zap, Wifi, ShieldCheck, Sparkles, Wallet, Gift, Lock, Download, Check, Menu, X, Tv, Lightbulb, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import heroGirl from "@/assets/hero-girl.jpg";

const NETWORKS = [
  { id: "MTN", color: "#facc15" },
  { id: "Glo", color: "#22c55e" },
  { id: "Airtel", color: "#ef4444" },
  { id: "9mobile", color: "#16a34a" },
];

const SERVICES = [
  { icon: Phone, title: "Airtime", desc: "Instant top-up on MTN, Glo, Airtel and 9mobile.", to: "/auth?mode=signup" },
  { icon: Wifi, title: "Data bundles", desc: "From daily plans to monthly mega-bundles, all networks.", to: "/auth?mode=signup" },
  { icon: Lightbulb, title: "Electricity", desc: "Pay any DISCO and get your token in seconds.", to: "/auth?mode=signup" },
  { icon: Tv, title: "Cable TV", desc: "DStv, GOtv and Startimes — no queues, no stress.", to: "/auth?mode=signup" },
];

const FEATURES = [
  { icon: Zap, title: "Instant delivery", desc: "Most transactions complete in under 5 seconds, 24/7." },
  { icon: Gift, title: "Earn BlitzPoints", desc: "Get 5 BlitzPoints for every ₦250 you spend on airtime or data." },
  { icon: Sparkles, title: "Redeem 1GB free", desc: "Swap 100 BlitzPoints for a free 1GB data bundle, any network." },
  { icon: ShieldCheck, title: "PIN-protected", desc: "Every transaction is locked behind a 4-digit transaction PIN." },
  { icon: Wallet, title: "One secure wallet", desc: "Fund once, pay anything. No re-entering card details." },
  { icon: Lock, title: "Encrypted end-to-end", desc: "Built on Supabase auth with row-level security on every record." },
];

const STEPS = [
  { n: "01", t: "Sign up free", d: "Create your BlitzPay account with email in 30 seconds." },
  { n: "02", t: "Fund your wallet", d: "Top up securely. Your balance is ready instantly." },
  { n: "03", t: "Pay & earn points", d: "Buy airtime, data or pay a bill — and earn BlitzPoints as you go." },
];

const FAQS = [
  { q: "Is BlitzPay free to use?", a: "Yes. Creating an account, funding your wallet, and buying airtime or data costs nothing extra. You only pay the face value of what you're buying." },
  { q: "What are BlitzPoints?", a: "Our built-in rewards. You earn 5 BlitzPoints for every ₦250 you spend on airtime or data. When you hit 100 points, you can redeem a free 1GB data bundle on any network." },
  { q: "Which networks and services are supported?", a: "All four major Nigerian networks — MTN, Glo, Airtel and 9mobile — for airtime and data, plus electricity (all major DISCOs) and cable TV (DStv, GOtv, Startimes)." },
  { q: "How long does delivery take?", a: "Airtime and data are typically delivered in under 5 seconds. Electricity tokens arrive within 30 seconds." },
  { q: "Is my money safe?", a: "Every transaction is locked behind a 4-digit PIN, your session is encrypted, and your data is protected with row-level security. We never store your card details." },
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
            <a href="#services" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Services</a>
            <a href="#features" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Why BlitzPay</a>
            <a href="#rewards" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Rewards</a>
            <a href="#faq" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">FAQ</a>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/auth?mode=signup"><Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white">Get started</Button></Link>
          </div>
          <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="border-t border-slate-100 py-4 md:hidden space-y-3">
            <a href="#services" className="block text-sm text-slate-600" onClick={() => setOpen(false)}>Services</a>
            <a href="#features" className="block text-sm text-slate-600" onClick={() => setOpen(false)}>Why BlitzPay</a>
            <a href="#rewards" className="block text-sm text-slate-600" onClick={() => setOpen(false)}>Rewards</a>
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

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-10 -z-10 rounded-[3rem] bg-gradient-to-tr from-blue-500/20 via-blue-300/10 to-transparent blur-3xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-100 bg-blue-50 shadow-[0_40px_120px_-30px_rgba(37,99,235,0.45)]">
        <img
          src={heroGirl}
          alt="Young Nigerian woman topping up airtime on BlitzPay"
          width={1024}
          height={1280}
          className="aspect-[4/5] w-full object-cover"
        />
        <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/40 bg-white/90 p-3 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-yellow-400">
                <Phone className="h-4 w-4 text-slate-900" />
              </span>
              <div>
                <div className="text-xs font-semibold text-slate-900">MTN Airtime · ₦1,000</div>
                <div className="text-[10px] text-slate-500">Delivered in 3s · +20 BlitzPoints</div>
              </div>
            </div>
            <Check className="h-5 w-5 rounded-full bg-emerald-500 p-1 text-white" />
          </div>
        </div>
      </div>
      <div className="absolute -right-2 -top-2 rotate-3 rounded-2xl border border-blue-100 bg-white px-3 py-2 shadow-lg sm:-right-4 sm:-top-4">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600"><Gift className="h-3.5 w-3.5 text-white" /></span>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">BlitzPoints</div>
            <div className="text-sm font-bold text-slate-900">100 = 1GB free</div>
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
      <section className="relative px-4 pt-12 pb-20 sm:pt-20 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[800px] rounded-full bg-blue-50 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-slate-50 blur-3xl" />
        </div>
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
              </span>
              Built for Nigeria · Live now
            </div>
            <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl text-slate-900">
              Airtime, data<br />& bills —<br />
              <span className="text-blue-600">paid in a swipe.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-slate-500">
              One wallet for MTN, Glo, Airtel, 9mobile, your DISCO bill and your cable TV subscription. Earn BlitzPoints on every purchase and redeem them for free data.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/auth?mode=signup"><Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-6">Start free <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
              <a href="https://github.com/max329prex-bit/swiftpay-data-airtime/releases/download/v1.0.0-apk/blitzpay.apk" download target="_blank" rel="noopener noreferrer"><Button size="lg" className="rounded-full px-6 bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-sm"><Download className="mr-1 h-4 w-4" /> Download App</Button></a>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-blue-600" /> No hidden fees</div>
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-blue-600" /> Instant delivery</div>
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-blue-600" /> PIN-protected</div>
            </div>
          </div>
          <div className="relative flex justify-center">
            <HeroVisual />
          </div>
        </div>

        <div className="mx-auto mt-20 max-w-5xl">
          <div className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Every major Nigerian network</div>
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

      {/* SERVICES */}
      <section id="services" className="px-4 py-20 bg-slate-50/50">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl text-slate-900">Everything you used to queue for.<br /><span className="text-blue-600">Now in your pocket.</span></h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s) => (
              <Link key={s.title} to={s.to} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group block">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600 text-white group-hover:scale-110 transition-transform">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{s.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl text-slate-900">Why people switch<br /><span className="text-blue-600">to BlitzPay.</span></h2>
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
      <section id="how" className="px-4 py-24 bg-slate-50/50">
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

      {/* REWARDS — real BlitzPoints program */}
      <section id="rewards" className="px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700">
                <Gift className="h-3.5 w-3.5" /> BlitzPoints rewards
              </div>
              <h2 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl text-slate-900">Spend airtime.<br />Earn free data.</h2>
              <p className="mt-4 max-w-md text-slate-500">Every ₦250 you spend on airtime or data earns you 5 BlitzPoints — automatically. Stack 100 points and redeem them for a free 1GB data bundle on any network. No fine print.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  { v: "₦250", l: "= 5 points" },
                  { v: "100 pts", l: "= 1GB free" },
                  { v: "Any", l: "network" },
                ].map((s) => (
                  <div key={s.l} className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm">
                    <div className="text-2xl font-bold text-slate-900">{s.v}</div>
                    <div className="mt-1 text-xs text-slate-500">{s.l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Link to="/auth?mode=signup"><Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6">Start earning <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-blue-100/60 blur-2xl" />
              <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-blue-900 p-8 text-white shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-widest text-blue-200">Your BlitzPoints</div>
                  <Gift className="h-5 w-5 text-blue-300" />
                </div>
                <div className="mt-3 text-6xl font-bold">87<span className="text-2xl text-blue-300"> / 100</span></div>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-blue-400 to-blue-200" />
                </div>
                <div className="mt-2 text-xs text-blue-200">13 points away from a free 1GB bundle</div>
                <div className="mt-6 space-y-2">
                  {[
                    { l: "MTN Airtime · ₦1,000", p: "+20" },
                    { l: "Glo Data 2GB · ₦1,500", p: "+30" },
                    { l: "Airtel Airtime · ₦500", p: "+10" },
                  ].map((r) => (
                    <div key={r.l} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs">
                      <span className="text-blue-100">{r.l}</span>
                      <span className="font-bold text-blue-300">{r.p}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-24 bg-slate-50/50">
        <div className="mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-10 text-center sm:p-16">
            <div className="absolute -top-32 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl" />
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Stop queuing.<br />Start swiping.</h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300">Create your free BlitzPay wallet today and pay your first bill in under a minute.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/auth?mode=signup"><Button size="lg" className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-6">Create free account <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
              <a href="https://github.com/max329prex-bit/swiftpay-data-airtime/releases/download/v1.0.0-apk/blitzpay.apk" download target="_blank" rel="noopener noreferrer"><Button variant="outline" size="lg" className="rounded-full px-6 border-slate-600 text-white hover:bg-slate-800 hover:text-white"><Download className="mr-1 h-4 w-4" /> Download App</Button></a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-4 py-24">
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