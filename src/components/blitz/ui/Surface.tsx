import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { ReactNode } from "react";

export function Card({
  className,
  children,
  raised,
  delay = 0,
}: { className?: string; children: ReactNode; raised?: boolean; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(raised ? "surface-2" : "surface", "rounded-3xl", className)}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h2>
      {action}
    </div>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  right,
  onClick,
  className,
  badge,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  className?: string;
  badge?: ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "press flex items-center gap-3.5 px-4 py-3.5",
        onClick && "cursor-pointer active:bg-foreground/[0.03]",
        className
      )}
    >
      {icon && <div className="flex-shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold leading-tight">
          {title}
          {badge}
        </div>
        {subtitle && <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{subtitle}</div>}
      </div>
      {right ?? (onClick ? <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/70" /> : null)}
    </div>
  );
}

export function IconPlate({
  children,
  tint = "primary",
  size = "md",
}: { children: ReactNode; tint?: "primary" | "accent" | "muted" | "gradient"; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-8 w-8 rounded-[10px]", md: "h-10 w-10 rounded-xl", lg: "h-12 w-12 rounded-2xl" };
  const tints = {
    primary: "bg-primary/12 text-primary",
    accent: "bg-accent/12 text-accent",
    muted: "bg-foreground/[0.06] text-muted-foreground",
    gradient: "bg-gradient-primary text-white shadow-[var(--shadow-key)]",
  };
  return <span className={cn("grid place-items-center", sizes[size], tints[tint])}>{children}</span>;
}

export function StatPill({ children, tone = "muted" }: { children: ReactNode; tone?: "success" | "warning" | "danger" | "info" | "muted" }) {
  const tones = {
    success: "bg-success/12 text-success",
    warning: "bg-warning/14 text-warning",
    danger: "bg-destructive/12 text-destructive",
    info: "bg-primary/12 text-primary",
    muted: "bg-foreground/[0.06] text-muted-foreground",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider", tones[tone])}>
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}