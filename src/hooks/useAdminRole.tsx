import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true if the current session is an admin session.
 * Admin login now uses sessionStorage (not Supabase auth) to avoid
 * tying admin access to any user account.
 */
export function useAdminRole(): { isAdmin: boolean; loading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check sessionStorage admin session first (standalone login)
    const adminSession = sessionStorage.getItem("bp_admin_session");
    if (adminSession) {
      setIsAdmin(true);
      setLoading(false);
      return;
    }

    // Fallback: check Supabase user_roles table (legacy)
    async function checkLegacyAdmin() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setIsAdmin(false); setLoading(false); return; }
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        setIsAdmin(!!data);
      } catch {
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    }
    checkLegacyAdmin();
  }, []);

  return { isAdmin, loading };
}

/** Get admin token for API calls */
export function getAdminToken(): string | null {
  return sessionStorage.getItem("bp_admin_session");
}

/** Clear admin session on logout */
export function clearAdminSession() {
  sessionStorage.removeItem("bp_admin_session");
}

