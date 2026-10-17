# Native app and group-card specification
Updated October 15, 2026. User direction: iOS/Android product with Venmo/Cash App familiarity, a dedicated group card and Apple/Google Pay.

## Intended experience
Create group checkout -> agree to shares -> secure contributions -> create/activate group card -> provision an authorized spender's wallet -> merchant payment -> reconciliation and individual receipts.
The card is separate from participants' existing personal cards. It cannot be literally ownerless: it must be associated with the issuer's approved cardholder/program. The issuer must agree to liability, funding and authorized spenders. A named authorized payer is the starting hypothesis. Do not assume all members can share a card or token. A credit card requires a real credit arrangement; prepaid/debit/credit structure remains unresolved. Demo language is “group card.”

## Delivered foundation
October 16 recovery update: local draft and simulated receipt snapshots now survive reopening. Approvals, card and wallet state deliberately do not; all participants must be simulated approving again. Local storage is not synchronized consent or a real wallet connection. Current design tokens are in DESIGN.md and supersede the early green palette described below.
Expo SDK 58 / React Native under mobile/, with Expo Router and shared native/web components. Home, Split, Card, Activity, Profile. Original Split Bill branding: green-led palette, bottom tabs, friend rows, large totals and card visual. The state reducer requires approvals, generates a demo session, gates checkout on simulated wallet setup, supports freezing/declines, blocks duplicate payments and revokes card/approvals when a split changes. No auth, real accounts, wallet tokens or native binary. State is in memory.

## Wallet research
Stripe supports eligible issued cards in digital wallets. Its documentation says wallet tokens require live mode and cannot be tested in a sandbox. iOS push provisioning requires Apple's payment-pass-provisioning entitlement. Android requires issuer/API access and native integration. Confirm program and region eligibility. Only show real wallet provisioning buttons when card/device eligibility is verified. This is issuer-side provisioning, not accepting Apple Pay as a merchant or generating a generic Wallet pass.
Sources checked October 15, 2026:
- https://docs.stripe.com/issuing/cards/digital-wallets?platform=react-native
- https://developer.apple.com/library/archive/documentation/Miscellaneous/Reference/EntitlementKeyReference/ApplePayandPassKitEntitlements/ApplePayandPassKitEntitlements.html
- https://docs.stripe.com/issuing/consumer-compliance
- https://docs.expo.dev/versions/v58.0.0/
- https://docs.expo.dev/router/installation/

## Next work
1. Preserve native UI as canonical and export it for browser review.
2. Add item splits, shared items and cent-conserving tax/tip allocation.
3. Add durable sessions, authenticated users and multi-device approvals.
4. Define authenticated server APIs for bill versions, approvals, card sessions, eligible wallet provisioning and issuer webhooks. Validate membership, authorized spender, approval version, funding, expiry and idempotency. Never put issuer secrets/PAN/CVC in client storage or logs.
5. Implement simulated/live issuer adapters; keep live disabled until partner approval/access and scoped authorization.
6. Connect Expo/EAS and Apple/Google developer accounts for signed internal builds. These accounts and signing are unresolved. Physical device QA, store assets, privacy disclosures and store review remain outstanding.
7. Continue hourly work on this direction. Private web publication does not mean App Store submission or successful native build.
