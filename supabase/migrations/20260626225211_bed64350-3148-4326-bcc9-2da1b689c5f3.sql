-- BlitzData Scheduler: reserved-balance + schedules tables + RPCs

-- 1) wallets: reserved_balance column
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS reserved_balance numeric NOT NULL DEFAULT 0
    CHECK (reserved_balance >= 0);

-- 2) Enums
DO $$ BEGIN
  CREATE TYPE public.schedule_frequency AS ENUM
    ('once','daily','weekly','monthly','every_n_days','until_cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.schedule_status AS ENUM
    ('active','paused','cancelled','completed','failed','needs_funding');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) scheduled_purchases
CREATE TABLE IF NOT EXISTS public.scheduled_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type public.tx_type NOT NULL DEFAULT 'data',
  network text NOT NULL,
  phone text NOT NULL,
  recipient_label text,
  package_code text,
  provider_code text,
  bundle_size text,
  amount numeric NOT NULL CHECK (amount > 0),
  bp_value integer DEFAULT 0,
  frequency public.schedule_frequency NOT NULL DEFAULT 'once',
  interval_days integer,
  next_run_at timestamptz NOT NULL,
  last_run_at timestamptz,
  end_at timestamptz,
  status public.schedule_status NOT NULL DEFAULT 'active',
  reserved_amount numeric NOT NULL DEFAULT 0 CHECK (reserved_amount >= 0),
  retry_count integer NOT NULL DEFAULT 0,
  last_error text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scheduled_purchases_user_idx ON public.scheduled_purchases(user_id);
CREATE INDEX IF NOT EXISTS scheduled_purchases_runner_idx
  ON public.scheduled_purchases(next_run_at) WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_purchases TO authenticated;
GRANT ALL ON public.scheduled_purchases TO service_role;
ALTER TABLE public.scheduled_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own schedules select" ON public.scheduled_purchases FOR SELECT
  TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own schedules update" ON public.scheduled_purchases FOR UPDATE
  TO authenticated USING (user_id = auth.uid());

-- 4) scheduled_runs (history)
CREATE TABLE IF NOT EXISTS public.scheduled_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.scheduled_purchases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  attempt_no integer NOT NULL DEFAULT 1,
  tx_id uuid,
  error text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS scheduled_runs_schedule_idx ON public.scheduled_runs(schedule_id);

GRANT SELECT ON public.scheduled_runs TO authenticated;
GRANT ALL ON public.scheduled_runs TO service_role;
ALTER TABLE public.scheduled_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own runs select" ON public.scheduled_runs FOR SELECT
  TO authenticated USING (user_id = auth.uid());

-- 5) Helper: compute next_run_at
CREATE OR REPLACE FUNCTION public.compute_next_run(
  _freq public.schedule_frequency, _from timestamptz, _interval_days integer
) RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _freq
    WHEN 'daily' THEN _from + interval '1 day'
    WHEN 'weekly' THEN _from + interval '7 days'
    WHEN 'monthly' THEN _from + interval '1 month'
    WHEN 'every_n_days' THEN _from + (COALESCE(_interval_days,7) || ' days')::interval
    WHEN 'until_cancelled' THEN _from + (COALESCE(_interval_days,30) || ' days')::interval
    ELSE NULL
  END
$$;

