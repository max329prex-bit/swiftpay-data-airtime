import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Zap, Camera, Loader2, User, Phone, Mail } from "lucide-react";

export default function EditProfile() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("full_name, phone, avatar_url").eq("id", user.id).single();
      if (data) {
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
        setAvatarUrl(data.avatar_url || "");
      }
      setLoading(false);
    })();
  }, [user]);

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `avatars/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      toast.success("Avatar uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      if (error) throw error;
      await refreshUser?.();
      toast.success("Profile saved");
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-background" style={{ backgroundImage: "var(--gradient-aurora)", backgroundAttachment: "fixed" }}>
      <div className="sticky top-0 z-40 glass border-b border-white/10">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3.5">
          <button onClick={() => navigate(-1)} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/5 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-glow">
              <Zap className="h-4 w-4 text-white" fill="white" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">Blitz<span className="text-gradient">Pay</span></span>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight mb-6">Edit Profile</h1>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 text-purple-400 animate-spin" /></div>
        ) : (
          <div className="space-y-6">
            {/* Avatar */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="h-24 w-24 rounded-full bg-gradient-primary shadow-glow grid place-items-center text-3xl font-bold text-white overflow-hidden">
                  {avatarUrl ? <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : <User className="h-10 w-10" />}
                </div>
                <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-purple-500 text-white grid place-items-center shadow-glow hover:bg-purple-400 transition-colors">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadAvatar(e.target.files[0]); }} />
            </div>

            {/* Fields */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Full Name
                </label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className="bg-white/5 border-white/10" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Phone Number
                </label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08012345678" className="bg-white/5 border-white/10" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Email
                </label>
                <Input value={user?.email || ""} disabled className="bg-white/[0.03] border-white/10 opacity-60" />
                <p className="text-[10px] text-muted-foreground mt-1">Email cannot be changed</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1 border-white/10" onClick={() => navigate(-1)}>Cancel</Button>
              <Button className="flex-1 bg-gradient-primary shadow-glow" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
