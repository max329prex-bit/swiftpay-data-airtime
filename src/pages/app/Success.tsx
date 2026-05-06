import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Receipt, RotateCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { naira } from "@/lib/networks";

export default function Success() {
  const [p] = useSearchParams();
  const ref = p.get("ref");
  const type = p.get("type") ?? "airtime";
  const amount = Number(p.get("amount") ?? 0);
  const network = p.get("network");
  const bundle = p.get("bundle");

  return (
    <div className="space-y-6 pb-10 pt-6 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-mint shadow-mint">
        <Check className="h-12 w-12 text-accent-foreground" strokeWidth={3} />
      </motion.div>
      <div>
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="font-display text-3xl font-bold">Transaction successful</motion.h1>
        <p className="mt-2 text-sm text-muted-foreground">Your {type === "data" ? `${bundle} data` : "airtime"} on {network} is on its way.</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="glass rounded-3xl p-5 text-left">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <span className="text-xs text-muted-foreground">Amount</span>
          <span className="font-display text-xl font-bold">{naira(amount)}</span>
        </div>
        <div className="space-y-2 pt-3 text-sm">
          <Row k="Type" v={<span className="capitalize">{type}</span>} />
          <Row k="Network" v={network} />
          {bundle && <Row k="Bundle" v={bundle} />}
          <Row k="Reference" v={<span className="font-mono text-xs">{ref}</span>} />
          <Row k="Status" v={<span className="text-success font-semibold">Successful</span>} />
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-2">
        <Link to={`/app/${type}`}><Button variant="soft" className="w-full"><RotateCw /> Buy again</Button></Link>
        <Link to="/app/history"><Button variant="soft" className="w-full"><Receipt /> View history</Button></Link>
      </div>
      <Link to="/app"><Button variant="hero" size="xl" className="w-full"><Home /> Back home</Button></Link>
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{k}</span><span>{v}</span></div>;
}
