import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
  import { createClient } from "npm:@supabase/supabase-js@2";
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key" };
  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return json({ success: false, error: "Authentication required" }, 401);
      const supa = createClient(SUPA_URL, SUPA_SVC, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data: { user }, error: authErr } = await supa.auth.getUser(authHeader.replace("Bearer ", ""));
      if (authErr || !user) return json({ success: false, error: "Invalid authentication" }, 401);
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const { data, error } = await supa.rpc("generate_api_key", { _name: body.name || "Default" });
        if (error) return json({ success: false, error: error.message }, 400);
        return json({ success: true, key: data[0].full_key, prefix: data[0].key_prefix, id: data[0].key_id, name: data[0].name, warning: "Store this key now. It will never be shown again." });
      }
      if (req.method === "GET") {
        const { data: keys } = await supa.rpc("list_api_keys");
        return json({ success: true, keys: keys || [] });
      }
      return json({ success: false, error: "Method not allowed" }, 405);
    } catch (e: any) { return json({ success: false, error: e.message }, 500); }
  });
  function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } }); }