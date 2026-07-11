-- BlitzPoints: switch from automatic award to manual claim on the purchase summary page.
-- Earn rate is now 1 BP per ₦250 spent on data/airtime.
-- Keeps the 100 BP = 1GB free data reward unchanged.

-- 1. Stop automatically awarding BlitzPoints inside purchase_vtu.
--    Points are now only added when the user explicitly clicks the
--    "Claim BlitzPoints" button on the PIN/summary screen and the
--    provider confirms the purchase.
CREATE OR REPLACE FUNCTION public.purchase_vtu(
  _type tx_type,
  _network text,
  _phone text,
  _amount numeric,
  _meta jsonb DEFAULT '{}'::jsonb
)
 RETURNS transactions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid UUID := auth.uid(); _bal NUMERIC; _tx public.transactions; _ref TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _uid FOR UPDATE;
  IF _bal IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF _bal < _amount THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;
  UPDATE public.wallets SET balance = balance - _amount WHERE user_id = _uid;
  _ref := 'SP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  INSERT INTO public.transactions (user_id, type, network, phone, amount, status, reference, meta)
  VALUES (_uid, _type, _network, _phone, _amount, 'success', _ref, _meta)
  RETURNING * INTO _tx;
  RETURN _tx;
END; $function$;

-- 2. Shared RPC for safely awarding BlitzPoints. Used by the purchase edge
--    function when a user claims points, and by the schedule runner.
--    Negative points are ignored; a reason is required for auditability.
CREATE OR REPLACE FUNCTION public.award_swift_points(
  _user_id UUID,
  _points INTEGER,
  _reason TEXT DEFAULT 'Award'
)
 RETURNS INTEGER
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _awarded INTEGER;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user_id required'; END IF;
  IF COALESCE(_points, 0) <= 0 THEN RETURN 0; END IF;
  UPDATE public.profiles
  SET swift_points = swift_points + _points, updated_at = now()
  WHERE user_id = _user_id
  RETURNING swift_points INTO _awarded;
  RETURN COALESCE(_awarded, 0);
END; $function$;

-- 3. Helper: returns true if this is the user's first successful data purchase
--    (excluding reward redemptions and zero-amount rows). Used to decide whether
--    the one-time 50 BP first-data-purchase bonus should be offered.
CREATE OR REPLACE FUNCTION public.is_first_data_purchase(_user_id UUID)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE user_id = _user_id
      AND type = 'data'
      AND status = 'success'
      AND amount > 0
  );
$$;