-- 6) create_schedule — verifies PIN, reserves funds, creates schedule
CREATE OR REPLACE FUNCTION public.create_schedule(
  _type public.tx_type, _network text, _phone text, _amount numeric,
  _package_code text, _provider_code text, _bundle_size text, _bp_value integer,
  _frequency public.schedule_frequency, _interval_days integer,
  _first_run_at timestamptz, _recipient_label text, _pin text, _meta jsonb DEFAULT '{}'::jsonb
) RETURNS public.scheduled_purchases
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _uid uuid := auth.uid(); _bal numeric; _res numeric; _avail numeric;
        _count int; _sched public.scheduled_purchases;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.verify_transaction_pin(_pin) THEN RAISE EXCEPTION 'Invalid PIN'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF _first_run_at < now() + interval '10 minutes' THEN
    RAISE EXCEPTION 'Schedule must be at least 10 minutes in the future';
  END IF;
  SELECT COUNT(*) INTO _count FROM public.scheduled_purchases
    WHERE user_id = _uid AND status IN ('active','paused','needs_funding');
  IF _count >= 20 THEN RAISE EXCEPTION 'Max 20 active schedules per user'; END IF;

  SELECT balance, reserved_balance INTO _bal, _res
    FROM public.wallets WHERE user_id = _uid FOR UPDATE;
  IF _bal IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  _avail := _bal - _res;
  IF _avail < _amount THEN
    RAISE EXCEPTION 'Insufficient available balance (have %, need %)', _avail, _amount;
  END IF;

  UPDATE public.wallets SET reserved_balance = reserved_balance + _amount,
    updated_at = now() WHERE user_id = _uid;

  INSERT INTO public.scheduled_purchases(
    user_id, type, network, phone, recipient_label, package_code, provider_code,
    bundle_size, amount, bp_value, frequency, interval_days, next_run_at,
    reserved_amount, meta
  ) VALUES (
    _uid, _type, _network, _phone, _recipient_label, _package_code, _provider_code,
    _bundle_size, _amount, COALESCE(_bp_value,0), _frequency, _interval_days,
    _first_run_at, _amount, COALESCE(_meta,'{}'::jsonb)
  ) RETURNING * INTO _sched;
  RETURN _sched;
END $$;

