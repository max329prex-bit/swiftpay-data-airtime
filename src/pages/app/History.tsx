import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/networks";
import { Receipt, ChevronRight } from "lucide-react";
import { BoltLoader } from "@/components/swift/BoltLoader";
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
      {loading ? <div className="py-10 grid place-items-center"><BoltLoader size={56} label="Loading..." /></div> :
       items.length === 0 ? (
        <div className="glass grid place-items-center gap-3 rounded-3xl p-10 text-center">
          <Receipt className="h-8 w-8 text-muted-foreground" /><div className="text-sm text-muted-foreground">No transactions yet.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(t => (
            <Link key={t.id} to={"/app/transaction/" + t.id}
              className="glass flex items-center justify-between rounded-2xl p-4 hover:border-primary/30 transition-colors">
              <div>
                <div className="text-sm font-semibold capitalize">{t.type.replace("_"," ")}{t.network ? " - " + t.network : ""}</div>
                <div className="text-[11px] text-muted-foreground">{t.phone || t.reference} - {new Date(t.created_at).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  {/* Deposits: + green if success, muted no-sign if pending/failed */}
                  {/* Purchases: - red if success, - muted if failed/refunded */}
                  <div className={`text-sm font-bold ${
                    (t.type === "wallet_fund" || t.type === "wallet_topup")
                      ? (t.status === "success" ? "text-green-400" : "text-muted-foreground")
                      : (t.status === "success" ? "text-red-400" : "text-muted-foreground")
                  }`}>
                    {(t.type === "wallet_fund" || t.type === "wallet_topup")
                      ? (t.status === "success" ? "+" : "")
                      : "-"}
                    {(t.type === "wallet_fund" || t.type === "wallet_topup") && t.meta?.net_credit
                      ? naira(Number(t.meta.net_credit))
                      : naira(Number(t.amount))}
                  </div>
                  <div className={`text-[10px] font-medium uppercase ${
                    t.status === "success" ? "text-success"
                    : t.status === "failed" ? "text-destructive"
                    : t.status === "refunded" ? "text-destructive"
                    : t.status === "verifying" || t.status === "processing" ? "text-blue-400"
                    : "text-warning"
                  }`}>
                    {t.status === "refunded" ? "Refunded" : t.status}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
