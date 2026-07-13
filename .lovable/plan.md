# Fix: All in-app purchases failing (data / airtime / cable / electricity)

## Root cause

In `supabase/functions/vtu-purchase/index.ts` the non-admin (regular app) branch has a self-assignment bug:

```ts
let userId: string;
if (isAdmin) {
  userId = apiUserId;
} else {
  const { data: { user } } = await uc.auth.getUser();
  userId = userId;   // ← should be user.id
}
```

Because `userId` stays `undefined`, `debit_and_create_transaction` is called with `_user_id: undefined`, the RPC returns nothing, the function replies with `INIT_FAILED`, and the client shows a generic error. No row is inserted into `transactions`, which matches what the DB shows: last real transaction was 21:37, nothing since despite the user's attempts.

The API path (`isAdmin` = true) is unaffected — it correctly sets `userId = apiUserId`. So this is not a provider outage, it's a code bug affecting every in-app purchase type.

## Fix

One-line change in `supabase/functions/vtu-purchase/index.ts`:

```
-      userId = userId;
+      userId = user.id;
```

That restores data, airtime, cable, and electricity purchases for all normal (non-API) users. No migration, no other file changes needed.

## Verification after deploy

1. Attempt MTN ₦250 1GB data purchase from the app.
2. Confirm a new row lands in `transactions` with `status = success` (or a real provider error, not `INIT_FAILED`).
3. Repeat with a ₦100 airtime purchase to confirm the fix isn't type-specific.
