import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, TrendingUp, Edit2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { naira } from "@/lib/networks";
import { Button } from "@/components/ui/button";
import { BoltLoader } from "@/components/swift/BoltLoader";
import { toast } from "sonner";

type Pkg = {
  package_code: string;
  name: string;
  network: string;
  provider_code: string;
  price: number;
  cost_price: number;
  size: string;
  validity: string;
  tier: string;
  is_active: boolean;
};

type TxRow = { meta: Record<string, unknown>; amount: number };

const PROVIDER_LABEL: Record<string, string> = {
  gsubz: "Gsubz",
  iacafe: "IACafe",
  bsplug: "BSPlug",
  aidapay: "AidaPay",
};

function providerGroup(code: string): string {
  if (!code) return "aidapay";
  const c = code.toLowerCase();
  if (c === "gsubz" || c.startsWith("gsz-"))         return "gsubz";
  if (c.startsWith("bsplug"))                         return "bsplug";
  if (c === "iacafe" || c.startsWith("iacafe"))       return "iacafe";
  return "aidapay";
}

export default function ProviderMarginReport() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [packages, setPackages]       = useState<Pkg[]>([]);
  const [txMap, setTxMap]             = useState<Record<string, { count: number; revenue: number }>>({});
  const [loading, setLoading]         = useState(true);
  const [isAdmin, setIsAdmin]         = useState(false);
  const [editing, setEditing]         = useState<Record<string, string>>({});
  const [saving, setSaving]           = useState<Record<string, boolean>>({});
  const [filterProvider, setFilterProvider] = useState("all");
  const [filterNetwork, setFilterNetwork]   = useState("all");
  const [syncing, setSyncing]               = useState(false);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
  const ANON_KEY     = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const SYNC_SECRET  = import.meta.env.VITE_SYNC_ADMIN_SECRET as string | undefined;

  const syncCosts = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/populate-cost-prices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": ANON_KEY,
          ...(SYNC_SECRET ? { "x-admin-secret": SYNC_SECRET } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Sync failed");
      toast.success(`Cost prices synced: ${data.updated ?? 0} plans updated`);
      load(); // refresh table
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role" as never, { _role: "admin" } as never).then(({ data }) => {
      setIsAdmin(!!data);
      if (!data) { toast.error("Admin access required"); nav("/app"); }
    });
  }, [user, nav]);

  const load = () => {
    setLoading(true);
    Promise.all([
      supabase
        .from("packages")
        .select("package_code,name,network,provider_code,price,cost_price,size,validity,tier,is_active")
        .order("network")
        .order("price"),
      supabase
        .from("transactions")
        .select("meta,amount")
        .eq("status", "success")
        .in("type", ["data", "airtime", "electricity", "cable"]),
    ]).then(([pkgR, txR]) => {
      setPackages((pkgR.data as Pkg[]) ?? []);

      // Aggregate transactions by package_code stored in meta
      const map: Record<string, { count: number; revenue: number }> = {};
      for (const tx of ((txR.data ?? []) as TxRow[])) {
        const pc =
          (tx.meta?.package_code as string) ??
          (tx.meta?.plan_id as string) ??
          (tx.meta?.provider_code as string) ?? "";
        if (!pc) continue;
        if (!map[pc]) map[pc] = { count: 0, revenue: 0 };
        map[pc].count++;
        map[pc].revenue += tx.amount;
      }
      setTxMap(map);
      setLoading(false);
    });
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);
  if (!isAdmin) return null;

  // ── Per-provider aggregates ──────────────────────────────────────────────
  const byProvider = packages.reduce<
    Record<string, { revenue: number; cost: number; margin: number; sold: number }>
  >((acc, pkg) => {
    const grp = providerGroup(pkg.provider_code);
    const tx  = txMap[pkg.package_code] ?? { count: 0, revenue: 0 };
    if (!acc[grp]) acc[grp] = { revenue: 0, cost: 0, margin: 0, sold: 0 };
    acc[grp].revenue += tx.revenue;
    acc[grp].cost    += tx.count * pkg.cost_price;
    acc[grp].margin  += tx.count * (pkg.price - pkg.cost_price);
    acc[grp].sold    += tx.count;
    return acc;
  }, {});

  const totalMargin = Object.values(byProvider).reduce((s, v) => s + v.margin, 0);
  const totalSold   = Object.values(byProvider).reduce((s, v) => s + v.sold, 0);

  const filteredPkgs = packages.filter(p => {
    if (filterProvider !== "all" && providerGroup(p.provider_code) !== filterProvider) return false;
    if (filterNetwork  !== "all" && p.network !== filterNetwork) return false;
    return true;
  });

  const saveEdit = async (pkg: Pkg) => {
    const val = parseFloat(editing[pkg.package_code] ?? "0");
    if (isNaN(val) || val < 0) { toast.error("Invalid value"); return; }
    setSaving(s => ({ ...s, [pkg.package_code]: true }));
    const { error } = await supabase
      .from("packages")
      .update({ cost_price: val })
      .eq("package_code", pkg.package_code);
    setSaving(s => ({ ...s, [pkg.package_code]: false }));
    if (error) { toast.error("Save failed: " + error.message); return; }
    setPackages(pkgs => pkgs.map(p =>
      p.package_code === pkg.package_code ? { ...p, cost_price: val } : p
    ));
    setEditing(e => { const n = { ...e }; delete n[pkg.package_code]; return n; });
    toast.success("Cost price updated");
  };

  const cancelEdit = (code: string) =>
    setEditing(e => { const n = { ...e }; delete n[code]; return n; });

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => nav(-1)} className="p-2 rounded-xl glass">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-xl font-semibold">Margin Report</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="soft" size="sm" onClick={syncCosts} disabled={syncing}>
            {syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="text-xs ml-1">{syncing ? "Syncing..." : "Sync Costs"}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-10 grid place-items-center"><BoltLoader size={48} /></div>
      ) : (
        <>
          {/* Provider summary cards */}
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(byProvider).map(([grp, stats]) => {
              const pct = stats.revenue > 0 ? (stats.margin / stats.revenue) * 100 : 0;
              return (
                <div key={grp} className="glass rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white/90">
                      {PROVIDER_LABEL[grp] ?? grp}
                    </span>
                    <span className={
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border " +
                      (stats.margin > 0
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20")
                    }>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1 text-xs text-white/60">
                    <span>Revenue</span>
                    <span className="text-right text-white/80">{naira(stats.revenue)}</span>
                    <span>Cost</span>
                    <span className="text-right text-white/80">{naira(stats.cost)}</span>
                    <span>Margin</span>
                    <span className={"text-right font-bold " + (stats.margin >= 0 ? "text-green-400" : "text-red-400")}>
                      {naira(stats.margin)}
                    </span>
                    <span>Sold</span>
                    <span className="text-right text-white/80">{stats.sold} tx</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total bar */}
          <div className="glass rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="text-sm text-white/70">Total Realised Margin</span>
            </div>
            <div className="text-right">
              <div className={"text-lg font-bold " + (totalMargin >= 0 ? "text-green-400" : "text-red-400")}>
                {naira(totalMargin)}
              </div>
              <div className="text-xs text-white/40">{totalSold} transactions</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap items-center">
            {(["all", "gsubz", "iacafe", "bsplug", "aidapay"] as const).map(p => (
              <button
                key={p}
                onClick={() => setFilterProvider(p)}
                className={
                  "text-xs px-3 py-1.5 rounded-full border transition-colors " +
                  (filterProvider === p
                    ? "bg-white/10 border-white/30 text-white"
                    : "border-white/10 text-white/40 hover:text-white/60")
                }
              >
                {p === "all" ? "All Providers" : PROVIDER_LABEL[p]}
              </button>
            ))}
            <div className="h-4 w-px bg-white/10 mx-1" />
            {(["all", "MTN", "AIRTEL", "GLO", "9MOBILE"] as const).map(n => (
              <button
                key={n}
                onClick={() => setFilterNetwork(n)}
                className={
                  "text-xs px-3 py-1.5 rounded-full border transition-colors " +
                  (filterNetwork === n
                    ? "bg-white/10 border-white/30 text-white"
                    : "border-white/10 text-white/40 hover:text-white/60")
                }
              >
                {n === "all" ? "All Networks" : n}
              </button>
            ))}
          </div>

          {/* Notice if no cost_price set */}
          {packages.every(p => p.cost_price === 0) && (
            <div className="glass rounded-xl p-3 border border-yellow-500/20 text-yellow-400/80 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>No cost prices set yet — click the <Edit2 className="h-3 w-3 inline" /> icon on any row to enter provider wholesale costs. Margin will calculate automatically.</span>
            </div>
          )}

          {/* Package table */}
          <div className="glass rounded-2xl overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/40">
                  <th className="text-left p-3 font-medium">Package</th>
                  <th className="text-right p-3 font-medium">Sell ₦</th>
                  <th className="text-right p-3 font-medium">Cost ₦</th>
                  <th className="text-right p-3 font-medium">Margin</th>
                  <th className="text-right p-3 font-medium">Sold</th>
                  <th className="text-right p-3 font-medium">Total ₦</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {filteredPkgs.map(pkg => {
                  const tx       = txMap[pkg.package_code] ?? { count: 0, revenue: 0 };
                  const marginN  = pkg.price - pkg.cost_price;
                  const marginPct = pkg.price > 0 ? (marginN / pkg.price) * 100 : 0;
                  const isEd     = pkg.package_code in editing;
                  return (
                    <tr key={pkg.package_code} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="p-3">
                        <div className="font-medium text-white/80">{pkg.size || pkg.name}</div>
                        <div className="text-white/40">{pkg.network} · {pkg.provider_code?.substring(0, 14)}</div>
                      </td>
                      <td className="p-3 text-right text-white/70">{naira(pkg.price)}</td>
                      <td className="p-3 text-right">
                        {isEd ? (
                          <input
                            type="number"
                            value={editing[pkg.package_code]}
                            onChange={e => setEditing(ed => ({ ...ed, [pkg.package_code]: e.target.value }))}
                            className="w-20 bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-right text-white text-xs focus:outline-none focus:border-white/40"
                            placeholder="0"
                            autoFocus
                          />
                        ) : (
                          <span className={pkg.cost_price === 0 ? "text-yellow-400/50" : "text-white/70"}>
                            {naira(pkg.cost_price)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className={marginN >= 0 ? "text-green-400" : "text-red-400"}>{naira(marginN)}</div>
                        <div className="text-white/30">{marginPct.toFixed(1)}%</div>
                      </td>
                      <td className="p-3 text-right text-white/60">{tx.count}</td>
                      <td className="p-3 text-right">
                        <span className={tx.count * marginN >= 0 ? "text-green-400/80" : "text-red-400"}>
                          {naira(tx.count * marginN)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {isEd ? (
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => saveEdit(pkg)}
                              disabled={saving[pkg.package_code]}
                              className="p-1.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-40"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => cancelEdit(pkg.package_code)}
                              className="p-1.5 rounded bg-white/10 text-white/50 hover:bg-white/20"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditing(e => ({ ...e, [pkg.package_code]: String(pkg.cost_price) }))}
                            className="p-1.5 rounded hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredPkgs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-white/30">No packages match filter</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