-- 7) cancel_schedule — release reservation
CREATE OR REPLACE FUNCTION public.cancel_schedule(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _s public.scheduled_purchases;
BEGIN
  SELECT * INTO _s FROM public.scheduled_purchases
    WHERE id = _id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Schedule not found'; END IF;
  IF _s.status = 'cancelled' THEN RETURN; END IF;
  IF _s.reserved_amount > 0 THEN
    UPDATE public.wallets SET reserved_balance = GREATEST(0, reserved_balance - _s.reserved_amount),
      updated_at = now() WHERE user_id = _uid;
  END IF;
  UPDATE public.scheduled_purchases SET status='cancelled', reserved_amount=0, updated_at=now()
    WHERE id = _id;
END $$;

-- 8) pause / resume (keep reservation)
CREATE OR REPLACE FUNCTION public.pause_schedule(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.scheduled_purchases SET status='paused', updated_at=now()
    WHERE id=_id AND user_id=auth.uid() AND status IN ('active','needs_funding');
END $$;

CREATE OR REPLACE FUNCTION public.resume_schedule(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.scheduled_purchases;
BEGIN
  SELECT * INTO _s FROM public.scheduled_purchases
    WHERE id=_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR _s.status <> 'paused' THEN RETURN; END IF;
  -- If next_run is in the past, push to now+15min
  UPDATE public.scheduled_purchases
    SET status='active',
        next_run_at = GREATEST(next_run_at, now() + interval '15 minutes'),
        updated_at = now()
    WHERE id = _id;
END $$;

-- 9) Runner-callable: pick due schedules (service role)
CREATE OR REPLACE FUNCTION public.fetch_due_schedules(_limit int DEFAULT 25)
RETURNS SETOF public.scheduled_purchases
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.scheduled_purchases
   WHERE status = 'active' AND next_run_at <= now()
   ORDER BY next_run_at ASC
   LIMIT _limit
$$;
REVOKE ALL ON FUNCTION public.fetch_due_schedules(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_due_schedules(int) TO service_role;

-- 10) Consume reservation for a run (service role) — creates a 'pending' tx and decrements wallet
CREATE OR REPLACE FUNCTION public.consume_schedule_reservation(_schedule_id uuid, _aidapay_hash text)
RETURNS public.transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.scheduled_purchases; _tx public.transactions; _ref text;
BEGIN
  SELECT * INTO _s FROM public.scheduled_purchases WHERE id=_schedule_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Schedule not found'; END IF;
  -- Move reserved → spent
  UPDATE public.wallets
     SET balance = balance - _s.reserved_amount,
         reserved_balance = GREATEST(0, reserved_balance - _s.reserved_amount),
         updated_at = now()
   WHERE user_id = _s.user_id;
  _ref := 'SCH-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  INSERT INTO public.transactions(user_id, type, network, phone, amount, status, reference, aidapay_hash, meta)
  VALUES (_s.user_id, _s.type, _s.network, _s.phone, _s.amount, 'pending', _ref, _aidapay_hash,
    jsonb_build_object('schedule_id', _s.id, 'bundle', _s.bundle_size))
  RETURNING * INTO _tx;
  UPDATE public.scheduled_purchases
     SET reserved_amount = 0, last_run_at = now(), updated_at = now()
   WHERE id = _schedule_id;
  RETURN _tx;
END $$;
REVOKE ALL ON FUNCTION public.consume_schedule_reservation(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_schedule_reservation(uuid, text) TO service_role;

-- 11) Advance schedule after success (service role)
CREATE OR REPLACE FUNCTION public.advance_schedule_after_success(_schedule_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.scheduled_purchases; _next timestamptz; _bal numeric; _res numeric;
BEGIN
  SELECT * INTO _s FROM public.scheduled_purchases WHERE id=_schedule_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  _next := public.compute_next_run(_s.frequency, _s.last_run_at, _s.interval_days);
  IF _next IS NULL OR (_s.end_at IS NOT NULL AND _next > _s.end_at) THEN
    UPDATE public.scheduled_purchases SET status='completed', retry_count=0, last_error=NULL, updated_at=now()
      WHERE id=_schedule_id;
    RETURN;
  END IF;
  -- Try to reserve next cycle immediately
  SELECT balance, reserved_balance INTO _bal, _res FROM public.wallets
    WHERE user_id = _s.user_id FOR UPDATE;
  IF (_bal - _res) >= _s.amount THEN
    UPDATE public.wallets SET reserved_balance = reserved_balance + _s.amount, updated_at=now()
      WHERE user_id = _s.user_id;
    UPDATE public.scheduled_purchases
       SET status='active', next_run_at=_next, reserved_amount=_s.amount,
           retry_count=0, last_error=NULL, updated_at=now()
     WHERE id=_schedule_id;
  ELSE
    UPDATE public.scheduled_purchases
       SET status='needs_funding', next_run_at=_next, reserved_amount=0,
           last_error='Insufficient balance to reserve next cycle', updated_at=now()
     WHERE id=_schedule_id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.advance_schedule_after_success(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_schedule_after_success(uuid) TO service_role;

-- 12) Failure / retry (service role) — Smart Retry ladder: 10m, 1h, 6h
CREATE OR REPLACE FUNCTION public.handle_schedule_failure(_schedule_id uuid, _err text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.scheduled_purchases; _delay interval;
BEGIN
  SELECT * INTO _s FROM public.scheduled_purchases WHERE id=_schedule_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF _s.retry_count >= 3 THEN
    -- Refund reservation back to wallet, mark failed
    IF _s.reserved_amount > 0 THEN
      UPDATE public.wallets SET reserved_balance = GREATEST(0, reserved_balance - _s.reserved_amount),
        updated_at=now() WHERE user_id=_s.user_id;
    END IF;
    UPDATE public.scheduled_purchases
       SET status='failed', reserved_amount=0, last_error=_err, updated_at=now()
     WHERE id=_schedule_id;
    RETURN;
  END IF;
  _delay := CASE _s.retry_count WHEN 0 THEN interval '10 minutes'
                                WHEN 1 THEN interval '1 hour'
                                ELSE interval '6 hours' END;
  UPDATE public.scheduled_purchases
     SET retry_count = retry_count + 1,
         next_run_at = now() + _delay,
         last_error  = _err,
         updated_at  = now()
   WHERE id=_schedule_id;
END $$;
REVOKE ALL ON FUNCTION public.handle_schedule_failure(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_schedule_failure(uuid, text) TO service_role;

-- 13) updated_at trigger
DROP TRIGGER IF EXISTS scheduled_purchases_updated ON public.scheduled_purchases;
CREATE TRIGGER scheduled_purchases_updated BEFORE UPDATE ON public.scheduled_purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 14) Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_purchases;