-- Migration: Free Transfer scanning improvements
-- Date: 2026-07-09
--
-- The edge function code (scan-opay-emails, opay-email-webhook) has been updated to:
--   - scan INBOX and All Mail variants for targeted checks
--   - accept multiple OPay sender addresses (no-reply@opay-nigeria.com, no-reply@opay.com, etc.)
--   - parse more email formats with fallback regex patterns
--   - match by exact sender account number without requiring a bank name
--   - require CRON_SECRET / FT_SCRIPT_SECRET for all scanner/webhook calls
--   - update the free_transfer_deposits row after a successful webhook credit
--
-- This migration adds the database index that makes the pending-deposit lookup fast.
-- message_uid is already the primary key of opay_used_emails, so it is already unique.
-- The id and status columns of free_transfer_deposits are already covered by the PK.

-- Speed up finding pending deposits for a given amount and status.
CREATE INDEX IF NOT EXISTS idx_free_transfer_deposits_status_amount_expires
  ON public.free_transfer_deposits (status, amount, expires_at DESC)
  WHERE status = 'pending';
