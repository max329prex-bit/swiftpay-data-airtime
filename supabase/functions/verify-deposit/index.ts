import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const SUPA_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPA_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPA_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KP_SK     = Deno.env.get("KORAPAY_SECRET_KEY")!;
const KP_BASE   = "https://api.korapay.com/merchant/api/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const auth = req.headers.get("Authorization");
  if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const uc = createClient(SUPA_URL, SUPA_ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: ae } = await uc.auth.getUser();
    if (ae || !user) throw new Error("Unauthorized");

    const { reference } = await req.json();
    if (!reference || !reference.startsWith("BP-")) throw new Error("Invalid reference");

    const sb = createClient(SUPA_URL, SUPA_SVC);

    // 1. Check if already credited
    const { data: existing } = await sb.from("transactions")
      .select("status, amount")
      .eq("reference", reference)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.status === "success") {
      return new Response(JSON.stringify({ success: true, already_credited: true, amount: existing.amount }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    // 2. Verify with Korapay API
    const kRes = await fetch(`${KP_BASE}/charges/${reference}`, {
      headers: { Authorization: `Bearer ${KP_SK}` },
      signal: AbortSignal.timeout(10000)
    });

    if (!kRes.ok) throw new Error("Could not verify payment with Korapay");
    const kData = await kRes.json();
    const kStatus = kData?.data?.status ?? kData?.data?.payment_status ?? "";
    const kAmount = Number(kData?.data?.amount ?? 0);
    const kNetCredit = Number(kData?.data?.metadata?.net_credit ?? 0);
    const creditAmount = kNetCredit > 0 ? kNetCredit : kAmount;

    if (kStatus !== "success" && kStatus !== "paid") {
      return new Response(JSON.stringify({ success: false, status: kStatus, message: "Payment not confirmed by Korapay" }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    // 3. Credit wallet
    const { error: creditErr } = await sb.rpc("credit_wallet_from_korapay", {
      _user_id: user.id,
      _amount: creditAmount,
      _korapay_ref: reference
    });

    if (creditErr && !creditErr.message?.includes("DUPLICATE")) {
      throw new Error(creditErr.message);
    }

    return new Response(JSON.stringify({ success: true, credited: true, amount: creditAmount }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
