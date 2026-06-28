import { useEffect, useState } from "react";

const ADMIN_SESSION_KEY = "blitzpay_admin_session";

/**
 * Returns true if a valid admin session token exists.
 * This is INDEPENDENT of user accounts — no link to auth.users.
 */
export function useAdminRole(): { isAdmin: boolean; loading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem(ADMIN_SESSION_KEY);
    // We only check token exists locally. The server validates it on each admin request.
    setIsAdmin(!!token && token.length >= 32);
    setLoading(false);
  }, []);

  return { isAdmin, loading };
}

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_SESSION_KEY);
}

export function logoutAdmin(): void {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}
