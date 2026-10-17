# Split Bill mobile
React Native / Expo application. Tabs: Home, Split, Card, Activity; stack screens: Profile, New group. The hosted web review is exported from this same source.

## Run
`npm ci` then `npx expo start`. For browser review: `npx expo start --web`. Use a compatible Expo Go version for native preview, or create a development build. No actual banking or Wallet integration is installed.

## Verify
`npm run typecheck`, `npm run lint`, `npm test`, `npx expo export --platform web`.

## Code layout
- `src/app/` — routes (Expo Router). `(tabs)/` holds the tab screens.
- `src/lib/split.ts` — split math for any group size.
- `src/lib/domain.ts` — backend rules (groups, invites, budget periods, deposits, cards, purchases, claim board, proposals, settlement, debt recovery, disputes). Pure TypeScript, intended to run server-side later.
- `src/lib/api.ts` — fake backend: async API over `domain.ts` with simulated latency, persisted to AsyncStorage. Replace the method bodies with HTTP calls when the real backend exists.
- `src/lib/fakeOcr.ts`, `src/lib/seed.ts` — simulated receipt scanning and demo data.
- `src/lib/store.tsx` — client session (current demo user, selected group, notices).
- `src/lib/ui.tsx` — shared components and design tokens (see `docs/DESIGN.md`).

## Build for distribution
App identifiers are proposed defaults; confirm ownership before registration. Connect Henry's Expo/EAS account and the relevant Apple Developer / Google Play developer accounts. Configure signing and run `npx eas-cli@latest build --profile preview --platform android` for an internal APK, or the corresponding iOS build with valid Apple provisioning. Production submission requires actual store metadata, privacy policy, support URL, screenshots, reviewer credentials where relevant, and provider/program approval for any live financial service. No store account or EAS project is configured yet. No signed binary has been produced.

## Issuing boundary
Card numbers shown are demo last-4 digits, not PANs. Each member's card and the group fund are modeled by the fake backend only. Apple Wallet and Google Wallet actions are explicit simulations. Real provisioning, deposits and authorizations belong behind an authenticated server and issuer-approved SDK integration. Never place secret keys or PAN/CVC in client storage/logs. See `docs/WALLET_PLAN.md` in the parent repository.
