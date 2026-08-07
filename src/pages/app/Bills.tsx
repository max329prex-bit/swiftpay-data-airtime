import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Wifi, BatteryCharging, Tv, Receipt, CalendarClock } from "lucide-react";
import { Card, SectionHeader, ListRow, IconPlate, StatPill } from "@/components/blitz/ui/Surface";

const BILLS = [
  { i: Zap, l: "Airtime", d: "All networks, instant top up", to: "/app/airtime", tint: "text-network-mtn bg-network-mtn/12" },
  { i: Wifi, l: "Data Bundles", d: "MTN, Airtel, Glo, 9mobile", to: "/app/data", tint: "text-primary bg-primary/12" },
  { i: BatteryCharging, l: "Electricity", d: "Pay any disco bill", to: "/app/electricity", tint: "text-accent bg-accent/12" },
  { i: Tv, l: "Cable TV", d: "DStv, GOtv, StarTimes", to: "/app/cable", tint: "text-network-airtel bg-network-airtel/12" },
];

export default function Bills() {
  const nav = useNavigate();
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Bill payment</div>
        <h1 className="mt-1 font-display text-[26px] font-bold leading-tight tracking-tight">Pay anything, instantly.</h1>
      </motion.div>

      <div>
        <SectionHeader title="Services" />
        <div className="grid grid-cols-2 gap-3">
          {BILLS.map((b, idx) => (
            <motion.div key={b.l} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05, duration: 0.4 }}>
              <Link to={b.to} className="press surface flex h-full flex-col gap-3 rounded-3xl p-4">
                <span className={`grid h-11 w-11 place-items-center rounded-2xl ${b.tint}`}>
                  <b.i className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <div>
                  <div className="text-[13.5px] font-semibold leading-tight">{b.l}</div>
                  <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{b.d}</div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader title="More" />
        <Card delay={0.1} className="divide-y divide-[hsl(var(--hairline))] overflow-hidden">
          <ListRow
            onClick={() => nav("/app/schedules")}
            icon={<IconPlate tint="gradient" size="lg"><CalendarClock className="h-[18px] w-[18px]" /></IconPlate>}
            title="BlitzData Scheduler"
            badge={<StatPill tone="info">New</StatPill>}
            subtitle="Auto renew, family and friends, reserved funds"
          />
          <ListRow
            onClick={() => nav("/app/history")}
            icon={<IconPlate tint="muted" size="lg"><Receipt className="h-[18px] w-[18px]" /></IconPlate>}
            title="Transaction history"
            subtitle="Receipts and past payments"
          />
        </Card>
      </div>
    </div>
  );
}
