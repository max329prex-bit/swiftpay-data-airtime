import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "How do I top up my wallet?",
  "Why did my airtime fail?",
  "How do I earn SwiftPoints?",
  "How do I change my PIN?",
];

export default function Support() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I\'m Swift, your SwiftlyPay AI assistant. Ask me anything about your wallet, bills, rewards or account." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const userMsg: Msg = { role: "user", content };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    let acc = "";
    const upsert = (chunk: string) => {
      acc += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.content !== "" && prev.length > next.length) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m));
        }
        return [...prev, { role: "assistant", content: acc }];
      });
    };

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error("Too many requests. Try again in a moment.");
        else toast.error("Couldn\'t reach Swift right now.");
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") { done = true; break; }
          try {
            const p = JSON.parse(j);
            const c = p.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch (e) {
      toast.error("Connection lost. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-180px)] flex-col">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-accent" /> AI Support
        </div>
        <div className="font-display text-2xl font-semibold">Meet Swift, your assistant</div>
      </motion.div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pb-3 scrollbar-hide">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-soft ${
                m.role === "user"
                  ? "bg-gradient-primary text-white rounded-br-sm"
                  : "glass rounded-bl-sm text-foreground"
              }`}
            >
              {m.content || <span className="opacity-60">…</span>}
            </div>
          </motion.div>
        ))}
        {loading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="glass flex items-center gap-2 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              Swift is thinking…
            </div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="glass rounded-full px-3 py-1.5 text-xs hover:border-primary/40 transition"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="glass flex items-center gap-2 rounded-2xl border border-white/10 p-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask Swift anything…"
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          size="icon"
          className="rounded-xl bg-gradient-primary text-white shadow-glow disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
