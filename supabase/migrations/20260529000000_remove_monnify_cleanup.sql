-- ============================================================
-- BlitzPay: Remove Monnify + DB cleanup
-- Applied: 2026-05-29
-- ============================================================

-- 1. Drop Monnify table (no longer used)
DROP TABLE IF EXISTS public.monnify_events CASCADE;

-- 2. Drop Monnify credit function
DROP FUNCTION IF EXISTS public.credit_wallet_from_monnify(text, numeric);
DROP FUNCTION IF EXISTS public.credit_wallet_from_monnify(uuid, numeric, text);

-- 3. Fix virtual_accounts default provider (was 'monnify', now 'korapay')
ALTER TABLE public.virtual_accounts
  ALTER COLUMN payment_provider SET DEFAULT 'korapay';

-- 4. Drop the older create_vtu_transaction (without _bp param)
--    The newer one awards BlitzPoints; keep that, drop the old one.
DROP FUNCTION IF EXISTS public.create_vtu_transaction(
  uuid, text, text, text, numeric, text, jsonb
);

-- 5. Drop duplicate support_tickets INSERT policy
DROP POLICY IF EXISTS "Users create own tickets" ON public.support_tickets;
-- Keep "Users insert own tickets" (same effect, cleaner name)

-- 6. Add partial index on transactions.status for recovery query performance
CREATE INDEX IF NOT EXISTS idx_tx_pending_status
  ON public.transactions(status, created_at)
  WHERE status IN ('processing', 'verifying', 'pending');

-- 7. Add RLS policy for webhook_events: service role only (explicit)
DROP POLICY IF EXISTS "Service role manages webhook events" ON public.webhook_events;
CREATE POLICY "Service role manages webhook events"
  ON public.webhook_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
