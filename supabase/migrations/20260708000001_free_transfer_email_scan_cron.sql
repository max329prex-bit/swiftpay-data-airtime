-- Migration: background email scan for Free Transfer verification
-- Run date: 2026-07-08
-- NOTE: The cron job is set up outside this migration so the CRON_SECRET is not committed.
-- Use the Supabase CLI or dashboard to schedule a minute-cron that calls the
-- scan-opay-emails edge function with the x-cron-secret header set to the value of CRON_SECRET.

-- Remove any legacy job that used the hardcoded fallback secret.
SELECT cron.unschedule('blitzpay-scan-opay-emails');
