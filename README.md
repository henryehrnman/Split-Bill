# Split Bill

A group-spending app built on trust. Members of a group (roommates, partners, friends, coworkers) each deposit an equal share into a group fund. Every member gets their own virtual card on that fund, adds it to Apple Pay or Google Pay, and can pay for group purchases. After each purchase the group agrees on how to split it, and each person's balance is adjusted.

**Stage:** hackathon MVP (submission 10:00am October 18, 2026). The app supports a local demo and authenticated shared accounts on the deployed Supabase RPC server. The hosted web app is [https://splitbill-hackathon.vercel.app](https://splitbill-hackathon.vercel.app). A check on two physical phones is still outstanding. Deposits, cards, and payments remain simulated. The outline is in [`launch.txt`](launch.txt) section 8; client setup is in [`mobile/README.md`](mobile/README.md#shared-accounts-and-live-updates).

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
9. **Tracking.** Activity shows monthly and all-time group spend; Profile shows each person's balance, spend this period, charges, and funding history. Open a sent charge in Activity to add or edit its shared note (up to 280 characters); leave it blank to clear it. Any joined member can update the note, with the latest author's name shown. Editing a note does not change amounts or approvals.

Ideas for generative AI, and the ones we decided against, are listed in section 6 of [`schema.txt`](schema.txt).

## Current state

Built in the local demo and shared server-backed app (all money simulated):

- Group creation with a budget and period, invite search by username/email/phone, accept or decline invites with the group details shown.
- Per-member cards, Apple/Google Wallet setup (simulated), card freeze.
- Period rollover with auto-refill (or manual top-up), simulated failed refills.
- Purchases from the group fund, one open charge at a time unless the group turns that off (then several, each held from the fund), pending splits shown on the home screen.
- Itemized claim board: claim items, lock in, suggest edits to others' items, approve/reject edits, fix scan mistakes; confirms automatically when complete.
- Percent / amount / equal proposals with acceptances, exact-cent allocation for any group size; default split per group.
- Spending limited to your own balance until you add your share for the period, automatic personal-card charge for negative balances, suspension when that fails, withdrawals locked while a split is pending.
- Budget change proposals with unanimous acceptance.
- Receipt photos (shared accounts): take or choose a photo and the server drafts the items, tax and tip. Gemini is used when `GEMINI_API_KEY` is set (`gemini-3.5-flash-lite` by default); Claude is the fallback when only `ANTHROPIC_API_KEY` is set. A read that doesn't add up to the charge stays a draft nobody can claim, and the claim board opens only after a save that matches. The local demo and "Use sample receipt" keep the simulated scanner for the demo merchants (Juniper, Trader Joe's, Shell).
- 7-day split deadline freeze, chargeback freeze, and a demo "support resolves dispute" action.
- Activity (group month/all-time spend, charge details) and Profile (balance, period spend, charges, funding history).
- **Demo user switcher**: tap the "Demo · Name" badge or use Profile to act as Henry, Maya, Jordan, Connor, or Saahil. This stands in for each person using their own phone. In the seeded data, Maya's Juniper charge is pending with her default split already sent, and Henry has a pending invite to Connor's "Tahoe ski trip".
- Demo controls: skip to the next budget period, skip ahead 7 days, simulate bank declines, reset demo data.
- Installable on iPhone from Safari (Share → Add to Home Screen, "Open as Web App" on): opens full screen with its own icon.

Verified: TypeScript, lint, and unit tests for split math and all backend rules (invites, periods, share-added spending rule, debt recovery, suspension, first proposal and notifications, claim board) pass, and the web bundle exports. Clicked through in headless Chrome: purchase, the payer's first proposal (sent by hand, sent automatically on leaving, and leaving someone out), notifications, accepting and settling, and the layout at iPhone size. `npm ci` in `mobile/` matches `package.json` as of main `7126984`.

The shared server is deployed. Supabase project `uiwbsedibgvwaklmwjna` is running the code on main: migration `0001` is applied and the `rpc` Edge Function is active. Email confirmation is off. An unauthenticated call returns 401, a CORS preflight returns 204, and a signed-in call with no profile returns 403 `no_profile`, so sign-in, the function, and `app_state` work together. `DEMO_MODE` is off, so a signed-in user cannot wipe every account. A synthetic receipt photo was read live on October 18, 2026 with Gemini (`gemini-3.5-flash-lite`): the items, tax, and tip matched the charge and landed on the claim board. Demo photos should be synthetic or redacted. Scans return 503 `scan_off` only when neither `GEMINI_API_KEY` nor `ANTHROPIC_API_KEY` is set.

