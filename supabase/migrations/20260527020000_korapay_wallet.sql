-- ============================================================
-- BlitzPay: Korapay wallet funding + transaction schema upgrades
-- ============================================================
DO $$ BEGIN
  ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'wallet_fund';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.tx_status ADD VALUE IF NOT EXISTS 'processing';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.tx_status ADD VALUE IF NOT EXISTS 'verifying';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.tx_status ADD VALUE IF NOT EXISTS 'refunded';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_reference TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_verification_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS tx_updated_at ON public.transactions;
CREATE TRIGGER tx_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.credit_wallet_from_korapay(
  _user_id     UUID,
  _amount      NUMERIC,
  _korapay_ref TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE reference = _korapay_ref AND status = 'success'
  ) THEN
    RAISE EXCEPTION 'DUPLICATE: already credited %', _korapay_ref;
  END IF;
  IF _amount < 100 THEN
    RAISE EXCEPTION 'Amount too small: %', _amount;
  END IF;
  INSERT INTO public.wallets (user_id, balance)
  VALUES (_user_id, _amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = wallets.balance + _amount, updated_at = now();
  INSERT INTO public.transactions (user_id, type, amount, reference, status, meta)
  VALUES (_user_id, 'wallet_fund', _amount, _korapay_ref, 'success',
    jsonb_build_object('provider', 'korapay'))
  ON CONFLICT (reference) DO UPDATE SET status = 'success', updated_at = now();
END; $$;

REVOKE EXECUTE ON FUNCTION public.credit_wallet_from_korapay(UUID, NUMERIC, TEXT)
  FROM PUBLIC, anon, authenticated;
