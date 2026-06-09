-- ============================================================
-- BlitzPay: Payvessel + Gsubz + Admin OTP migration
-- Applied: 2026-06-09
-- ============================================================

-- 1. Payvessel virtual accounts (permanent per user)
CREATE TABLE IF NOT EXISTS public.payvessel_virtual_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  account_name   TEXT,
  bank_name      TEXT,
  bank_code      TEXT,
  pv_reference   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payvessel_va_user_unique UNIQUE (user_id)
);
ALTER TABLE public.payvessel_virtual_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own payvessel VA"
  ON public.payvessel_virtual_accounts FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Service role manages payvessel VAs"
  ON public.payvessel_virtual_accounts FOR ALL
  TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_pv_va_account_number
  ON public.payvessel_virtual_accounts(account_number);

-- 2. Admin OTPs (short-lived, 6-digit)
CREATE TABLE IF NOT EXISTS public.admin_otps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_otps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages admin OTPs"
  ON public.admin_otps FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3. credit_wallet_from_payvessel (mirrors credit_wallet_from_korapay)
CREATE OR REPLACE FUNCTION public.credit_wallet_from_payvessel(
  _user_id   UUID,
  _amount    NUMERIC,
  _pv_ref    TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE reference = _pv_ref AND status = 'success'
  ) THEN
    RAISE EXCEPTION 'DUPLICATE: already credited %', _pv_ref;
  END IF;
  IF _amount < 100 THEN
    RAISE EXCEPTION 'Amount too small: %', _amount;
  END IF;
  INSERT INTO public.wallets (user_id, balance)
  VALUES (_user_id, _amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = wallets.balance + _amount, updated_at = now();
  INSERT INTO public.transactions (user_id, type, amount, reference, status, meta)
  VALUES (_user_id, 'wallet_fund', _amount, _pv_ref, 'success',
    jsonb_build_object('provider', 'payvessel'))
  ON CONFLICT (reference) DO UPDATE SET status = 'success';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.credit_wallet_from_payvessel(UUID, NUMERIC, TEXT)
  FROM PUBLIC, anon, authenticated;

-- 4. Update virtual_accounts table default provider to payvessel
ALTER TABLE public.virtual_accounts
  ALTER COLUMN payment_provider SET DEFAULT 'payvessel';