Point a shared-server build at it with `mobile/.env.local` or the hosted build environment: `EXPO_PUBLIC_API_URL=https://uiwbsedibgvwaklmwjna.supabase.co/functions/v1/rpc`, `EXPO_PUBLIC_SUPABASE_URL=https://uiwbsedibgvwaklmwjna.supabase.co`, and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase dashboard (Settings → API Keys).

The hosted web app is [https://splitbill-hackathon.vercel.app](https://splitbill-hackathon.vercel.app). It is the web build pointed at this server. Shared accounts work there, and Profile still has the local demo. Two signed-in clients have been checked against the server (invite, equal split, sample-receipt claim board, and a live update). On October 18, 2026 two signed-in browsers completed the hosted itemized claim board: a sample receipt, separate claims, a suggested edit the other person accepted, both people locking in, and a live settle with no manual refresh.

Not yet verified: two physical phones against this deployed server, the Home Screen install on a physical iPhone, Android, user testing.

## Architecture

All business rules live in plain TypeScript so they can move to a real server unchanged:

| File | Role |
|---|---|
| `mobile/src/lib/money.ts` | Integer-cent helpers: formatting, parsing, exact allocation |
| `mobile/src/lib/split.ts` | Split math for any number of members (equal, percent, amount, items + tax/tip) |
| `mobile/src/lib/domain.ts` | Backend rules: groups, invites, budget periods, deposits, cards, purchases, claim board, proposals, settlement, debt recovery, disputes |
| `mobile/src/lib/api.ts` | Async API facade: local persisted demo or authenticated HTTP RPC, selected by session mode |
| `mobile/src/lib/fakeOcr.ts` | Sample receipts, and the check that real photo reads add up to the charge |
| `mobile/src/lib/photo.ts` | Takes or picks a receipt photo and shrinks it for upload |
| `supabase/functions/rpc/receipt.ts` | Reads a receipt photo with Gemini, or with Claude when only that key is set |
| `mobile/src/lib/seed.ts` | Demo users and history, built through the same rules |
| `mobile/src/lib/store.tsx` | Scoped account/demo state, selected group, API calls, Realtime refresh, notices |
| `mobile/src/lib/ui.tsx` | Shared UI components and styles |

Swapping in a real backend means implementing the same `api` methods over HTTP, with `domain.ts` running server-side and the viewer coming from authentication instead of the demo switcher. Tonight's version ([`launch.txt`](launch.txt) 8.ii): one Supabase table holding the same data object the fake backend keeps today, one Supabase Edge Function that checks the caller's sign-in, runs the same `domain.ts` function and returns only the caller's groups, Supabase Realtime for live updates, and an HTTP `api.ts` switched on by `EXPO_PUBLIC_API_URL` (the fake backend stays for offline demos). The full design with normalized tables is in [`backend.txt`](backend.txt).

## Next steps

For the hackathon (by 10:00am October 18; details in [`launch.txt`](launch.txt) section 8):

1. **Server (Henry):** implemented Supabase table and RPC Edge Function running `domain.ts`, sign-in to user mapping and filtered responses. Deploy using [`supabase/README.md`](supabase/README.md).
2. **App (Connor):** implemented sign-in/sign-up and profile completion, authenticated HTTP `api.ts`, version-ping Realtime updates, remote invite search, demo-mode toggle and account isolation, loading/error/retry states. Configure the public client settings and verify against the deployed server on two phones.
3. **Receipts, hosting, demo (Saahil):** receipt photos are live on the deployed function with Gemini (`GEMINI_API_KEY` set; `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`). A synthetic receipt was read onto the claim board on October 18, 2026. Claude remains the fallback. Use a synthetic or redacted receipt. The hosted web app is live at [https://splitbill-hackathon.vercel.app](https://splitbill-hackathon.vercel.app). The demo script is [`docs/DEMO.md`](docs/DEMO.md). Still to do: a demo group with real accounts, and a backup video. The final Devpost submission needs a video under 3 minutes. Tonight's draft does not.
4. Stretch goal: Stripe Issuing test mode, with the "Simulate tap" button firing Stripe's real card-approval webhook.

Left out until after the hackathon: real money and cards, Apple Pay, native push notifications, bank linking, saved-card debt recovery (stays simulated), scheduled jobs (`tick()` runs them on every request), normalized tables.

After the hackathon ([`launch.txt`](launch.txt) sections 3-4):

- **Milestone A:** real accounts and a real group on TestFlight, with test-mode Stripe cards, push notifications and scheduled jobs. Needs a paid Apple Developer account.
- **Milestone B:** real cards at real stores. Needs a company, Stripe live Issuing approval, Apple wallet approval, and a partner bank for pooled funds.
- Product: leaving a group and settling up balances when someone leaves; inviting people to an existing group; the dispute center workflow.
