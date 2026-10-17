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

1. **Setup.** Someone creates a group with a buying power, e.g. $300 for 3 people. Each member deposits an equal share ($100) to join. Cards are issued when members join and work once everyone has deposited.
2. **Purchase.** Any member pays with their card. The charge comes out of the group fund and opens a split using the group's default (equal unless changed). Only one charge can be open at a time; the card is locked until the split is settled.
3. **Split.** Members accept the split or propose a new one (equal, percentages, exact amounts, or by receipt item). A new proposal resets acceptances. Everyone with a non-zero share must accept; people who weren't part of the purchase don't need to. Splits always cover every cent.
4. **Settle.** Once accepted, each person's balance drops by their share. Members with auto top-up are refilled to their share of the buying power; others top up manually.
5. **Standing.** A member whose balance is below their share can only spend up to their own balance until they top up. Failed top-ups leave the balance (and group buying power) reduced.
6. **Buying power changes.** Any member can propose raising or lowering it; everyone must accept. Raising asks each person to deposit their share of the increase; lowering keeps balances (surplus stays).
7. **Disputes.** A split not agreed within 7 days freezes the group and escalates to a dispute center. A chargeback on a settled charge also freezes the group. The dispute center itself is out of scope.
8. **Receipts and tracking.** Members can scan a receipt to pull in line items and claim what they had; tax and tip follow each person's item total. Activity shows monthly and all-time group spend; Profile shows each person's balance, spend, charges, and funding history.

## Current state

Built in the app (simulated by the fake backend):

- Groups with equal initial deposits, per-member cards, Apple/Google Wallet setup (simulated), card freeze.
- Purchases from the group fund, one open charge at a time, spend limits based on standing.
- Iterative split proposals and acceptances across equal / percent / amount / item modes, with exact-cent allocation for any group size.
- Default split per group (equal or custom percentages).
- Balances, deposits, withdrawals, auto top-up, simulated failed top-ups, restricted spending.
- Buying power change proposals with unanimous acceptance.
- Simulated receipt scanning for the demo merchants (Juniper, Trader Joe's, Shell); other merchants return a single editable line.
- 7-day split deadline freeze, chargeback freeze, and a demo "support resolves dispute" action.
- Activity (group month/all-time spend, charge details) and Profile (balance, spend, charges, funding history).
- **Demo user switcher** — tap the "Demo · Name" badge or use Profile to act as Henry, Maya, Jordan, or Connor. This stands in for each person using their own phone.
- Demo controls: skip ahead 7 days, reset demo data.

Verified: TypeScript, lint, and unit tests for split math and all backend rules pass. The main flows (scan receipt, propose an item split, accept as each member, settle, purchase) were clicked through in the web preview.

Not yet verified: physical iOS/Android devices, user testing.

## Architecture

All business rules live in plain TypeScript so they can move to a real server unchanged:

| File | Role |
|---|---|
| `mobile/src/lib/split.ts` | Split math for any number of members (equal, percent, amount, items + tax/tip) |
| `mobile/src/lib/domain.ts` | Backend rules: groups, deposits, cards, purchases, proposals, settlement, standing, buying power, disputes |
| `mobile/src/lib/api.ts` | **Fake backend**: async API with simulated latency, persists to device storage. Replace with HTTP calls later |
| `mobile/src/lib/fakeOcr.ts` | Stand-in for receipt OCR |
| `mobile/src/lib/seed.ts` | Demo users and history, built through the same rules |
| `mobile/src/lib/store.tsx` | Client session: current demo user, selected group, API calls, notices |

Swapping in a real backend means implementing the same `api` methods over HTTP, with `domain.ts` running server-side and the viewer coming from authentication instead of the demo switcher.

## Next steps

Backend and APIs (next phase):

1. Real accounts and authentication; replace the demo user switcher.
2. Server running `domain.ts` behind the `api` surface, with a database, idempotency keys, and an audit log.
3. Real receipt OCR service.
4. Push notifications for new charges, proposals, and buying power changes.

Payments (gated on partner access):

5. Card issuer and funding rails (e.g. Stripe Issuing test mode), wallet provisioning, real deposits and top-ups.
6. Dispute center workflow and chargeback handling.

Product:

7. Group invites and leaving a group; settling up balances when someone leaves.
8. Physical-device QA, signed internal builds via EAS, and a short demo script.
