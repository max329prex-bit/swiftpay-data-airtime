import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useSwiftPoints() {
  const { user } = useAuth();
  const [points, setPoints] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setPoints(0); setLoading(false); return; }
    const { data } = await supabase.from("profiles").select("swift_points").eq("user_id", user.id).maybeSingle();
    setPoints(Number((data as any)?.swift_points ?? 0));
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("pts-" + user.id)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refresh]);

  return { points, loading, refresh };
}