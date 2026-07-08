-- Remove balances that were not earned through recorded transactions.
-- User 4f1a0e8c...: ₦10,000 balance with zero transaction history.
-- User 46a92839...: ₦500 balance with zero transaction history.
-- User 8ce97dda...: ₦885.50 balance from fake/test deposits the user never made.
-- Small underpaid balances (10815768, 132674cc) are intentionally left for
-- manual verification before any credit is applied.

DO $$
DECLARE
  users UUID[] := ARRAY[
    '4f1a0e8c-5361-4a1a-9bb1-6684a1217bf0',
    '46a92839-2e4d-428f-a47b-b88c7c9b4b95',
    '8ce97dda-3731-47fc-b699-eada4efdd117'
  ];
  uid UUID;
  bal NUMERIC;
  ts TEXT := '20260708032000';
BEGIN
  FOREACH uid IN ARRAY users
  LOOP
    SELECT balance INTO bal FROM public.wallets WHERE user_id = uid;
    IF bal IS NULL OR bal = 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.transactions (
      user_id, type, amount, reference, status, meta
    ) VALUES (
      uid,
      'adjustment',
      -bal,
      'ADJ-' || uid::text || '-' || ts,
      'success',
      jsonb_build_object(
        'reason', 'remove_unearned_balance',
        'previous_balance', bal,
        'expected_balance', 0,
        'reconciled_at', now()
      )
    )
    ON CONFLICT (reference) DO NOTHING;

    UPDATE public.wallets
    SET balance = 0, updated_at = now()
    WHERE user_id = uid;
  END LOOP;
END $$;
