import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, Wallet as WalletIcon, Receipt, Settings as SettingsIcon, Bell, X, CheckCheck, AlertCircle, Info, MessageCircle, Send, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "./Logo";
import { BoltLoader, SplashScreen } from "./BoltLoader";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useBroadcast, useNotifications } from "@/hooks/useBroadcast";
import { naira } from "@/lib/networks";
import { motion, AnimatePresence } from "framer-motion";
import Index from "../../pages/Index.tsx";

function BlitziText({ text }: { text: string }) {
  const lines = text.split("\n").filter(l => l.trim() !== "" || true);
  return (
    <span>
      {lines.map((line, li) => {
        const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
        return (
          <span key={li}>
            {parts.map((part, pi) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return <strong key={pi} className="font-semibold">{part.slice(2, -2)}</strong>;
              }
              if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
                return <em key={pi}>{part.slice(1, -1)}</em>;
              }
              return <span key={pi}>{part}</span>;
            })}
            {li < lines.length - 1 && <br />}
          </span>
        );
      })}
    </span>
  );
}

const TABS = [
  { to: "/app", icon: Home, label: "Home", end: true },
  { to: "/app/bills", icon: Receipt, label: "Bills" },
  { to: "/app/wallet", icon: WalletIcon, label: "Deposit" },
  { to: "/app/settings", icon: SettingsIcon, label: "Settings" },
];

type Notif = { id: string; title: string; body: string; read: boolean; isBroadcast?: boolean };
type ChatMsg = { role: "user" | "blitzi"; text: string };

