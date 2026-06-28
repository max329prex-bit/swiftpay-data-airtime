import { createClient } from "npm:@supabase/supabase-js@2";

// transaction-recovery: Handles stuck pending transactions.
// For wallet_fund: logs for admin review (webhooks should auto-credit).
// For data/airtime/electricity/cable: auto-refunds if stuck > 5 minutes.

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
  const results: { refunded: number; alerted: number; details: string[] } = { refunded: 0, alerted: 0, details: [] };

  // ── 1. Auto-refund data/airtime/electricity/cable stuck > 5 minutes ──
  const vtuCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: vtuStuck } = await sb.from("transactions")
    .select("id, user_id, reference, amount, type, created_at, meta")
    .in("type", ["data", "airtime", "electricity", "cable"])
    .eq("status", "pending")
    .lt("created_at", vtuCutoff);

  if (vtuStuck && vtuStuck.length > 0) {
    console.log(`[recovery] Found ${vtuStuck.length} stuck VTU purchases`);
    for (const tx of vtuStuck) {
      const ageMin = (Date.now() - new Date(tx.created_at).getTime()) / 60000;
      console.log(`[recovery] Auto-refunding stuck VTU: ${tx.reference} ${tx.type} ₦${tx.amount} ${ageMin.toFixed(0)}min`);
      try {
        const { error } = await sb.rpc("fail_and_refund_transaction", { _tx_id: tx.id, _reason: `Stuck pending >5min (auto-recovery)` });
        if (error) {
          console.error(`[recovery] refund failed for ${tx.reference}:`, error.message);
          await tg(`🚨 *Auto-refund FAILED*\nRef: ${tx.reference}\n${tx.type} ₦${tx.amount}\nUser: ${tx.user_id}\nError: ${error.message}`);
        } else {
          results.refunded++;
          results.details.push(`Refunded ${tx.reference} (${tx.type} ₦${tx.amount})`);
          await tg(`✅ *Auto-refunded stuck VTU*\nRef: \`\`${tx.reference}\`\`\nType: ${tx.type}\nAmount: ₦${tx.amount}\nUser: ${tx.user_id}\nAge: ${ageMin.toFixed(0)}min`);
        }
      } catch (e) {
        console.error(`[recovery] exception refunding ${tx.reference}:`, e);
      }
    }
  }

  // ── 2. Alert on stuck wallet_fund > 30 minutes ──
  const fundCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: stuckFund } = await sb.from("transactions")
    .select("id, user_id, reference, amount, created_at, meta")
    .eq("type", "wallet_fund")
    .eq("status", "pending")
    .lt("created_at", fundCutoff);

  if (stuckFund && stuckFund.length > 0) {
    for (const tx of stuckFund) {
      const provider = (tx.meta as Record<string, string>)?.provider ?? "unknown";
      const ageMin = (Date.now() - new Date(tx.created_at).getTime()) / 60000;
      console.log(`[recovery] Stuck deposit: ${tx.reference} user=${tx.user_id} ₦${tx.amount} ${ageMin.toFixed(0)}min provider=${provider}`);
      results.alerted++;
      await tg(`⚠️ *Stuck Deposit*\nRef: \`\`${tx.reference}\`\`\nUser: ${tx.user_id}\nAmount: ₦${tx.amount}\nAge: ${ageMin.toFixed(0)}min\nProvider: ${provider}\n\nCheck dashboard to verify payment.`);
    }
  }

  return new Response(
    JSON.stringify({ refunded: results.refunded, alerted: results.alerted, details: results.details }),
    { headers: { "Content-Type": "application/json" } }
  );
});
