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
- `src/lib/api.ts` — mode-aware API: the local demo persists to AsyncStorage; account mode calls the authenticated server. Both preserve the same screen method signatures.
- `src/lib/fakeOcr.ts`, `src/lib/seed.ts` — simulated receipt scanning and demo data.
- `src/lib/auth.ts`, `session.tsx`, `AuthScreen.tsx` — Supabase email/password sign-in, sign-up, profile completion, session recovery, and demo mode.
- `src/lib/http.ts`, `realtime.ts` — authenticated RPC transport and version-only Realtime invalidation.
- `src/lib/store.tsx` — scoped account/demo state, selected group, notices, retry and refresh; discards responses from old sessions.
- `src/lib/ui.tsx` — shared components and design tokens (see `docs/DESIGN.md`).

## Build for distribution
App identifiers are proposed defaults; confirm ownership before registration. Connect Henry's Expo/EAS account and the relevant Apple Developer / Google Play developer accounts. Configure signing and run `npx eas-cli@latest build --profile preview --platform android` for an internal APK, or the corresponding iOS build with valid Apple provisioning. Production submission requires actual store metadata, privacy policy, support URL, screenshots, reviewer credentials where relevant, and provider/program approval for any live financial service. No store account or EAS project is configured yet. No signed binary has been produced.

## Issuing boundary
Card numbers shown are demo last-4 digits, not PANs. Each member's card and the group fund are modeled by the fake backend only. Apple Wallet and Google Wallet actions are explicit simulations. Real provisioning, deposits and authorizations belong behind an authenticated server and issuer-approved SDK integration. Never place secret keys or PAN/CVC in client storage/logs. See `docs/WALLET_PLAN.md` in the parent repository.

## Shared accounts and live updates

Set these public build-time values in an ignored `mobile/.env.local`, then restart Expo (or rebuild the hosted web export):

```dotenv
EXPO_PUBLIC_API_URL=https://YOUR_PROJECT.supabase.co/functions/v1/rpc
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PROJECT_KEY
```

`EXPO_PUBLIC_API_URL` is the complete RPC endpoint. The legacy `EXPO_PUBLIC_SUPABASE_ANON_KEY` is also supported. Never put a secret/service-role key in an `EXPO_PUBLIC_` variable. Leave the API URL unset for the original local demo. A partially configured account build displays an error and still offers demo access.

Account mode uses Supabase email/password authentication. Sign-up collects name, handle and optional phone, then creates the domain profile through `createUser`. If email confirmation is enabled, the app asks the user to confirm before signing in; the hackathon server plan uses confirmations off. Failed profile creation can be retried without creating another auth account. Profile offers Sign out and Try demo mode; Exit demo mode returns to the account. The demo user switcher, clock/reset/support shortcuts, and failed-bank simulation appear only in local demo mode. All money remains simulated in both modes.

The server contract is `POST {method, args}` with the Supabase access token. `args` excludes the leading actor: the server derives identity from the token. State calls return `{db, viewerId}`; `searchUsers` returns a user array; errors return `{error, code}`. `no_profile` starts profile setup. Responses must include the referenced user profiles required to render visible groups, charges and claims. `setSingleOpenCharge` remains supported. Client requests time out after 15 seconds and never automatically retry writes; if a write times out, refresh to check whether it completed before trying it again.

Subscribe authenticated clients to `public.app_state_ping`, row `id=1`, using Supabase Realtime. This table carries only a version counter; never expose the full shared `app_state` row. Every ping refetches authorized state through RPC. The server must emit a ping only when state changes, including on `fetch`, to avoid a refresh loop. Reconnect, app foreground and a 15-second fallback poll also refresh state. A selected-group or account change cleans up its subscription. HTTP state responses are serialized and obsolete account responses are discarded.

Validation: `npm run typecheck`, `npm run lint`, `npm test` (includes HTTP errors, malformed payloads, authorization headers, timeouts, and no automatic write retries), `npm run test:network` (two client identities against the real RPC handler), and `npx expo export --platform web`. Network tests cover invite/join/purchase/settle, scoped responses, forged actors, concurrent writes and unchanged reads without ping loops. Browser checks against a local synthetic auth fixture covered sign-up, failed sign-in/retry, session recovery, sign-out and demo isolation. A deployed Supabase project and two real accounts are still required for a live two-device check. Local fixtures do not establish deployment, hosted Realtime or physical-iPhone behavior.
