import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BoltLoader } from "@/components/swift/BoltLoader";
import { ArrowLeft, RefreshCw, Users, Search, Mail, Phone, Wallet, Shield, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { naira } from "@/lib/networks";

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  balance: number;
  created_at: string;
  wallet_funded: boolean;
  tx_count: number;
};

export default function UserManagement() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [filtered, setFiltered] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({ total: 0, admins: 0, withWallet: 0, today: 0 });

  useEffect(() => {
    const adminToken = sessionStorage.getItem("blitzpay_admin_session");
    if (adminToken) { setIsAdmin(true); return; }
    if (!user) return;
    supabase.rpc("has_role" as never, { _role: "admin" } as never).then(({ data }) => {
      setIsAdmin(!!data);
      if (!data) { toast.error("Admin access required"); nav("/app"); }
    });
  }, [user, nav]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let rpcResult = await supabase.rpc("admin_list_users" as any).catch(() => null);
      let userData: any[] = [];

      if (rpcResult?.data && Array.isArray(rpcResult.data)) {
        userData = rpcResult.data;
      } else {
        const [profilesRes, walletsRes, rolesRes, txCounts] = await Promise.all([
          supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200),
          supabase.from("wallets").select("user_id, balance"),
          supabase.from("user_roles").select("user_id, role"),
          supabase.from("transactions").select("user_id, id").limit(1000),
        ]);

        const profiles = (profilesRes.data || []) as any[];
        const wallets = (walletsRes.data || []) as any[];
        const roles = (rolesRes.data || []) as any[];
        const txs = (txCounts.data || []) as any[];

        const txCountMap: Record<string, number> = {};
        for (const t of txs) {
          txCountMap[t.user_id] = (txCountMap[t.user_id] || 0) + 1;
        }

        userData = profiles.map((p: any) => {
          const w = wallets.find((w: any) => w.user_id === p.user_id);
          const r = roles.find((r: any) => r.user_id === p.user_id);
          return {
            id: p.user_id,
            email: p.email || "\u2014",
            full_name: p.full_name || "\u2014",
            phone: p.phone || "\u2014",
            role: r?.role || "user",
            balance: Number(w?.balance || 0),
            created_at: p.created_at,
            wallet_funded: Number(w?.balance || 0) > 0,
            tx_count: txCountMap[p.user_id] || 0,
          };
        });
      }

      setRows(userData);
      setFiltered(userData);
      setStats({
        total: userData.length,
        admins: userData.filter((u) => u.role === "admin").length,
        withWallet: userData.filter((u) => u.wallet_funded || u.balance > 0).length,
        today: userData.filter((u) => {
          const d = new Date(u.created_at);
          const now = new Date();
          return d.toDateString() === now.toDateString();
        }).length,
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  useEffect(() => {
    const q = search.toLowerCase().trim();
    if (!q) { setFiltered(rows); return; }
    setFiltered(
      rows.filter((r) =>
        (r.email || "").toLowerCase().includes(q) ||
        (r.full_name || "").toLowerCase().includes(q) ||
        (r.phone || "").includes(q) ||
        r.id.toLowerCase().includes(q)
      )
    );
  }, [search, rows]);

  if (!isAdmin) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 pb-10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => nav(-1)} className="grid h-9 w-9 place-items-center rounded-full glass text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-semibold">Users</h1>
            <p className="text-xs text-muted-foreground">All registered accounts</p>
          </div>
        </div>
        <Button variant="soft" size="sm" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { icon: Users, label: "Total", value: stats.total, color: "text-blue-400" },
          { icon: Shield, label: "Admins", value: stats.admins, color: "text-red-400" },
          { icon: Wallet, label: "Funded", value: stats.withWallet, color: "text-green-400" },
          { icon: Calendar, label: "Today", value: stats.today, color: "text-yellow-400" },
        ].map((s) => (
          <div key={s.label} className="glass rounded-2xl p-3 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
              <s.icon className="h-3 w-3" /> {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-white/5 border-white/10"
        />
      </div>

      {loading ? (
        <div className="py-10 grid place-items-center">
          <BoltLoader size={48} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No users found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">{r.full_name || "Unnamed User"}</span>
                    {r.role === "admin" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">ADMIN</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {r.email && r.email !== "\u2014" && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" /> {r.email}
                      </span>
                    )}
                    {r.phone && r.phone !== "\u2014" && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {r.phone}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold">{naira(r.balance || 0)}</div>
                  <div className="text-[10px] text-muted-foreground">{r.tx_count || 0} tx</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="font-mono truncate max-w-[200px]">ID: {r.id}</span>
                <span>{new Date(r.created_at).toLocaleDateString("en-NG")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
