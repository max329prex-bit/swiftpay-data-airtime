import boltLogo from "@/assets/swift-bolt.png";

export function BoltLoader({ size = 64, label }: { size?: number; label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <img
        src={boltLogo}
        alt="Loading"
        style={{ width: size, height: size }}
        className="animate-spin drop-shadow-[0_0_24px_hsl(var(--primary)/0.8)]"
      />
      {label && <p className="text-sm text-muted-foreground animate-pulse">{label}</p>}
    </div>
  );
}

export function FullScreenLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm">
      <BoltLoader size={80} label={label} />
    </div>
  );
}