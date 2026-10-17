# Split Bill

A group-spending app built on trust. Members of a group (roommates, partners, friends, coworkers) each deposit an equal share into a group fund. Every member gets their own virtual card on that fund, adds it to Apple Pay or Google Pay, and can pay for group purchases. After each purchase the group agrees on how to split it, and each person's balance is adjusted.

**Stage:** hackathon MVP. Everything runs in the app against a **fake backend**. No real accounts, cards, deposits, or payments exist yet.

The product rules come from [`schema.txt`](schema.txt) (Connor's product schema). This README describes what is built against it.

## Repository layout

| Path | Contents |
|---|---|
| `schema.txt` | Product schema — the source of truth for how the product works |
| `mobile/` | React Native / Expo app (iOS, Android, web), fake backend, tests |
| `docs/` | Project log, design rules, feasibility and wallet research |
| `dist/` | Exported web preview and downloadable native source |
| `scripts/` | Web packaging helper |

## Run locally

Requires a current Node.js LTS release.

```sh
cd mobile
npm ci
npm run web      # browser preview at http://localhost:8081
npm start        # native preview via Expo Go or a development build
```

Checks, from `mobile/`:

```sh
npm run typecheck
npm run lint
npm test
```

## How the product works

1. **Setup.** Someone creates a group with a budget per period, e.g. $300 every 2 weeks, and invites people by username, email, or phone. Each invitee sees the group details and either joins (depositing their equal share, here $100 for 3 people) or declines. Cards work once every invite has been answered and there are at least 2 members.
2. **Periods.** At the start of each period, members with auto-refill are charged back up to their share (with $40 left you're charged $60); others add funds themselves.
3. **Purchase.** Any member pays with their card. The charge comes out of the group fund, and the payer sends the first proposal: they pick who was part of it and how much (or scan the receipt), and only people with a share are notified. If the payer leaves without sending, the group's default split (equal unless changed) goes out automatically and everyone involved is notified (the fake backend also sends it after 10 minutes). Notifications are shown on the home screen as a stand-in for push. The pending split shows on the home screen under the fund amount. Only one charge can be open at a time.
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
- Purchases from the group fund, one open charge at a time, pending split shown on the home screen.
- Itemized claim board: claim items, lock in, suggest edits to others' items, approve/reject edits, fix scan mistakes; confirms automatically when complete.
- Percent / amount / equal proposals with acceptances, exact-cent allocation for any group size; default split per group.
- Spending limited to your own balance until you add your share for the period, automatic personal-card charge for negative balances, suspension when that fails, withdrawals locked while a split is pending.
- Budget change proposals with unanimous acceptance.
- Simulated receipt scanning for the demo merchants (Juniper, Trader Joe's, Shell); other merchants return a single line to fix by hand.
- 7-day split deadline freeze, chargeback freeze, and a demo "support resolves dispute" action.
- Activity (group month/all-time spend, charge details) and Profile (balance, period spend, charges, funding history).
- **Demo user switcher**: tap the "Demo · Name" badge or use Profile to act as Henry, Maya, Jordan, Connor, or Saahil. This stands in for each person using their own phone. Henry has a pending invite to Connor's "Tahoe ski trip".
- Demo controls: skip to the next budget period, skip ahead 7 days, simulate bank declines, reset demo data.

Verified: TypeScript, lint, and unit tests for split math and all backend rules (invites, periods, restriction, debt recovery, suspension, claim board) pass, and the web bundle exports. The October 17 schema update has not yet been clicked through in a browser.

Not yet verified: physical iOS/Android devices, user testing.

## Architecture

All business rules live in plain TypeScript so they can move to a real server unchanged:

| File | Role |
|---|---|
| `mobile/src/lib/split.ts` | Split math for any number of members (equal, percent, amount, items + tax/tip) |
| `mobile/src/lib/domain.ts` | Backend rules: groups, invites, budget periods, deposits, cards, purchases, claim board, proposals, settlement, debt recovery, disputes |
| `mobile/src/lib/api.ts` | **Fake backend**: async API with simulated latency, persists to device storage. Replace with HTTP calls later |
| `mobile/src/lib/fakeOcr.ts` | Stand-in for receipt OCR |
| `mobile/src/lib/seed.ts` | Demo users and history, built through the same rules |
| `mobile/src/lib/store.tsx` | Client session: current demo user, selected group, API calls, notices |

Swapping in a real backend means implementing the same `api` methods over HTTP, with `domain.ts` running server-side and the viewer coming from authentication instead of the demo switcher.

## Next steps

Backend and APIs (next phase):

1. Real accounts and authentication; replace the demo user switcher.
2. Server running `domain.ts` behind the `api` surface, with a database, idempotency keys, and an audit log.
3. Real receipt OCR service (vision model, validated against the charge total; see `schema.txt` section 6).
4. Push notifications for invites, new charges, proposals, item edits, and budget changes.
5. A scheduled job for period rollover (the fake backend runs it on every request).

Payments (gated on partner access):

6. Card issuer and funding rails (e.g. Stripe Issuing test mode), wallet provisioning, real deposits, refills, and debt recovery.
7. Dispute center workflow and chargeback handling.

Product:

8. Leaving a group and settling up balances when someone leaves; inviting people to an existing group.
9. Physical-device QA, signed internal builds via EAS, and a short demo script.
