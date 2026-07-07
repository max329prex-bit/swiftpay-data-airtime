import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key"
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ELECTRICITY_PROVIDERS = [
  { name: "Ikeja Electric (IKEDC)", code: "ikeja-electric" },
  { name: "Eko Electricity (EKEDC)", code: "eko-electric" },
  { name: "Abuja Electricity (AEDC)", code: "abuja-electric" },
  { name: "Port Harcourt Electric (PHEDC)", code: "portharcourt-electric" },
  { name: "Enugu Electricity (EEDC)", code: "enugu-electric" },
  { name: "Benin Electricity (BEDC)", code: "benin-electric" },
  { name: "Ibadan Electricity (IBEDC)", code: "ibadan-electric" },
  { name: "Kaduna Electricity (KAEDCO)", code: "kaduna-electric" },
  { name: "Kano Electricity (KEDCO)", code: "kano-electric" },
  { name: "Jos Electricity (JEDC)", code: "jos-electic" },
  { name: "Yola Electricity (YEDC)", code: "yola-electric" },
  { name: "Aba Electricity (ABA)", code: "aba-electric" },
];

const CABLE_PROVIDERS = [
  { id: "DSTV", name: "DStv", code: "dstv" },
  { id: "GOTV", name: "GOtv", code: "gotv" },
  { id: "STARTIMES", name: "StarTimes", code: "startimes" },
];

const CABLE_PACKAGES = [
  { provider: "dstv", code: "dstv-access", name: "DStv Access", price: 2000 },
  { provider: "dstv", code: "dstv-compact", name: "DStv Compact", price: 9000 },
  { provider: "dstv", code: "dstv-compact-plus", name: "DStv Compact Plus", price: 14250 },
  { provider: "dstv", code: "dstv-premium", name: "DStv Premium", price: 24500 },
  { provider: "gotv", code: "gotv-smallie", name: "GOtv Smallie", price: 1900 },
  { provider: "gotv", code: "gotv-jinja", name: "GOtv Jinja", price: 3900 },
  { provider: "gotv", code: "gotv-jolli", name: "GOtv Jolli", price: 5800 },
  { provider: "gotv", code: "gotv-max", name: "GOtv Max", price: 8500 },
  { provider: "gotv", code: "gotv-supa", name: "GOtv Supa", price: 11400 },
  { provider: "startimes", code: "startimes-nova", name: "Nova (Daily)", price: 150 },
  { provider: "startimes", code: "startimes-smart", name: "Smart (Monthly)", price: 3800 },
  { provider: "startimes", code: "startimes-classic", name: "Classic (Monthly)", price: 4500 },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) return json({ success: false, error: "Missing x-api-key header" }, 401);
    const supa = createClient(SUPA_URL, SUPA_SVC, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: keyData } = await supa.rpc("verify_api_key", { _api_key: apiKey });
    if (!keyData?.[0]) return json({ success: false, error: "Invalid API key" }, 401);

    return json({
      success: true,
      electricity_providers: ELECTRICITY_PROVIDERS,
      cable_providers: CABLE_PROVIDERS,
      cable_packages: CABLE_PACKAGES,
    });
  } catch (e: any) { return json({ success: false, error: e.message }, 500); }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
