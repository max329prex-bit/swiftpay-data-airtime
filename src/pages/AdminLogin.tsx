import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2, Shield, ArrowLeft } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY     = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const ADMIN_EMAIL  = "onojav79@gmail.com";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [step, setStep]         = useState<"password" | "otp">("password");
  const [password, setPassword] = useState("");
  const [otp, setOtp]           = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
        body: JSON.stringify({ action: "verify-password", password }),
      });
      const data = await res.json();
      // backend returns { success: true } on valid password
      if (!res.ok || !data.success) throw new Error(data.error || "Invalid password");
      setStep("otp");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      // Verify the Supabase Auth OTP sent to admin email
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: ADMIN_EMAIL, token: otp, type: "email",
      });
      if (verifyErr) throw new Error(verifyErr.message || "Invalid or expired code");
      // Password was already validated — access granted
      navigate("/app/admin/treasury", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 p-8 rounded-3xl border border-white/10 bg-white/[0.03] shadow-xl">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-display text-xl font-bold tracking-tight">Admin Access</h1>
          <p className="text-sm text-muted-foreground">
            {step === "password"
              ? "Enter the admin password to continue"
              : `Enter the 6-digit code sent to ${ADMIN_EMAIL}`}
          </p>
        </div>

        {step === "password" ? (
          <form onSubmit={handlePassword} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Admin password"
              autoFocus
              className="w-full h-12 rounded-xl bg-secondary/50 border border-white/10 px-4 text-sm
                         outline-none focus:border-primary/60 transition placeholder:text-muted-foreground"
            />
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500
                         text-white font-semibold text-sm flex items-center justify-center gap-2
                         disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.98]"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending code…</> : "Send Verification Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtp} className="space-y-4">
            <input
              type="text"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              autoFocus
              inputMode="numeric"
              maxLength={6}
              className="w-full h-14 rounded-xl bg-secondary/50 border border-white/10 px-4 text-center
                         text-2xl tracking-[0.35em] font-mono outline-none focus:border-primary/60 transition"
            />
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500
                         text-white font-semibold text-sm flex items-center justify-center gap-2
                         disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.98]"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</> : "Verify & Enter"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("password"); setOtp(""); setError(""); }}
              className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
            >
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
