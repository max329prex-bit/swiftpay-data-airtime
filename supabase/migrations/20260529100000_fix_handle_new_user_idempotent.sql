-- ============================================================
-- BlitzPay: Fix handle_new_user trigger — make idempotent
-- Prevents duplicate wallets/profiles if trigger fires twice
-- (can happen with OAuth identity linking edge cases, or re-signup)
-- Applied: 2026-05-29
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- ON CONFLICT DO NOTHING ensures safe re-runs (no duplicate wallets/profiles)
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
