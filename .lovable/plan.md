## Free Transfer — Frontend Integration

Backend (`create-free-transfer`, `check-free-transfer`, `opay-email-webhook`, tables, RPC, profile columns `ft_bank_name/ft_account_name/ft_account_number`) is already live. This plan wires the UI on top of it.

### 1. Wallet page — add a 3rd tab "Free Transfer"

In `src/pages/app/Wallet.tsx`, extend the existing tab switcher from 2 tabs: **Permanent · Free Transfer** (Free Transfer highlighted as "FREE ≥ ₦500" badge). Just permanent and free transfer remove one time 

### 2. New component `FreeTransferPanel` (rendered inside the new tab)

Flow states in one panel:

**State A — first-time setup** (when `profiles.ft_account_name` is null)

- Card asking for defaults: Bank Name, Account Name, Account Number.
- Saves via `supabase.from('profiles').update(...)`.
- After save, moves to State B.

**State B — enter amount**

- Amount input (₦).
- Live fee preview: FREE if ≥500, else 1% (≈₦X fee, receive ₦Y).
- Shows saved default sender: `{ft_account_name} · {ft_bank_name} · ****{last4}`.
- Link: **"I'm sending from a different bank"** → expands inline fields (bank, name, number) for one-off override, not saved.
- Button: **Continue** → invokes `create-free-transfer` with `{ amount, bank_name, account_name, account_number }`.

**State C — pay & verify**

- Show BlitzPay OPay account (from function response `pay_to`): **6554098879 · PRAISE ADAKOLE ONOJA · OPay** with copy buttons.
- Countdown to `expires_at` (12h).
- Big button **"I've Made Payment"** → switches to polling.
- Polls `check-free-transfer` every 5s (max ~3 min in-app; deposit still auto-credits later via Gmail Apps Script).
- Statuses:
  - `pending` → "Verifying your payment…" spinner.
  - `verified` → toast success, refresh wallet, navigate to `/app/history`.
  - `expired` → red card with support instructions (email screenshot to support).
  - `not_found` after 3 min → soft message: "Still waiting… we'll credit automatically when OPay's email arrives. Check History shortly."

### 3. Realtime credit

Existing `wallet-live` channel already listens for `transactions` inserts with `type=wallet_fund status=success` → it'll auto-refresh balance when the Apps Script webhook credits, even if the user closed the polling screen.

### 4. Settings — add "Free Transfer Defaults" section

In `src/pages/app/Settings.tsx` (or `EditProfile.tsx`), add a small card to view/edit `ft_bank_name/ft_account_name/ft_account_number` so users can change their saved defaults later.

### 5. Small polish

- Move the yellow "1% fee applies" info banner on the Wallet page so it only shows on Permanent/One-Time tabs, not Free Transfer (which is free ≥500).
- No route changes needed; all lives under `/app/wallet`.

### Technical notes

- All calls use `supabase.functions.invoke('create-free-transfer' | 'check-free-transfer')`.
- No new tables/migrations required — schema already exists.
- No new secrets required.
- Types already regenerated (types.ts shows `ft_*` and `free_transfer_deposits`).