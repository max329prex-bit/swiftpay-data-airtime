import { Link, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function SiteNav() {
  const nav = useNavigate();
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="mx-auto mt-3 max-w-6xl px-4">
        <div className="glass-strong flex h-14 items-center justify-between rounded-2xl px-4 shadow-soft">
          <Logo />
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#how" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it works</a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Button size="sm" variant="hero" onClick={() => nav("/app")}>Open app</Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => nav("/auth")} className="hidden sm:inline-flex">Sign in</Button>
                <Button size="sm" variant="hero" onClick={() => nav("/auth?mode=signup")}>Get started</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
