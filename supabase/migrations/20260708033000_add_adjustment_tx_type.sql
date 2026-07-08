-- Add a dedicated adjustment transaction type so one-off balance corrections
-- do not pollute funding/spending reconciliation calculations.

ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'adjustment';

-- Retag the balance-correction transactions created by the previous migration.
UPDATE public.transactions
SET type = 'adjustment'
WHERE reference LIKE 'ADJ-%-20260708032000';
