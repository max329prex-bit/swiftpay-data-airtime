import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
  import { createClient } from "npm:@supabase/supabase-js@2";

  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };

  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    
    try {
      // For key generation, we need auth token (not API key)
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ success: false, error: "Authentication required" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const supa = createClient(SUPA_URL, SUPA_SVC, { auth: { autoRefreshToken: false, persistSession: false } });
      
      // Verify auth token
      const { data: { user }, error: authError } = await supa.auth.getUser(authHeader.replace("Bearer ", ""));
      if (authError || !user) {
        return new Response(JSON.stringify({ success: false, error: "Invalid authentication" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      }

      if (req.method === "POST") {
        // Generate new key
        const body = await req.json().catch(() => ({}));
        const { data: keyData, error } = await supa.rpc("generate_api_key", { _name: body.name || "Default" });
        
        if (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        }
        
        return new Response(JSON.stringify({
          success: true,
          key: keyData[0].full_key,
          prefix: keyData[0].key_prefix,
          id: keyData[0].key_id,
          name: keyData[0].name,
          warning: "Store this key now. It will never be shown again."
        }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
      }
      
      if (req.method === "GET") {
        // List keys
        const { data: keys } = await supa.rpc("list_api_keys");
        return new Response(JSON.stringify({ success: true, keys: keys || [] }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
      }
      
      return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  });
  