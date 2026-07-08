import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck, ArrowLeft, MessageSquare } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY     = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function AdminLogin() {
  const navigate = useNavigate();
  const [step, setStep]         = useState<"password" | "otp">("password");
  const [password, setPassword] = useState("");
  const [otp, setOtp]           = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [otpSentTo, setOtpSentTo] = useState("");

  const otpCall = async (body: Record<string, string>) => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Request failed");
    return data;
  };

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await otpCall({ action: "verify-password", password });
      const d = await otpCall({ action: "request-otp" });
      setOtpSentTo(d.message || "OTP sent to admin Telegram");
      setStep("otp");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 6) return setError("Enter the 6-digit code");
    setLoading(true);
    setError("");
    try {
      await otpCall({ action: "verify-otp", code: otp });
      // Store admin session in sessionStorage (NOT Supabase auth)
      sessionStorage.setItem("bp_admin_session", Date.now().toString());
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
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-display text-xl font-bold tracking-tight">BlitzPay Admin</h1>
          <p className="text-sm text-muted-foreground">
            {step === "password"
              ? "Enter admin password to continue"
              : otpSentTo || "Check Telegram for the 6-digit code"}
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
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending code…</>
                : <><MessageSquare className="h-4 w-4" /> Send Verification Code</>}
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
                         text-2xl font-bold tracking-[0.4em] outline-none focus:border-primary/60
                         transition placeholder:text-muted-foreground placeholder:tracking-normal"
            />
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500
                         text-white font-semibold text-sm flex items-center justify-center gap-2
                         disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-[0.98]"
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</>
                : "Verify & Enter Admin"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("password"); setOtp(""); setError(""); }}
              className="w-full text-xs text-muted-foreground flex items-center justify-center gap-1 hover:text-foreground transition"
            >
              <ArrowLeft className="h-3 w-3" /> Back to password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
