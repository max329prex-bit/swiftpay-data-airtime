-- Migration: Allow 'reserved' status for free transfer deposits
-- Date: 2026-07-09
--
-- The previous migration introduced a 'reserved' status for active pay-screen
-- sessions, but the existing table check constraint does not allow it. This
-- migration updates the constraint to include 'reserved'.
--
-- The workflow currently does NOT auto-push migrations (remote migration history
-- is out of sync), so this must be applied manually in the Supabase SQL Editor.

-- Drop the existing check constraint. If it was never created, this is a no-op.
ALTER TABLE public.free_transfer_deposits
DROP CONSTRAINT IF EXISTS free_transfer_deposits_status_check;

-- Add the updated constraint with all valid statuses.
-- NOT VALID lets us apply the DDL without validating every existing row first.
ALTER TABLE public.free_transfer_deposits
ADD CONSTRAINT free_transfer_deposits_status_check
CHECK (status IN ('reserved', 'pending', 'verified', 'failed', 'expired'))
NOT VALID;

-- Normalize any rows that would violate the new constraint before validating it.
UPDATE public.free_transfer_deposits
SET status = 'pending'
WHERE status IS NULL OR status = '';

-- Validate the constraint against all existing rows.
ALTER TABLE public.free_transfer_deposits
VALIDATE CONSTRAINT free_transfer_deposits_status_check;
