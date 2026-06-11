import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, TrendingUp, Pencil, Check, X, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { naira } from "@/lib/networks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BoltLoader } from "@/components/swift/BoltLoader";
import { toast } from "sonner";

type Pkg = {
  package_code: string; name: string; network: string;
  price: number; cost_price: number | null;
  provider_code: string; size: string; validity: string;
};
type TxRow = { meta: { provider_code?: string }; amount: number; status: string };

const PROVIDERS = ["gsubz", "iacafe", "bsplug", "aidapay"] as const;
const PROVIDER_COLORS: Record<string, string> = {
  gsubz:   "bg-violet-500/10 text-violet-400 border-violet-500/20",
  iacafe:  "bg-sky-500/10    text-sky-400    border-sky-500/20",
  bsplug:  "bg-amber-500/10  text-amber-400  border-amber-500/20",
  aidapay: "bg-rose-500/10   text-rose-400   border-rose-500/20",
};
const PROVIDER_BAR: Record<string, string> = {
  gsubz: "bg-violet-500", iacafe: "bg-sky-500", bsplug: "bg-amber-400", aidapay: "bg-rose-500",
};

function margin(sell: number, cost: number | null): number | null {
  if (cost == null || cost === 0) return null;
  return ((sell - cost) / sell) * 100;
}

function MarginBar({ pct, provider }: { pct: number | null; provider: string }) {
  if (pct == null) return <span className="text-[10px] text-muted-foreground">—</span>;
  const bar = PROVIDER_BAR[provider] ?? "bg-primary";
  const colour = pct >= 15 ? "text-green-400" : pct >= 5 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-border overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(pct, 40) * 2.5}%` }} />
      </div>
      <span className={`text-xs font-mono font-semibold ${colour}`}>{pct.toFixed(1)}%</span>
    </div>
  );
}

function ProviderPill({ p }: { p: string }) {
  return (
    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${PROVIDER_COLORS[p] ?? "bg-muted text-muted-foreground"}`}>
      {p}
    </span>
  );
}

