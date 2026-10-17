# Split Bill

A social group-checkout app. Friends agree on how to split a bill, each person approves their share, and the group pays the merchant with one app-issued virtual card. The merchant sees a single payment; each participant sees exactly what they owe.

**Stage:** hackathon prototype. All card, wallet, and payment flows are simulated — no real money moves.

## Repository layout

| Path | Contents |
|---|---|
| `mobile/` | Canonical React Native / Expo app (iOS, Android, web), tests, and build config |
| `docs/` | Project log, execution plan, design rules, feasibility memo, wallet plan |
| `dist/` | Exported web preview (hosting directory) and downloadable native source |
| `scripts/` | Web packaging helper |

## Run locally

Requires a current Node.js LTS release.

```sh
cd mobile
npm ci
npm run web      # browser preview
npm start        # native preview via Expo Go or a development build
```

Checks, from `mobile/`:

```sh
npm run typecheck
npm run lint
npm test
```

## Current state

The app has five screens: Home, Split, Card, Activity, and Profile.

What works (simulated):

- **Split modes:** equal, percentage, custom amount, and item-level. Items can be shared by several people, and tax and tip are allocated proportionally.
- **Exact-cent math:** integer cents with largest-remainder allocation and stable participant ordering. Shares always sum to the total; fractional cents are rejected.
- **Consent gating:** each participant approves their share. Any edit to the bill revokes all approvals and the card. Payment unlocks only after every approval is in.
- **Group card:** a demo card session is generated after unanimous approval, capped at the bill amount, with freeze/unfreeze, decline/retry, and duplicate-payment protection.
- **Wallet setup:** Apple Wallet / Google Wallet provisioning is an explicit simulation.
- **Local recovery:** drafts and up to 100 receipts persist on-device via AsyncStorage with versioned, validated storage. Reopening the app clears approvals and card state. History can be cleared after confirmation.

Verified: TypeScript, lint, and unit tests (split math, payment states, recovery) pass. Expo web, iOS, and Android JavaScript bundles export successfully.

Not yet verified: browser visual/reload QA, physical-device testing, and user testing.

## Known limitations

- All three participants approve on one device. That simulates consent; it is not proof of independent consent.
- No accounts, authentication, server state, or cross-device sync.
- No real card issuing, wallet tokens, or money movement.
- No signed iOS/Android builds; no Expo/EAS, Apple Developer, or Google Play accounts configured.

## Plans

Near term:

1. Partial-refund simulation with cumulative caps and idempotency tests.
2. Persistence QA on browser reload and physical iOS/Android devices.
3. Accessibility and small-screen review.
4. 90-second pitch, 3-minute demo script, and a concise architecture/competitor explanation.

Next:

5. Authenticated server membership with immutable, versioned split approvals, so each person approves on their own device.
6. Exercise payment edge cases: changed tips, absent participant, funding failure, duplicate webhooks, expired approvals, retry without double charge.
7. Internal native builds via EAS once signing accounts exist.

Later, and gated on partner access:

8. Issuer decision matrix (access, funding latency, sandbox, wallet provisioning, disputes, fees), then sandbox issuing (e.g. Stripe Issuing test mode).
9. Feature-by-feature comparison with Cino and other competitors to sharpen positioning.
10. Interviews with 5–10 target users (initial hypothesis: US college students dining in groups).

## Target architecture

```
Client -> authenticated API -> group/session service -> versioned split proposal
       -> participant approvals -> funding orchestration -> issuer authorization policy
       -> capture/reconciliation -> receipts/refunds
```

Money is stored in integer minor units with an explicit currency. Writes are idempotent, and approvals reference an immutable split version. Webhooks are signature-verified and deduplicated. See `docs/PROJECT.md` for entities, states, and acceptance gates.

## Further reading

- `docs/PROJECT.md`: product decisions, market research, architecture, backlog, and progress log
- `docs/ASYNC_PLAN.md`: milestone plan and verification evidence
- `docs/DESIGN.md`: UI/UX rules
- `docs/FEASIBILITY.md`: competitor and issuer research
- `docs/WALLET_PLAN.md`: card and wallet integration plan
- `mobile/README.md`: native build and distribution notes