export function AppShell() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [, setPinChecked] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [broadcastDismissed, setBroadcastDismissed] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([
    { role: "blitzi", text: "Hi! I'm Blitzi, your BlitzPay assistant. Ask me anything about your account, data plans, or transactions." }
  ]);
  const [chatBusy, setChatBusy] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const broadcast = useBroadcast();
  const { notifications: dbNotifs, markAllRead: markAllDbRead } = useNotifications();
  usePushNotifications();

  useEffect(() => {
    function handleOpenChat() { setShowChat(true); }
    window.addEventListener("open-blitzi-chat", handleOpenChat);
    return () => window.removeEventListener("open-blitzi-chat", handleOpenChat);
  }, []);

  // Guest users stay on /app and see the landing page (Index)
  // No redirect to /auth — the landing page serves as the guest experience

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_transaction_pin").then(({ data }) => {
        const exemptPaths = ["/app/setup-pin", "/app/edit-profile", "/app/settings"];
        if (data === false && !exemptPaths.includes(window.location.pathname)) {
          nav("/app/setup-pin", { replace: true });
        }
      setPinChecked(true);
    });
  }, [user, nav]);

  // Build notifications: welcome + deposits + ACTIVE broadcast
  useEffect(() => {
    if (!user) return;
    const items: Notif[] = [];
    const welcomedKey = `bp_welcomed_${user.id}`;
    if (!localStorage.getItem(welcomedKey)) {
      items.push({ id: "welcome", title: "Welcome to BlitzPay!", body: "Fund your wallet and enjoy instant data & airtime.", read: false });
      localStorage.setItem(welcomedKey, "1");
    }
    supabase.from("transactions").select("id, amount, created_at").eq("user_id", user.id).eq("type", "wallet_topup")
      .order("created_at", { ascending: false }).limit(5)
      .then(({ data }) => {
        const txNotifs: Notif[] = (data || []).map(t => ({
          id: t.id, title: "Wallet Funded",
          body: `${naira(Number(t.amount))} added to your wallet.`,
          read: !!localStorage.getItem(`bp_nr_${t.id}`),
        }));
        setNotifs(prev => {
          // Keep any existing broadcast notif, merge with new
          const existing = prev.filter(n => n.isBroadcast);
          return [...items, ...txNotifs, ...existing];
        });
      });
  }, [user]);

  // When a broadcast is active, add it as a notification
  useEffect(() => {
    if (!broadcast?.active || broadcastDismissed) {
      setNotifs(prev => prev.filter(n => !n.isBroadcast));
      return;
    }
    const bId = `broadcast-${broadcast.type}-${broadcast.message?.slice(0, 20)}`;
    const bNotif: Notif = {
      id: bId,
      title: broadcast.title || (broadcast.type === "error" ? "Alert" : "Announcement"),
      body: broadcast.message,
      read: false,
      isBroadcast: true,
    };
    setNotifs(prev => {
      const filtered = prev.filter(n => !n.isBroadcast);
      return [...filtered, bNotif];
    });
  }, [broadcast, broadcastDismissed]);

  // Merge DB notifications (support-ticket responses, etc.) into the local panel
  useEffect(() => {
    if (!user) return;
    const dbMapped: Notif[] = dbNotifs.map(n => ({
      id: n.id,
      title: n.title || "Support",
      body: n.message,
      read: n.is_read,
    }));
    setNotifs(prev => {
      const local = prev.filter(n => !dbMapped.some(d => d.id === n.id));
      return [...local, ...dbMapped];
    });
  }, [user, dbNotifs]);

  const unread = notifs.filter(n => !n.read).length;

  async function markAllRead() {
    notifs.forEach(n => localStorage.setItem(`bp_nr_${n.id}`, "1"));
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    await markAllDbRead();
  }

  useEffect(() => {
    if (showChat) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs, showChat]);

  async function sendChat() {
    const msg = chatInput.trim();
    if (!msg || chatBusy) return;
    setChatInput("");
    setChatMsgs(prev => [...prev, { role: "user", text: msg }]);
    setChatBusy(true);
    try {
      const history = [...chatMsgs, { role: "user", text: msg }].map(m => ({
        role: m.role === "blitzi" ? "assistant" : "user",
        content: m.text,
      }));
      const { data, error } = await supabase.functions.invoke("swift-chat", { body: { messages: history } });
      if (error) throw error;
      const reply = data?.reply || data?.message || "Sorry, I couldn't get a response. Try again!";
      setChatMsgs(prev => [...prev, { role: "blitzi", text: reply }]);
    } catch {
      setChatMsgs(prev => [...prev, { role: "blitzi", text: "Something went wrong. Please try again in a moment." }]);
    } finally {
      setChatBusy(false);
    }
  }

  if (showSplash || loading) return (
    <AnimatePresence>
      <SplashScreen key="splash" onDone={() => setShowSplash(false)} />
    </AnimatePresence>
  );
  if (!user) return <Index />;

  const broadcastColors: Record<string, string> = {
    info: "bg-blue-500/10 border-blue-500/20 text-blue-300",
    warning: "bg-yellow-500/10 border-yellow-500/20 text-yellow-300",
    error: "bg-red-500/10 border-red-500/20 text-red-300",
  };

  return (
    <div className="relative mx-auto min-h-screen max-w-md pb-28">
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/70 border-b border-white/5">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <Logo />
          <button onClick={() => setShowNotifs(true)} className="relative grid h-9 w-9 place-items-center rounded-full glass">
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground shadow">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </div>
        <AnimatePresence>
          {broadcast?.active && !broadcastDismissed && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className={`overflow-hidden border-t ${broadcastColors[broadcast.type] || broadcastColors.info}`}>
              <div className="flex items-start gap-2.5 px-5 py-2.5">
                {broadcast.type === "error" ? <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> : <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
                <p className="flex-1 text-xs leading-relaxed">
                  {broadcast.title && <strong className="font-semibold">{broadcast.title}: </strong>}
                  {broadcast.message}
                </p>
                <button onClick={() => setBroadcastDismissed(true)} className="flex-shrink-0 opacity-60 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="px-5 pt-5"><Outlet /></main>

      <motion.button
        onClick={() => setShowChat(true)}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-24 right-5 z-30 h-12 w-12 rounded-full bg-gradient-primary shadow-glow grid place-items-center"
        title="Chat with Blitzi"
      >
        <MessageCircle className="h-5 w-5 text-white" />
      </motion.button>

      <nav className="fixed bottom-4 left-1/2 z-30 w-[92%] max-w-sm -translate-x-1/2">
        <div className="glass flex items-center justify-around rounded-3xl border border-white/10 px-2 py-2 shadow-glow backdrop-blur-2xl">
          {TABS.map(t => (
            <NavLink key={t.to} to={t.to} end={t.end} className="group relative flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2">
              {({ isActive }) => (
                <>
                  <span className={`grid h-9 w-9 place-items-center rounded-xl transition-all ${isActive ? "bg-gradient-primary text-white shadow-glow scale-110" : "text-muted-foreground group-hover:text-foreground"}`}>
                    <t.icon className="h-4 w-4" />
                  </span>
                  <span className={`text-[10px] font-semibold transition ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{t.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <AnimatePresence>
        {showChat && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowChat(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-[#0f1117] border-t border-white/10 flex flex-col"
              style={{ height: "70vh" }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-primary grid place-items-center shadow-glow">
                    <span className="text-base">⚡</span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Blitzi</div>
                    <div className="text-[10px] text-accent">AI Assistant</div>
                  </div>
                </div>
                <button onClick={() => setShowChat(false)} className="grid h-8 w-8 place-items-center rounded-full glass">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-hide">
                {chatMsgs.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-gradient-primary text-white rounded-br-sm"
                        : "bg-white/[0.07] text-foreground rounded-bl-sm"
                    }`}>
                      <BlitziText text={m.text} />
                    </div>
                  </div>
                ))}
                {chatBusy && (
                  <div className="flex justify-start">
                    <div className="bg-white/[0.07] rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Blitzi is typing...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="px-4 pb-5 pt-2 border-t border-white/5 flex-shrink-0">
                <div className="flex items-center gap-2 glass rounded-2xl px-4 py-2">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                    placeholder="Ask Blitzi anything..."
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <button onClick={sendChat} disabled={!chatInput.trim() || chatBusy}
                    className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary disabled:opacity-40 transition">
                    <Send className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNotifs && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowNotifs(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-[#0f1117] border-t border-white/10"
              style={{ maxHeight: "75vh" }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
                <div>
                  <h2 className="font-display text-lg font-bold">Notifications</h2>
                  {unread > 0 && <p className="text-xs text-muted-foreground">{unread} unread</p>}
                </div>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button onClick={markAllRead} className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/10 transition">
                      <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                    </button>
                  )}
                  <button onClick={() => setShowNotifs(false)} className="grid h-8 w-8 place-items-center rounded-full glass">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto scrollbar-hide pb-8" style={{ maxHeight: "calc(75vh - 80px)" }}>
                {notifs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                    <Bell className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {notifs.map(n => (
                      <div key={n.id} className={`flex items-start gap-3 px-5 py-4 transition ${n.read ? "opacity-60" : ""}`}>
                        <div className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-accent"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold">{n.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

