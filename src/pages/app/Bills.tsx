import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Wifi, BatteryCharging, Tv, ChevronRight, Receipt } from "lucide-react";

const BILLS = [
  { i: Zap, l: "Airtime", d: "All networks · instant top-up", to: "/app/airtime", grad: "from-yellow-400 to-orange-500" },
  { i: Wifi, l: "Data Bundles", d: "MTN · Airtel · Glo · 9mobile", to: "/app/data", grad: "from-primary to-accent" },
  { i: BatteryCharging, l: "Electricity", d: "Pay any disco bill", to: "/app/electricity", grad: "from-emerald-400 to-teal-500" },
  { i: Tv, l: "Cable TV", d: "DStv · GOtv · StarTimes", to: "/app/cable", grad: "from-fuchsia-500 to-purple-600" },
];

export default function Bills() {
  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-sm text-muted-foreground">Bill Payment</div>
        <div className="font-display text-2xl font-semibold">Pay anything, instantly.</div>
      </motion.div>

      <div className="space-y-3">
        {BILLS.map((b, idx) => (
          <motion.div key={b.l} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
            <Link to={b.to} className="group relative flex items-center gap-4 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-primary/40 hover:bg-white/[0.06]">
              <span className={`grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${b.grad} shadow-lg`}>
                <b.i className="h-5 w-5 text-white" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{b.l}</div>
                <div className="truncate text-[11px] text-muted-foreground">{b.d}</div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
          </motion.div>
        ))}
      </div>

      <Link to="/app/history" className="glass mt-2 flex items-center justify-between rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary/40"><Receipt className="h-4 w-4" /></span>
          <div>
            <div className="text-sm font-semibold">Transaction history</div>
            <div className="text-[11px] text-muted-foreground">Receipts & past payments</div>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </div>
  );
}