import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Index from "./Index.tsx";
import { Loader2 } from "lucide-react";

/**
 * Root route handler:
 * - Logged in user → redirect to /app dashboard
 * - Not logged in → show the marketing landing page (Index)
 */
export default function HomeRedirect() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) {
      navigate("/app", { replace: true });
    }
  }, [loading, session, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0A0B14]">
        <Loader2 className="h-8 w-8 animate-spin text-[#00D9FF]" />
      </div>
    );
  }

  // Not logged in — show the landing / advertisement page
  if (!session) {
    return <Index />;
  }

  // Logged in — already redirected above, but return empty while navigating
  return null;
}
