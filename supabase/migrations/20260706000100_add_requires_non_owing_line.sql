-- Add explicit flag so the UI and edge function can agree on which plans require a non-owing line.
ALTER TABLE public.packages
ADD COLUMN IF NOT EXISTS requires_non_owing_line boolean NOT NULL DEFAULT false;

-- Backfill based on existing plan naming conventions.
-- Non-owing plans = gifting / awoof / gift bundles (require a clean line).
-- Owing plans = SME / regular bundles (work even if the line is owing).
UPDATE public.packages
SET requires_non_owing_line = true
WHERE provider_code = 'gsubz'
  AND (
    lower(package_code) LIKE '%awoof%'
    OR lower(package_code) LIKE '%gifting%'
    OR lower(package_code) LIKE '%gift%'
  );

-- IA Cafe budget-data plans are non-owing; they convert to airtime if the line is owing.
UPDATE public.packages
SET requires_non_owing_line = true
WHERE provider_code = 'iacafe';

-- BSPlug plans are currently treated as owing-safe by default.
-- If a specific BSPlug plan is non-owing, set the flag manually or update the sync logic.

-- Ensure the new column is visible in the public API (PostgREST/Supabase client).
COMMENT ON COLUMN public.packages.requires_non_owing_line IS 'true = plan requires a non-owing line; false = works for owing lines too';
