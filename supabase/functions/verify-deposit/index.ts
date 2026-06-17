import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// verify-deposit: PayVessel-only.
// PayVessel deposits credit automatically via payvessel-webhook.
// This endpoint lets the frontend poll whether a specific reference has been credited.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPA_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPA_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPA_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const auth = req.headers.get("Authorization");
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const uc = createClient(SUPA_URL, SUPA_ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: ae } = await uc.auth.getUser();
    if (ae || !user) throw new Error("Unauthorized");

    const { reference } = await req.json();
    if (!reference) throw new Error("reference is required");

    const sb = createClient(SUPA_URL, SUPA_SVC);

    // Check transaction status in DB — PayVessel credits are applied by payvessel-webhook
    const { data: tx } = await sb.from("transactions")
      .select("status, amount, meta, created_at")
      .eq("reference", reference)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!tx) {
      return new Response(JSON.stringify({ success: false, status: "not_found", message: "Transaction not found" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      status: tx.status,
      amount: tx.amount,
      already_credited: tx.status === "success",
      provider: tx.meta?.provider ?? "payvessel",
      created_at: tx.created_at,
    }), { headers: { ...cors, "Content-Type": "application/json" } });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
