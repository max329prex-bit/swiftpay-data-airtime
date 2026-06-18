import { createClient } from "npm:@supabase/supabase-js@2";

// TEMP DIAGNOSTIC: probe PayVessel API endpoints with real credentials
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PV_KEY   = Deno.env.get("PAYVESSEL_API_KEY")!;
const PV_SEC   = Deno.env.get("PAYVESSEL_SECRET_KEY")!;
const PV_BASE  = "https://api.payvessel.com/pms/api/external";
const AUTH_HDR = { "api-key": PV_KEY, "api-secret": PV_SEC, "Content-Type": "application/json" };

const ENDPOINTS = [
  "GET /request/getCollectionTransactions/",
  "GET /request/collectionTransactions/",
  "GET /request/transactionList/",
  "GET /request/listTransactions/",
  "GET /request/getTransactionHistory/",
  "POST /request/getCollectionTransactions/",
  "POST /request/listCollections/",
  "GET /collections/",
  "GET /collection/list/",
  "POST /collections/",
];

Deno.serve(async (_req) => {
  const results: Record<string, string> = {};
  
  for (const ep of ENDPOINTS) {
    const [method, path] = ep.split(" ");
    const url = PV_BASE + path;
    try {
      const r = await fetch(url, {
        method,
        headers: AUTH_HDR,
        body: method === "POST" ? JSON.stringify({}) : undefined,
        signal: AbortSignal.timeout(5000)
      });
      const body = await r.text();
      results[ep] = `${r.status}: ${body.slice(0, 120)}`;
    } catch(e) {
      results[ep] = `ERR: ${String(e).slice(0, 60)}`;
    }
  }
  
  return new Response(JSON.stringify(results, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
});
