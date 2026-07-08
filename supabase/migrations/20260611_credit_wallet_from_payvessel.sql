-- Migration: create credit_wallet_from_payvessel RPC
-- This function is called by payvessel-webhook to credit user wallets on successful deposits.
-- Mirrors credit_wallet_from_korapay exactly, using _pv_ref as the idempotency key.

CREATE OR REPLACE FUNCTION public.credit_wallet_from_payvessel(
  _user_id uuid,
  _amount  numeric,
  _pv_ref  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Idempotency: don't credit the same reference twice
  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE reference = _pv_ref AND status = 'success'
  ) THEN
    RAISE EXCEPTION 'DUPLICATE: already credited %', _pv_ref;
  END IF;

  IF _amount < 100 THEN
    RAISE EXCEPTION 'Amount too small: %', _amount;
  END IF;

  -- Credit wallet
  INSERT INTO public.wallets (user_id, balance)
  VALUES (_user_id, _amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = wallets.balance + _amount,
        updated_at = now();

  -- Log transaction
  INSERT INTO public.transactions (user_id, type, amount, reference, status, meta)
  VALUES (
    _user_id,
    'wallet_fund',
    _amount,
    _pv_ref,
    'success',
    jsonb_build_object('provider', 'payvessel')
  )
  ON CONFLICT (reference) DO UPDATE SET status = 'success';
END;
$$;
