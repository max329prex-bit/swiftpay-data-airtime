import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/networks";
import { BoltLoader } from "@/components/swift/BoltLoader";
import { ArrowLeft, Share2, CheckCircle2, XCircle, Clock, Copy, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return (
    <div className="flex items-center gap-1.5 text-green-400 font-semibold text-sm">
      <CheckCircle2 className="h-5 w-5" /> Successful
    </div>
  );
  if (status === "failed" || status === "reversed") return (
    <div className="flex items-center gap-1.5 text-destructive font-semibold text-sm">
      <XCircle className="h-5 w-5" /> {status === "reversed" ? "Reversed" : "Failed"}
    </div>
  );
  return (
    <div className="flex items-center gap-1.5 text-warning font-semibold text-sm">
      <Clock className="h-5 w-5" /> {status.charAt(0).toUpperCase() + status.slice(1)}
    </div>
  );
}

export default function Receipt() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [tx, setTx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from("transactions").select("*").eq("id", id).single()
      .then(({ data }) => { setTx(data); setLoading(false); });
  }, [id]);

  function copyRef() {
    if (!tx) return;
    navigator.clipboard.writeText(tx.reference);
    setCopied(true);
    toast.success("Reference copied");
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareReceipt() {
    if (!tx) return;
    const text = `BlitzPay Receipt\n\n${tx.type.replace(/_/g, " ").toUpperCase()}\nAmount: ${naira(Number(tx.amount))}\nNetwork: ${tx.network || "N/A"}\nPhone: ${tx.phone || "N/A"}\nStatus: ${tx.status.toUpperCase()}\nRef: ${tx.reference}\nDate: ${new Date(tx.created_at).toLocaleString("en-NG")}`;
    if (navigator.share) {
      await navigator.share({ title: "BlitzPay Receipt", text });
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Receipt text copied to clipboard");
    }
  }

  if (loading) return (
    <div className="py-16 grid place-items-center">
      <BoltLoader size={56} label="Loading receipt..." />
    </div>
  );

  if (!tx) return (
    <div className="py-16 grid place-items-center gap-3">
      <p className="text-muted-foreground text-sm">Receipt not found.</p>
    </div>
  );

  const isCredit = tx.type === "wallet_topup" || tx.type === "wallet_fund";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="pb-10">
      <button onClick={() => nav(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-5">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="glass rounded-3xl overflow-hidden border border-white/10">
        <div className={`h-1.5 w-full ${tx.status === "success" ? "bg-gradient-primary" : tx.status === "failed" ? "bg-destructive" : "bg-warning"}`} />
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-display text-lg font-bold tracking-tight">BlitzPay</span>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Official Receipt</p>
            </div>
            <StatusBadge status={tx.status} />
          </div>

          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Amount</p>
            <p className={`font-display text-4xl font-bold ${isCredit ? "text-green-400" : "text-foreground"}`}>
              {isCredit ? "+" : ""}{naira(Number(tx.amount))}
            </p>
          </div>

          <div className="flex items-center gap-1 overflow-hidden">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="h-px w-2 bg-white/10 flex-shrink-0" />
            ))}
          </div>

          <div className="space-y-0">
            {[
              { label: "Type", value: tx.type.replace(/_/g, " ").toUpperCase() },
              tx.network && { label: "Network", value: tx.network.toUpperCase() },
              tx.phone && { label: "Phone Number", value: tx.phone },
              { label: "Date & Time", value: new Date(tx.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) },
              { label: "Status", value: tx.status.toUpperCase() },
            ].filter(Boolean).map((row: any) => (
              <div key={row.label} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
                <span className="text-xs text-muted-foreground">{row.label}</span>
                <span className="text-xs font-semibold text-foreground">{row.value}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1 overflow-hidden">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="h-px w-2 bg-white/10 flex-shrink-0" />
            ))}
          </div>

          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Transaction Reference</p>
            <button onClick={copyRef} className="w-full flex items-center justify-between glass rounded-xl px-4 py-3 hover:border-primary/30 transition">
              <span className="text-xs font-mono text-foreground truncate">{tx.reference}</span>
              {copied ? <CheckCheck className="h-4 w-4 text-green-400 flex-shrink-0 ml-2" /> : <Copy className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />}
            </button>
          </div>

          {tx.status !== "success" && (
            <p className="text-[10px] text-center text-muted-foreground">
              If you were charged but did not receive service, contact support with your reference.
            </p>
          )}
        </div>
      </div>

      <button onClick={shareReceipt} className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-4 font-semibold text-white shadow-glow">
        <Share2 className="h-4 w-4" />
        Share Receipt
      </button>
    </motion.div>
  );
}
