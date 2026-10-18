# Split Bill

A group-spending app built on trust. Members of a group (roommates, partners, friends, coworkers) each deposit an equal share into a group fund. Every member gets their own virtual card on that fund, adds it to Apple Pay or Google Pay, and can pay for group purchases. After each purchase the group agrees on how to split it, and each person's balance is adjusted.

**Stage:** hackathon MVP (submission 10:00am October 18, 2026). Today everything runs in the app against a **fake backend**: no real accounts, cards, deposits, or payments exist yet. The plan for the hackathon is to put the same rules on a real server with real sign-in, so a group can use one shared group live from their own iPhones, with money still simulated ([`launch.txt`](launch.txt) section 8).

The product rules come from [`schema.txt`](schema.txt) (product schema by Connor and Saahil). This README describes what is built against it; [`backend.txt`](backend.txt) and [`launch.txt`](launch.txt) describe what comes next.

## Repository layout

| Path | Contents |
|---|---|
| `schema.txt` | Product schema — the source of truth for how the product works |
| `backend.txt` | Draft backend plan: stack, API endpoints, data model, build order |
| `launch.txt` | Launch plan: APIs and hosting, steps to real iPhones, and the hackathon plan (section 8) |
| `mobile/` | React Native / Expo app (iOS, Android, web), fake backend, tests |
| `mobile/public/` | Web page template, manifest and icons that make the web build installable on iPhone |
| `docs/` | Project log, design rules, feasibility and wallet research |
| `dist/` | Exported web preview and downloadable native source |
| `scripts/` | Web packaging helper |

## Run locally

Requires a current Node.js LTS release.

```sh
cd mobile
npm ci
npm run web      # browser preview at http://localhost:8081
npm start        # native preview via a development build
```

The app is on Expo SDK 58. The App Store's Expo Go doesn't support SDK 58 yet, and iOS Expo Go now requires the phone and computer to share an Expo account, so for iPhones use the web build instead: open it in Safari and add it to the Home Screen ([`launch.txt`](launch.txt) 8.i).

Checks, from `mobile/`:

```sh
npm run typecheck
npm run lint
npm test
```

## How the product works

1. **Setup.** Someone creates a group with a budget per period, e.g. $300 every 2 weeks, and invites people by username, email, or phone. Each invitee sees the group details and either joins (depositing their equal share, here $100 for 3 people) or declines. Cards work once every invite has been answered and there are at least 2 members.
2. **Periods.** At the start of each period, members with auto-refill are charged back up to their share (with $40 left you're charged $60); others add funds themselves.
3. **Purchase.** Any member pays with their card. The charge comes out of the group fund, and the payer sends the first proposal: they pick who was part of it and how much (or scan the receipt), and only people with a share are notified. If the payer leaves without sending, the group's default split (equal unless changed) goes out automatically and everyone involved is notified (the fake backend also sends it after 10 minutes). Notifications are shown on the home screen as a stand-in for push. The pending split shows on the home screen under the fund amount. By default only one charge can be open at a time; a group can turn that lock off in its settings, and then every open charge is held from the fund (and, for anyone who hasn't added their share, from their own balance) until it settles.
4. **Split by item.** Scan the receipt. Each person claims their items and locks in their selection. Others can suggest edits to someone's items, which that person approves or rejects. Once every item is claimed, everyone who claimed has locked, and no edits are pending, the split confirms. Tax and tip follow each person's item total.
5. **Split by percent or amount.** Members propose or accept a split (equal, percentages, exact amounts). A new proposal resets acceptances. Everyone with a non-zero share must accept. Splits always cover every cent.
6. **Settle and standing.** Each person's balance drops by their share. Balances have no minimum: anyone who has added their share this period can spend whatever is in the group fund (trust model). Someone who skips their top-up can only spend up to their own balance until they add their share. If a confirmed split takes someone below $0, their personal card is charged back to $0; if that fails they're suspended and the group carries the debt until repaid. Withdrawals are allowed only when no split is pending.
7. **Budget changes.** Any member can propose raising or lowering the budget; everyone must accept. A raise is collected at the next period start; a cut keeps balances (surplus stays).
8. **Disputes.** A split not agreed within 7 days freezes the group and escalates to a dispute center. A chargeback on a settled charge also freezes the group. The dispute center itself is out of scope.
9. **Tracking.** Activity shows monthly and all-time group spend; Profile shows each person's balance, spend this period, charges, and funding history.

Ideas for generative AI, and the ones we decided against, are listed in section 6 of [`schema.txt`](schema.txt).

## Current state

Built in the app (simulated by the fake backend):

