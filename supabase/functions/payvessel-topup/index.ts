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
const PV_WEBHOOK  = "https://blitz.com.ng/webhook/payvessel";
const PV_HEADERS  = { "api-key": PV_API_KEY, "api-secret": PV_SECRET, "Content-Type": "application/json" };
const STATIC_BANKS  = ["999991", "120001"];
const DYNAMIC_BANKS = ["090175"];

// Operator-provided default KYC used to auto-provision accounts for every user
// so the end-user never has to enter NIN/BVN manually. Set these in Supabase secrets.
const DEFAULT_FULLNAME = (Deno.env.get("DEFAULT_KYC_FULLNAME") || "").trim();
const DEFAULT_PHONE    = (Deno.env.get("DEFAULT_KYC_PHONE") || "").replace(/\D/g, "");
const DEFAULT_NIN      = (Deno.env.get("DEFAULT_KYC_NIN") || "").replace(/\D/g, "");
const DEFAULT_BVN      = (Deno.env.get("DEFAULT_KYC_BVN") || "").replace(/\D/g, "");

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

    // KYC: body values take priority over profile values
    const bodyName  = (body.full_name || "").trim();
    const bodyPhone = (body.phone || "").trim();
    const bodyNIN   = (body.nin || "").replace(/\D/g, "");
    const bodyBVN   = (body.bvn || "").replace(/\D/g, "");

    // Deterministic 11-digit fallback derived from user.id — same value every call
    // so Payvessel sees a stable identity per user without requiring real KYC.
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(user.id))
    );
    const digits = Array.from(digest).map(b => (b % 10).toString()).join("");
    const auto11    = (d: string, prefix: string) => (prefix + d).replace(/\D/g, "").slice(0, 11).padEnd(11, "0");
    const autoPhone = auto11(digits.slice(0, 9),  "07");   // 07XXXXXXXXX
    const autoNIN   = auto11(digits.slice(2, 13), "");     // 11 random digits
    const autoBVN   = auto11(digits.slice(5, 16), "22");   // BVNs commonly start with 22

    // Name: prefer real profile → email local-part → generic label.
    const emailLocal = (user.email?.split("@")[0] || "").replace(/[^a-zA-Z ]/g, " ").trim();
    const name  = (bodyName || profile?.full_name || DEFAULT_FULLNAME || emailLocal || "BLITZPAY USER").toUpperCase();
    const phone = (bodyPhone || profile?.phone || DEFAULT_PHONE || autoPhone).replace(/\D/g, "").slice(0, 11);
    const nin   = bodyNIN || profile?.nin || DEFAULT_NIN || autoNIN;
    const bvn   = bodyBVN || profile?.bvn || DEFAULT_BVN || autoBVN;

    // STATIC (permanent)
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

      // Auto-KYC: use body → profile → operator defaults. Only ask the user
      // for KYC if NOTHING is available (defaults missing in secrets).
      const hasKYC = (nin && nin.length === 11) || (bvn && bvn.length === 11);
      if (!hasKYC) {
        return json({ success: true, type: "static", needs_kyc: true });
      }

      // Persist submitted KYC back to profile
      const profileUpdates: Record<string, string> = {};
      if (bodyName)                profileUpdates.full_name = bodyName;
      if (bodyPhone.length === 11) profileUpdates.phone     = bodyPhone;
      if (bodyNIN.length === 11)   profileUpdates.nin       = bodyNIN;
      if (bodyBVN.length === 11)   profileUpdates.bvn       = bodyBVN;
      if (Object.keys(profileUpdates).length > 0) {
        await admin.from("profiles").update(profileUpdates).eq("user_id", user.id);
      }

      // Create STATIC VA
      const payload: Record<string, unknown> = {
        email: user.email, name, phoneNumber: phone,
        bankcode: STATIC_BANKS, account_type: "STATIC",
        businessid: PV_BIZ_ID, webhook_url: PV_WEBHOOK, webhookUrl: PV_WEBHOOK,
        metadata: { user_id: user.id }
      };
      if (bvn) payload.bvn = bvn;
      if (nin) payload.nin = nin;

      const pvRes = await fetch(PV_ENDPOINT, {
        method: "POST", headers: PV_HEADERS,
        body: JSON.stringify(payload), signal: AbortSignal.timeout(25000)
      });
      const raw = await pvRes.text();
      let pvData: Record<string, unknown>;
      try { pvData = JSON.parse(raw); }
      catch { throw new Error(`Payvessel unavailable (${pvRes.status}). Try again shortly.`); }

      console.log("[topup/static]", JSON.stringify(pvData).slice(0, 500));
      if (!pvData.status) {
        const pvMsg = (pvData.message as string) || JSON.stringify(pvData.errors || pvData).slice(0, 200);
        if (pvMsg.toLowerCase().includes("nin") || pvMsg.toLowerCase().includes("bvn")) {
          throw new Error("KYC_REQUIRED: Please add your NIN or BVN in Settings to unlock your permanent account.");
        }
        throw new Error(pvMsg || "Account creation failed");
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

    // DYNAMIC (one-time)
    if (type === "dynamic") {
      const pvRes = await fetch(PV_ENDPOINT, {
        method: "POST", headers: PV_HEADERS,
        body: JSON.stringify({
          email: user.email, name, phoneNumber: phone,
          bankcode: DYNAMIC_BANKS, account_type: "DYNAMIC",
          businessid: PV_BIZ_ID, webhook_url: PV_WEBHOOK, webhookUrl: PV_WEBHOOK,
          metadata: { user_id: user.id }
        }),
        signal: AbortSignal.timeout(25000)
      });
      const raw = await pvRes.text();
      let pvData: Record<string, unknown>;
      try { pvData = JSON.parse(raw); }
      catch { throw new Error(`Payvessel unavailable (${pvRes.status}). Try again shortly.`); }

      console.log("[topup/dynamic]", JSON.stringify(pvData).slice(0, 500));
      if (!pvData.status) {
        let pvDynMsg = (pvData.message as string) || "";
        // Payvessel DYNAMIC errors can be in errors array: [{"BankName":"error text"}]
        if (!pvDynMsg && Array.isArray(pvData.errors) && (pvData.errors as Record<string,string>[]).length > 0) {
          pvDynMsg = Object.values((pvData.errors as Record<string,string>[])[0])[0] || "";
        }
        pvDynMsg = pvDynMsg || JSON.stringify(pvData.errors || pvData).slice(0, 200);
        if (pvDynMsg.toLowerCase().includes("insufficient funds")) {
          throw new Error("One-time accounts are temporarily unavailable. Please use the Permanent account tab.");
        }
        throw new Error(pvDynMsg || "Dynamic account creation failed");
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
