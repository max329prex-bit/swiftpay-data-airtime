import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/networks";
import { BoltLoader } from "@/components/blitz/BoltLoader";
import { ArrowLeft, Copy, CheckCheck, Receipt, LifeBuoy, RefreshCw, Clock, CheckCircle2, XCircle, AlertCircle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

function statusColor(s: string) {
  if (s === "success") return "text-green-400";
  if (s === "failed" || s === "reversed") return "text-destructive";
  if (s === "verifying" || s === "processing") return "text-blue-400";
  if (s === "refunded") return "text-purple-400";
  return "text-warning";
}

function statusBg(s: string) {
  if (s === "success") return "bg-green-400/10 border-green-400/20";
  if (s === "failed" || s === "reversed") return "bg-destructive/10 border-destructive/20";
  if (s === "verifying" || s === "processing") return "bg-blue-400/10 border-blue-400/20";
  if (s === "refunded") return "bg-purple-400/10 border-purple-400/20";
  return "bg-warning/10 border-warning/20";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 className="h-5 w-5 text-green-400" />;
  if (status === "failed" || status === "reversed") return <XCircle className="h-5 w-5 text-destructive" />;
  if (status === "verifying" || status === "processing") return <RefreshCw className="h-5 w-5 text-blue-400 animate-spin" />;
  if (status === "refunded") return <ArrowUpCircle className="h-5 w-5 text-purple-400" />;
  return <Clock className="h-5 w-5 text-warning" />;
}

const TIMELINE_STEPS = [
  { key: "pending", label: "Initiated" },
  { key: "processing", label: "Processing" },
  { key: "verifying", label: "Verifying" },
  { key: "success", label: "Completed" },
];

function getTimelineIndex(status: string) {
  if (status === "success") return 3;
  if (status === "verifying") return 2;
  if (status === "processing") return 1;
  if (status === "failed" || status === "reversed" || status === "refunded") return -1;
  return 0;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <button
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Copied");
          setTimeout(() => setCopied(false), 2000);
        }}
        className="flex items-center gap-1.5 text-xs font-medium text-foreground max-w-[55%] text-right"
      >
        <span className="truncate">{value}</span>
        {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-400 flex-shrink-0" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
      </button>
    </div>
  );
}

export default function TransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [tx, setTx] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase.from("transactions").select("*").eq("id", id).single()
      .then(({ data }) => { setTx(data); setLoading(false); });
  }, [id]);

  if (loading) return (
    <div className="py-16 grid place-items-center">
      <BoltLoader size={56} label="Loading..." />
    </div>
  );

  if (!tx) return (
    <div className="py-16 grid place-items-center gap-3 text-center">
      <AlertCircle className="h-8 w-8 text-muted-foreground" />
      <p className="text-muted-foreground text-sm">Transaction not found.</p>
    </div>
  );

  const isCredit = tx.type === "wallet_topup" || tx.type === "wallet_fund";
  const tIdx = getTimelineIndex(tx.status);
  const isFailed = tx.status === "failed" || tx.status === "reversed" || tx.status === "refunded";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 pb-10"
    >
      <button onClick={() => nav(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className={`glass rounded-3xl p-6 border ${statusBg(tx.status)}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
              {tx.type.replace(/_/g, " ")}
            </p>
            <h1 className={`font-display text-3xl font-bold ${isCredit ? "text-green-400" : "text-foreground"}`}>
              {isCredit ? "+" : "-"}{naira(Number(tx.amount))}
            </h1>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold uppercase ${statusBg(tx.status)} ${statusColor(tx.status)}`}>
            <StatusIcon status={tx.status} />
            {tx.status}
          </div>
        </div>

        {tx.network && (
          <div className="text-sm text-muted-foreground">
            Network: <span className="text-foreground font-medium uppercase">{tx.network}</span>
          </div>
        )}
        {tx.phone && (
          <div className="text-sm text-muted-foreground">
            Phone: <span className="text-foreground font-medium">{tx.phone}</span>
          </div>
        )}
        <div className="text-xs text-muted-foreground mt-2">
          {new Date(tx.created_at).toLocaleString("en-NG", { dateStyle: "long", timeStyle: "short" })}
        </div>
      </div>

      {!isCredit && !isFailed && (
        <div className="glass rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Progress</p>
          <div className="flex items-center">
            {TIMELINE_STEPS.map((step, i) => (
              <div key={step.key} className="flex-1 flex items-center">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold transition-all ${i <= tIdx ? "bg-gradient-primary text-white shadow-glow" : "bg-white/10 text-muted-foreground"}`}>
                    {i < tIdx ? <CheckCheck className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span className={`text-[9px] mt-1 text-center leading-tight ${i <= tIdx ? "text-foreground" : "text-muted-foreground"}`}>
                    {step.label}
                  </span>
                </div>
                {i < TIMELINE_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mb-4 mx-1 ${i < tIdx ? "bg-gradient-primary" : "bg-white/10"}`} />
                )}
              </div>
            ))}
          </div>
          {tx.retry_count > 0 && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              <RefreshCw className="inline h-3 w-3 mr-1" />
              {tx.retry_count} retry attempt{tx.retry_count !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {isFailed && tx.failure_reason && (
        <div className="glass rounded-2xl p-4 border border-destructive/20">
          <p className="text-xs font-semibold uppercase tracking-widest text-destructive mb-1">Failure Reason</p>
          <p className="text-sm text-muted-foreground">{tx.failure_reason}</p>
        </div>
      )}

      <div className="glass rounded-2xl px-5 py-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground py-3 border-b border-white/5">References</p>
        <CopyRow label="Transaction ID" value={tx.id} />
        <CopyRow label="Reference" value={tx.reference} />
        {tx.provider_reference && <CopyRow label="Provider Ref" value={tx.provider_reference} />}
        {tx.aidapay_hash && <CopyRow label="AidaPay Hash" value={tx.aidapay_hash} />}
        {tx.idempotency_key && <CopyRow label="Idempotency Key" value={tx.idempotency_key} />}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          to={`/app/receipt/${tx.id}`}
          className="glass flex flex-col items-center gap-2 rounded-2xl p-4 hover:border-primary/30 transition-colors"
        >
          <Receipt className="h-5 w-5 text-accent" />
          <span className="text-xs font-semibold">View Receipt</span>
        </Link>
        <Link
          to="/app/support"
          state={{ txRef: tx.reference, txId: tx.id }}
          className="glass flex flex-col items-center gap-2 rounded-2xl p-4 hover:border-primary/30 transition-colors"
        >
          <LifeBuoy className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs font-semibold">Get Support</span>
        </Link>
      </div>
    </motion.div>
  );
}
