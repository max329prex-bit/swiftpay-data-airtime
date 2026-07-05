import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/blitz/Logo";
import { toast } from "sonner";
import { ArrowRight, Mail, RefreshCw, KeyRound, CheckCircle2 } from "lucide-react";

type Step = "form" | "verify" | "forgot" | "forgot-sent";

export default function Auth() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(""); const [phone, setPhone] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const nav = useNavigate();

  // Already logged in? Redirect to dashboard immediately.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav("/app", { replace: true });
    });
  }, [nav]);

  // Handle when user returns from email confirmation or password reset link
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        nav("/app");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [nav]);

  function startCooldown(secs: number) {
    setResendCooldown(secs);
    const t = setInterval(() => setResendCooldown(p => { if (p <= 1) { clearInterval(t); return 0; } return p - 1; }), 1000);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { full_name: fullName, phone },
            emailRedirectTo: `${window.location.origin}/app`,
          },
        });
        if (error) throw error;
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          toast.error("An account with this email already exists. Please sign in.");
          setMode("signin"); setPassword(""); return;
        }
        setStep("verify");
        startCooldown(60);
        toast.success("Check your email for the confirmation link!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav("/app");
      }
    } catch (err: any) {
      const msg: string = err.message ?? "Something went wrong";
      if (msg.toLowerCase().includes("already registered")) {
        toast.error("Email already registered. Please sign in."); setMode("signin"); setPassword("");
      } else if (msg.toLowerCase().includes("invalid login") || msg.toLowerCase().includes("invalid credentials")) {
        toast.error("Incorrect email or password. Use Forgot Password if needed.");
      } else {
        toast.error(msg);
      }
    } finally { setLoading(false); }
  }

  async function resendEmail() {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup", email,
        options: { emailRedirectTo: `${window.location.origin}/app` }
      });
      if (error) throw error;
      toast.success("Confirmation email resent!");
      startCooldown(60);
    } catch (err: any) {
      toast.error(err.message ?? "Could not resend");
      startCooldown(60);
    } finally { setLoading(false); }
  }

  async function sendResetEmail(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/app`,
      });
      if (error) throw error;
      setStep("forgot-sent");
    } catch (err: any) {
      toast.error(err.message ?? "Could not send reset email");
    } finally { setLoading(false); }
  }

  async function signInWithGoogle() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/app` },
      });
      if (error) throw error;
    } catch (err: any) { toast.error(err.message ?? "Could not sign in with Google"); setLoading(false); }
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-4">
      <div className="absolute inset-0 -z-10 bg-gradient-aurora" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="gloss-strong rounded-3xl p-8 shadow-card">

          <AnimatePresence mode="wait">

            {/* ── Verify email screen ── */}
            {step === "verify" && (
              <motion.div key="verify" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                <div className="flex justify-center">
                  <span className="grid h-20 w-20 place-items-center rounded-2xl bg-primary/10">
                    <Mail className="h-10 w-10 text-primary" />
                  </span>
                </div>
                <div className="text-center space-y-2">
                  <h1 className="font-display text-2xl font-bold">Check your email</h1>
                  <p className="text-sm text-muted-foreground">Confirmation link sent to</p>
                  <p className="font-semibold text-foreground text-sm">{email}</p>
                  <p className="text-xs text-muted-foreground">Click the link in the email to verify and open BlitzPay.</p>
                </div>
                <div className="glass rounded-2xl p-4 text-center space-y-1 border border-primary/20">
                  <p className="text-xs text-muted-foreground">Email sent from</p>
                  <p className="text-sm font-semibold text-primary">onojav79@gmail.com</p>
                  <p className="text-xs text-muted-foreground">Check spam if not found</p>
                </div>
                <div className="text-center">
                  {resendCooldown > 0 ? (
                    <p className="text-sm text-muted-foreground">Resend in {resendCooldown}s</p>
                  ) : (
                    <button onClick={resendEmail} disabled={loading} className="text-sm text-primary hover:underline inline-flex items-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5" /> Resend email
                    </button>
                  )}
                </div>
                <div className="text-center">
                  <button onClick={() => { setStep("form"); setResendCooldown(0); }} className="text-xs text-muted-foreground hover:text-foreground">
                    Back to sign up
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Forgot password screen ── */}
            {step === "forgot" && (
              <motion.div key="forgot" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                <div className="flex justify-center">
                  <span className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10">
                    <KeyRound className="h-8 w-8 text-primary" />
                  </span>
                </div>
                <div className="text-center">
                  <h1 className="font-display text-2xl font-bold">Reset password</h1>
                  <p className="mt-2 text-sm text-muted-foreground">Enter your email and we'll send a reset link</p>
                </div>
                <form onSubmit={sendResetEmail} className="space-y-4">
                  <div>
                    <Label htmlFor="reset-em">Email address</Label>
                    <Input id="reset-em" type="email" required value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)} className="mt-1" placeholder="you@blitzpay.ng" />
                  </div>
                  <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                    {loading ? "Sending..." : "Send reset link"} <ArrowRight />
                  </Button>
                </form>
                <div className="text-center">
                  <button onClick={() => setStep("form")} className="text-xs text-muted-foreground hover:text-foreground">
                    Back to sign in
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Reset email sent ── */}
            {step === "forgot-sent" && (
              <motion.div key="forgot-sent" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                <div className="flex justify-center">
                  <span className="grid h-20 w-20 place-items-center rounded-2xl bg-green-500/10">
                    <CheckCircle2 className="h-10 w-10 text-green-400" />
                  </span>
                </div>
                <div className="text-center space-y-2">
                  <h1 className="font-display text-2xl font-bold">Reset link sent!</h1>
                  <p className="text-sm text-muted-foreground">Check your email at</p>
                  <p className="font-semibold text-foreground text-sm">{resetEmail}</p>
                  <p className="text-xs text-muted-foreground">Click the link to set a new password. Check spam if not found.</p>
                </div>
                <div className="glass rounded-2xl p-4 text-center space-y-1 border border-green-500/20">
                  <p className="text-xs text-muted-foreground">Email sent from</p>
                  <p className="text-sm font-semibold text-green-400">onojav79@gmail.com</p>
                </div>
                <div className="text-center">
                  <button onClick={() => { setStep("form"); setResetEmail(""); }} className="text-sm text-primary hover:underline">
                    Back to sign in
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Main sign in / sign up form ── */}
            {step === "form" && (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h1 className="font-display text-3xl font-bold">{mode === "signup" ? "Create your wallet" : "Welcome back"}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{mode === "signup" ? "30 seconds. No paperwork." : "Sign in to your BlitzPay wallet."}</p>

                <Button type="button" variant="outline" size="lg" className="mt-6 w-full gap-3" disabled={loading} onClick={signInWithGoogle}>
                  <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Continue with Google
                </Button>

                <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">sign {mode === "signup" ? "up" : "in"} with email</span><div className="h-px flex-1 bg-border" /></div>

                <form onSubmit={submit} className="space-y-3">
                  {mode === "signup" && (<>
                    <div><Label htmlFor="fn">Full name</Label><Input id="fn" required value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1" placeholder="Ada Obi" /></div>
                    <div><Label htmlFor="ph">Phone</Label><Input id="ph" required value={phone} onChange={e => setPhone(e.target.value)} className="mt-1" placeholder="0803 000 0000" /></div>
                  </>)}
                  <div><Label htmlFor="em">Email</Label><Input id="em" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1" placeholder="you@blitzpay.ng" /></div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label htmlFor="pw">Password</Label>
                      {mode === "signin" && (
                        <button type="button" onClick={() => { setResetEmail(email); setStep("forgot"); }}
                          className="text-xs text-primary hover:underline">
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <Input id="pw" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                  <Button type="submit" variant="hero" size="lg" className="mt-2 w-full" disabled={loading}>
                    {loading ? "Please wait..." : mode === "signup" ? "Create wallet" : "Sign in"} <ArrowRight />
                  </Button>
                </form>

                <div className="mt-5 text-center text-sm text-muted-foreground">
                  {mode === "signup" ? "Already have an account? " : "New to BlitzPay? "}
                  <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setPassword(""); }} className="text-primary hover:underline">
                    {mode === "signup" ? "Sign in" : "Create one"}
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
        <div className="mt-4 text-center"><Link to="/" className="text-xs text-muted-foreground hover:text-foreground">Back to home</Link></div>
      </motion.div>
    </div>
  );
}
