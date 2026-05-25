import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type" };
const MK = Deno.env.get("MONNIFY_API_KEY")!;
const MS = Deno.env.get("MONNIFY_SECRET_KEY")!;
const MC = Deno.env.get("MONNIFY_CONTRACT_CODE")!;
const MBASE = MK.startsWith("MK_TEST_") ? "https://sandbox.monnify.com" : "https://api.monnify.com";
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
async function monnifyToken(): Promise<string> {
  const r = await fetch(`${MBASE}/api/v1/auth/login`, { method:"POST", headers:{ Authorization:`Basic ${btoa(MK+":"+MS)}`, "Content-Type":"application/json" }});
  const d = await r.json(); return d.responseBody?.accessToken || "";
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null,{headers:cors});
  const auth = req.headers.get("Authorization");
  if (!auth) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
  try {
    const uc = createClient(SUPA_URL, SUPA_ANON, {global:{headers:{Authorization:auth}}});
    const { data:{user}, error:ae } = await uc.auth.getUser();
    if (ae || !user) throw new Error("Unauthorized");
    const admin = createClient(SUPA_URL, SUPA_SVC);
    const { data:existing } = await admin.from("virtual_accounts").select("*").eq("user_id",user.id).maybeSingle();
    if (existing) return new Response(JSON.stringify({success:true,data:existing}),{headers:{...cors,"Content-Type":"application/json"}});
    const { data:profile } = await admin.from("profiles").select("full_name").eq("user_id",user.id).maybeSingle();
    const name = (profile as any)?.full_name || user.email?.split("@")[0] || "SwiftPay User";
    const tok = await monnifyToken();
    const ref = `SP-${user.id.replace(/-/g,"").substring(0,16)}`;
    const cr = await fetch(`${MBASE}/api/v2/bank-transfer/reserved-accounts`,{
      method:"POST", headers:{ Authorization:`Bearer ${tok}`, "Content-Type":"application/json" },
      body: JSON.stringify({ accountReference:ref, accountName:name, currencyCode:"NGN", contractCode:MC, customerEmail:user.email, customerName:name, getAllAvailableBanks:false, preferredBanks:["035"] })
    });
    const cd = await cr.json();
    if (!cd.requestSuccessful) throw new Error(cd.responseMessage || "Monnify account creation failed");
    const acct = (cd.responseBody?.accounts || [])[0] || {};
    const { data:saved } = await admin.from("virtual_accounts").insert({ user_id:user.id, account_reference:ref, account_number:acct.accountNumber, bank_name:acct.bankName, bank_code:acct.bankCode, account_name:cd.responseBody?.accountName }).select().single();
    return new Response(JSON.stringify({success:true,data:saved}),{headers:{...cors,"Content-Type":"application/json"}});
  } catch(e) { console.error("monnify-account:",e); return new Response(JSON.stringify({error:e instanceof Error?e.message:"Unknown"}),{status:500,headers:{...cors,"Content-Type":"application/json"}}); }
});
