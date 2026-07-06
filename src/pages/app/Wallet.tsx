import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";
import { naira } from "@/lib/networks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Copy, CheckCircle2, Building2, RefreshCw, Info,
  Zap, Lock, Clock, ChevronRight, ShieldCheck, User, Phone, CreditCard
} from "lucide-react";

interface VAResult {
  success: boolean;
  type: "static" | "dynamic";
  needs_kyc?: boolean;
  account_number: string;
  account_name: string;
  bank_name: string;
  tracking_reference?: string;
  expires_at?: string;
  is_existing?: boolean;
  error?: string;
}

interface KYCPayload {
  full_name?: string;
  phone?: string;
  nin?: string;
  bvn?: string;
}

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function callTopup(
  accessToken: string,
  type: "static" | "dynamic",
  kyc?: KYCPayload
): Promise<VAResult> {
  const res = await fetch(`${SUPA_URL}/functions/v1/payvessel-topup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ type, ...kyc })
  });
  const raw = await res.text();
  try { return JSON.parse(raw); }
  catch { throw new Error("Service returned an unexpected response. Please try again."); }
}

export default function Wallet() {
  const { balance, reserved, available, refresh } = useWallet();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"static" | "dynamic">("static");

  // Static VA state
  const [staticVA, setStaticVA]        = useState<VAResult | null>(null);
  const [staticLoading, setStaticLoad] = useState(false);
  const [staticError, setStaticError]  = useState<string | null>(null);
  const [copiedStatic, setCopiedStatic] = useState(false);

  // KYC form state
  const [showKYC, setShowKYC]           = useState(false);
  const [kycName, setKycName]           = useState("");
  const [kycEmail, setKycEmail]         = useState("");
  const [kycPhone, setKycPhone]         = useState("");
  const [kycLoaded, setKycLoaded]       = useState(false);
  const [kycNIN, setKycNIN]             = useState("");
  const [kycBVN, setKycBVN]             = useState("");
  const [kycSubmitting, setKycSubmit]   = useState(false);
  const [kycError, setKycError]         = useState<string | null>(null);

  // Dynamic VA state
  const [dynamicVA, setDynamicVA]        = useState<VAResult | null>(null);
  const [dynamicLoading, setDynLoad]     = useState(false);
  const [dynamicError, setDynamicError]  = useState<string | null>(null);
  const [copiedDynamic, setCopiedDynamic] = useState(false);
  const [countdown, setCountdown]        = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Real-time wallet update
  useEffect(() => {
    const ch = supabase.channel("wallet-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, (p) => {
        const n = p.new as any;
        if (n?.type === "wallet_fund" && n?.status === "success") {
          refresh();
          toast.success("Deposit confirmed! Balance updated.");
          if (dynamicVA) { setDynamicVA(null); clearCountdown(); }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh, dynamicVA]);

  // Load static VA on mount
  useEffect(() => { fetchStatic(); }, []);

  // Auto-fill KYC form with user data when KYC is shown
  useEffect(() => {
    if (!showKYC || kycLoaded || !user) return;
    async function loadProfile() {
      try {
        const { data } = await supabase.from("profiles").select("full_name, phone").eq("user_id", user.id).maybeSingle();
        if (data?.full_name) setKycName(data.full_name);
        if (data?.phone) setKycPhone(data.phone);
        if (user.email) setKycEmail(user.email);
        setKycLoaded(true);
      } catch {
        if (user.email) setKycEmail(user.email);
        setKycLoaded(true);
      }
    }
    loadProfile();
  }, [showKYC, user, kycLoaded]);

  function clearCountdown() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setCountdown(null);
  }

  function startCountdown(expiresAt: string) {
    clearCountdown();
    const update = () => {
      const secs = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setCountdown(secs);
      if (secs <= 0) { clearCountdown(); setDynamicVA(null); toast.info("One-time account expired."); }
    };
    update();
    timerRef.current = setInterval(update, 1000);
  }

  useEffect(() => () => clearCountdown(), []);

  const fetchStatic = useCallback(async (silent = false) => {
    if (!silent) setStaticLoad(true);
    setStaticError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const data = await callTopup(session.access_token, "static");
      if (data.needs_kyc) {
        setShowKYC(true);
        return;
      }
      if (data.needs_kyc) {
        setStaticError("KYC_REQUIRED: Your identity is needed to create a permanent account.");
        return;
      }
      if (!data.success) throw new Error(data.error || "Could not load account");
      setStaticVA(data);
      setShowKYC(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setStaticError(msg);
      // Don't toast KYC errors â they get a dedicated UI card
      if (!silent && !msg.startsWith("KYC_REQUIRED:")) toast.error(msg);
    } finally { setStaticLoad(false); }
  }, []);

  const submitKYC = useCallback(async () => {
    const name  = kycName.trim();
    const phone = kycPhone.replace(/\D/g, "");
    const nin   = kycNIN.replace(/\D/g, "");
    const bvn   = kycBVN.replace(/\D/g, "");

    if (!name || name.split(" ").filter(Boolean).length < 2) {
      setKycError("Enter your full name (first and last name)"); return;
    }
    if (phone.length !== 11) {
      setKycError("Enter a valid 11-digit Nigerian phone number"); return;
    }
    if (nin.length !== 11) {
      setKycError("NIN must be exactly 11 digits"); return;
    }
    if (bvn && bvn.length !== 11) {
      setKycError("BVN must be exactly 11 digits if provided"); return;
    }

    setKycSubmit(true);
    setKycError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const data = await callTopup(session.access_token, "static", {
        full_name: name, phone, nin, bvn: bvn || undefined
      });
      if (data.needs_kyc) {
        setKycError("Please check your details and try again."); return;
      }
      if (!data.success) throw new Error(data.error || "Account creation failed");
      setStaticVA(data);
      setShowKYC(false);
      toast.success("Permanent account created!");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setKycError(msg);
      toast.error(msg);
    } finally { setKycSubmit(false); }
  }, [kycName, kycPhone, kycNIN, kycBVN]);

  const fetchDynamic = useCallback(async () => {
    setDynLoad(true);
    setDynamicError(null);
    clearCountdown();
    setDynamicVA(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const data = await callTopup(session.access_token, "dynamic");
      if (!data.success) throw new Error(data.error || "Could not create one-time account");
      setDynamicVA(data);
      if (data.expires_at) startCountdown(data.expires_at);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setDynamicError(msg);
      toast.error(msg);
    } finally { setDynLoad(false); }
  }, []);

  async function copyText(text: string, which: "static" | "dynamic") {
    await navigator.clipboard.writeText(text);
    if (which === "static") { setCopiedStatic(true); setTimeout(() => setCopiedStatic(false), 2500); }
    else { setCopiedDynamic(true); setTimeout(() => setCopiedDynamic(false), 2500); }
    toast.success("Copied!");
  }

  function fmtCountdown(s: number | null) {
    if (s === null) return "";
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  const AccountCard = ({ va, copied, onCopy, onRefresh, showRefresh = false }:
    { va: VAResult; copied: boolean; onCopy: () => void; onRefresh?: () => void; showRefresh?: boolean }) => (
    <motion.div key="va" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-secondary/30 border border-primary/20 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Building2 className="w-4 h-4 text-primary" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Deposit to</div>
          <div className="text-sm font-semibold">{va.bank_name || "Bank"}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {showRefresh && (
            <button onClick={onRefresh} className="text-xs text-primary flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> New
            </button>
          )}
          <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">
            Active
          </span>
        </div>
      </div>

      <button onClick={onCopy}
        className="w-full rounded-xl bg-white/[0.04] border border-white/10 p-4 flex items-center justify-between group hover:bg-white/[0.07] active:scale-[0.98] transition">
        <div className="text-left">
          <div className="text-xs text-muted-foreground mb-1">Account Number</div>
          <div className="font-display text-2xl font-bold tracking-wider">{va.account_number}</div>
        </div>
        {copied
          ? <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0" />
          : <Copy className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition shrink-0" />}
      </button>

      <div className="rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3">
        <div className="text-xs text-muted-foreground mb-0.5">Account Name</div>
        <div className="text-sm font-semibold">{va.account_name}</div>
      </div>

      <p className="text-center text-xs text-muted-foreground">Tap to copy Â· No minimum</p>
    </motion.div>
  );

  return (
    <div className="space-y-5 pb-10">
      <h1 className="font-display text-2xl font-semibold">Deposit</h1>

      {/* Balance */}
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-primary p-6 shadow-glow">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
        <div className="text-xs uppercase tracking-widest text-white/70">Wallet balance</div>
        <div className="mt-1 font-display text-4xl font-bold text-white">{naira(balance)}</div>
        {reserved > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-3 text-white/90">
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-white/70">Reserved</div>
              <div className="font-display text-base font-bold">{naira(reserved)}</div>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-white/70">Available</div>
              <div className="font-display text-base font-bold">{naira(available)}</div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Tab switcher */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary/20 p-1">
        <button onClick={() => setTab("static")}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition
            ${tab === "static" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <Lock className="w-4 h-4" /> Permanent
        </button>
        <button onClick={() => setTab("dynamic")}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition
            ${tab === "dynamic" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <Zap className="w-4 h-4" /> One-Time
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-2xl bg-secondary/20 border border-white/5 p-4 flex gap-3 text-sm text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 text-primary/70 shrink-0" />
        {tab === "static"
          ? <p>Your permanent account â transfer any amount anytime. Balance updates instantly. <span className="text-yellow-400/80 font-medium">1% deposit fee applies.</span></p>
          : <p>One-time account â valid for a single transfer only. Expires after use or 30 minutes. <span className="text-yellow-400/80 font-medium">1% deposit fee applies.</span></p>}
      </div>

      {/* ââ STATIC TAB ââââââââââââââââââââââââââââââââââââââââââââââââââââââ */}
      <AnimatePresence mode="wait">
        {tab === "static" && (
          <motion.div key="static-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-3">

            {/* Loading */}
            {staticLoading && (
              <div className="rounded-2xl bg-secondary/30 border border-white/5 p-6 flex items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading your accountâ¦</span>
              </div>
            )}

            {/* Error */}
            {!staticLoading && staticError && (
              staticError.startsWith("KYC_REQUIRED:") ? (
                <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <Lock className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-amber-400">Identity Verification Required</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Payvessel requires your NIN or BVN to create a permanent account.
                      </p>
                    </div>
                  </div>
                  <button onClick={() => navigate("/app/settings")}
                    className="w-full h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium flex items-center justify-center gap-2 hover:bg-amber-500/30 transition">
                    Go to Settings â Verification
                  </button>
                  <p className="text-[10px] text-muted-foreground/60 text-center">Your one-time account tab still works while you set this up</p>
                </div>
              ) : (
                <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-5 space-y-3">
                  <p className="text-sm text-destructive">{staticError}</p>
                  <button onClick={() => fetchStatic()} className="flex items-center gap-2 text-sm font-medium text-primary">
                    <RefreshCw className="w-4 h-4" /> Try again
                  </button>
                </div>
              )
            )}

            {/* ââ KYC Form ââ */}
            {!staticLoading && !staticError && showKYC && !staticVA && (
              <motion.div key="kyc-form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-secondary/30 border border-primary/20 p-5 space-y-5">

                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Set up your permanent account</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Fill in your details to create a dedicated bank account.
                    </div>
                  </div>
                </div>

                {/* Inline error */}
                {kycError && (
                  <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
                    <p className="text-sm text-destructive">{kycError}</p>
                  </div>
                )}

                {/* Fields */}
                <div className="space-y-3">
                  {/* Full Name */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="First Last Name"
                      value={kycName}
                      onChange={e => { setKycName(e.target.value); setKycError(null); }}
                      className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition"
                    />
                  </div>

                  {/* Email (read-only) */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> Email
                    </label>
                    <input
                      type="email"
                      readOnly
                      value={kycEmail}
                      className="w-full rounded-xl bg-white/[0.02] border border-white/5 px-4 py-3 text-sm text-muted-foreground cursor-default"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Phone Number
                    </label>
                    <input
                      type="tel"
                      placeholder="08012345678"
                      value={kycPhone}
                      onChange={e => { setKycPhone(e.target.value); setKycError(null); }}
                      className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition"
                    />
                  </div>

                  {/* NIN */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> NIN <span className="text-primary/60">(required)</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="11-digit NIN"
                      value={kycNIN}
                      onChange={e => { setKycNIN(e.target.value.replace(/\D/g, "")); setKycError(null); }}
                      className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition font-mono"
                    />
                  </div>

                  {/* BVN */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> BVN <span className="text-muted-foreground/50">(optional)</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="11-digit BVN"
                      value={kycBVN}
                      onChange={e => { setKycBVN(e.target.value.replace(/\D/g, "")); setKycError(null); }}
                      className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition font-mono"
                    />
                  </div>
                </div>

                {/* Submit */}
                <button
                  onClick={submitKYC}
                  disabled={kycSubmitting}
                  className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50 shadow-glow"
                >
                  {kycSubmitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating accountâ¦</>
                    : <><ShieldCheck className="w-4 h-4" /> Create my permanent account <ChevronRight className="w-4 h-4 opacity-60" /></>}
                </button>

                <p className="text-center text-xs text-muted-foreground">
                  Your details are encrypted and used only for account verification
                </p>
              </motion.div>
            )}

            {/* Account card */}
            {!staticLoading && staticVA && (
              <AccountCard va={staticVA} copied={copiedStatic}
                onCopy={() => copyText(staticVA.account_number, "static")} />
            )}

            {staticVA && (
              <button onClick={() => fetchStatic(true)}
                className="w-full h-11 rounded-xl border border-white/10 text-sm text-muted-foreground flex items-center justify-center gap-2 hover:bg-white/5 transition">
                <RefreshCw className="w-4 h-4" /> Refresh balance
              </button>
            )}
          </motion.div>
        )}

        {/* ââ DYNAMIC TAB âââââââââââââââââââââââââââââââââââââââââââââââââââ */}
        {tab === "dynamic" && (
          <motion.div key="dynamic-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-4">
            {!dynamicVA && !dynamicLoading && (
              <div className="space-y-3">
                {dynamicError && (
                  <div className="rounded-2xl bg-secondary/30 border border-white/5 p-4">
                    <p className="text-sm text-muted-foreground text-center">{dynamicError}</p>
                  </div>
                )}
                <button onClick={fetchDynamic} disabled={dynamicLoading}
                  className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition shadow-glow">
                  <Zap className="w-5 h-5" />
                  Generate one-time account
                  <ChevronRight className="w-5 h-5 opacity-60" />
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  No BVN required Â· Instant Â· Single use only
                </p>
              </div>
            )}

            {dynamicLoading && (
              <div className="rounded-2xl bg-secondary/30 border border-white/5 p-6 flex items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Generating your accountâ¦</span>
              </div>
            )}

            {dynamicVA && !dynamicLoading && (
              <div className="space-y-3">
                {countdown !== null && (
                  <div className={`rounded-xl border px-4 py-2.5 flex items-center gap-2 text-sm
                    ${countdown < 120 ? "bg-orange-500/10 border-orange-500/20 text-orange-400"
                                      : "bg-secondary/20 border-white/5 text-muted-foreground"}`}>
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>Expires in <strong>{fmtCountdown(countdown)}</strong> â use immediately</span>
                  </div>
                )}
                <AccountCard va={dynamicVA} copied={copiedDynamic}
                  onCopy={() => copyText(dynamicVA.account_number, "dynamic")}
                  onRefresh={fetchDynamic} showRefresh={true} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-center text-xs text-muted-foreground">Secured by Payvessel Â· Instant bank transfer Â· <span className="text-yellow-400/70">1% fee on all deposits</span></p>
    </div>
  );
}
