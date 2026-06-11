-- ============================================================
-- BlitzPay: Add cost_price column to packages for margin tracking
-- Applied: 2026-06-11
-- ============================================================

-- cost_price = what the platform pays the VTU provider per transaction.
-- Margin per sale = price - cost_price
-- Admin fills this via the ProviderMarginReport UI.
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.packages.cost_price IS
  'Provider wholesale cost in naira. Margin = price - cost_price. Updated via admin margin report UI.';
