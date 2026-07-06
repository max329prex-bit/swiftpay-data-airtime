-- BlitzPay API System Migration
  -- Tables: api_keys, api_purchases
  -- 2026-07-06

  -- ============================================================
  -- API KEYS TABLE
  -- ============================================================
  CREATE TABLE IF NOT EXISTS public.api_keys (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key_hash      TEXT NOT NULL UNIQUE,         -- hashed key for verification
    key_prefix    TEXT NOT NULL,                -- first 8 chars for display
    name          TEXT,                         -- optional label (e.g. "Production")
    is_active     BOOLEAN NOT NULL DEFAULT true,
    rate_limit    INTEGER NOT NULL DEFAULT 100, -- requests per minute
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at  TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ,
    revoked_reason TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(user_id);
  CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);
  CREATE INDEX IF NOT EXISTS idx_api_keys_active ON public.api_keys(is_active) WHERE is_active = true;

  -- RLS: users can only see their own keys
  ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can view own api_keys"
    ON public.api_keys FOR SELECT
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can insert own api_keys"
    ON public.api_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Users can update own api_keys"
    ON public.api_keys FOR UPDATE
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can delete own api_keys"
    ON public.api_keys FOR DELETE
    USING (auth.uid() = user_id);

  -- ============================================================
  -- API PURCHASES TABLE
  -- ============================================================
  CREATE TABLE IF NOT EXISTS public.api_purchases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id      UUID NOT NULL REFERENCES public.api_keys(id),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type            public.tx_type NOT NULL,   -- reuses existing enum
    network         TEXT NOT NULL,
    phone           TEXT NOT NULL,
    amount          NUMERIC NOT NULL,
    package_id      UUID REFERENCES public.packages(id),
    status          TEXT NOT NULL DEFAULT 'pending',
    reference       TEXT NOT NULL UNIQUE,
    provider_reference TEXT,
    provider_code   TEXT,
    meta            JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ
  );

  CREATE INDEX IF NOT EXISTS idx_api_purchases_key ON public.api_purchases(api_key_id);
  CREATE INDEX IF NOT EXISTS idx_api_purchases_user ON public.api_purchases(user_id);
  CREATE INDEX IF NOT EXISTS idx_api_purchases_ref ON public.api_purchases(reference);
  CREATE INDEX IF NOT EXISTS idx_api_purchases_status ON public.api_purchases(status);
  CREATE INDEX IF NOT EXISTS idx_api_purchases_created ON public.api_purchases(created_at DESC);

  ALTER TABLE public.api_purchases ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can view own api_purchases"
    ON public.api_purchases FOR SELECT
    USING (auth.uid() = user_id);

  -- ============================================================
  -- FUNCTIONS
  -- ============================================================

  -- Generate a new API key (requires ₦5,000 wallet balance)
  CREATE OR REPLACE FUNCTION public.generate_api_key(
    _name TEXT DEFAULT 'Default'
  )
  RETURNS TABLE (
    key_id UUID,
    key_prefix TEXT,
    full_key TEXT,  -- returned ONCE, never stored in plain text
    name TEXT
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
    _user_id UUID;
    _wallet_bal NUMERIC;
    _raw_key TEXT;
    _key_hash TEXT;
    _key_prefix TEXT;
    _key_id UUID;
    _MIN_BALANCE CONSTANT NUMERIC := 5000;
  BEGIN
    _user_id := auth.uid();
    IF _user_id IS NULL THEN
      RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Check wallet balance
    SELECT balance INTO _wallet_bal FROM public.wallets WHERE user_id = _user_id;
    IF COALESCE(_wallet_bal, 0) < _MIN_BALANCE THEN
      RAISE EXCEPTION 'MIN_BALANCE_REQUIRED: You need at least ₦% in your wallet to generate an API key', _MIN_BALANCE;
    END IF;

    -- Generate raw key
    _raw_key := 'bp_' || encode(gen_random_bytes(32), 'hex');
    _key_hash := digest(_raw_key, 'sha256')::text;
    _key_prefix := substring(_raw_key from 1 for 8);

    -- Insert
    INSERT INTO public.api_keys (user_id, key_hash, key_prefix, name)
    VALUES (_user_id, _key_hash, _key_prefix, _name)
    RETURNING id INTO _key_id;

    RETURN QUERY SELECT _key_id, _key_prefix, _raw_key, _name;
  END $$;

  -- Verify an API key and return user_id
  CREATE OR REPLACE FUNCTION public.verify_api_key(_api_key TEXT)
  RETURNS TABLE (
    user_id UUID,
    key_id UUID,
    is_active BOOLEAN,
    rate_limit INTEGER
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
    _hash TEXT;
  BEGIN
    _hash := digest(_api_key, 'sha256')::text;
    RETURN QUERY
    SELECT ak.user_id, ak.id, ak.is_active, ak.rate_limit
    FROM public.api_keys ak
    WHERE ak.key_hash = _hash AND ak.is_active = true
      AND (ak.revoked_at IS NULL OR ak.revoked_at > now());
  END $$;

  -- Record API purchase
  CREATE OR REPLACE FUNCTION public.api_purchase_data(
    _api_key TEXT,
    _network TEXT,
    _phone TEXT,
    _package_id UUID,
    _amount NUMERIC,
    _reference TEXT DEFAULT NULL
  )
  RETURNS public.api_purchases
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
    _key_rec RECORD;
    _pkg RECORD;
    _ref TEXT;
    _purchase public.api_purchases;
  BEGIN
    -- Verify key
    SELECT * INTO _key_rec FROM public.verify_api_key(_api_key);
    IF _key_rec.user_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_API_KEY';
    END IF;

    -- Get package details
    SELECT * INTO _pkg FROM public.packages WHERE id = _package_id AND is_active = true;
    IF _pkg.id IS NULL THEN
      RAISE EXCEPTION 'INVALID_PACKAGE';
    END IF;

    _ref := COALESCE(_reference, 'API-' || extract(epoch from now())::bigint::text);

    -- Create purchase record
    INSERT INTO public.api_purchases (
      api_key_id, user_id, type, network, phone, amount, package_id,
      status, reference, provider_code, meta
    ) VALUES (
      _key_rec.key_id, _key_rec.user_id, 'data', _network, _phone, _amount, _package_id,
      'pending', _ref, _pkg.provider_code,
      jsonb_build_object('package_name', _pkg.name, 'size', _pkg.size, 'validity', _pkg.validity)
    )
    RETURNING * INTO _purchase;

    RETURN _purchase;
  END $$;

  -- List user's API keys (safe, no hashes)
  CREATE OR REPLACE FUNCTION public.list_api_keys()
  RETURNS TABLE (
    id UUID,
    key_prefix TEXT,
    name TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  BEGIN
    RETURN QUERY
    SELECT ak.id, ak.key_prefix, ak.name, ak.is_active, ak.created_at, ak.last_used_at
    FROM public.api_keys ak
    WHERE ak.user_id = auth.uid()
    ORDER BY ak.created_at DESC;
  END $$;

  -- Update last_used timestamp
  CREATE OR REPLACE FUNCTION public.update_api_key_last_used(_key_id UUID)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  BEGIN
    UPDATE public.api_keys SET last_used_at = now() WHERE id = _key_id;
  END $$;
  