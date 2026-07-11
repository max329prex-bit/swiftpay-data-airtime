-- Backfill BlitzPoints values to the new rate: 1 BP per ₦250 spent.
-- The sync-packages edge function already writes this formula on future syncs,
-- but existing rows need to be updated so users see the correct claim amount immediately.

UPDATE public.packages
SET bp_value = GREATEST(1, FLOOR(sell_price / 250))
WHERE sell_price > 0;
