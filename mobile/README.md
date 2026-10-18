# Split Bill mobile
React Native / Expo application. Tabs: Home, Split, Card, Activity; stack screens: Profile, New group. The hosted web review is exported from this same source.

## Run
`npm ci` then `npx expo start`. For browser review: `npx expo start --web`. Use a compatible Expo Go version for native preview, or create a development build. No actual banking or Wallet integration is installed.

## Verify
`npm run typecheck`, `npm run lint`, `npm test`, `npm run test:network`, `npx expo export --platform web`.

## Code layout
- `src/app/` — routes (Expo Router). `(tabs)/` holds the tab screens.
- `src/lib/split.ts` — split math for any group size.
- `src/lib/domain.ts` — backend rules (groups, invites, budget periods, deposits, cards, purchases, claim board, proposals, settlement, debt recovery, disputes). Pure TypeScript shared by the local demo and RPC server.
- `src/lib/firstSend.ts` — coordinates manual first proposals and automatic default sends; failed or busy requests remain retryable.
- `src/lib/api.ts` — mode-aware API: the local demo persists to AsyncStorage; account mode calls the authenticated server. Both preserve the same screen method signatures.
- `src/lib/fakeOcr.ts`, `src/lib/seed.ts` — sample receipt scanning, the check applied to real photo reads (`fromScan`), and demo data.
- `src/lib/photo.ts` — takes or picks a receipt photo and shrinks it for upload.
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

The server contract is `POST {method, args}` with the Supabase access token. `args` excludes the leading actor: the server derives identity from the token. State calls return `{db, viewerId}`; `searchUsers` returns a user array; errors return `{error, code}`. `no_profile` starts profile setup. Responses must include the referenced user profiles required to render visible groups, charges and claims. `setSingleOpenCharge` remains supported. Client requests time out after 15 seconds (60 seconds for photo scans) and never automatically retry writes; if a write times out, refresh to check whether it completed before trying it again.

Approvals must identify what the member reviewed. `acceptSplit` takes `[chargeId, expectedProposalId]`; `setLocked` takes `[chargeId, true, expectedReceiptKey]`, using `receiptApprovalKey` from the displayed receipt. Unlocking uses `[chargeId, false]`. Missing or stale approval values return HTTP 409 with code `stale`; the app refreshes state and asks the member to review again. Claim changes and accepted item edits clear existing locks. Other members locking an unchanged receipt do not invalidate its key. The server rechecks consent when replaying a concurrent write. Deploy the matching client and RPC code together.

`scanReceipt` accepts `[chargeId, photo?]`, where a photo is `{data, mediaType}`. With shared accounts, Split offers Take photo and Choose photo (`src/lib/photo.ts` resizes to a 1568px JPEG); the server reads it with a Claude vision model and falls back to one editable line when the items don't add up to the charge. "Use sample receipt" and demo mode keep the sample scanner, so the local demo never sends photos. Capture and upload run inside the first-send controller and wait for the app to be active again, so the native picker backgrounding the app, a cancelled picker or a failed upload never sends the default split. The server needs `ANTHROPIC_API_KEY` (see `supabase/README.md`); without it photo scans return `scan_off`.

Subscribe authenticated clients to `public.app_state_ping`, row `id=1`, using Supabase Realtime. This table carries only a version counter; never expose the full shared `app_state` row. Every ping refetches authorized state through RPC. The server must emit a ping only when state changes, including on `fetch`, to avoid a refresh loop. Reconnect, app foreground and a 15-second fallback poll also refresh state. A selected-group or account change cleans up its subscription. HTTP state responses are serialized and obsolete account responses are discarded.

Validation: `npm run typecheck`, `npm run lint`, `npm test` (includes HTTP errors, malformed payloads, authorization headers, timeouts, no automatic write retries, and the first-send controller), `npm run test:network` (two client identities against the real RPC handler), and `npx expo export --platform web`. Network tests cover invite/join/purchase/settle, scoped responses, forged actors, stale proposal/receipt approvals during concurrent writes, unchanged-receipt locks settling once, and unchanged reads without ping loops. Browser checks covered sign-up, failed sign-in/retry, session recovery, sign-out and demo isolation against a local synthetic auth fixture, plus sent-proposal approval and Profile invitation routing in the local demo. A deployed Supabase project and two real accounts are still required for a live two-device check. Local fixtures do not establish deployment, hosted Realtime or physical-iPhone behavior.
