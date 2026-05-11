import { Link } from "react-router-dom";
import { Zap } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
        <Zap className="h-5 w-5 text-white" strokeWidth={2.5} fill="white" />
      </span>
      <span className="font-display text-xl font-bold tracking-tight">
        Swiftly<span className="text-gradient">Pay</span>
      </span>
    </Link>
  );
}
