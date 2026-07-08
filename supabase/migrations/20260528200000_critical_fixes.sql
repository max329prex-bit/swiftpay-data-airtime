-- ============================================================
-- BlitzPay: Critical fixes migration
-- 1. webhook_events table (was missing — caused ALL deposits to fail)
-- 2. refund_balance column on wallets (was missing — caused refunds to crash)
-- 3. support_tickets table
-- Applied: 2026-05-28
-- ============================================================

-- 1. webhook_events: idempotency table for Korapay webhook
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    TEXT NOT NULL UNIQUE,
  provider    TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- Only service role can access this table
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id
  ON public.webhook_events(event_id);

-- 2. refund_balance on wallets
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS refund_balance NUMERIC(14,2) NOT NULL DEFAULT 0;

-- 3. support_tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_ref            TEXT NOT NULL UNIQUE DEFAULT 'BLP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  intent                TEXT NOT NULL,
  message               TEXT,
  related_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'open',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user_created
  ON public.support_tickets(user_id, created_at DESC);
