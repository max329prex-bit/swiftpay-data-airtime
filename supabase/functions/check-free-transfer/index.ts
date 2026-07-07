import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
    }

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false },
      global: { headers: { Authorization: auth } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: CORS });
    }

    const body = await req.json().catch(() => ({}));
    const { deposit_id } = body;
    if (!deposit_id) {
      return new Response(JSON.stringify({ error: "deposit_id required" }), { status: 400, headers: CORS });
    }

    const svc = createClient(SUPABASE_URL, SUPABASE_SVC);

    const { data: dep, error: depErr } = await svc
      .from("free_transfer_deposits")
      .select("id, status, amount, credited_amount, expires_at, created_at")
      .eq("id", deposit_id)
      .eq("user_id", user.id)
      .single();

    if (depErr || !dep) {
      return new Response(JSON.stringify({ success: false, status: "not_found" }), { status: 404, headers: CORS });
    }

    // Auto-expire
    if (dep.status === "pending" && new Date(dep.expires_at) < new Date()) {
      await svc.from("free_transfer_deposits").update({ status: "expired" }).eq("id", deposit_id);
      dep.status = "expired";
    }

    const messages: Record<string, string> = {
      pending:  "Verifying your payment... This usually takes under 2 minutes.",
      verified: `Deposit successful! ₦${Number(dep.credited_amount).toLocaleString("en-NG", { minimumFractionDigits: 2 })} has been added to your wallet.`,
      expired:  "This deposit has expired (12 hours). Please contact support with your transfer screenshot.",
      failed:   "Verification failed. Please contact support.",
    };

    return new Response(JSON.stringify({
      success:        dep.status === "verified",
      status:         dep.status,
      credited_amount: dep.credited_amount,
      message:        messages[dep.status] ?? "Processing...",
    }), { headers: CORS });

  } catch (err) {
    console.error("check-free-transfer:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
