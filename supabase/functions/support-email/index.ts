import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPA_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPA_SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BREVO_KEY = Deno.env.get("BREVO_API_KEY") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const SUPPORT_EMAIL = "blitzpaysup@gmail.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // Fail-closed: only the service-role key or a matching non-empty cron secret may run this poller.
    const authHeader = req.headers.get("Authorization") ?? "";
    const headerSecret = req.headers.get("x-cron-secret") ?? "";
    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    const isServiceRole = SUPA_SVC && authHeader === `Bearer ${SUPA_SVC}`;
    const cronOk = !!cronSecret && !!headerSecret && headerSecret === cronSecret;
    if (!isServiceRole && !cronOk) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPA_URL, SUPA_SVC);

    // Poll for unsent support tickets (last 5 minutes)
    const since = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: tickets, error: te } = await sb
      .from("support_tickets")
      .select("id, user_id, message, status, ticket_ref, created_at, intent")
      .eq("status", "open")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(50);

    if (te) throw te;
    if (!tickets || tickets.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: cors });
    }

    let sent = 0;
    for (const ticket of tickets) {
      // Check if already notified
      const { data: existing } = await sb
        .from("support_ticket_notified")
        .select("ticket_id")
        .eq("ticket_id", ticket.id)
        .maybeSingle();
      if (existing) continue;

      // Get user info
      const { data: user } = await sb
        .from("profiles")
        .select("full_name, phone")
        .eq("user_id", ticket.user_id)
        .maybeSingle();

      const userName = user?.full_name || "Unknown User";
      const userPhone = user?.phone || "N/A";

      // Send via Brevo
      if (BREVO_KEY) {
        try {
          const emailBody = {
            sender: { name: "BlitzPay Support", email: "noreply@blitzpay.ng" },
            to: [{ email: SUPPORT_EMAIL, name: "BlitzPay Support Team" }],
            subject: `[Ticket ${ticket.ticket_ref}] ${userName} needs help`,
            htmlContent: `<p><strong>New support ticket from BlitzPay</strong></p>
<p><strong>Ticket Ref:</strong> ${ticket.ticket_ref}</p>
<p><strong>User:</strong> ${userName}</p>
<p><strong>Phone:</strong> ${userPhone}</p>
<p><strong>Intent:</strong> ${ticket.intent || "other"}</p>
<p><strong>Message:</strong></p>
<blockquote>${(ticket.message || "").replace(/\n/g, "<br>")}</blockquote>
<p><strong>Time:</strong> ${new Date(ticket.created_at).toLocaleString("en-NG")}</p>`
          };

          const r = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": BREVO_KEY,
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify(emailBody),
            signal: AbortSignal.timeout(15000)
          });

          if (r.ok || r.status === 201) {
            await sb.from("support_ticket_notified").insert({
              ticket_id: ticket.id,
              emailed_at: new Date().toISOString()
            });
            sent++;
            console.log(`[support-email] Sent ticket ${ticket.ticket_ref} to ${SUPPORT_EMAIL}`);
          } else {
            const err = await r.text().catch(() => "");
            console.error(`[support-email] Brevo failed for ${ticket.ticket_ref}:`, r.status, err.slice(0, 200));
          }
        } catch (e) {
          console.error("[support-email] Brevo error:", e);
        }
      } else {
        console.warn("[support-email] BREVO_API_KEY not configured");
      }
    }

    return new Response(JSON.stringify({ sent, total: tickets.length }), { headers: cors });

  } catch (e: unknown) {
    console.error("[support-email] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: cors
    });
  }
});
