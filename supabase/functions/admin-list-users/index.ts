import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// Validate admin session token against admin_sessions table
async function validateAdminToken(token: string): Promise<boolean> {
  const sb = createClient(SUPA_URL, SUPA_SVC);
  const { data, error } = await sb
    .from("admin_sessions")
    .select("id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) {
    console.error("[admin-list-users] validate token error:", error.message);
    return false;
  }
  return !!data;
}

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  balance: number;
  created_at: string;
  wallet_funded: boolean;
  tx_count: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // Extract admin session token from Authorization header
    const auth = req.headers.get("Authorization") ?? "";
    const adminToken = auth.replace(/^Bearer\s+/i, "").trim();

    if (!adminToken) {
      return new Response(JSON.stringify({ error: "Missing admin session token" }), {
        status: 401,
        headers: cors,
      });
    }

    const isValid = await validateAdminToken(adminToken);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid or expired admin session" }), {
        status: 401,
        headers: cors,
      });
    }

    // Use service role key to read all user data (bypasses RLS)
    const sb = createClient(SUPA_URL, SUPA_SVC);

    const [profilesRes, walletsRes, rolesRes, txRes] = await Promise.all([
      sb.from("profiles").select("user_id, email, full_name, phone, created_at").order("created_at", { ascending: false }),
      sb.from("wallets").select("user_id, balance"),
      sb.from("user_roles").select("user_id, role"),
      sb.from("transactions").select("user_id, id"),
    ]);

    if (profilesRes.error) throw new Error("profiles: " + profilesRes.error.message);
    if (walletsRes.error) throw new Error("wallets: " + walletsRes.error.message);
    if (rolesRes.error) throw new Error("roles: " + rolesRes.error.message);
    if (txRes.error) throw new Error("transactions: " + txRes.error.message);

    const profiles = profilesRes.data ?? [];
    const wallets = walletsRes.data ?? [];
    const roles = rolesRes.data ?? [];
    const txs = txRes.data ?? [];

    // Build lookup maps
    const walletMap = new Map<string, number>();
    for (const w of wallets) walletMap.set(w.user_id, Number(w.balance || 0));

    const roleMap = new Map<string, string>();
    for (const r of roles) roleMap.set(r.user_id, r.role || "user");

    const txCountMap: Record<string, number> = {};
    for (const t of txs) {
      txCountMap[t.user_id] = (txCountMap[t.user_id] || 0) + 1;
    }

    // Assemble user rows
    const rows: UserRow[] = profiles.map((p) => {
      const balance = walletMap.get(p.user_id) || 0;
      return {
        id: p.user_id,
        email: p.email || null,
        full_name: p.full_name || null,
        phone: p.phone || null,
        role: roleMap.get(p.user_id) || "user",
        balance,
        created_at: p.created_at,
        wallet_funded: balance > 0,
        tx_count: txCountMap[p.user_id] || 0,
      };
    });

    return new Response(
      JSON.stringify({ success: true, users: rows, count: rows.length }),
      { headers: cors }
    );
  } catch (e) {
    console.error("[admin-list-users] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: cors }
    );
  }
});
