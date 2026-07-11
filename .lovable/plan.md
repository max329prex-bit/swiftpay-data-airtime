# Fix Free Transfer manual verification

## Root cause

`confirm-free-transfer` awaits an inline `fetch` to `scan-opay-emails` with a 15s AbortController timeout. The IMAP scan often takes longer than that (Deno cold start + IMAP fetch of 6+ messages), so the edge function either aborts, hits the platform timeout, or the client drops the connection — the browser surfaces this as **"Failed to fetch"**.

The scan itself still runs (and/or the 5-minute cron catches it) — which is why a refresh 1–2 minutes later shows the wallet credited.

## Fix (minimal, keeps cron untouched)

### 1. `supabase/functions/confirm-free-transfer/index.ts`
- Stop `await`ing the inline scan. Kick it off fire-and-forget with `EdgeRuntime.waitUntil(...)` (or just an unawaited promise) so the HTTP response returns as soon as the deposit is transitioned to `pending` and the `verifying` transaction row is upserted.
- Return `{ success: true, status: "pending", deposit_id, message: "Payment confirmed. Checking for your transfer..." }` immediately — no more 15s inline scan blocking the response.
- Keep every other branch (expired / already verified / already pending) unchanged.

Result: the endpoint responds in well under a second, so "Failed to fetch" from timeout goes away. Frontend polling + realtime + the existing `trigger-email-check` retry loop pick up the credit as soon as the scan finds the email (which the cron also independently guarantees).

### 2. `src/components/blitz/FreeTransferPanel.tsx` — "refresh after ~10s" hint
Per the user's request: at 10 seconds elapsed in the `checking` step, show a message telling them they can refresh if it isn't verified within a minute or two. Adjust the existing elapsed-time hints:
- `checkingElapsed >= 10 && < 60`: "Still checking… if this isn't verified in a minute or two, you can refresh the page — your wallet will already be credited."
- `checkingElapsed >= 60`: keep/repurpose the existing amber "refresh this page and check your balance" box.
- Remove the 30s hint (superseded by the 10s one).

No other UI or business-logic changes. Cron, matching, crediting, and `opay-email-webhook` are untouched.

## Files changed

- `supabase/functions/confirm-free-transfer/index.ts` — drop inline await on scan, return immediately.
- `src/components/blitz/FreeTransferPanel.tsx` — earlier "you can refresh" hint at 10s.

## Not doing

- No new queue table, no retry rewrites, no changes to `scan-opay-emails`, `opay-email-webhook`, `trigger-email-check`, or the GitHub Actions cron.
