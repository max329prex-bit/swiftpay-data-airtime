-- Admin user listing function
-- Creates a secure RPC that admins can call to list all registered users

-- First, ensure email column exists on profiles (for fallback)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill existing profiles with email from auth.users
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.user_id = au.id AND p.email IS NULL;

-- Sync email on new profiles via trigger
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT email INTO NEW.email
  FROM auth.users
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_email ON public.profiles;
CREATE TRIGGER trg_sync_profile_email
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- Also update email on auth.user update
CREATE OR REPLACE FUNCTION public.sync_profile_email_update()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email
  WHERE user_id = NEW.id AND (email IS NULL OR email != NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_email_update ON auth.users;
CREATE TRIGGER trg_sync_profile_email_update
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email_update();

-- Admin RPC to list all users with wallet/role data
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  role TEXT,
  balance NUMERIC,
  created_at TIMESTAMPTZ,
  wallet_funded BOOLEAN,
  tx_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    au.id,
    COALESCE(p.email, au.email) AS email,
    p.full_name,
    p.phone,
    COALESCE(ur.role::TEXT, 'user') AS role,
    COALESCE(w.balance, 0) AS balance,
    p.created_at,
    COALESCE(w.balance, 0) > 0 AS wallet_funded,
    (SELECT COUNT(*) FROM public.transactions t WHERE t.user_id = au.id)::BIGINT AS tx_count
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.user_id = au.id
  LEFT JOIN public.user_roles ur ON ur.user_id = au.id
  LEFT JOIN public.wallets w ON w.user_id = au.id
  ORDER BY p.created_at DESC;
END;
$$;