export default function ProviderMarginReport() {
  const nav = useNavigate();
  const [packages,  setPkgs]    = useState<Pkg[]>([]);
  const [txRevenue, setTxRev]   = useState<Record<string, number>>({});
  const [loading,   setLoading] = useState(true);
  const [editId,    setEditId]  = useState<string | null>(null);
  const [editVal,   setEditVal] = useState("");
  const [saving,    setSaving]  = useState(false);
  const [filter,    setFilter]  = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const [{ data: pkgs }, { data: txs }] = await Promise.all([
      supabase.from("packages")
        .select("package_code,name,network,price,cost_price,provider_code,size,validity")
        .eq("is_active", true)
        .order("provider_code,network,sort_order"),
      supabase.from("transactions")
        .select("meta,amount,status")
        .eq("status", "success")
        .in("type", ["data","airtime","electricity","cable"])
        .limit(5000),
    ]);
    setPkgs((pkgs ?? []) as Pkg[]);

    // Aggregate realised revenue by provider from tx meta
    const rev: Record<string, number> = {};
    for (const tx of (txs ?? []) as TxRow[]) {
      const p = tx.meta?.provider_code ?? "unknown";
      rev[p] = (rev[p] ?? 0) + Number(tx.amount);
    }
    setTxRev(rev);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Provider summaries
  const providerStats = useMemo(() => {
    return PROVIDERS.map(p => {
      const pkgs = packages.filter(x => x.provider_code === p);
      const withCost = pkgs.filter(x => x.cost_price != null);
      const avgSell = pkgs.length ? pkgs.reduce((s, x) => s + x.price, 0) / pkgs.length : 0;
      const avgCost = withCost.length ? withCost.reduce((s, x) => s + (x.cost_price ?? 0), 0) / withCost.length : null;
      const avgMargin = withCost.length
        ? withCost.reduce((s, x) => s + (margin(x.price, x.cost_price) ?? 0), 0) / withCost.length
        : null;
      return { p, total: pkgs.length, withCost: withCost.length, avgSell, avgCost, avgMargin, revenue: txRevenue[p] ?? 0 };
    });
  }, [packages, txRevenue]);

  // Top earners (packages with cost set, sorted by margin desc)
  const topEarners = useMemo(() =>
    packages
      .filter(x => x.cost_price != null)
      .map(x => ({ ...x, mg: margin(x.price, x.cost_price) ?? 0 }))
      .sort((a, b) => b.mg - a.mg)
      .slice(0, 10),
    [packages]
  );

  const filteredPkgs = useMemo(() =>
    filter === "all" ? packages : packages.filter(x => x.provider_code === filter),
    [packages, filter]
  );

  const startEdit = (pkg: Pkg) => {
    setEditId(pkg.package_code);
    setEditVal(pkg.cost_price != null ? String(pkg.cost_price) : "");
  };

  const saveCost = async (pkg: Pkg) => {
    const val = parseFloat(editVal);
    if (isNaN(val) || val < 0) { toast.error("Enter a valid cost price"); return; }
    setSaving(true);
    const { error } = await supabase.from("packages")
      .update({ cost_price: val })
      .eq("package_code", pkg.package_code);
    setSaving(false);
    if (error) { toast.error("Save failed: " + error.message); return; }
    toast.success(`Cost saved for ${pkg.name}`);
    setPkgs(prev => prev.map(p => p.package_code === pkg.package_code ? { ...p, cost_price: val } : p));
    setEditId(null);
  };

  if (loading) return <div className="py-20 grid place-items-center"><BoltLoader size={48} /></div>;

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => nav(-1)} className="p-2 rounded-xl glass"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="font-display text-xl font-semibold">Margin Report</h1>
        </div>
        <Button variant="soft" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
      </div>

      {/* Provider Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        {providerStats.map(({ p, total, withCost, avgSell, avgCost, avgMargin, revenue }) => (
          <div key={p} className="glass rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <ProviderPill p={p} />
              <span className="text-[10px] text-muted-foreground">{total} plans</span>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Avg sell / cost</div>
              <div className="text-sm font-bold">{naira(avgSell)} <span className="text-muted-foreground font-normal">/ {avgCost != null ? naira(avgCost) : "—"}</span></div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-muted-foreground">Avg margin</div>
                <MarginBar pct={avgMargin} provider={p} />
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground">Tx revenue</div>
                <div className="text-xs font-semibold text-green-400">{naira(revenue)}</div>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground">{withCost}/{total} costs set</div>
          </div>
        ))}
      </div>

      {/* Top Earners */}
      {topEarners.length > 0 && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border/30 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Top Earners</h2>
          </div>
          {topEarners.map((pkg, i) => (
            <div key={pkg.package_code} className="flex items-center justify-between p-3 border-b border-border/20 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] text-muted-foreground w-4 flex-shrink-0">#{i+1}</span>
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{pkg.name}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <ProviderPill p={pkg.provider_code} />
                    <span className="text-[10px] text-muted-foreground">{pkg.network} · {pkg.size}</span>
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <div className="text-xs font-semibold">{naira(pkg.price - (pkg.cost_price ?? 0))}</div>
                <MarginBar pct={pkg.mg} provider={pkg.provider_code} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Package Cost Editor */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Package Cost Editor</h2>
          </div>
          {/* Filter tabs */}
          <div className="flex items-center gap-1">
            {(["all", ...PROVIDERS] as string[]).map(f => (
              <button key={f}
                onClick={() => setFilter(f)}
                className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full transition ${
                  filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >{f === "all" ? "All" : f}</button>
            ))}
          </div>
        </div>

        {/* Header row */}
        <div className="grid grid-cols-[1fr_70px_70px_80px_32px] gap-2 px-3 py-2 border-b border-border/20 text-[10px] font-semibold uppercase text-muted-foreground">
          <span>Plan</span><span className="text-right">Sell</span><span className="text-right">Cost</span><span className="text-right">Margin</span><span/>
        </div>

        {filteredPkgs.map(pkg => {
          const mg = margin(pkg.price, pkg.cost_price);
          const isEditing = editId === pkg.package_code;
          return (
            <div key={pkg.package_code} className="grid grid-cols-[1fr_70px_70px_80px_32px] gap-2 items-center px-3 py-2.5 border-b border-border/10 last:border-0 hover:bg-white/[0.02]">
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">{pkg.name}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <ProviderPill p={pkg.provider_code} />
                  <span className="text-[10px] text-muted-foreground">{pkg.network}</span>
                </div>
              </div>
              <div className="text-right text-xs font-mono">{naira(pkg.price)}</div>
              <div className="text-right">
                {isEditing ? (
                  <Input
                    autoFocus
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveCost(pkg); if (e.key === "Escape") setEditId(null); }}
                    className="h-6 w-16 text-xs text-right px-1 glass border-white/20"
                    inputMode="decimal"
                  />
                ) : (
                  <span className={`text-xs font-mono ${pkg.cost_price == null ? "text-muted-foreground" : ""}`}>
                    {pkg.cost_price != null ? naira(pkg.cost_price) : "—"}
                  </span>
                )}
              </div>
              <div className="flex justify-end">
                {isEditing ? null : <MarginBar pct={mg} provider={pkg.provider_code} />}
              </div>
              <div className="flex items-center justify-center gap-0.5">
                {isEditing ? (
                  <>
                    <button onClick={() => saveCost(pkg)} disabled={saving}
                      className="p-1 rounded-lg hover:bg-green-500/20 text-green-400 transition">
                      <Check className="h-3 w-3"/>
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="p-1 rounded-lg hover:bg-red-500/20 text-red-400 transition">
                      <X className="h-3 w-3"/>
                    </button>
                  </>
                ) : (
                  <button onClick={() => startEdit(pkg)}
                    className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground transition">
                    <Pencil className="h-3 w-3"/>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
