-- Migration: Free Transfer enhancements
-- Date: 2026-07-07

-- 1. Prevent two different users from using the same bank account as their Free Transfer default.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_ft_account_number
ON public.profiles (ft_account_number)
WHERE ft_account_number IS NOT NULL AND ft_account_number <> '';

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
