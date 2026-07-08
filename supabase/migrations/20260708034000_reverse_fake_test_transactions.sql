-- Reverse the fake/test deposits and purchase on the 8ce97dda account so the
-- transaction history no longer claims an expected balance of ₦1,870.50.
-- The wallet balance itself is already 0 after the previous adjustment; this
-- just cleans up the records that were inflating the reconciliation formula.

UPDATE public.transactions
SET
  status = 'reversed',
  meta = meta || jsonb_build_object(
    'reversed_reason', 'fake/test transaction on account that never deposited',
    'reversed_at', now()
  ),
  updated_at = now()
WHERE user_id = '8ce97dda-3731-47fc-b699-eada4efdd117'
  AND type IN ('wallet_fund', 'airtime', 'data', 'cable', 'electricity')
  AND status = 'success';
