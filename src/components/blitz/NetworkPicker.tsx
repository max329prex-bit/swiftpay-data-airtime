import { NETWORKS, NetworkId } from "@/lib/networks";

export function NetworkPicker({ value, onChange }: { value: NetworkId | null; onChange: (n: NetworkId) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {NETWORKS.map((n) => {
        const active = value === n.id;
        return (
          <button key={n.id} onClick={() => onChange(n.id)} type="button"
            className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition-all ${
              active ? "border-primary bg-primary/10 shadow-glow" : "border-white/10 bg-white/[0.03] hover:bg-white/5"
            }`}>
            <span className={`grid h-9 w-9 place-items-center rounded-xl ${n.bg} ${n.color} font-display text-xs font-bold`}>
              {n.id === "9MOBILE" ? "9m" : n.id.slice(0, 3)}
            </span>
            <span className="text-[10px] font-medium">{n.name}</span>
          </button>
        );
      })}
    </div>
  );
}
