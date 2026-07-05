import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Mail, CheckCircle2, AlertTriangle, Loader2, Send } from "lucide-react";

export default function Support() {
  const { user } = useAuth();
  const [showTicket, setShowTicket] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ticketRef, setTicketRef] = useState<string | null>(null);
  const [degradedProviders, setDegradedProviders] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("bundle_status")
      .select("package_code, auto_paused_at")
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

  async function submitTicket() {
    if (!message.trim() || !user) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .insert({ user_id: user.id, intent: "other", message: message.trim(), status: "open" })
        .select("ticket_ref")
        .single();
      if (error) throw error;
      setTicketRef((data as Record<string, string>).ticket_ref);

      // Also email blitzpaysup@gmail.com via edge function
      await supabase.functions.invoke("send-support-email", {
        body: {
          from: user.email || "support@blitzpay.ng",
          subject: `BlitzPay Support Ticket - ${(data as Record<string, string>).ticket_ref}`,
          body: `New support ticket from ${user.email || "user"}:\n\n${message.trim()}\n\nTicket Ref: ${(data as Record<string, string>).ticket_ref}\nUser ID: ${user.id}`,
        },
      }).catch(() => { /* email is best-effort */ });

    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to submit ticket");
    } finally {
      setSubmitting(false);
    }
  }

  function openBlitziChat() {
    window.dispatchEvent(new CustomEvent("open-blitzi-chat"));
  }

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="font-display text-2xl font-semibold">Support</h1>
        <p className="text-sm text-muted-foreground mt-1">We'll help resolve your issue quickly.</p>
      </div>

      {degradedProviders.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
          <div className="text-sm text-yellow-300">
            <strong>Service Notice:</strong> Some {degradedProviders.join(", ")} plans are temporarily
            paused. Funds are safe. Avoid retrying — we're on it.
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {!showTicket && !ticketRef && (
          <motion.div key="options" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-3">

            <button onClick={openBlitziChat}
              className="w-full flex items-center gap-4 rounded-2xl bg-gradient-primary p-5 text-left shadow-glow transition active:scale-[0.98]">
              <div className="h-11 w-11 rounded-xl bg-white/20 grid place-items-center shrink-0">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-base font-bold text-white">Chat with Blitzi</div>
                <div className="text-sm text-white/70 mt-0.5">Instant AI support · Available 24/7</div>
              </div>
            </button>

            <button onClick={() => setShowTicket(true)}
              className="w-full flex items-center gap-4 rounded-2xl bg-secondary/40 border border-white/5 p-5 text-left transition hover:bg-secondary/60 active:scale-[0.98]">
              <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/20 grid place-items-center shrink-0">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-base font-bold">Send a Ticket</div>
                <div className="text-sm text-muted-foreground mt-0.5">We'll reply to your email within 24h</div>
              </div>
            </button>

            <p className="text-center text-xs text-muted-foreground pt-2">
              Urgent? Email us at{" "}
              <a href="mailto:blitzpaysup@gmail.com" className="text-primary underline">
                blitzpaysup@gmail.com
              </a>
            </p>
          </motion.div>
        )}

        {showTicket && !ticketRef && (
          <motion.div key="ticket-form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            className="space-y-4">
            <div>
              <div className="text-sm font-semibold mb-1">Describe your issue</div>
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us what happened — include your phone number, transaction reference, or any details that help..."
                rows={5}
                className="rounded-2xl bg-secondary/40 border-white/10 resize-none text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowTicket(false)}
                className="flex-1 h-12 rounded-2xl bg-secondary/40 border border-white/10 text-sm font-semibold transition hover:bg-secondary/60">
                Back
              </button>
              <button onClick={submitTicket} disabled={!message.trim() || submitting}
                className="flex-1 h-12 rounded-2xl bg-gradient-primary text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition active:scale-[0.98]">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send Ticket</>}
              </button>
            </div>
          </motion.div>
        )}

        {ticketRef && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center space-y-4 py-10">
            <div className="h-20 w-20 rounded-full bg-green-400/15 border border-green-400/30 grid place-items-center">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Ticket Submitted</h2>
              <p className="text-sm text-muted-foreground mt-1">Ref: <span className="font-mono text-primary">{ticketRef}</span></p>
              <p className="text-xs text-muted-foreground mt-2">We'll get back to you within 24 hours.</p>
            </div>
            <button onClick={() => { setTicketRef(null); setShowTicket(false); setMessage(""); }}
              className="h-11 px-6 rounded-xl bg-secondary/40 border border-white/10 text-sm font-semibold">
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
