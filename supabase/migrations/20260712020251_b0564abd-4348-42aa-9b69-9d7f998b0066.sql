CREATE OR REPLACE FUNCTION public.generate_api_key(_user_id uuid, _key_name text DEFAULT 'API Key'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _wallet record;
  _new_key text;
  _key_id uuid;
  _existing_count integer;
  _email text;
  _whitelisted boolean := false;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = _user_id;
  IF _email IN ('obaofaaua@gmail.com','max329prex@gmail.com','max329@gmail.com') THEN
    _whitelisted := true;
  END IF;

  SELECT * INTO _wallet FROM wallets WHERE user_id = _user_id;
  IF _wallet IS NULL AND NOT _whitelisted THEN
    RETURN jsonb_build_object('error', 'Wallet not found');
  END IF;

  IF NOT _whitelisted AND COALESCE(_wallet.balance, 0) < 5000 THEN
    RETURN jsonb_build_object(
      'error', 'Insufficient wallet balance',
      'required', 5000,
      'current', _wallet.balance,
      'message', 'Fund your wallet with at least ₦5,000 to unlock API access and get 2% off on all data plans'
    );
  END IF;

  SELECT COUNT(*) INTO _existing_count FROM api_keys WHERE user_id = _user_id;
  IF _existing_count >= 5 THEN
    RETURN jsonb_build_object('error', 'Maximum 5 API keys allowed per user');
  END IF;

  _new_key := 'bp_' || encode(gen_random_bytes(32), 'hex');

  INSERT INTO api_keys (user_id, api_key, name, is_active, wallet_discount_percent)
  VALUES (_user_id, _new_key, _key_name, true, 2.0)
  RETURNING id INTO _key_id;

  RETURN jsonb_build_object(
    'success', true,
    'api_key', _new_key,
    'key_id', _key_id,
    'name', _key_name,
    'message', 'API key created. You now get 2% off on all data plans via API.'
  );
END;
$function$;