-- ============================================================
-- BlitzPay: Korapay-only migration (remove Monnify, fix wallet funding)
-- Applied: 2026-05-28
-- ============================================================

-- 1. Replace credit_wallet_from_korapay to match checkout webhook signature
--    Old: (reference text, amount numeric) — virtual account flow
--    New: (_user_id uuid, _amount numeric, _korapay_ref text) — checkout flow
DROP FUNCTION IF EXISTS public.credit_wallet_from_korapay(text, numeric);

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
  ON CONFLICT (reference) DO UPDATE SET status = 'success';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.credit_wallet_from_korapay(UUID, NUMERIC, TEXT)
  FROM PUBLIC, anon, authenticated;

-- 2. Add refund_wallet function (used by transaction-recovery instead of Monnify)
CREATE OR REPLACE FUNCTION public.refund_wallet(
  _user_id UUID,
  _amount  NUMERIC,
  _ref     TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _amount <= 0 THEN RETURN; END IF;
  UPDATE public.wallets
    SET refund_balance = refund_balance + _amount, updated_at = now()
    WHERE user_id = _user_id;
  INSERT INTO public.transactions (user_id, type, amount, reference, status, meta)
  VALUES (_user_id, 'wallet_fund', _amount,
    'REFUND-' || _ref, 'success',
    jsonb_build_object('provider', 'refund', 'original_ref', _ref))
  ON CONFLICT (reference) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_wallet(UUID, NUMERIC, TEXT)
  FROM PUBLIC, anon, authenticated;
