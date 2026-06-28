-- ============================================================
-- BlitzPay: Wallet-Safe Purchase Flow
-- 1. create_vtu_transaction_pending — creates pending tx, NO wallet debit
-- 2. commit_vtu_transaction — debit wallet + mark success (after provider OK)
-- 3. reverse_vtu_transaction — mark failed, NO debit (after provider fail)
-- 4. reverse_and_refund — for backward compat with already-debited tx
-- 5. is_tx_pending — check if a tx is still pending
-- ============================================================

-- Create pending transaction (reserve only — wallet untouched)
CREATE OR REPLACE FUNCTION public.create_vtu_transaction_pending(
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
  _ref TEXT;
BEGIN
  _ref := COALESCE(_reference, 'SP-' || extract(epoch from now())::bigint::text);
  
  INSERT INTO public.transactions (
    user_id, type, network, phone, amount, status, reference, meta
  ) VALUES (
    _user_id, _type, _network, _phone, _amount, 'pending', _ref, _meta
  )
  RETURNING * INTO _tx;
  
  RETURN _tx;
END $$;

-- Commit pending transaction: debit wallet + mark success
CREATE OR REPLACE FUNCTION public.commit_vtu_transaction(
  _tx_id UUID,
  _user_id UUID,
  _amount NUMERIC,
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
  _bal NUMERIC;
  _existing public.transactions;
BEGIN
  -- Lock the transaction row
  SELECT * INTO _existing FROM public.transactions WHERE id = _tx_id FOR UPDATE;
  
  IF _existing IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;
  
  IF _existing.status != 'pending' THEN
    RAISE EXCEPTION 'Transaction already resolved: %', _existing.status;
  END IF;
  
  -- Lock wallet and check balance
  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF _bal IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;
  IF _bal < _amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Wallet balance ₦% < ₦%', _bal, _amount;
  END IF;
  
  -- Debit wallet
  UPDATE public.wallets SET balance = balance - _amount WHERE user_id = _user_id;
  
  -- Update transaction to success
  UPDATE public.transactions SET
    status = 'success',
    provider_reference = COALESCE(_provider_reference, provider_reference),
    meta = COALESCE(_meta, meta),
    updated_at = now()
  WHERE id = _tx_id
  RETURNING * INTO _tx;
  
  RETURN _tx;
END $$;

-- Reverse pending transaction: mark failed, NO wallet debit (money was never taken)
CREATE OR REPLACE FUNCTION public.reverse_vtu_transaction(
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
  UPDATE public.transactions SET
    status = 'failed',
    meta = meta || jsonb_build_object('failure_reason', _reason, 'reversed_at', now()),
    updated_at = now()
  WHERE id = _tx_id AND status = 'pending'
  RETURNING * INTO _tx;
  
  RETURN _tx;
END $$;

-- Reverse and refund: for backward compat with already-debited transactions
CREATE OR REPLACE FUNCTION public.reverse_and_refund(
  _tx_id UUID,
  _reason TEXT DEFAULT 'Auto-refund on failure'
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
  
  -- Mark as reversed (refunded)
  UPDATE public.transactions SET
    status = 'reversed',
    meta = meta || jsonb_build_object('refund_reason', _reason, 'refunded_at', now(), 'refund_amount', _tx.amount),
    updated_at = now()
  WHERE id = _tx_id
  RETURNING * INTO _tx;
  
  RETURN _tx;
END $$;

-- Check if transaction is still pending
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

-- Index for fast pending transaction lookups
CREATE INDEX IF NOT EXISTS idx_tx_pending_user
  ON public.transactions(user_id, status, created_at)
  WHERE status = 'pending';
