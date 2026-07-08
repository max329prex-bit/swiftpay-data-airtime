
-- Add new transaction types
ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'electricity';
ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'cable';

-- Function to set transaction PIN (hashed)
CREATE OR REPLACE FUNCTION public.set_transaction_pin(_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'PIN must be 4 digits'; END IF;
  UPDATE public.profiles
    SET transaction_pin = extensions.crypt(_pin, extensions.gen_salt('bf')), updated_at = now()
    WHERE user_id = _uid;
  RETURN TRUE;
END; $$;

-- Function to check whether the user has set a PIN
CREATE OR REPLACE FUNCTION public.has_transaction_pin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT transaction_pin IS NOT NULL AND transaction_pin <> '' FROM public.profiles WHERE user_id = auth.uid()), false)
$$;

-- Function to verify a PIN
CREATE OR REPLACE FUNCTION public.verify_transaction_pin(_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE _stored TEXT;
BEGIN
  SELECT transaction_pin INTO _stored FROM public.profiles WHERE user_id = auth.uid();
  IF _stored IS NULL OR _stored = '' THEN RETURN FALSE; END IF;
  RETURN _stored = extensions.crypt(_pin, _stored);
END; $$;

-- Ensure pgcrypto is available for crypt/gen_salt
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

REVOKE EXECUTE ON FUNCTION public.set_transaction_pin(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_transaction_pin(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_transaction_pin(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_transaction_pin(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_transaction_pin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_transaction_pin() TO authenticated;
