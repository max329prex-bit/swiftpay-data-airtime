
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purchase_vtu(tx_type, text, text, numeric, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.topup_wallet(numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_vtu(tx_type, text, text, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.topup_wallet(numeric, text) TO authenticated;