- Group creation with a budget and period, invite search by username/email/phone, accept or decline invites with the group details shown.
- Per-member cards, Apple/Google Wallet setup (simulated), card freeze.
- Period rollover with auto-refill (or manual top-up), simulated failed refills.
- Purchases from the group fund, one open charge at a time unless the group turns that off (then several, each held from the fund), pending splits shown on the home screen.
- Itemized claim board: claim items, lock in, suggest edits to others' items, approve/reject edits, fix scan mistakes; confirms automatically when complete.
- Percent / amount / equal proposals with acceptances, exact-cent allocation for any group size; default split per group.
- Spending limited to your own balance until you add your share for the period, automatic personal-card charge for negative balances, suspension when that fails, withdrawals locked while a split is pending.
- Budget change proposals with unanimous acceptance.
- Simulated receipt scanning for the demo merchants (Juniper, Trader Joe's, Shell); other merchants return a single line to fix by hand.
- 7-day split deadline freeze, chargeback freeze, and a demo "support resolves dispute" action.
- Activity (group month/all-time spend, charge details) and Profile (balance, period spend, charges, funding history).
- **Demo user switcher**: tap the "Demo · Name" badge or use Profile to act as Henry, Maya, Jordan, Connor, or Saahil. This stands in for each person using their own phone. In the seeded data, Maya's Juniper charge is pending with her default split already sent, and Henry has a pending invite to Connor's "Tahoe ski trip".
- Demo controls: skip to the next budget period, skip ahead 7 days, simulate bank declines, reset demo data.
- Installable on iPhone from Safari (Share → Add to Home Screen, "Open as Web App" on): opens full screen with its own icon.

Verified: TypeScript, lint, and unit tests for split math and all backend rules (invites, periods, share-added spending rule, debt recovery, suspension, first proposal and notifications, claim board) pass, and the web bundle exports. Clicked through in headless Chrome: purchase, the payer's first proposal (sent by hand, sent automatically on leaving, and leaving someone out), notifications, accepting and settling, and the layout at iPhone size.

Not yet verified: the itemized claim board in a browser, the Home Screen install on a physical iPhone, Android, user testing.

## Architecture

All business rules live in plain TypeScript so they can move to a real server unchanged:

| File | Role |
|---|---|
| `mobile/src/lib/money.ts` | Integer-cent helpers: formatting, parsing, exact allocation |
| `mobile/src/lib/split.ts` | Split math for any number of members (equal, percent, amount, items + tax/tip) |
| `mobile/src/lib/domain.ts` | Backend rules: groups, invites, budget periods, deposits, cards, purchases, claim board, proposals, settlement, debt recovery, disputes |
| `mobile/src/lib/api.ts` | **Fake backend**: async API with simulated latency, persists to device storage. Replace with HTTP calls later |
| `mobile/src/lib/fakeOcr.ts` | Stand-in for receipt OCR |
| `mobile/src/lib/seed.ts` | Demo users and history, built through the same rules |
| `mobile/src/lib/store.tsx` | Client session: current demo user, selected group, API calls, notices |
| `mobile/src/lib/ui.tsx` | Shared UI components and styles |

Swapping in a real backend means implementing the same `api` methods over HTTP, with `domain.ts` running server-side and the viewer coming from authentication instead of the demo switcher. Tonight's version ([`launch.txt`](launch.txt) 8.ii): one Supabase table holding the same data object the fake backend keeps today, one Supabase Edge Function that checks the caller's sign-in, runs the same `domain.ts` function and returns only the caller's groups, Supabase Realtime for live updates, and an HTTP `api.ts` switched on by `EXPO_PUBLIC_API_URL` (the fake backend stays for offline demos). The full design with normalized tables is in [`backend.txt`](backend.txt).

## Next steps

For the hackathon (by 10:00am October 18; details in [`launch.txt`](launch.txt) section 8):

1. **Server (Henry):** Supabase table and Edge Function running `domain.ts`, sign-in to user mapping, responses filtered to the caller's groups, deploy.
2. **App (Connor):** sign-in and sign-up screen, HTTP `api.ts`, Realtime updates, demo-mode toggle for the user switcher, loading and error states.
3. **Receipts, hosting, demo (Saahil):** hosted web URL (Vercel or EAS Hosting), real receipt scanning with a vision model on the server, a demo group with real accounts, demo script and backup video. Real scans first need `domain.ts`'s `scanReceipt` to accept scanned items instead of always calling `fakeOcr.ts`.
4. Stretch goal: Stripe Issuing test mode, with the "Simulate tap" button firing Stripe's real card-approval webhook.

Left out until after the hackathon: real money and cards, Apple Pay, native push notifications, bank linking, saved-card debt recovery (stays simulated), scheduled jobs (`tick()` runs them on every request), normalized tables.

After the hackathon ([`launch.txt`](launch.txt) sections 3-4):

- **Milestone A:** real accounts and a real group on TestFlight, with test-mode Stripe cards, push notifications and scheduled jobs. Needs a paid Apple Developer account.
- **Milestone B:** real cards at real stores. Needs a company, Stripe live Issuing approval, Apple wallet approval, and a partner bank for pooled funds.
- Product: leaving a group and settling up balances when someone leaves; inviting people to an existing group; the dispute center workflow.
