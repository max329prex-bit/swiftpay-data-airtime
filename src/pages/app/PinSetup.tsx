import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export default function PinSetup() {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"create" | "confirm">("create");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function save() {
    if (pin !== confirm) { toast.error("PINs do not match"); setConfirm(""); setStep("create"); setPin(""); return; }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("set_transaction_pin", { _pin: pin });
      if (error) throw error;
      toast.success("Transaction PIN set!");
      nav("/app", { replace: true });
    } catch (e: any) { toast.error(e.message ?? "Failed to set PIN"); }
    finally { setBusy(false); }
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-4">
      <div className="absolute inset-0 -z-10 bg-gradient-aurora" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md gloss-strong rounded-3xl p-8 shadow-card space-y-6">
        <div className="flex justify-center">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </span>
        </div>
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold">{step === "create" ? "Set your transaction PIN" : "Confirm your PIN"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === "create" ? "Create a 4-digit PIN to authorize every payment." : "Enter the same 4 digits again."}
          </p>
        </div>
        <div className="flex justify-center">
          {step === "create" ? (
            <InputOTP maxLength={4} value={pin} onChange={(v) => { setPin(v); if (v.length === 4) setStep("confirm"); }}>
              <InputOTPGroup>
                <InputOTPSlot index={0} className="h-14 w-14 text-xl rounded-2xl" />
                <InputOTPSlot index={1} className="h-14 w-14 text-xl rounded-2xl" />
                <InputOTPSlot index={2} className="h-14 w-14 text-xl rounded-2xl" />
                <InputOTPSlot index={3} className="h-14 w-14 text-xl rounded-2xl" />
              </InputOTPGroup>
            </InputOTP>
          ) : (
            <InputOTP maxLength={4} value={confirm} onChange={setConfirm}>
              <InputOTPGroup>
                <InputOTPSlot index={0} className="h-14 w-14 text-xl rounded-2xl" />
                <InputOTPSlot index={1} className="h-14 w-14 text-xl rounded-2xl" />
                <InputOTPSlot index={2} className="h-14 w-14 text-xl rounded-2xl" />
                <InputOTPSlot index={3} className="h-14 w-14 text-xl rounded-2xl" />
              </InputOTPGroup>
            </InputOTP>
          )}
        </div>
        {step === "confirm" && (
          <Button variant="hero" size="xl" className="w-full" disabled={confirm.length < 4 || busy} onClick={save}>
            {busy ? "Saving..." : "Confirm PIN"}
          </Button>
        )}
        {step === "confirm" && (
          <button onClick={() => { setStep("create"); setPin(""); setConfirm(""); }} className="block w-full text-center text-xs text-muted-foreground hover:text-foreground">
            ← Start over
          </button>
        )}
      </motion.div>
    </div>
  );
}