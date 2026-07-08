-- ============================================================
-- BlitzPay: KYC columns + Dynamic accounts table + tracking_reference fix
-- Applied: 2026-06-10
-- ============================================================

-- 1. Add tracking_reference to payvessel_virtual_accounts
--    (was stored as pv_reference but code expects tracking_reference)
ALTER TABLE public.payvessel_virtual_accounts
  ADD COLUMN IF NOT EXISTS tracking_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_pv_va_tracking_ref
  ON public.payvessel_virtual_accounts(tracking_reference);

-- 2. Create payvessel_dynamic_requests table
--    (referenced in webhook + topup but was never migrated)
CREATE TABLE IF NOT EXISTS public.payvessel_dynamic_requests (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracking_reference TEXT        NOT NULL,
  account_number     TEXT,
  account_name       TEXT,
  bank_name          TEXT,
  expires_at         TIMESTAMPTZ,
  is_used            BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payvessel_dynamic_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own dynamic requests"
  ON public.payvessel_dynamic_requests FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Service role manages dynamic requests"
  ON public.payvessel_dynamic_requests FOR ALL
  TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_pv_dyn_tracking_ref
  ON public.payvessel_dynamic_requests(tracking_reference);
CREATE INDEX IF NOT EXISTS idx_pv_dyn_user_id
  ON public.payvessel_dynamic_requests(user_id);

-- 3. Add NIN / BVN / KYC status to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nin        TEXT,
  ADD COLUMN IF NOT EXISTS bvn        TEXT,
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'none';
-- kyc_status values: 'none' | 'submitted' | 'verified'
-- NIN/BVN are write-once from the user side; admin can unlock via service_role.
COMMENT ON COLUMN public.profiles.kyc_status IS
  'none = no KYC, submitted = NIN/BVN saved (pending Payvessel upgrade), verified = Payvessel confirmed identity';
