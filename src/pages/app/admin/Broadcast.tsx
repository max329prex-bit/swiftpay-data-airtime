import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Megaphone, Send, X } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

type BroadcastValue = { active: boolean; message: string; type: "info" | "warning" | "error"; title: string; updated_at: string; };

export default function Broadcast() {
  const nav = useNavigate();
  const [current, setCurrent] = useState<BroadcastValue | null>(null);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"info" | "warning" | "error">("info");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "broadcast_message").maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          const v = data.value as BroadcastValue;
          setCurrent(v);
          if (v.active) { setMessage(v.message); setTitle(v.title || ""); setType(v.type); }
        }
      });
  }, []);

  async function publish() {
    if (!message.trim()) { toast.error("Enter a message"); return; }
    setSaving(true);
    const value: BroadcastValue = { active: true, message: message.trim(), title: title.trim(), type, updated_at: new Date().toISOString() };
    await supabase.from("app_settings").upsert({ key: "broadcast_message", value, updated_at: new Date().toISOString() });
    setCurrent(value);
    toast.success("Broadcast published!");
    setSaving(false);
  }

  async function clear() {
    setSaving(true);
    const value: BroadcastValue = { active: false, message: "", title: "", type: "info", updated_at: new Date().toISOString() };
    await supabase.from("app_settings").upsert({ key: "broadcast_message", value, updated_at: new Date().toISOString() });
    setCurrent(value);
    setMessage(""); setTitle("");
    toast.success("Broadcast cleared");
    setSaving(false);
  }

  const typeBg = { info: "bg-blue-400/10 border-blue-400/20 text-blue-400", warning: "bg-warning/10 border-warning/20 text-warning", error: "bg-destructive/10 border-destructive/20 text-destructive" };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => nav(-1)} className="grid h-9 w-9 place-items-center rounded-full glass text-muted-foreground"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="font-display text-2xl font-semibold">Broadcast</h1>
          <p className="text-xs text-muted-foreground">Send system-wide alerts to all users</p>
        </div>
      </div>

      {current?.active && (
        <div className={`glass rounded-2xl p-4 border flex items-start gap-3 ${typeBg[current.type]}`}>
          <Megaphone className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {current.title && <p className="text-sm font-semibold mb-0.5">{current.title}</p>}
            <p className="text-xs leading-relaxed">{current.message}</p>
          </div>
          <button onClick={clear} disabled={saving} className="flex-shrink-0 opacity-60 hover:opacity-100 transition"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="glass rounded-2xl p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Compose Alert</p>
        <div className="flex gap-2">
          {(["info", "warning", "error"] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} className={`flex-1 rounded-xl py-2 text-xs font-semibold border transition-all ${type === t ? typeBg[t] : "glass text-muted-foreground"}`}>
              {t === "info" ? "Info" : t === "warning" ? "Warning" : "Error"}
            </button>
          ))}
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground mb-1.5 block">Title (optional)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Scheduled Maintenance"
            className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/40" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground mb-1.5 block">Message</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Type your alert message here..."
            className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 resize-none" />
        </div>
        <div className="flex gap-3">
          <button onClick={publish} disabled={saving || !message.trim()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3 font-semibold text-white shadow-glow disabled:opacity-50 transition">
            <Send className="h-4 w-4" />
            {saving ? "Publishing..." : "Publish Broadcast"}
          </button>
          {current?.active && (
            <button onClick={clear} disabled={saving} className="px-4 rounded-xl glass text-destructive border-destructive/30 text-sm font-semibold hover:bg-destructive/10 transition">Clear</button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
