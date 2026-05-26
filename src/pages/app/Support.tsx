import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Clock, Wifi, Wallet, RefreshCw, HelpCircle,
  CheckCircle2, ChevronRight, AlertTriangle,
} from "lucide-react";

type Intent =
  | "transaction_pending"
  | "wallet_not_credited"
  | "data_not_received"
  | "refund_issue"
  | "other";

interface RecentTx {
  id: string;
  reference: string;
  type: string;
  network: string | null;
  amount: number;
  status: string;
  created_at: string;
}

const INTENTS: { id: Intent; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "transaction_pending",  label: "Transaction Pending",   icon: <Clock className="w-4 h-4" />,        desc: "Purchase is stuck in processing" },
  { id: "wallet_not_credited",  label: "Wallet Not Credited",   icon: <Wallet className="w-4 h-4" />,       desc: "Funded wallet but balance didn\'t update" },
  { id: "data_not_received",    label: "Data Not Received",     icon: <Wifi className="w-4 h-4" />,         desc: "Paid but data wasn\'t delivered" },
  { id: "refund_issue",         label: "Refund Issue",          icon: <RefreshCw className="w-4 h-4" />,    desc: "Expecting a refund that hasn\'t arrived" },
  { id: "other",                label: "Other Issue",           icon: <HelpCircle className="w-4 h-4" />,   desc: "Something else went wrong" },
];

export default function Support() {
  const { user } = useAuth();
  const [step, setStep] = useState<"intent" | "detail" | "done">("intent");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [recentTxs, setRecentTxs] = useState<RecentTx[]>([]);
  const [selectedTx, setSelectedTx] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ticketRef, setTicketRef] = useState<string | null>(null);
  const [degradedProviders, setDegradedProviders] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;

    // Load recent transactions for context auto-attach
    supabase
      .from("transactions")
      .select("id, reference, type, network, amount, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setRecentTxs((data as RecentTx[]) ?? []));

    // Check for degraded providers (emergency broadcast)
    supabase
      .from("bundle_status")
      .select("package_code, auto_paused_at, auto_paused_reason")
      .not("auto_paused_at", "is", null)
      .limit(5)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const providers = [...new Set(data.map((d: Record<string, unknown>) =>
            (d.package_code as string).split("-")[0]?.toUpperCase()
          ))];
          setDegradedProviders(providers);
        }
      });
  }, [user]);

  async function submit() {
    if (!intent || !user) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user.id,
          intent,
          message: message.trim() || null,
          related_transaction_id: selectedTx || null,
          status: "open",
        })
        .select("ticket_ref")
        .single();

      if (error) throw error;
      setTicketRef((data as Record<string, string>).ticket_ref);
      setStep("done");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to submit ticket");
    } finally {
      setSubmitting(false);
    }
  }

  function restart() {
    setStep("intent"); setIntent(null); setSelectedTx(null);
    setMessage(""); setTicketRef(null);
  }

  const selectedIntentObj = INTENTS.find(i => i.id === intent);

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="font-display text-2xl font-semibold">Support</h1>
        <p className="text-sm text-muted-foreground mt-1">
          We\'ll help resolve your issue quickly.
        </p>
      </div>

      {/* Emergency banner if providers are degraded */}
      {degradedProviders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4"
        >
          <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
          <div className="text-sm text-yellow-300">
            <strong>Service Notice:</strong> Some {degradedProviders.join(", ")} plans are temporarily
            paused for maintenance. Funds are safe. Avoid retrying — we\'re on it.
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">

        {/* STEP 1: Intent selection */}
        {step === "intent" && (
          <motion.div key="intent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
              What\'s the issue?
            </p>
            {INTENTS.map(({ id, label, icon, desc }) => (
              <button
                key={id}
                onClick={() => { setIntent(id); setStep("detail"); }}
                className="w-full flex items-center justify-between gap-3 rounded-2xl bg-secondary/40 border border-white/5 p-4 text-left transition hover:bg-secondary/60 active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-primary">{icon}</span>
                  <div>
                    <div className="text-sm font-semibold">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}

            <div className="mt-4 rounded-2xl bg-secondary/20 p-4 text-center text-sm text-muted-foreground">
              Urgent? Email us at{" "}
              <a href="mailto:blitzpaysup@gmail.com" className="text-primary underline">
                blitzpaysup@gmail.com
              </a>
            </div>
          </motion.div>
        )}

        {/* STEP 2: Detail + transaction attach */}
        {step === "detail" && (
          <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }} className="space-y-4"
          >
            <button onClick={() => setStep("intent")} className="text-sm text-muted-foreground flex items-center gap-1">
              ← Back
            </button>

            <div className="rounded-2xl bg-primary/10 border border-primary/20 p-3 flex items-center gap-2">
              <span className="text-primary">{selectedIntentObj?.icon}</span>
              <span className="text-sm font-medium">{selectedIntentObj?.label}</span>
            </div>

            {/* Auto-attach recent transaction */}
            {recentTxs.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Related transaction (optional)
                </p>
                {recentTxs.map(tx => (
                  <button
                    key={tx.id}
                    onClick={() => setSelectedTx(selectedTx === tx.id ? null : tx.id)}
                    className={`w-full flex items-center justify-between rounded-xl border p-3 text-sm transition ${
                      selectedTx === tx.id
                        ? "border-primary bg-primary/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/5"
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-mono text-xs text-muted-foreground">{tx.reference}</div>
                      <div className="font-medium">
                        {tx.type} {tx.network && `· ${tx.network}`} · ₦{tx.amount.toLocaleString()}
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      tx.status === "success" ? "text-green-400 bg-green-400/10" :
                      tx.status === "failed"  ? "text-red-400 bg-red-400/10" :
                      "text-yellow-400 bg-yellow-400/10"
                    }`}>
                      {tx.status}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Message */}
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Describe your issue in a few words (optional)..."
              className="h-24 resize-none rounded-2xl bg-secondary/40"
            />

            <Button onClick={submit} disabled={submitting} className="w-full h-12 rounded-2xl">
              {submitting ? "Submitting..." : "Submit Support Ticket"}
            </Button>
          </motion.div>
        )}

        {/* STEP 3: Done */}
        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 py-8 text-center"
          >
            <div className="rounded-full bg-green-500/10 border border-green-500/30 p-5">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Ticket Submitted</h2>
              <p className="text-sm text-muted-foreground mt-1">
                We\'ll review and get back to you via email.
              </p>
            </div>
            {ticketRef && (
              <div className="rounded-xl bg-secondary/40 border border-white/10 px-4 py-3 w-full">
                <div className="text-xs text-muted-foreground mb-1">Your ticket reference</div>
                <div className="font-mono text-sm font-semibold text-primary">{ticketRef}</div>
              </div>
            )}
            <Button variant="outline" onClick={restart} className="mt-2 rounded-xl">
              Submit Another
            </Button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
