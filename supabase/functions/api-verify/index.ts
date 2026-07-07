import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key"
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GSUBZ_KEY = Deno.env.get("GSUBZ_API_KEY") ?? "";
const IACAFE_TOKEN = Deno.env.get("IACAFE_TOKEN") ?? "";
const IACAFE_BASE = "https://iacafe.com.ng/devapi/v1";
const GSUBZ_BASE = "https://api.gsubz.com/api";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) return json({ success: false, error: "Missing x-api-key header" }, 401);
    const supa = createClient(SUPA_URL, SUPA_SVC, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: keyData } = await supa.rpc("verify_api_key", { _api_key: apiKey });
    if (!keyData?.[0]) return json({ success: false, error: "Invalid API key" }, 401);

    const body = await req.json().catch(() => ({}));
    const { type, provider_code, meter_number, smartcard } = body;

    if (type === "electricity") {
      if (!provider_code || !meter_number) return json({ success: false, error: "Missing provider_code or meter_number" }, 400);
      const v = await iacafeVerifyMeter(provider_code, meter_number, "prepaid");
      if (v.ok && v.name) return json({ success: true, customer_name: v.name, meter_number });
      return json({ success: false, error: v.error || "Could not verify meter" }, 200);
    }

    if (type === "cable") {
      if (!provider_code || !smartcard) return json({ success: false, error: "Missing provider_code or smartcard" }, 400);
      const key = (GSUBZ_KEY || "").trim();
      if (!key) return json({ success: false, error: "Verification service unavailable" }, 200);
      try {
        const fd = new FormData();
        fd.append("serviceID", provider_code);
        fd.append("smartcard", smartcard);
        fd.append("api", key);
        const r = await fetch(GSUBZ_BASE + "/verify/", {
          method: "POST", headers: { "Authorization": "Bearer " + key }, body: fd,
          signal: AbortSignal.timeout(15000)
        });
        const d = await r.json();
        const errorText = d?.description || d?.message || "";
        if (/ACCESS_NOT_ALLOWED|INVALID|ERROR|FAILED|DENIED|UNAUTHORIZED/i.test(errorText)) {
          return json({ success: false, error: errorText }, 200);
        }
        const customerName = d?.content?.Customer_Name || d?.content?.customer_name || d?.customer_name || d?.Customer_Name || d?.data?.customer_name || d?.name;
        if (customerName && typeof customerName === "string" && customerName.length > 1 && !/ACCESS_NOT_ALLOWED|INVALID|ERROR/i.test(customerName)) {
          return json({ success: true, customer_name: customerName, smartcard });
        }
        return json({ success: false, error: errorText || "Could not verify smartcard" }, 200);
      } catch (e) {
        return json({ success: false, error: "Verification service unavailable" }, 200);
      }
    }

    return json({ success: false, error: "Unsupported type. Use 'electricity' or 'cable'." }, 400);
  } catch (e: any) { return json({ success: false, error: e.message }, 500); }
});

async function iacafeVerifyMeter(serviceID: string, customerId: string, type: string): Promise<{ ok: boolean; name?: string; error?: string }> {
  if (!IACAFE_TOKEN) return { ok: false, error: "Verification service unavailable" };
  try {
    const r = await fetch(`${IACAFE_BASE}/verify`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${IACAFE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ service_id: serviceID, customer_id: customerId, variation_id: type }),
      signal: AbortSignal.timeout(15000)
    });
    const d = await r.json();
    if (!r.ok || d?.success === false) {
      return { ok: false, error: d?.error?.message || d?.message || d?.error || "Verification failed" };
    }
    const name = d?.data?.name || d?.data?.customer_name || d?.data?.Customer_Name || d?.name || d?.customer_name;
    if (name && typeof name === "string" && name.length > 1) return { ok: true, name };
    return { ok: false, error: d?.message || "Could not verify meter" };
  } catch (e) {
    return { ok: false, error: "Verification service unavailable" };
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
