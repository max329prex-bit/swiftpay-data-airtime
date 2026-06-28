-- ============================================================
-- BlitzPay: CORRECTED Wallet-Safe Purchase Flow
-- Wallet is debited IMMEDIATELY on purchase start.
-- If provider fails, wallet is refunded.
-- If provider succeeds, money stays debited.
-- This prevents double-spending while pending.
-- ============================================================

-- 1. Debit wallet and create pending transaction (atomic)
CREATE OR REPLACE FUNCTION public.debit_and_create_transaction(
  _user_id UUID,
  _type TEXT,
  _network TEXT,
  _phone TEXT,
  _amount NUMERIC,
  _reference TEXT DEFAULT NULL,
  _meta JSONB DEFAULT '{}'::jsonb
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx public.transactions;
  _bal NUMERIC;
  _ref TEXT;
BEGIN
  _ref := COALESCE(_reference, 'SP-' || extract(epoch from now())::bigint::text);

  -- Lock wallet and check balance
  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF _bal IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;
  IF _bal < _amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Wallet balance ₦% < ₦%', _bal, _amount;
  END IF;

  -- Debit wallet immediately
  UPDATE public.wallets SET balance = balance - _amount WHERE user_id = _user_id;

  -- Create pending transaction
  INSERT INTO public.transactions (
    user_id, type, network, phone, amount, status, reference, meta
  ) VALUES (
    _user_id, _type, _network, _phone, _amount, 'pending', _ref, _meta
  )
  RETURNING * INTO _tx;

  RETURN _tx;
END $$;

-- 2. Commit pending transaction to success (provider confirmed OK)
CREATE OR REPLACE FUNCTION public.commit_transaction(
  _tx_id UUID,
  _provider_reference TEXT DEFAULT NULL,
  _meta JSONB DEFAULT NULL
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx public.transactions;
  _existing public.transactions;
BEGIN
  SELECT * INTO _existing FROM public.transactions WHERE id = _tx_id FOR UPDATE;
  IF _existing IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;
  IF _existing.status != 'pending' THEN
    RAISE EXCEPTION 'Transaction already resolved: %', _existing.status;
  END IF;

  UPDATE public.transactions SET
    status = 'success',
    provider_reference = COALESCE(_provider_reference, provider_reference),
    meta = COALESCE(_meta, meta),
    updated_at = now()
  WHERE id = _tx_id
  RETURNING * INTO _tx;

  RETURN _tx;
END $$;

-- 3. Fail pending transaction and REFUND wallet (provider failed)
CREATE OR REPLACE FUNCTION public.fail_and_refund_transaction(
  _tx_id UUID,
  _reason TEXT DEFAULT 'Provider failure'
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx public.transactions;
BEGIN
  SELECT * INTO _tx FROM public.transactions WHERE id = _tx_id FOR UPDATE;
  IF _tx IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;
  IF _tx.status IN ('failed', 'reversed') THEN
    RETURN _tx; -- already handled
  END IF;

  -- Credit wallet back
  UPDATE public.wallets SET balance = balance + _tx.amount WHERE user_id = _tx.user_id;

  -- Mark as failed with refund info
  UPDATE public.transactions SET
    status = 'failed',
    meta = meta || jsonb_build_object(
      'failure_reason', _reason,
      'refunded_at', now(),
      'refund_amount', _tx.amount,
      'was_pending', true
    ),
    updated_at = now()
  WHERE id = _tx_id
  RETURNING * INTO _tx;

  RETURN _tx;
END $$;

-- 4. Check if transaction is still pending
CREATE OR REPLACE FUNCTION public.is_tx_pending(_tx_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE id = _tx_id AND status = 'pending'
  );
$$;

-- 5. Drop old incorrect functions (they're replaced above)
DROP FUNCTION IF EXISTS public.create_vtu_transaction_pending(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.commit_vtu_transaction(UUID, UUID, NUMERIC, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.reverse_vtu_transaction(UUID, TEXT);
DROP FUNCTION IF EXISTS public.reverse_and_refund(UUID, TEXT);

-- Index for fast pending lookups
CREATE INDEX IF NOT EXISTS idx_tx_pending_user
  ON public.transactions(user_id, status, created_at)
  WHERE status = 'pending';
