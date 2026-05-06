import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/swift/Logo";
import { toast } from "sonner";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Step = "form" | "verify";

export default function Auth() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(""); const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName, phone } },
        });
        if (error) throw error;
        toast.success("Verification code sent to your email!");
        setStep("verify");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav("/app");
      }
    } catch (err: any) { toast.error(err.message ?? "Something went wrong"); }
    finally { setLoading(false); }
  }

  async function verifyCode() {
    if (otp.length < 6) return toast.error("Enter the 6-digit code");
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "signup" });
      if (error) throw error;
      toast.success("Email verified! Welcome to SwiftPay!");
      nav("/app");
    } catch (err: any) { toast.error(err.message ?? "Invalid code"); }
    finally { setLoading(false); }
  }

  async function resendCode() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      toast.success("New code sent!");
    } catch (err: any) { toast.error(err.message ?? "Could not resend"); }
    finally { setLoading(false); }
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-4">
      <div className="absolute inset-0 -z-10 bg-gradient-aurora" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="gloss-strong rounded-3xl p-8 shadow-card">

          {step === "verify" ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="flex justify-center">
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10">
                  <ShieldCheck className="h-8 w-8 text-primary" />
                </span>
              </div>
              <div className="text-center">
                <h1 className="font-display text-2xl font-bold">Verify your email</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  We sent a 6-digit code to<br />
                  <span className="font-semibold text-foreground">{email}</span>
                </p>
              </div>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button variant="hero" size="lg" className="w-full" disabled={loading || otp.length < 6} onClick={verifyCode}>
                {loading ? "Verifying…" : "Verify & continue"} <ArrowRight />
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                Didn't get a code?{" "}
                <button onClick={resendCode} disabled={loading} className="text-primary hover:underline">Resend</button>
              </div>
            </motion.div>
          ) : (
            <>
              <h1 className="font-display text-3xl font-bold">{mode === "signup" ? "Create your wallet" : "Welcome back"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{mode === "signup" ? "30 seconds. No paperwork." : "Sign in to your SwiftPay wallet."}</p>

              <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-3 opacity-50">
                <div className="flex items-center gap-3">
                  <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4c-.2 1.2-.9 2.2-2 2.9v2.4h3.2c1.9-1.7 3-4.3 3-7.1z"/><path fill="currentColor" opacity=".8" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.4c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.5C4.7 19.7 8.1 22 12 22z"/></svg>
                  <span className="text-sm text-muted-foreground">Continue with Google — <span className="text-xs">coming soon</span></span>
                </div>
              </div>

              <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">sign {mode === "signup" ? "up" : "in"} with email</span><div className="h-px flex-1 bg-border" /></div>

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
            </>
          )}
        </div>
        <div className="mt-4 text-center"><Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to home</Link></div>
      </motion.div>
    </div>
  );
}
