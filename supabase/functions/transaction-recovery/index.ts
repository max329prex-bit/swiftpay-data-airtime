Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const KORAPAY_SECRET = Deno.env.get("KORAPAY_SECRET_KEY") ?? "";
  const AIDAPAY_BASE = "https://www.aidapay.ng/api/v1";
  const AIDAPAY_TOKEN = Deno.env.get("AIDAPAY_TOKEN") ?? "";
  const TG_BOT = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const TG_CHAT = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") ?? "";
  const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
  const MAX_RETRIES = 5;

  // Security: require cron secret
  const incoming = req.headers.get("x-cron-secret") ?? "";
  if (!CRON_SECRET || incoming !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });
  }

  async function tg(msg: string) {
    if (!TG_BOT || !TG_CHAT) return;
    try { await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: TG_CHAT, text: msg, parse_mode: "Markdown" }) }); } catch {}
  }

  async function checkKorapay(ref: string): Promise<"success"|"failed"|"pending"|"unknown"> {
    if (!KORAPAY_SECRET) return "unknown";
    try {
      const r = await fetch(`https://api.korapay.com/merchant/api/v1/charges/${ref}`, {
        headers: { Authorization: `Bearer ${KORAPAY_SECRET}` }, signal: AbortSignal.timeout(10000)
      });
      if (!r.ok) return "unknown";
      const s = ((await r.json())?.data?.status ?? "").toLowerCase();
      if (["success","successful","completed"].includes(s)) return "success";
      if (["failed","error","cancelled","declined"].includes(s)) return "failed";
      return "pending";
    } catch { return "unknown"; }
  }

  async function checkAidapay(hash: string): Promise<"success"|"failed"|"pending"|"unknown"> {
    try {
      const r = await fetch(`${AIDAPAY_BASE}/transaction/${hash}`, {
        headers: { Authorization: `Bearer ${AIDAPAY_TOKEN}` }, signal: AbortSignal.timeout(10000)
      });
      if (!r.ok) return "unknown";
      const s = ((await r.json())?.data?.status ?? "").toLowerCase();
      if (["successful","success","completed"].includes(s)) return "success";
      if (["failed","error","cancelled"].includes(s)) return "failed";
      return "pending";
    } catch { return "unknown"; }
  }

  try {
    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const sb = await import("npm:@supabase/supabase-js@2").then(m => m.createClient(SUPA_URL, SUPA_SVC));

    const [{ data: stuck }, { data: deposits }] = await Promise.all([
      sb.from("transactions").select("*").in("status", ["processing","verifying"]).lt("created_at", cutoff).lt("retry_count", MAX_RETRIES).limit(20),
      sb.from("transactions").select("*").eq("status", "pending").eq("type", "wallet_fund").lt("created_at", cutoff).limit(20),
    ]);

    const map = new Map<string, Record<string, unknown>>();
    for (const tx of (stuck ?? [])) map.set(tx.id, { ...tx, _kp: false });
    for (const tx of (deposits ?? [])) if (!map.has(tx.id)) map.set(tx.id, { ...tx, _kp: true });
    const all = [...map.values()];

    if (all.length === 0) return new Response(JSON.stringify({ checked: 0, resolved: 0 }), { headers: cors });

    let resolved = 0;
    const now = new Date().toISOString();

    for (const tx of all) {
      try {
        const meta = (tx.meta as Record<string, unknown>) ?? {};
        const isKp = tx._kp as boolean;
        const newRetry = ((tx.retry_count as number) ?? 0) + 1;
        let status: "success"|"failed"|"pending"|"unknown" = "unknown";

        if (isKp) {
          const ref = (meta.korapay_reference as string) ?? tx.provider_reference as string ?? tx.reference as string;
          if (ref) status = await checkKorapay(ref);
        } else {
          const prvCode = (meta.provider_code as string) ?? "";
          if (!prvCode.startsWith("bsplug") && !prvCode.startsWith("iacafe")) {
            const hash = (meta.aidapay_ref as string) ?? tx.provider_reference as string;
            if (hash) status = await checkAidapay(hash);
          }
        }

        if (status === "success") {
          if (isKp) {
            const ref = (meta.korapay_reference as string) ?? tx.provider_reference as string ?? tx.reference as string;
            const { error: e } = await sb.rpc("credit_wallet_from_korapay", { _user_id: tx.user_id, _amount: tx.amount, _korapay_ref: ref });
            if (e && !(e.message ?? "").includes("DUPLICATE")) { console.error("credit error:", e.message); continue; }
            resolved++;
            await tg(`✅ Deposit recovered: NGN${tx.amount} credited. Ref: ${tx.reference}`);
          } else {
            await sb.from("transactions").update({ status: "success", last_verification_at: now }).eq("id", tx.id);
            resolved++;
          }
        } else if (status === "failed") {
          await sb.from("transactions").update({ status: "failed", failure_reason: "Provider confirmed failed", last_verification_at: now }).eq("id", tx.id);
          if (!isKp) await sb.rpc("refund_wallet", { _user_id: tx.user_id, _amount: tx.amount, _ref: tx.reference });
          resolved++;
        } else if (!isKp && newRetry >= MAX_RETRIES) {
          await sb.from("transactions").update({ status: "failed", retry_count: newRetry, failure_reason: `Max retries: ${status}` }).eq("id", tx.id);
          await sb.rpc("refund_wallet", { _user_id: tx.user_id, _amount: tx.amount, _ref: tx.reference });
          await tg(`[REVIEW] Manual check: Ref ${tx.reference} NGN${tx.amount}`);
        } else {
          await sb.from("transactions").update({ retry_count: newRetry, last_verification_at: now }).eq("id", tx.id);
        }
      } catch (e) { console.error("tx error:", tx.id, e); }
    }

    return new Response(JSON.stringify({ checked: all.length, resolved, at: now }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: cors });
  }
});
