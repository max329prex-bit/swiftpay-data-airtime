-- ============================================================
-- BlitzPay: Treasury & Float Automation System
-- ============================================================

CREATE TABLE IF NOT EXISTS public.provider_treasury (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code           TEXT NOT NULL UNIQUE,
  actual_balance          NUMERIC(14,2) NOT NULL DEFAULT 0,
  reserved_balance        NUMERIC(14,2) NOT NULL DEFAULT 0,
  refill_threshold        NUMERIC(14,2) NOT NULL DEFAULT 8000,
  refill_target           NUMERIC(14,2) NOT NULL DEFAULT 20000,
  critical_stop_threshold NUMERIC(14,2) NOT NULL DEFAULT 3000,
  transfer_health         TEXT NOT NULL DEFAULT 'healthy',
  cb_failures             INT NOT NULL DEFAULT 0,
  cb_paused_until         TIMESTAMPTZ,
  last_refill_at          TIMESTAMPTZ,
  refill_cooldown_minutes INT NOT NULL DEFAULT 30,
  daily_refill_cap        NUMERIC(14,2) NOT NULL DEFAULT 500000,
  daily_refilled_today    NUMERIC(14,2) NOT NULL DEFAULT 0,
  daily_cap_reset_at      DATE NOT NULL DEFAULT CURRENT_DATE,
  avg_spend_10min         NUMERIC(14,2) NOT NULL DEFAULT 0,
  avg_spend_1hr           NUMERIC(14,2) NOT NULL DEFAULT 0,
  last_synced_at          TIMESTAMPTZ,
  bank_account_number     TEXT,
  bank_code               TEXT,
  bank_name               TEXT,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.provider_treasury ENABLE ROW LEVEL SECURITY;

INSERT INTO public.provider_treasury (provider_code, refill_threshold, refill_target, critical_stop_threshold, bank_account_number, bank_code, bank_name)
VALUES
  ('aidapay', 8000, 20000, 3000, NULL,         NULL,     NULL),
  ('bsplug',  4000, 10000, 2000, '6587166346', '120001', '9PSB'),
  ('iacafe',  4000, 10000, 2000, NULL,         NULL,     NULL)
ON CONFLICT (provider_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.liquidity_reservations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_code TEXT NOT NULL,
  amount        NUMERIC(14,2) NOT NULL,
  tx_reference  TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '5 minutes',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.liquidity_reservations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.liquidity_reservations(status, expires_at);

CREATE TABLE IF NOT EXISTS public.treasury_ledger (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code  TEXT NOT NULL,
  direction      TEXT NOT NULL,
  amount         NUMERIC(14,2) NOT NULL,
  reference      TEXT,
  balance_before NUMERIC(14,2),
  balance_after  NUMERIC(14,2),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.treasury_ledger ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.treasury_transfers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code     TEXT NOT NULL,
  amount            NUMERIC(14,2) NOT NULL,
  korapay_reference TEXT UNIQUE,
  bank_code         TEXT,
  account_number    TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',
  balance_before    NUMERIC(14,2),
  balance_after     NUMERIC(14,2),
  retries           INT NOT NULL DEFAULT 0,
  last_checked_at   TIMESTAMPTZ,
  initiated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at      TIMESTAMPTZ,
  failure_reason    TEXT
);
ALTER TABLE public.treasury_transfers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_treasury_transfers_status ON public.treasury_transfers(status, initiated_at);

CREATE TABLE IF NOT EXISTS public.app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_settings (key, value) VALUES
  ('treasury_automation_enabled', 'true'::jsonb),
  ('max_single_refill_ngn',       '50000'::jsonb),
  ('max_daily_refill_ngn',        '200000'::jsonb),
  ('korapay_fee_per_disburse',    '53.75'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- DB functions
CREATE OR REPLACE FUNCTION public.reserve_provider_liquidity(
  _provider TEXT, _amount NUMERIC, _uid UUID, _tx_ref TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pt public.provider_treasury; _usable NUMERIC; _rid UUID;
BEGIN
  SELECT * INTO _pt FROM public.provider_treasury WHERE provider_code = _provider FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown provider: %', _provider; END IF;
  IF _pt.transfer_health = 'paused' THEN RAISE EXCEPTION 'Provider % paused', _provider; END IF;
  UPDATE public.liquidity_reservations SET status = 'expired'
    WHERE provider_code = _provider AND status = 'pending' AND expires_at < now();
  SELECT _pt.actual_balance - COALESCE(SUM(r.amount), 0)
    INTO _usable FROM public.liquidity_reservations r
    WHERE r.provider_code = _provider AND r.status = 'pending';
  IF _usable < _amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_LIQUIDITY: usable=% needed=%', _usable, _amount;
  END IF;
  INSERT INTO public.liquidity_reservations (user_id, provider_code, amount, tx_reference)
  VALUES (_uid, _provider, _amount, _tx_ref) RETURNING id INTO _rid;
  RETURN _rid;
END; $$;

CREATE OR REPLACE FUNCTION public.release_provider_liquidity(
  _reservation_id UUID, _outcome TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.liquidity_reservations;
BEGIN
  SELECT * INTO _r FROM public.liquidity_reservations WHERE id = _reservation_id;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.liquidity_reservations SET status = _outcome WHERE id = _reservation_id;
  IF _outcome = 'used' THEN
    UPDATE public.provider_treasury SET actual_balance = actual_balance - _r.amount, updated_at = now()
      WHERE provider_code = _r.provider_code;
    INSERT INTO public.treasury_ledger (provider_code, direction, amount, reference, notes)
    VALUES (_r.provider_code, 'out', _r.amount, _r.tx_reference, 'VTU purchase');
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.record_treasury_transfer(
  _provider TEXT, _amount NUMERIC, _kp_ref TEXT, _bank_code TEXT, _account TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bal NUMERIC; _tid UUID;
BEGIN
  SELECT actual_balance INTO _bal FROM public.provider_treasury WHERE provider_code = _provider;
  INSERT INTO public.treasury_transfers (provider_code, amount, korapay_reference, bank_code, account_number, balance_before, status)
  VALUES (_provider, _amount, _kp_ref, _bank_code, _account, _bal, 'pending') RETURNING id INTO _tid;
  INSERT INTO public.treasury_ledger (provider_code, direction, amount, reference, balance_before, notes)
  VALUES (_provider, 'in_pending', _amount, _kp_ref, _bal, 'Auto-refill initiated');
  RETURN _tid;
END; $$;

CREATE OR REPLACE FUNCTION public.confirm_treasury_transfer(_transfer_id UUID, _new_balance NUMERIC)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t public.treasury_transfers;
BEGIN
  SELECT * INTO _t FROM public.treasury_transfers WHERE id = _transfer_id;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.treasury_transfers SET status = 'confirmed', confirmed_at = now(), balance_after = _new_balance
    WHERE id = _transfer_id;
  UPDATE public.provider_treasury
    SET actual_balance = _new_balance, transfer_health = 'healthy', cb_failures = 0, last_synced_at = now(), updated_at = now()
    WHERE provider_code = _t.provider_code;
  INSERT INTO public.treasury_ledger (provider_code, direction, amount, reference, balance_before, balance_after, notes)
  VALUES (_t.provider_code, 'in', _t.amount, _t.korapay_reference, _t.balance_before, _new_balance, 'Refill confirmed');
END; $$;

REVOKE EXECUTE ON FUNCTION public.reserve_provider_liquidity(TEXT, NUMERIC, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_provider_liquidity(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_treasury_transfer(TEXT, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_treasury_transfer(UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
