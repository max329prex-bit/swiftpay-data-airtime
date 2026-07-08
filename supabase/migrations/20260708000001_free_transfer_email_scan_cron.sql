-- Migration: background email scan for Free Transfer verification
-- Run date: 2026-07-08
-- Scans the OPay Gmail inbox every minute so deposits are verified as soon as the email arrives.

-- Remove existing job if it exists so this migration is idempotent.
SELECT cron.unschedule('blitzpay-scan-opay-emails');

-- Schedule a new scan every minute using the CRON_SECRET env var.
SELECT cron.schedule(
  'blitzpay-scan-opay-emails',
  '* * * * *',
  $
    SELECT net.http_post(
      url := 'https://tljnhlhzyntotadxoypz.supabase.co/functions/v1/scan-opay-emails',
      headers := '{"Content-Type": "application/json", "x-cron-secret": "cron-blitzpay-scan-emails-2026"}'::jsonb,
      body := '{}'::jsonb
    )
  $
);
