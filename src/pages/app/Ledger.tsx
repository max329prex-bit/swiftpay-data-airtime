import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/networks";
import { BoltLoader } from "@/components/blitz/BoltLoader";
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

type LedgerRow = { id: string; amount: number; direction: string; balance_before: number; balance_after: number; reason: string; reference: string | null; created_at: string; };

export default function Ledger() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [entries, setEntries] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("wallet_ledger").select("id, amount, direction, balance_before, balance_after, reason, reference, created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => { setEntries((data || []) as LedgerRow[]); setLoading(false); });
  }, [user]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => nav(-1)} className="grid h-9 w-9 place-items-center rounded-full glass text-muted-foreground"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="font-display text-2xl font-semibold">Wallet Ledger</h1>
          <p className="text-xs text-muted-foreground">Full balance movement history</p>
        </div>
      </div>

      {loading ? <div className="py-16 grid place-items-center"><BoltLoader size={56} label="Loading ledger..." /></div>
       : entries.length === 0 ? (
        <div className="glass grid place-items-center gap-3 rounded-3xl p-10 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No ledger entries yet.</p>
        </div>
       ) : (
        <div className="space-y-2">
          {entries.map((e) => {
            const isCredit = e.direction === "credit";
            return (
              <div key={e.id} className="glass rounded-2xl p-4 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`grid h-9 w-9 place-items-center rounded-xl flex-shrink-0 ${isCredit ? "bg-green-400/10 text-green-400" : "bg-destructive/10 text-destructive"}`}>
                      {isCredit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold capitalize">{e.reason.replace(/_/g, " ")}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(e.created_at).toLocaleString("en-NG", { dateStyle: "short", timeStyle: "short" })}</p>
                    </div>
                  </div>
                  <p className={`text-sm font-bold ${isCredit ? "text-green-400" : "text-destructive"}`}>
                    {isCredit ? "+" : "-"}{naira(Number(e.amount))}
                  </p>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground bg-white/[0.03] rounded-lg px-3 py-2">
                  <span>Before: <span className="text-foreground font-medium">{naira(Number(e.balance_before))}</span></span>
                  <span className="text-white/20">-&gt;</span>
                  <span>After: <span className="text-foreground font-medium">{naira(Number(e.balance_after))}</span></span>
                </div>
                {e.reference && <p className="text-[9px] text-muted-foreground font-mono truncate">{e.reference}</p>}
              </div>
            );
          })}
        </div>
       )}
    </motion.div>
  );
}
