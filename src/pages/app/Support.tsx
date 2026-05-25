import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Bot, Send, Loader2, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "How do I top up my wallet?",
  "Why did my airtime fail?",
  "How do I earn BlitzPoints?",
  "How do I change my PIN?",
];

export default function Support() {
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I'm Blitzi, your BlitzPay AI assistant. Ask me anything about your wallet, airtime, data, bills or account." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
    }
  }, [messages, loading, chatOpen]);

  useEffect(() => {
    if (chatOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [chatOpen]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: Msg = { role: "user", content };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      // Use supabase.functions.invoke — the swift-chat function returns plain JSON {reply}
      const { data, error } = await supabase.functions.invoke("swift-chat", {
        body: { messages: next.map(m => ({ role: m.role, content: m.content })) },
      });

      if (error) {
        const body = await (error as any).context?.json?.().catch(() => null);
        throw new Error(body?.error || "Blitzi is unavailable right now");
      }

      const reply = data?.reply || "Sorry, I could not respond right now. Please try again.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e: any) {
      toast.error(e.message || "Could not reach Blitzi. Try again.");
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I'm having trouble connecting. Please try again or email us at blitzpaysup@gmail.com" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => chatOpen ? setChatOpen(false) : nav("/app")}
          className="grid h-9 w-9 place-items-center rounded-full glass">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="font-display text-xl font-semibold">Support</h1>
          <p className="text-xs text-muted-foreground">We're here to help</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!chatOpen ? (
          /* ── Option cards ── */
          <motion.div key="options" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="space-y-3">
            {/* Email card */}
            <a href="mailto:blitzpaysup@gmail.com"
              className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 hover:bg-white/[0.07] transition group">
              <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-accent/20">
                <Mail className="h-5 w-5 text-accent" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-display text-base font-bold">Send Email</div>
                <div className="text-xs text-muted-foreground mt-0.5">blitzpaysup@gmail.com</div>
                <div className="text-[11px] text-muted-foreground mt-1">For billing issues, account problems & complaints</div>
              </div>
            </a>

            {/* Blitzi chat card */}
            <button onClick={() => setChatOpen(true)}
              className="flex w-full items-center gap-4 rounded-3xl border border-primary/20 bg-primary/5 p-5 hover:bg-primary/10 transition group text-left">
              <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-primary/20 group-hover:bg-primary/30 transition">
                <Bot className="h-5 w-5 text-primary" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-display text-base font-bold">Chat with Blitzi</div>
                <div className="text-xs text-muted-foreground mt-0.5">AI assistant — instant answers</div>
                <div className="text-[11px] text-muted-foreground mt-1">Wallet, airtime, data, bills and account help</div>
              </div>
              <div className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent flex-shrink-0">LIVE</div>
            </button>

            {/* Quick topics */}
            <div className="pt-2">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">Common questions</div>
              <div className="space-y-1">
                {STARTERS.map(s => (
                  <button key={s} onClick={() => { setChatOpen(true); setTimeout(() => send(s), 400); }}
                    className="glass flex w-full items-center rounded-2xl px-4 py-3 text-sm text-left hover:border-primary/30 transition">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          /* ── Blitzi chat ── */
          <motion.div key="chat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="flex flex-col" style={{ height: "calc(100vh - 200px)" }}>
            {/* Chat header */}
            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/20">
                <Bot className="h-4 w-4 text-primary" />
              </span>
              <div>
                <div className="text-sm font-semibold">Blitzi</div>
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                  <span className="text-[11px] text-accent">Online</span>
                </div>
              </div>
              <button onClick={() => setChatOpen(false)} className="ml-auto grid h-8 w-8 place-items-center rounded-full glass">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pb-3 scrollbar-hide">
              {messages.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "user" ? "bg-gradient-primary text-white rounded-br-sm" : "glass rounded-bl-sm text-foreground"
                  }`}>
                    {m.content}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="glass flex items-center gap-2 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span className="text-muted-foreground text-xs">Blitzi is thinking…</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="glass flex items-center gap-2 rounded-2xl border border-white/10 p-1.5 mt-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                placeholder="Ask Blitzi anything…"
                className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button onClick={() => send()} disabled={loading || !input.trim()} size="icon"
                className="rounded-xl bg-gradient-primary text-white shadow-glow disabled:opacity-50 flex-shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
