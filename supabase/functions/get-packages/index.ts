import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const SUPA_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPA_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const rh = { "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}` };

  try {
    const [pkgsR, statusR] = await Promise.all([
      fetch(`${SUPA_URL}/rest/v1/packages?select=network,name,size,validity,price,provider_code,package_code,sort_order,coming_soon&is_active=eq.true&order=sort_order`, { headers: rh }),
      fetch(`${SUPA_URL}/rest/v1/bundle_status?select=package_code,is_available,fail_count,success_count,last_error,last_checked_at`, { headers: rh })
    ]);

    const packages = await pkgsR.json();
    const statuses = await statusR.json();

    if (!Array.isArray(packages)) throw new Error("packages not array: " + JSON.stringify(packages).slice(0,100));

    const statusMap: Record<string, any> = {};
    for (const s of (Array.isArray(statuses) ? statuses : [])) statusMap[s.package_code] = s;

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const result: Record<string, any[]> = { MTN: [], AIRTEL: [], GLO: [], "9MOBILE": [] };

    for (const pkg of packages) {
      const s = statusMap[pkg.package_code];
      const comingSoon = pkg.coming_soon === true;
      const recentlyFailed = s && !s.is_available && s.last_checked_at >= sixHoursAgo;
      const available = !comingSoon && !recentlyFailed;

      let success_rate = 92;
      if (s) {
        const total = (s.success_count || 0) + (s.fail_count || 0);
        success_rate = total > 5 ? Math.round((s.success_count / total) * 100) : 92;
      }

      const plan = {
        id: pkg.package_code,
        name: pkg.name,
        size: pkg.size,
        validity: pkg.validity,
        sell_price: pkg.price,
        provider_code: pkg.provider_code,
        package_code: pkg.package_code,
        coming_soon: comingSoon,
        available,
        success_rate,
        ...(!available && !comingSoon ? { unavailable_reason: s?.last_error || "Temporarily unavailable" } : {})
      };

      if (result[pkg.network] !== undefined) result[pkg.network].push(plan);
    }

    return new Response(JSON.stringify({ success: true, packages: result }), {
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=30" }
    });

  } catch(e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
