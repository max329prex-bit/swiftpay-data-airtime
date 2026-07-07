-- Migration: Free Transfer enhancements
-- Date: 2026-07-07

-- Abort safely if duplicate (bank + account number) combinations already exist.
DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT ft_bank_name, ft_account_number
    FROM public.profiles
    WHERE ft_account_number IS NOT NULL AND ft_account_number <> ''
       AND ft_bank_name IS NOT NULL AND ft_bank_name <> ''
    GROUP BY ft_bank_name, ft_account_number
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Cannot create unique index: % duplicate (bank + account number) combination(s) found in profiles. Resolve duplicates before applying this migration.', dup_count;
  END IF;
END $;

-- 1. Prevent two different users from using the same bank + account number combination as their Free Transfer default.
-- Drop the old single-column index if it exists (from the previous version of this migration).
DROP INDEX IF EXISTS public.idx_profiles_ft_account_number;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_ft_bank_account
ON public.profiles (ft_bank_name, ft_account_number)
WHERE ft_account_number IS NOT NULL AND ft_account_number <> ''
  AND ft_bank_name IS NOT NULL AND ft_bank_name <> '';

-- 2. Enable realtime updates for transactions and free_transfer_deposits so the UI updates immediately when a payment is verified.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'free_transfer_deposits'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.free_transfer_deposits;
  END IF;
END $$;
