-- ============================================================
-- BlitzPay: Provider Margin Report — cost_price on packages
-- Applied: 2026-06-11
-- ============================================================

-- 1. Add cost_price column to packages (what we pay the provider per plan)
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) DEFAULT NULL;

COMMENT ON COLUMN public.packages.cost_price IS
  'What BlitzPay pays the provider for this plan. NULL = not set yet. Margin = price - cost_price.';

-- 2. Admin UPDATE policy on packages so the margin report page can save cost prices
DO $$ BEGIN
  -- Drop if exists (idempotent)
  DROP POLICY IF EXISTS "Admin can update packages" ON public.packages;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY "Admin can update packages"
  ON public.packages FOR UPDATE
  TO authenticated
  USING  (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
