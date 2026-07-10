# Two focused changes

## 1. Add ₦10,000 to handicapino@gmail.com only
- Look up the user id for `handicapino@gmail.com` (id `8ce97dda-3731-47fc-b699-eada4efdd117`).
- Add ₦10,000 to that user's wallet balance.
- Log a matching `wallet_fund` transaction (status `success`, reference `ADMIN-CREDIT-<timestamp>`, meta note "admin manual credit") so the wallet and history stay in sync.
- No other user is touched.

## 2. Mask the transaction PIN as dots (••••)
Currently PIN digits show as plain numbers while typing. Change the PIN entry so each digit shows as a dot / asterisk, like a password field.

Files to update:
- `src/pages/app/PinSetup.tsx` — the create + confirm PIN screens (uses `InputOTPSlot`; render each slot as a masked dot when filled).
- Anywhere else the transaction PIN is entered during a purchase / schedule flow. I'll grep for other `set_transaction_pin` / `verify_transaction_pin` / PIN input usages (e.g. purchase confirm modals in `Airtime.tsx`, `Data.tsx`, `Cable.tsx`, `Electricity.tsx`, `ScheduleNew.tsx`) and apply the same masking there.

Approach: keep the underlying value as the real digits (so RPCs still receive the 4-digit PIN), but render the visible character as `•` when the slot is filled. Numeric keyboard on mobile stays intact.

## Not doing (confirming intent)
- No changes to the free-transfer flow, email scanner, or any other user's balance.
- No global balance reconciliation.
