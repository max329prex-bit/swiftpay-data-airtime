import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const SUPA_URL   = Deno.env.get("SUPABASE_URL")!;
const SUPA_ANON  = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPA_SVC   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PV_API_KEY = Deno.env.get("PAYVESSEL_API_KEY")!;
const PV_SECRET  = Deno.env.get("PAYVESSEL_SECRET_KEY")!;
const PV_BIZ_ID  = Deno.env.get("PAYVESSEL_BUSINESS_ID")!;
const PV_ENDPOINT = "https://api.payvessel.com/pms/api/external/request/customerReservedAccount/";
const PV_WEBHOOK  = `${SUPA_URL}/functions/v1/payvessel-webhook`;
const PV_HEADERS  = { "api-key": PV_API_KEY, "api-secret": PV_SECRET, "Content-Type": "application/json" };
const STATIC_BANKS  = ["999991", "120001"];
const DYNAMIC_BANKS = ["090175"]; // Rubies MFB — supports DYNAMIC

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (d: unknown, s = 200) =>
    new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);

  try {
    const uc = createClient(SUPA_URL, SUPA_ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: ae } = await uc.auth.getUser();
    if (ae || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPA_URL, SUPA_SVC);
    const body  = await req.json().catch(() => ({})) as Record<string, string>;
    const type  = body.type ?? "static";

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, phone, bvn, nin")
      .eq("user_id", user.id)
      .maybeSingle() as { data: Record<string, string> | null };

    const name  = (profile?.full_name || user.email?.split("@")[0] || "BLITZPAY USER").toUpperCase();
    const phone = (profile?.phone || "09012345678").replace(/\D/g, "").slice(0, 11);

    // ── STATIC (permanent) ─────────────────────────────────────────────────
    if (type === "static") {
      // Return cached if exists
      const { data: existing } = await admin
        .from("payvessel_virtual_accounts")
        .select("account_number, account_name, bank_name, tracking_reference")
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing?.account_number) {
        return json({ success: true, type: "static", is_existing: true, ...existing,
          message: "Transfer any amount here. Balance updates instantly." });
      }

      // Create STATIC
      const payload: Record<string, unknown> = {
        email: user.email, name, phoneNumber: phone,
        bankcode: STATIC_BANKS, account_type: "STATIC",
        businessid: PV_BIZ_ID, webhook_url: PV_WEBHOOK,
        metadata: { user_id: user.id }
      };
      if (profile?.bvn) payload.bvn = profile.bvn;
      if (profile?.nin) payload.nin = profile.nin;

      const pvRes = await fetch(PV_ENDPOINT, {
        method: "POST", headers: PV_HEADERS,
        body: JSON.stringify(payload), signal: AbortSignal.timeout(25000)
      });
      const raw = await pvRes.text();
      let pvData: Record<string, unknown>;
      try { pvData = JSON.parse(raw); }
      catch { throw new Error(`Payvessel unavailable (${pvRes.status}). Try again shortly.`); }

      const pvStaticLog = JSON.stringify(pvData).slice(0, 500);
      console.log("[topup/static]", pvStaticLog);
      if (!pvData.status) {
        const pvMsg = (pvData.message as string) || (pvData.detail as string) || pvStaticLog;
        throw new Error(`Payvessel: ${pvMsg}`);
      }

      const banks = pvData.banks as Record<string, string>[];
      const bank  = banks?.[0];
      if (!bank?.accountNumber) throw new Error("No account number returned");

      await admin.from("payvessel_virtual_accounts").upsert({
        user_id: user.id, account_number: bank.accountNumber,
        account_name: bank.accountName, bank_name: bank.bankName,
        tracking_reference: bank.trackingReference
      }, { onConflict: "user_id" });

      return json({ success: true, type: "static", is_existing: false,
        account_number: bank.accountNumber, account_name: bank.accountName,
        bank_name: bank.bankName, tracking_reference: bank.trackingReference,
        message: "Permanent account created. Transfer any amount anytime." });
    }

    // ── DYNAMIC (one-time) ─────────────────────────────────────────────────
    if (type === "dynamic") {
      const pvRes = await fetch(PV_ENDPOINT, {
        method: "POST", headers: PV_HEADERS,
        body: JSON.stringify({
          email: user.email, name, phoneNumber: phone,
          bankcode: DYNAMIC_BANKS, account_type: "DYNAMIC",
          businessid: PV_BIZ_ID, webhook_url: PV_WEBHOOK,
          metadata: { user_id: user.id }
        }),
        signal: AbortSignal.timeout(25000)
      });
      const raw = await pvRes.text();
      let pvData: Record<string, unknown>;
      try { pvData = JSON.parse(raw); }
      catch { throw new Error(`Payvessel unavailable (${pvRes.status}). Try again shortly.`); }

      const pvDynLog = JSON.stringify(pvData).slice(0, 500);
      console.log("[topup/dynamic]", pvDynLog);
      if (!pvData.status) {
        const pvDynMsg = (pvData.message as string) || (pvData.detail as string) || pvDynLog;
        throw new Error(`Payvessel: ${pvDynMsg}`);
      }

      const banks = pvData.banks as Record<string, string>[];
      const bank  = banks?.[0];
      if (!bank?.accountNumber) throw new Error("No account number returned");

      const expiresAt = bank.expire_date || new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await admin.from("payvessel_dynamic_requests").insert({
        user_id: user.id, tracking_reference: bank.trackingReference,
        account_number: bank.accountNumber, account_name: bank.accountName,
        bank_name: bank.bankName, expires_at: expiresAt
      });

      return json({ success: true, type: "dynamic",
        account_number: bank.accountNumber, account_name: bank.accountName,
        bank_name: bank.bankName, tracking_reference: bank.trackingReference,
        expires_at: expiresAt,
        message: "One-time account. Expires after one transfer — do not reuse." });
    }

    return json({ error: "Invalid type" }, 400);

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[payvessel-topup]", msg);
    return json({ success: false, error: msg }, 500);
  }
});
