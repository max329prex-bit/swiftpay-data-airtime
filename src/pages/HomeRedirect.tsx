import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

/**
 * Root route handler:
 * Always redirect to /app. The AppShell decides what to show:
 * - Logged in → dashboard
 * - Not logged in → landing/advertisement page
 */
export default function HomeRedirect() {
  const { loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      navigate("/app", { replace: true });
    }
  }, [loading, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0A0B14]">
        <Loader2 className="h-8 w-8 animate-spin text-[#00D9FF]" />
      </div>
    );
  }

  return null;
}
