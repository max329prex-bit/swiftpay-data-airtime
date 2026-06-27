Three small, surgical polish fixes — no business logic changes.

## 1. Landing page "Download App" button is invisible

**Cause:** `App.tsx` forces `defaultTheme="dark"`, so shadcn's `outline` button variant resolves `bg-background` to near-black. On the white hero section it renders as a black button on a black-ish chip with no visible text.

**Fix (`src/pages/Index.tsx`, line 158):** Replace the outline variant with explicit light styling so it always reads correctly on the white hero, regardless of theme:
```tsx
<Button size="lg" variant="outline"
  className="rounded-full px-6 bg-white text-slate-900 border-slate-300 hover:bg-slate-50 hover:text-slate-900">
  <Download className="mr-1 h-4 w-4" /> Download App
</Button>
```
The second Download button (line 312, dark CTA band) already has explicit dark-section classes — leave it untouched.

## 2. PIN setup boxes are not visible

**Cause:** `InputOTPSlot` defaults to `border-input` which is extremely faint on the `bg-gradient-aurora` backdrop. The 4 slots blend into the card.

**Fix (`src/pages/app/PinSetup.tsx`):** Add visible surface + border to each slot via className (8 slots, both create + confirm). Tokens only, no hardcoded colors:
```tsx
className="h-14 w-14 text-xl rounded-2xl border-2 border-primary/30 bg-background/40 first:rounded-2xl last:rounded-2xl"
```
Also add `gap-3` to `InputOTPGroup` (override `flex items-center` with a wrapper class) so the rounded slots sit apart instead of touching — the default group joins them edge-to-edge which hides the per-slot rounding.

## 3. BlitzData Scheduler is hidden

Currently only reachable from `/app/bills`. Promote it to the dashboard with a single, premium entry card placed directly under the Quick actions row — keeps the existing dashboard hierarchy intact (wallet → points → quick actions → **scheduler** → support → recent).

**Fix (`src/pages/app/Dashboard.tsx`):** Add one card linking to `/app/schedules`:
```tsx
<Link to="/app/schedules"
  className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-r from-primary/10 to-accent/10 p-4 flex items-center gap-3 hover:border-accent/40 transition group">
  <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary shadow-glow">
    <CalendarClock className="h-5 w-5 text-white" />
  </span>
  <div className="flex-1 min-w-0">
    <div className="text-sm font-semibold flex items-center gap-2">
      BlitzData Scheduler
      <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">New</span>
    </div>
    <div className="text-xs text-muted-foreground">Auto-renew data & airtime on your schedule</div>
  </div>
  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition" />
</Link>
```
Import `CalendarClock` from `lucide-react`.

## What is NOT changing
- No backend, RPC, or schema changes.
- No restructuring of the dashboard, landing layout, or PIN flow.
- All other components untouched.
