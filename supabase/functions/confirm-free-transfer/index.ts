import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    if ("message" in err && typeof (err as { message?: unknown }).message === "string") {
      return (err as { message: string }).message;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return "Unexpected error";
    }
  }
  return String(err);
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET   = Deno.env.get("CRON_SECRET")!;

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
      .select("id, user_id, status, amount, expires_at, account_name, bank_name, account_number")
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
        message: "This deposit has expired. Please create a new one.",
      }), { headers: CORS });
    }

    if (dep.status !== "reserved") {
      return new Response(JSON.stringify({
        success: dep.status === "verified" || dep.status === "pending",
        status: dep.status,
        message: dep.status === "verified"
          ? "This deposit is already verified."
          : dep.status === "pending"
            ? "This deposit is already being checked."
            : "This deposit can no longer be confirmed.",
      }), { headers: CORS });
    }

    const { data: updatedRows, error: updateErr } = await svc
      .from("free_transfer_deposits")
      .update({ status: "pending" })
      .eq("id", deposit_id)
      .eq("status", "reserved")
      .select("id");

    if (updateErr) {
      return new Response(JSON.stringify({ error: "Could not confirm deposit: " + updateErr.message }), { status: 500, headers: CORS });
    }
    if (!updatedRows || updatedRows.length === 0) {
      return new Response(JSON.stringify({
        success: dep.status === "verified" || dep.status === "pending",
        status: dep.status === "verified" ? "verified" : dep.status === "pending" ? "pending" : dep.status,
        message: dep.status === "verified"
          ? "This deposit is already verified."
          : dep.status === "pending"
            ? "This deposit is already being checked."
            : "This deposit can no longer be confirmed.",
      }), { headers: CORS });
    }

    const fee = dep.amount >= 500 ? 0 : Math.round(dep.amount * 0.01 * 100) / 100;
    const net = dep.amount - fee;
    const ref = `FT-${deposit_id}`;
    await svc.from("transactions").upsert({
      user_id: dep.user_id,
      type: "wallet_fund",
      amount: net,
      reference: ref,
      status: "verifying",
      meta: {
        provider: "free_transfer",
        gross_amount: dep.amount,
        fee,
        net_amount: net,
        deposit_id,
      },
    }, { onConflict: "reference" });

    // Immediately scan for this specific deposit so the user doesn't wait for cron.
    let scanResult: any = { target_matched: false, error: null };
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const scanResp = await fetch(`${SUPABASE_URL}/functions/v1/scan-opay-emails`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${CRON_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deposit_id }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (scanResp.ok) {
        scanResult = await scanResp.json();
      } else {
        const txt = await scanResp.text().catch(() => "unknown");
        scanResult = { target_matched: false, error: `scan returned ${scanResp.status}: ${txt.slice(0, 200)}` };
      }
    } catch (scanErr) {
      scanResult = { target_matched: false, error: formatError(scanErr) };
    }

    // Re-fetch deposit status to return the latest state.
    const { data: finalDep } = await svc
      .from("free_transfer_deposits")
      .select("status, credited_amount, matched_at")
      .eq("id", deposit_id)
      .single();

    const finalStatus = finalDep?.status ?? "pending";
    const credited = finalDep?.credited_amount ?? null;

    if (finalStatus === "verified") {
      return new Response(JSON.stringify({
        success: true,
        status: "verified",
        deposit_id,
        credited,
        message: `Transfer confirmed. ₦${credited} credited successfully.`,
        scan: scanResult,
      }), { headers: CORS });
    }

    return new Response(JSON.stringify({
      success: true,
      status: "pending",
      deposit_id,
      message: "Payment confirmed. Still checking for your transfer...",
      scan: scanResult,
    }), { headers: CORS });

  } catch (err) {
    console.error("confirm-free-transfer:", err);
    return new Response(JSON.stringify({ error: formatError(err) }), { status: 500, headers: CORS });
  }
});
