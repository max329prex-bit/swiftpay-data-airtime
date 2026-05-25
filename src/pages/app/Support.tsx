import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Bot, Send, Loader2, ArrowLeft, X, ChevronRight } from "lucide-react";
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
    { role: "assistant", content: "Hi! I'm Blitzi, your BlitzPay assistant. Ask me anything about wallet funding, airtime, data, bills or your account 😊" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
        inputRef.current?.focus();
      }, 300);
    }
  }, [chatOpen]);

  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
    }
  }, [messages, loading]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: Msg = { role: "user", content };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("swift-chat", {
        body: { messages: next.map(m => ({ role: m.role, content: m.content })) },
      });

      if (error) {
        const body = await (error as any).context?.json?.().catch(() => null);
        throw new Error(body?.error || "Connection error");
      }

      const reply = data?.reply || "Sorry, I could not respond right now. Please try again.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I'm having trouble right now. Please email blitzpaysup@gmail.com and we'll help you out! 📧"
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* ── Main support options page ── */}
      <div className="space-y-4 pb-10">
        <div className="flex items-center gap-3">
          <button onClick={() => nav("/app")} className="grid h-9 w-9 place-items-center rounded-full glass">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-display text-xl font-semibold">Support</h1>
            <p className="text-xs text-muted-foreground">We're here to help</p>
          </div>
        </div>

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
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition flex-shrink-0" />
        </a>

        {/* Blitzi chat card */}
        <button onClick={() => setChatOpen(true)}
          className="flex w-full items-center gap-4 rounded-3xl border border-primary/20 bg-primary/5 p-5 hover:bg-primary/10 transition group text-left">
          <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-primary/20 group-hover:bg-primary/30 transition">
            <Bot className="h-5 w-5 text-primary" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-display text-base font-bold">Chat with Blitzi</div>
            <div className="text-xs text-muted-foreground mt-0.5">AI assistant — instant answers 24/7</div>
            <div className="text-[11px] text-muted-foreground mt-1">Wallet, airtime, data, bills and account help</div>
          </div>
          <div className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent flex-shrink-0">LIVE</div>
        </button>

        {/* Quick topics */}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">Common questions</div>
          <div className="space-y-1.5">
            {STARTERS.map(s => (
              <button key={s} onClick={() => { setChatOpen(true); setTimeout(() => send(s), 400); }}
                className="glass flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm text-left hover:border-primary/30 transition">
                <span>{s}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Full-screen chat overlay — covers EVERYTHING including bottom nav ── */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed inset-0 z-[100] flex flex-col bg-background"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 pt-12 pb-4 border-b border-white/5 bg-background/95 backdrop-blur-xl">
              <button onClick={() => setChatOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full glass flex-shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/20 flex-shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </span>
              <div>
                <div className="text-sm font-semibold">Blitzi</div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                  <span className="text-[11px] text-accent">Online — always ready to help</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-hide">
              {messages.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-gradient-primary text-white rounded-br-sm"
                      : "glass rounded-bl-sm text-foreground"
                  }`}>
                    {m.content}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="glass flex items-center gap-2 rounded-2xl rounded-bl-sm px-4 py-3 text-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span className="text-muted-foreground text-xs">Blitzi is thinking…</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick starters (first message only) */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {STARTERS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="glass rounded-full px-3 py-1.5 text-xs hover:border-primary/40 transition">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input bar */}
            <div className="px-4 pb-6 pt-2 border-t border-white/5 bg-background/95 backdrop-blur-xl">
              <div className="glass flex items-center gap-2 rounded-2xl border border-white/10 p-1.5">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
