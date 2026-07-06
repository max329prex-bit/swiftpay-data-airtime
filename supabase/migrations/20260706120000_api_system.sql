CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    rate_limit INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(user_id);
  CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);
  CREATE INDEX IF NOT EXISTS idx_api_keys_active ON public.api_keys(is_active) WHERE is_active = true;

  CREATE TABLE IF NOT EXISTS public.api_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES public.api_keys(id),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type public.tx_type NOT NULL,
    network TEXT NOT NULL,
    phone TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    package_id UUID REFERENCES public.packages(id),
    status TEXT NOT NULL DEFAULT 'pending',
    reference TEXT NOT NULL UNIQUE,
    provider_reference TEXT,
    provider_code TEXT,
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_api_purchases_key ON public.api_purchases(api_key_id);
  CREATE INDEX IF NOT EXISTS idx_api_purchases_user ON public.api_purchases(user_id);
  CREATE INDEX IF NOT EXISTS idx_api_purchases_ref ON public.api_purchases(reference);

  ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users view own keys" ON public.api_keys FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Users insert own keys" ON public.api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "Users update own keys" ON public.api_keys FOR UPDATE USING (auth.uid() = user_id);

  ALTER TABLE public.api_purchases ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users view own purchases" ON public.api_purchases FOR SELECT USING (auth.uid() = user_id);

  CREATE OR REPLACE FUNCTION public.generate_api_key(_name TEXT DEFAULT 'Default')
  RETURNS TABLE (key_id UUID, key_prefix TEXT, full_key TEXT, name TEXT)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user_id UUID := auth.uid();
  _wallet_bal NUMERIC;
  _raw_key TEXT;
  _hash TEXT;
  _prefix TEXT;
  _id UUID;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT balance INTO _wallet_bal FROM public.wallets WHERE user_id = _user_id;
  IF COALESCE(_wallet_bal, 0) < 5000 THEN
    RAISE EXCEPTION 'MIN_BALANCE_REQUIRED: Need at least N5000'; END IF;
  _raw_key := 'bp_' || encode(gen_random_bytes(32), 'hex');
  _hash := digest(_raw_key, 'sha256')::text;
  _prefix := substring(_raw_key from 1 for 8);
  INSERT INTO public.api_keys (user_id, key_hash, key_prefix, name) VALUES (_user_id, _hash, _prefix, _name) RETURNING id INTO _id;
  RETURN QUERY SELECT _id, _prefix, _raw_key, _name;
END $$;

CREATE OR REPLACE FUNCTION public.verify_api_key(_api_key TEXT)
RETURNS TABLE (user_id UUID, key_id UUID, is_active BOOLEAN, rate_limit INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _hash TEXT := digest(_api_key, 'sha256')::text;
BEGIN
  RETURN QUERY
  SELECT ak.user_id, ak.id, ak.is_active, ak.rate_limit
  FROM public.api_keys ak WHERE ak.key_hash = _hash AND ak.is_active = true AND ak.revoked_at IS NULL;
END $$;

CREATE OR REPLACE FUNCTION public.update_api_key_last_used(_key_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.api_keys SET last_used_at = now() WHERE id = _key_id;
END $$;

CREATE OR REPLACE FUNCTION public.list_api_keys()
RETURNS TABLE (id UUID, key_prefix TEXT, name TEXT, is_active BOOLEAN, created_at TIMESTAMPTZ, last_used_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT ak.id, ak.key_prefix, ak.name, ak.is_active, ak.created_at, ak.last_used_at
  FROM public.api_keys ak WHERE ak.user_id = auth.uid() ORDER BY ak.created_at DESC;
END $$;