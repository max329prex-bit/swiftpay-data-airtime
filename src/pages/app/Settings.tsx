import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogOut, User, Bell, Shield, Sparkles, ChevronRight, Moon, Bot, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHideBalance } from "@/hooks/useHideBalance";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";

export default function Settings() {
  const { user } = useAuth();
  const { hide, setHide } = useHideBalance();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notif, setNotif] = useState(() => localStorage.getItem("swiftly:notif") !== "0");
  const [chatOpen, setChatOpen] = useState(false);
  const [msgs, setMsgs] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, phone").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { setName(data?.full_name ?? ""); setPhone(data?.phone ?? ""); });
  }, [user]);

  useEffect(() => {
    if (chatOpen && msgs.length > 0) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [msgs, chatOpen]);

  const initials = (name || user?.email || "?").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
  const themeLabel = theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";
  const nextTheme = (theme === "dark" ? "light" : theme === "light" ? "system" : "dark") as "dark" | "light" | "system";

  async function sendMsg() {
    if (!chatInput.trim() || chatBusy) return;
    const msg = { role: "user", content: chatInput.trim() };
    const newMsgs = [...msgs, msg];
    setMsgs(newMsgs);
    setChatInput("");
    setChatBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("swift-chat", {
        body: { messages: newMsgs }
      });
      if (error) {
        const body = await (error as any).context?.json?.().catch(() => null);
        throw new Error(body?.error || "AI assistant unavailable");
      }
      setMsgs(m => [...m, { role: "assistant", content: data?.reply || "Sorry, I could not respond right now." }]);
    } catch {
      toast.error("AI assistant temporarily unavailable");
    } finally {
      setChatBusy(false);
    }
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Profile header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-6 shadow-glow">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/20 backdrop-blur font-display text-xl font-bold text-white">{initials}</div>
          <div className="min-w-0">
            <div className="font-display text-xl font-bold text-white truncate">{name || "Add your name"}</div>
            <div className="text-xs text-white/80 truncate">{user?.email}</div>
            {phone && <div className="text-xs text-white/70">{phone}</div>}
          </div>
        </div>
      </div>

      {/* Support — Swift AI Chat */}
      <Section title="Support">
        <div>
          <button
            onClick={() => setChatOpen(o => !o)}
            className="flex w-full items-center gap-3 p-4 hover:bg-white/5 transition text-left"
          >
            <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-primary/20">
              <Bot className="h-4 w-4 text-primary" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">Swift AI Support</div>
              <div className="text-xs text-muted-foreground">Ask anything about your account</div>
            </div>
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${chatOpen ? "rotate-90" : ""}`} />
          </button>

          <AnimatePresence>
            {chatOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden border-t border-white/5"
              >
                {/* Messages */}
                <div className="h-52 overflow-y-auto p-3 space-y-2.5 scrollbar-hide">
                  {msgs.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-1.5">
                      <Bot className="h-8 w-8 text-primary/40 mb-1" />
                      <p className="text-xs text-muted-foreground">Hi! I'm Swift, your AI assistant.</p>
                      <p className="text-xs text-muted-foreground">How can I help you today?</p>
                    </div>
                  )}
                  {msgs.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`rounded-2xl px-3 py-2 text-[12px] leading-relaxed max-w-[85%] ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/10 text-foreground"
                      }`}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {chatBusy && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl px-3 py-2 text-[12px] bg-white/10 text-muted-foreground">
                        Swift is typing…
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div className="flex gap-2 p-3 border-t border-white/5">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                    placeholder="Ask Swift anything…"
                    className="flex-1 rounded-xl bg-white/[0.06] border border-white/10 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                  />
                  <button
                    onClick={sendMsg}
                    disabled={chatBusy || !chatInput.trim()}
                    className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-primary/20 text-primary disabled:opacity-40 hover:bg-primary/30 transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Section>

      {/* Privacy */}
      <Section title="Privacy">
        <Row icon={hide ? EyeOff : Eye} label="Hide balance" desc="Mask your wallet amount on the home screen">
          <Switch checked={hide} onCheckedChange={setHide} />
        </Row>
        <Row icon={Shield} label="Change transaction PIN" onClick={() => nav("/app/setup-pin")} chevron />
      </Section>

      {/* App */}
      <Section title="App">
        <Row icon={Bell} label="Push notifications" desc="Deals & transaction alerts">
          <Switch checked={notif} onCheckedChange={(v) => { setNotif(v); localStorage.setItem("swiftly:notif", v ? "1" : "0"); toast.success(v ? "Notifications on" : "Notifications off"); }} />
        </Row>
        <Row
          icon={Moon}
          label="Theme"
          desc={themeLabel}
          onClick={() => { setTheme(nextTheme); toast.success(`Switched to ${nextTheme} mode`); }}
          chevron
        />
        <Row icon={Sparkles} label="BlitzPoints info" desc="Earn points on every purchase" />
      </Section>

      {/* Account */}
      <Section title="Account">
        <Row icon={User} label="Edit profile" onClick={() => toast("Coming soon")} chevron />
        <Row icon={LogOut} label="Sign out" danger onClick={async () => { await supabase.auth.signOut(); nav("/"); }} chevron />
      </Section>

      <div className="pt-2 text-center text-[11px] text-muted-foreground">BlitzPay · v1.0.0</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="glass divide-y divide-white/5 rounded-2xl overflow-hidden">{children}</div>
    </div>
  );
}

function Row({
  icon: Icon, label, desc, children, onClick, chevron, danger,
}: {
  icon: any; label: string; desc?: string; children?: React.ReactNode;
  onClick?: () => void; chevron?: boolean; danger?: boolean;
}) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`flex w-full items-center gap-3 p-4 text-left ${onClick ? "hover:bg-white/5 transition" : ""}`}
    >
      <span className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl ${danger ? "bg-destructive/15 text-destructive" : "bg-white/[0.08] text-foreground"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${danger ? "text-destructive" : ""}`}>{label}</div>
        {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
      </div>
      {children}
      {chevron && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
    </Comp>
  );
}
