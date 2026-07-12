-- Ensure api_purchases table exists and has all columns needed for API logging
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

-- Add any missing columns for older tables
ALTER TABLE public.api_purchases ADD COLUMN IF NOT EXISTS type public.tx_type;
ALTER TABLE public.api_purchases ADD COLUMN IF NOT EXISTS provider_reference TEXT;
ALTER TABLE public.api_purchases ADD COLUMN IF NOT EXISTS provider_code TEXT;
ALTER TABLE public.api_purchases ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}';
ALTER TABLE public.api_purchases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.api_purchases ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
