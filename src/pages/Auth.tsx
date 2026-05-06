import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/swift/Logo";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";

export default function Auth() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(""); const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/app`, data: { full_name: fullName, phone } },
        });
        if (error) throw error;
        toast.success("Welcome to SwiftPay!"); nav("/app");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav("/app");
      }
    } catch (err: any) { toast.error(err.message ?? "Something went wrong"); }
    finally { setLoading(false); }
  }

  async function google() {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/app` } });
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-4">
      <div className="absolute inset-0 -z-10 bg-gradient-aurora" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="glass-strong rounded-3xl p-8 shadow-card">
          <h1 className="font-display text-3xl font-bold">{mode === "signup" ? "Create your wallet" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{mode === "signup" ? "30 seconds. No paperwork." : "Sign in to your SwiftPay wallet."}</p>

          <Button onClick={google} variant="glass" className="mt-6 w-full" size="lg">
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4c-.2 1.2-.9 2.2-2 2.9v2.4h3.2c1.9-1.7 3-4.3 3-7.1z"/><path fill="#fff" opacity=".8" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.4c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.5C4.7 19.7 8.1 22 12 22z"/><path fill="#fff" opacity=".6" d="M6.4 14.1c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V7.8H3.1C2.4 9.1 2 10.5 2 12s.4 2.9 1.1 4.2l3.3-2.1z"/><path fill="#fff" opacity=".4" d="M12 6.4c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 3.5 14.7 2.5 12 2.5c-3.9 0-7.3 2.3-8.9 5.5L6.4 10.5c.8-2.4 3-4.1 5.6-4.1z"/></svg>
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">or</span><div className="h-px flex-1 bg-border" /></div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (<>
              <div><Label htmlFor="fn">Full name</Label><Input id="fn" required value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1" placeholder="Ada Obi" /></div>
              <div><Label htmlFor="ph">Phone</Label><Input id="ph" required value={phone} onChange={e => setPhone(e.target.value)} className="mt-1" placeholder="0803 000 0000" /></div>
            </>)}
            <div><Label htmlFor="em">Email</Label><Input id="em" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1" placeholder="you@swiftpay.ng" /></div>
            <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="mt-1" placeholder="••••••••" /></div>
            <Button type="submit" variant="hero" size="lg" className="mt-2 w-full" disabled={loading}>
              {loading ? "Please wait…" : mode === "signup" ? "Create wallet" : "Sign in"} <ArrowRight />
            </Button>
          </form>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account? " : "New to SwiftPay? "}
            <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="text-primary hover:underline">
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </div>
        </div>
        <div className="mt-4 text-center"><Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to home</Link></div>
      </motion.div>
    </div>
  );
}
