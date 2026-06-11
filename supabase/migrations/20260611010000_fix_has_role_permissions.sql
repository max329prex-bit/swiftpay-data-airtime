-- ============================================================
-- BlitzPay: Fix has_role permission denied for anon role
-- Root cause: packages table SELECT RLS policy calls has_role()
-- which anon PostgreSQL role didn't have EXECUTE permission on.
-- This broke get-packages endpoint → all plans showed as unavailable.
-- Applied: 2026-06-11
-- ============================================================

-- Grant EXECUTE on has_role to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.has_role(app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Also grant read access to user_roles table so has_role can check roles
-- (needed when has_role evaluates in RLS context under anon role)
GRANT SELECT ON public.user_roles TO anon;
GRANT SELECT ON public.user_roles TO authenticated;
