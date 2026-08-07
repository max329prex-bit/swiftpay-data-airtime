# BlitzPay App UI — Premium Upgrade

Goal: make the logged-in app feel clearly more premium than any competing Nigerian VTU app, while keeping the violet identity BlitzPay launched with. Website/landing page is untouched.

## Visual direction

"Deep violet glass, quietly expensive." Purple stays the brand signal, but it stops being spread evenly across every surface. Instead:

- Calmer near-black violet surfaces with real elevation layers instead of one flat dark grey.
- Purple concentrated where it earns attention: the balance card, primary CTAs, active nav, progress, highlights.
- Softer, larger radii, tighter type scale, more generous breathing room.
- Micro-motion: press-scale on tiles, spring counters on balance, staggered card entry, skeletons instead of spinners.

## What changes, screen by screen

**Design tokens (`index.css` / `tailwind.config.ts`)**
- Add elevation surface tokens (`--surface-1/2/3`), a refined border token, and a subtler noise/aurora backdrop so the background stops looking washed.
- Retune the primary gradient: violet to soft magenta with less neon; keep mint as the single secondary accent.
- New shadow set (ambient + key light) so cards read as physical layers, not outlined boxes.
- Both light and dark themes updated in parallel.

**Bottom navigation**
- Floating pill dock with a sliding active indicator, icon+label fade, and a raised centre-weighted feel. Haptic-style press animation.

**Header**
- Compact greeting row: avatar initial, name, notification bell with dot. Sticky, blurs content underneath on scroll.

**Dashboard (Home)**
- Balance card rebuilt: layered gradient, faint embossed logo mark, animated naira counter, eye toggle, and inline Fund/Send actions instead of a lone plus button.
- BlitzPoints becomes a slimmer progress strip with a clearer "X to free 1GB" line and a redeem chip that only lights up when unlocked.
- Quick actions redrawn as four tactile tiles with distinct icon tints (network-coloured), pressed states, and better labels.
- Scheduler and Support rows become one consistent "card row" component instead of two different treatments.
- Recent activity: grouped by day, avatar-style type icon per row, aligned amounts, coloured status pills, skeleton loading.

**Bills hub**
- Service grid with larger icon plates, short descriptors, and a "recent recipients" strip at the top.

**Wallet / Deposit**
- Method tabs restyled as segmented control; account-number card gets copy feedback and clearer hierarchy; Free Transfer panel adopts the same card system.

**Settings**
- Grouped sections with proper section headers, consistent row component, real switches, and a profile header card.

**Purchase flows (Airtime, Data, Electricity, Cable)**
- Shared step layout, bigger amount input, network picker as logo chips, bundle cards with price emphasis and points badge, sticky bottom confirm bar.
- PIN entry screen restyled with the new tile treatment.

**Shared**
- One reusable `Card`, `SectionHeader`, `ListRow`, and `StatPill` set so every screen stops inventing its own spacing.
- Skeleton loaders replacing bare spinners; BoltLoader kept for full-screen only.

## Not changing

- No backend, RPC, edge function, or business-logic changes.
- No route changes; all existing pages, flows and data stay wired exactly as they are.
- Landing page and marketing site untouched.

## Technical notes

- All colour work lands in `src/index.css` tokens plus `tailwind.config.ts`; components use semantic tokens only.
- New shared primitives under `src/components/blitz/ui/`.
- Motion via the already-installed `framer-motion`.
- Both `.light` and `.dark` variable blocks updated and checked for contrast.
- Rolled out in passes: tokens + shared primitives first, then shell/nav, then Dashboard, then Bills/Wallet/Settings, then purchase flows — so the app stays usable throughout.
