-- Migration: Free Transfer reserved payment session
-- Date: 2026-07-09
--
-- Introduces a 'reserved' status for free_transfer_deposits. A reserved row
-- represents an active payment session: the pay screen is shown, the unique
-- kobo amount is held, but the user has not yet confirmed they have paid.
--
-- Only when the user taps "I have made payment" does the row transition to
-- 'pending' and become visible to the email scanner/webhook. This prevents
-- cross-account sessionStorage leaks because the frontend only restores the
-- pay screen from a reserved row owned by the current user.

-- Ensure the status column can store the new state. We do not add a hard
-- check constraint here to keep the migration backwards-compatible; the
-- application and edge functions enforce valid statuses.

-- Help the frontend / edge functions find the user's active reserved session
-- without scanning the whole table.
DROP INDEX IF EXISTS public.idx_free_transfer_deposits_user_status_expires;
CREATE INDEX IF NOT EXISTS idx_free_transfer_deposits_user_status_expires
ON public.free_transfer_deposits (user_id, status, expires_at DESC)
WHERE status IN ('reserved', 'pending');

-- Optional: if the table has no status values, normalise historical rows.
-- Current production already has pending/verified/failed, so this is a no-op.
UPDATE public.free_transfer_deposits
SET status = 'pending'
WHERE status IS NULL OR status = '';
