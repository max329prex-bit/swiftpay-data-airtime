import { motion } from "framer-motion";
import { Wifi, ArrowUpRight, Zap } from "lucide-react";
import { naira } from "@/lib/networks";

export function PhoneMock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: -4 }}
      animate={{ opacity: 1, y: 0, rotate: -4 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-[280px] sm:w-[320px]"
    >
      <div className="absolute -inset-10 -z-10 rounded-full bg-gradient-primary opacity-30 blur-3xl" />
      <div className="relative aspect-[9/19] rounded-[2.8rem] border border-white/15 bg-gradient-to-b from-[hsl(232_30%_10%)] to-[hsl(252_40%_8%)] p-3 shadow-[0_40px_120px_-20px_rgba(124,92,255,0.6)]">
        <div className="absolute left-1/2 top-3 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
        <div className="h-full overflow-hidden rounded-[2.2rem] bg-gradient-hero p-5">
          <div className="mt-6 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Wallet</div>
              <div className="font-display text-2xl font-bold">{naira(48230)}</div>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-mint shadow-mint">
              <ArrowUpRight className="h-4 w-4 text-accent-foreground" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {[{ i: Zap, l: "Airtime" }, { i: Wifi, l: "Data" }].map(({ i: Ic, l }) => (
              <div key={l} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <Ic className="h-4 w-4 text-primary" />
                <div className="mt-2 text-xs font-medium">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Recent</div>
            {[
              { n: "MTN", a: 1500, c: "hsl(48 100% 55%)" },
              { n: "Airtel Data", a: 800, c: "hsl(0 85% 55%)" },
              { n: "Glo Topup", a: 500, c: "hsl(138 70% 42%)" },
            ].map((t, i) => (
              <motion.div
                key={t.n}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.15 }}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: t.c }} />
                  <span className="text-xs">{t.n}</span>
                </div>
                <span className="text-xs font-semibold">-{naira(t.a)}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
