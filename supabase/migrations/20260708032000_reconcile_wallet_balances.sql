-- One-time reconciliation: correct wallet balances to match the sum of
-- successful wallet_fund / wallet_topup transactions minus successful
-- airtime/data/cable/electricity purchases.
-- Created after fixing Free Transfer duplicate-amount and shared-session bugs.

DO $$
DECLARE
  rec RECORD;
  ts TEXT := '20260708032000';
BEGIN
  FOR rec IN
    SELECT
      w.user_id,
      w.balance,
      COALESCE(SUM(CASE WHEN t.status = 'success' AND t.type IN ('wallet_fund', 'wallet_topup') THEN t.amount ELSE 0 END), 0) AS total_funded,
      COALESCE(SUM(CASE WHEN t.status = 'success' AND t.type IN ('airtime', 'data', 'cable', 'electricity') THEN t.amount ELSE 0 END), 0) AS total_spent,
      (COALESCE(SUM(CASE WHEN t.status = 'success' AND t.type IN ('wallet_fund', 'wallet_topup') THEN t.amount ELSE 0 END), 0) -
       COALESCE(SUM(CASE WHEN t.status = 'success' AND t.type IN ('airtime', 'data', 'cable', 'electricity') THEN t.amount ELSE 0 END), 0)) AS expected_balance,
      (w.balance -
       (COALESCE(SUM(CASE WHEN t.status = 'success' AND t.type IN ('wallet_fund', 'wallet_topup') THEN t.amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.status = 'success' AND t.type IN ('airtime', 'data', 'cable', 'electricity') THEN t.amount ELSE 0 END), 0))) AS adjustment
    FROM wallets w
    LEFT JOIN transactions t ON t.user_id = w.user_id
    GROUP BY w.user_id, w.balance
    HAVING w.balance != (
      COALESCE(SUM(CASE WHEN t.status = 'success' AND t.type IN ('wallet_fund', 'wallet_topup') THEN t.amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN t.status = 'success' AND t.type IN ('airtime', 'data', 'cable', 'electricity') THEN t.amount ELSE 0 END), 0)
    )
  LOOP
    IF rec.adjustment = 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO transactions (user_id, type, amount, reference, status, meta)
    VALUES (
      rec.user_id,
      'wallet_fund',
      rec.adjustment,
      'ADJ-' || rec.user_id::text || '-' || ts,
      'success',
      jsonb_build_object(
        'reason', 'wallet_reconciliation',
        'previous_balance', rec.balance,
        'expected_balance', rec.expected_balance,
        'adjustment', rec.adjustment,
        'total_funded', rec.total_funded,
        'total_spent', rec.total_spent,
        'reconciled_at', now()
      )
    )
    ON CONFLICT (reference) DO NOTHING;

    UPDATE wallets
    SET balance = rec.expected_balance,
        updated_at = now()
    WHERE user_id = rec.user_id;
  END LOOP;
END $$;
