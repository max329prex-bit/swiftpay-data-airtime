import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/networks";
import { Receipt } from "lucide-react";

export default function History() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => { setItems(data ?? []); setLoading(false); });
  }, [user]);

  return (
    <div className="space-y-5 pb-10">
      <h1 className="font-display text-2xl font-semibold">History</h1>
      {loading ? <div className="py-10 grid place-items-center"><BoltLoader size={56} label="Loading…" /></div> :
       items.length === 0 ? (
        <div className="glass grid place-items-center gap-3 rounded-3xl p-10 text-center">
          <Receipt className="h-8 w-8 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">No transactions yet.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(t => (
            <div key={t.id} className="glass flex items-center justify-between rounded-2xl p-4">
              <div>
                <div className="text-sm font-semibold capitalize">{t.type.replace("_"," ")}{t.network ? ` · ${t.network}` : ""}</div>
                <div className="text-[11px] text-muted-foreground">{t.phone || t.reference} · {new Date(t.created_at).toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-bold ${t.type === "wallet_topup" ? "text-accent" : ""}`}>
                  {t.type === "wallet_topup" ? "+" : "-"}{naira(Number(t.amount))}
                </div>
                <div className={`text-[10px] font-medium uppercase ${t.status === "success" ? "text-success" : t.status === "failed" ? "text-destructive" : "text-warning"}`}>{t.status}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
