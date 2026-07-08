import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
  import { createClient } from "npm:@supabase/supabase-js@2";
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key" };
  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const apiKey = req.headers.get("x-api-key");
      if (!apiKey) return json({ success: false, error: "Missing x-api-key header" }, 401);
      const url = new URL(req.url);
      const ref = url.pathname.split("/").pop();
      if (!ref || ref === "transaction") return json({ success: false, error: "Missing reference" }, 400);
      const supa = createClient(SUPA_URL, SUPA_SVC, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data: keyData } = await supa.rpc("verify_api_key", { _api_key: apiKey });
      if (!keyData?.[0]) return json({ success: false, error: "Invalid API key" }, 401);
      const userId = keyData[0].user_id, keyId = keyData[0].key_id;
      await supa.rpc("update_api_key_last_used", { _key_id: keyId });
      const { data: tx } = await supa.from("transactions").select("id,status,reference,network,phone,amount,provider_reference,meta,created_at,updated_at").eq("reference", ref).eq("user_id", userId).single();
      if (!tx) return json({ success: false, error: "Transaction not found" }, 404);
      const { provider_reference, meta, ...safeTx } = tx;
      const safeMeta = meta ? Object.fromEntries(Object.entries(meta).filter(([k]) => !k.toLowerCase().includes("provider") && !k.toLowerCase().includes("gsubz") && !k.toLowerCase().includes("iacafe") && !k.toLowerCase().includes("bsplug"))) : null;
      return json({ success: true, transaction: { ...safeTx, provider_reference: provider_reference ? "PARTNER-XXXX" : null, meta: safeMeta } });
    } catch (e: any) { return json({ success: false, error: e.message }, 500); }
  });
  function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } }); }