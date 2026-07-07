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

    // Verify deposit belongs to this user and is still pending
    const { data: dep, error: depErr } = await svc
      .from("free_transfer_deposits")
      .select("id, status, expires_at")
      .eq("id", deposit_id)
      .eq("user_id", user.id)
      .single();

    if (depErr || !dep) {
      return new Response(JSON.stringify({ error: "Deposit not found" }), { status: 404, headers: CORS });
    }

    if (new Date(dep.expires_at) < new Date()) {
      await svc.from("free_transfer_deposits").update({ status: "expired" }).eq("id", deposit_id);
      return new Response(JSON.stringify({
        success: false,
        status: "expired",
        message: "This deposit has expired. Please contact support with your transfer screenshot.",
      }), { headers: CORS });
    }

    // Trigger the IMAP scanner directly
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/scan-opay-emails`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SVC}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(60000),
    });

    let scanResult: any = {};
    try { scanResult = await resp.json(); } catch { /* ignore */ }

    return new Response(JSON.stringify({
      success: resp.ok && scanResult?.success !== false,
      status: "triggered",
      emails_processed: scanResult?.processed ?? 0,
      message: resp.ok
        ? "Checking for your payment now. This usually takes a few seconds."
        : "Could not reach the email checker. Please wait for the automatic check.",
    }), { headers: CORS });

  } catch (err) {
    console.error("trigger-email-check:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
