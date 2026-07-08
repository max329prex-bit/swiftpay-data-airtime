import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useWallet() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [reserved, setReserved] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setBalance(0); setReserved(0); setLoading(false); return; }
    const { data } = await supabase.from("wallets").select("balance, reserved_balance").eq("user_id", user.id).maybeSingle();
    setBalance(Number(data?.balance ?? 0));
    setReserved(Number((data as any)?.reserved_balance ?? 0));
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("wallet-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refresh]);

  const available = Math.max(0, balance - reserved);
  return { balance, reserved, available, loading, refresh };
}
