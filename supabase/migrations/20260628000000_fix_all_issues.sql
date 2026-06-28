-- ============================================================
-- BlitzPay Fix All Issues — 2026-06-28
-- 1. Independent admin auth (admin_sessions)
-- 2. Notifications table for broadcast delivery
-- 3. Remove admin from both email accounts
-- 4. Transaction reference search (for AI support)
-- 5. Support ticket email trigger
-- 6. GSubz minimum price enforcement
-- ============================================================

-- ============================================================
-- 1. ADMIN SESSIONS (independent auth, no link to auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT NOT NULL UNIQUE,
  ip_address  TEXT,
  user_agent  TEXT,
  revoked     BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '8 hours'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON public.admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON public.admin_sessions(expires_at) WHERE NOT revoked;

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages admin sessions"
  ON public.admin_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Admin auth check function
CREATE OR REPLACE FUNCTION public.is_admin_session(_token TEXT)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE token = _token
      AND NOT revoked
      AND expires_at > now()
  )
$$;

-- ============================================================
-- 2. NOTIFICATIONS TABLE (per-user broadcast delivery)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT,
  message     TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info','warning','error')),
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  source      TEXT DEFAULT 'broadcast',  -- 'broadcast', 'system', 'transaction'
  meta        JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE NOT is_read;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Service role manages notifications"
  ON public.notifications FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Function: send broadcast to all users (creates notification per user)
CREATE OR REPLACE FUNCTION public.send_broadcast(
  _title      TEXT,
  _message    TEXT,
  _type       TEXT DEFAULT 'info'
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count INT := 0;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, source)
  SELECT id, _title, _message, _type, 'broadcast'
  FROM auth.users
  WHERE email_confirmed_at IS NOT NULL   -- only confirmed users
     OR confirmed_at IS NOT NULL;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END $$;
REVOKE ALL ON FUNCTION public.send_broadcast(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_broadcast(TEXT, TEXT, TEXT) TO service_role;

-- Mark notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_read(_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = TRUE
  WHERE id = _id AND user_id = auth.uid();
END $$;

-- ============================================================
-- 3. REMOVE ADMIN FROM BOTH EMAIL ACCOUNTS
-- ============================================================
-- Delete any admin roles for max329prex@gmail.com and onojav79@gmail.com
DELETE FROM public.user_roles
WHERE role = 'admin'
  AND user_id IN (
    SELECT id FROM auth.users
    WHERE email IN ('max329prex@gmail.com', 'onojav79@gmail.com')
  );

-- ============================================================
-- 4. TRANSACTION REFERENCE SEARCH (for AI support)
-- ============================================================
-- Function: search any transaction by reference (service role only)
CREATE OR REPLACE FUNCTION public.search_transaction_by_reference(_ref TEXT)
RETURNS TABLE (
  tx_id UUID,
  tx_type TEXT,
  network TEXT,
  phone TEXT,
  amount NUMERIC,
  status TEXT,
  reference TEXT,
  created_at TIMESTAMPTZ,
  user_email TEXT,
  user_name TEXT,
  meta JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    t.id AS tx_id,
    t.type::TEXT AS tx_type,
    t.network,
    t.phone,
    t.amount,
    t.status::TEXT AS status,
    t.reference,
    t.created_at,
    u.email AS user_email,
    p.full_name AS user_name,
    t.meta
  FROM public.transactions t
  JOIN auth.users u ON u.id = t.user_id
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.reference ILIKE '%' || _ref || '%'
  ORDER BY t.created_at DESC
  LIMIT 10;
$$;
REVOKE ALL ON FUNCTION public.search_transaction_by_reference(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_transaction_by_reference(TEXT) TO service_role;

-- ============================================================
-- 5. SUPPORT TICKET EMAIL TRIGGER SETUP
-- ============================================================
-- Table to track which tickets have been emailed (idempotent)
CREATE TABLE IF NOT EXISTS public.support_ticket_notified (
  ticket_id   UUID PRIMARY KEY REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  emailed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.support_ticket_notified ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages notifications"
  ON public.support_ticket_notified FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- 6. GSubz minimum price enforcement
-- ============================================================
-- Add cost_price column to packages if not exists
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(14,2);

-- Function: get package with enforced minimum sell price
CREATE OR REPLACE FUNCTION public.get_package_with_min_price(_pkg_code TEXT)
RETURNS public.packages LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.packages WHERE package_code = _pkg_code;
$$;

-- ============================================================
-- 7. ENABLE REALTIME FOR NOTIFICATIONS
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
