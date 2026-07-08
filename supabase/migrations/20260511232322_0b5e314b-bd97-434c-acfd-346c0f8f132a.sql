
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS swift_points INTEGER NOT NULL DEFAULT 0;

-- Update purchase_vtu to award points based on amount (5 points per 250 naira spent on data/airtime)
CREATE OR REPLACE FUNCTION public.purchase_vtu(_type tx_type, _network text, _phone text, _amount numeric, _meta jsonb DEFAULT '{}'::jsonb)
 RETURNS transactions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid UUID := auth.uid(); _bal NUMERIC; _tx public.transactions; _ref TEXT; _pts INTEGER;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _uid FOR UPDATE;
  IF _bal IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF _bal < _amount THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;
  UPDATE public.wallets SET balance = balance - _amount WHERE user_id = _uid;
  _ref := 'SP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  INSERT INTO public.transactions (user_id, type, network, phone, amount, status, reference, meta)
  VALUES (_uid, _type, _network, _phone, _amount, 'success', _ref, _meta) RETURNING * INTO _tx;

  -- Award SwiftPoints: 5 points per 250 naira (only for data/airtime)
  IF _type IN ('data','airtime') THEN
    _pts := GREATEST(1, FLOOR(_amount / 250.0) * 5);
    UPDATE public.profiles SET swift_points = swift_points + _pts, updated_at = now() WHERE user_id = _uid;
  END IF;

  RETURN _tx;
END; $function$;

-- Redeem 100 points for 1GB free data
CREATE OR REPLACE FUNCTION public.redeem_swift_points(_network text, _phone text)
 RETURNS transactions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid UUID := auth.uid(); _pts INTEGER; _tx public.transactions; _ref TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT swift_points INTO _pts FROM public.profiles WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(_pts,0) < 100 THEN RAISE EXCEPTION 'Need 100 SwiftPoints to redeem'; END IF;
  UPDATE public.profiles SET swift_points = swift_points - 100, updated_at = now() WHERE user_id = _uid;
  _ref := 'RD-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  INSERT INTO public.transactions (user_id, type, network, phone, amount, status, reference, meta)
  VALUES (_uid, 'data', _network, _phone, 0, 'success', _ref,
    jsonb_build_object('reward', true, 'bundle', '1GB Free (SwiftPoint Reward)'))
  RETURNING * INTO _tx;
  RETURN _tx;
END; $function$;
