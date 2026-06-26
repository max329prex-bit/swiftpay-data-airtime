# BlitzData Scheduler — Build Plan

Going with **Option 2 (Reserved Balance)** as recommended. Wallet shows main + reserved + available. Cron drains the reservation on the scheduled date by calling the existing `vtu-purchase` path.

## Phase 1 — Core (launch)

**Database**
- `wallets`: add `reserved_balance numeric default 0`. Available = `balance − reserved_balance`. (Refund balance untouched.)
- New table `scheduled_purchases`:
  - `id, user_id, type (data/airtime), network, phone, package_code, provider_code, amount, bp_value`
  - `frequency` enum: `once | daily | weekly | monthly | every_n_days | until_cancelled`
  - `interval_days int null`, `next_run_at timestamptz`, `last_run_at`, `end_at null`
  - `status` enum: `active | paused | cancelled | completed | failed`
  - `reserved_amount numeric` (funds currently held for the *next* run)
  - `recipient_label text` (e.g. "Dad's MTN" — supports Family & Friends)
  - `retry_count int`, `last_error text`, `meta jsonb`, timestamps
- New table `scheduled_runs` (history): `id, schedule_id, ran_at, status, tx_id, error, attempt_no`
- RPCs (SECURITY DEFINER, search_path=public):
  - `create_schedule(...)` — validates PIN, reserves `amount` from wallet → `reserved_balance` (rejects if available < amount), inserts row, computes `next_run_at`.
  - `cancel_schedule(id)` — releases reservation back to `balance`, status=cancelled.
  - `pause_schedule(id)` / `resume_schedule(id)` — keeps reservation; resume recomputes `next_run_at`.
  - `execute_scheduled_purchase(id)` — called by the edge function: consumes reservation, calls vtu logic, on success creates next reservation (if recurring) or releases leftover; on failure schedules retry.
- RLS: users CRUD their own; service_role full access. Standard `GRANT` block.

**Edge function `schedule-runner`** (cron every 5 min via pg_cron + pg_net):
- Selects `active` schedules where `next_run_at <= now()`.
- For each: reuses the existing provider routing in `vtu-purchase` (extract shared helper or invoke internally with a service token). Records to `scheduled_runs`.
- On success: advance `next_run_at` per frequency; if recurring, attempt to reserve next cycle from wallet (if insufficient, mark `needs_funding`, notify).
- On failure: **Smart Retry** ladder — +10 min, +1 hr, +6 hr (max 3 attempts) before marking the run failed and refunding the reservation.

**Frontend (`src/pages/app/Scheduler/`)**
- `Index.tsx` — list of active/paused/cancelled schedules + upcoming calendar strip.
- `New.tsx` — wizard: network → phone (with recipient label) → bundle → frequency → review → PIN confirm.
- `Detail.tsx` — pause/resume/cancel, run history, next run countdown.
- Dashboard widget: "Reserved ₦X · Y upcoming purchases".
- Wallet page: show three lines — Main / Reserved / Available.

**Notifications**
- 24 h before run: in-app + push (existing `usePushNotifications`).
- On success/failure: existing notification path.

## Phase 2 — Smart features (post-core, same release if time allows)

1. **Family & Friends** — already supported via `recipient_label` + phone per schedule; add a "Recipients" quick-pick in the new-schedule wizard pulling from `beneficiaries`.
2. **Auto-Renew Forever** — `frequency = until_cancelled` with `interval_days`. Handled by runner.
3. **Upcoming Charges Calendar** — read-only month view computed from active schedules.
4. **Schedule Templates** — seed table `schedule_templates` (Student/Heavy/Weekly/Monthly). One-tap creates schedule with defaults.
5. **Data Expiry Reminder** — store `expires_at` estimate on successful tx (from package validity in `packages`), background job nudges 2 days before.

## Phase 3 — Differentiators (after launch, not in this PR)
Data Budget Mode, Smart Recommendations, Auto Top-Up nudges, Price Lock. Listed for roadmap, not built now.

## Technical notes

- All reservation math goes through RPCs with `FOR UPDATE` on `wallets` to avoid races.
- The runner uses `SERVICE_ROLE_KEY` and a `CRON_SECRET` header check (secret already exists).
- `vtu-purchase` logic refactored: extract the provider-routing block into a shared module both `vtu-purchase` and `schedule-runner` import, so we don't duplicate Gsubz/IACafe/BSPlug/AidaPay routing.
- Existing treasury reservation (`reserve_provider_liquidity`) still runs at execution time — only the *wallet-side* reservation is new.

## Questions before I start

1. **Min lead time** for a schedule (e.g. must be ≥ 15 min in the future)?
2. **Max active schedules per user** at launch (e.g. 20)?
3. For **recurring schedules**, when should the *next* reservation be made — immediately after a successful run, or 24 h before the next run? (Immediately = stronger guarantee, but locks more funds.)
4. Should **paused** schedules keep their reservation or release it until resumed?
