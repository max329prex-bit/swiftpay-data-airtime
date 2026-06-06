Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
  try {
    const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD") ?? Deno.env.get("ADMIN_PANEL_PASSWORD") ?? "";
    const body = await req.json();
    const { action, password } = body;

    if (action === "verify-password") {
      if (!password || password !== ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ success: false, error: "Invalid password" }), { status: 401, headers: cors });
      }
      return new Response(JSON.stringify({ success: true }), { headers: cors });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
