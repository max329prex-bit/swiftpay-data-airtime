import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Phone, Mail, Save, Loader2, X, Building2, CreditCard, Gift } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function EditProfile() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [ftBank, setFtBank] = useState("");
  const [ftName, setFtName] = useState("");
  const [ftAcct, setFtAcct] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, phone, ft_bank_name, ft_account_name, ft_account_number")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        setLoading(false);
        if (error) { toast.error("Could not load profile"); return; }
        setFullName(data?.full_name ?? "");
        setPhone(data?.phone ?? "");
        setFtBank(data?.ft_bank_name ?? "");
        setFtName(data?.ft_account_name ?? "");
        setFtAcct(data?.ft_account_number ?? "");
      });
  }, [user]);

  async function handleSave() {
    if (!user) return;
    const acct = ftAcct.replace(/\D/g, "");
    const bank = ftBank.trim();
    if (acct && bank) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("ft_bank_name", bank)
        .eq("ft_account_number", acct)
        .neq("user_id", user.id)
        .maybeSingle();
      if (existing) {
        toast.error("This bank + account number is already registered by another user.");
        return;
      }
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          ft_bank_name: bank || null,
          ft_account_name: ftName.trim().toUpperCase() || null,
          ft_account_number: acct || null,
        },
        { onConflict: "user_id" }
      );
    if (error) {
      if (error.message.includes("idx_profiles_ft_bank_account")) {
        toast.error("This bank + account number is already registered by another user.");
      } else {
        toast.error("Failed to save: " + error.message);
      }
    } else {
      toast.success("Profile saved");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => nav("/app/settings")} className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display text-lg font-bold">Edit Profile</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className="pl-10 h-12 bg-white/[0.04] border-white/10 rounded-xl" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone Number</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08012345678" className="pl-10 h-12 bg-white/[0.04] border-white/10 rounded-xl" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={user?.email ?? ""} disabled className="pl-10 h-12 bg-white/[0.02] border-white/5 rounded-xl text-muted-foreground cursor-not-allowed" />
          </div>
          <p className="text-xs text-muted-foreground pl-1">Email cannot be changed</p>
        </div>

        {/* Free Transfer defaults */}
        <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-sm font-semibold">Free Transfer defaults</div>
              <div className="text-[11px] text-muted-foreground">Bank account you'll transfer from — used to auto-verify deposits.</div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Bank Name</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={ftBank} onChange={e => setFtBank(e.target.value)} placeholder="e.g. OPay, GTBank"
                className="pl-10 h-11 bg-white/[0.04] border-white/10 rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Account Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={ftName} onChange={e => setFtName(e.target.value)} placeholder="Exactly as on your bank"
                className="pl-10 h-11 bg-white/[0.04] border-white/10 rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Account Number</label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={ftAcct} onChange={e => setFtAcct(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10 digits" inputMode="numeric"
                className="pl-10 h-11 bg-white/[0.04] border-white/10 rounded-xl" />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" className="flex-1 h-12 rounded-xl border-white/10" onClick={() => nav("/app/settings")}>
            <X className="w-4 h-4 mr-2" /> Cancel
          </Button>
          <Button className="flex-1 h-12 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium" disabled={saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
