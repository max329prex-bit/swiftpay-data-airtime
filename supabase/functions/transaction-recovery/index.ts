import { createClient } from "npm:@supabase/supabase-js@2";

// transaction-recovery: PayVessel-only.
// Scans for wallet_fund transactions stuck at 'pending' and logs them for admin review.
// PayVessel webhooks should auto-credit deposits; this is a safety net.

const SUPA_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_BOT    = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT   = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID") ?? "";

async function tg(msg: string) {
  if (!TG_BOT || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text: msg, parse_mode: "Markdown" }),
    });
  } catch {}
}

Deno.serve(async (_req) => {
  const sb = createClient(SUPA_URL, SUPA_SVC);

  // Find wallet_fund txs stuck in pending > 30 minutes
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: stuck } = await sb.from("transactions")
    .select("id, user_id, reference, amount, created_at, meta")
    .eq("type", "wallet_fund")
    .eq("status", "pending")
    .lt("created_at", cutoff);

  if (!stuck || stuck.length === 0) {
    console.log("[transaction-recovery] No stuck transactions found");
    return new Response(JSON.stringify({ recovered: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`[transaction-recovery] Found ${stuck.length} stuck pending wallet_fund transactions`);

  for (const tx of stuck) {
    const provider = (tx.meta as Record<string, string>)?.provider ?? "unknown";
    const ageMin = (Date.now() - new Date(tx.created_at).getTime()) / 60000;

    console.log(`[transaction-recovery] Stuck: ${tx.reference} user=${tx.user_id} ₦${tx.amount} ${ageMin.toFixed(0)}min provider=${provider}`);

    // Alert admin via Telegram
    await tg(
      `⚠️ *Stuck Deposit*\nRef: \`${tx.reference}\`\nUser: ${tx.user_id}\nAmount: ₦${tx.amount}\nAge: ${ageMin.toFixed(0)}min\nProvider: ${provider}\n\nCheck PayVessel dashboard to verify if payment was received.`
    );
  }

  return new Response(
    JSON.stringify({ stuck_count: stuck.length, references: stuck.map((t) => t.reference) }),
    { headers: { "Content-Type": "application/json" } }
  );
});
