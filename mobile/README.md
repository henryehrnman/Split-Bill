# Split Bill mobile
React Native / Expo application. Tabs: Home, Split, Card, Activity; stack screens: Profile, New group. The hosted web review is exported from this same source.

## Run
`npm ci` then `npx expo start`. For browser review: `npx expo start --web`. Use a compatible Expo Go version for native preview, or create a development build. No actual banking or Wallet integration is installed.

## Verify
`npm run typecheck`, `npm run lint`, `npm test`, `npm run test:network`, `npx expo export --platform web`.

## Phone UI local review

The web home route uses the phone interface from `src/web/`, without the design preview's desktop introduction or device frame. Native routes and the existing sign-in screens are unchanged. The web interface uses the same mode-aware API and domain rules as the native screens.

To export an isolated local demo from `mobile/`, disable dotenv loading and clear any public account settings already present in the shell:

```sh
env -u EXPO_PUBLIC_API_URL -u EXPO_PUBLIC_SUPABASE_URL \
  -u EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY -u EXPO_PUBLIC_SUPABASE_ANON_KEY \
  EXPO_NO_DOTENV=1 npx expo export --platform web --output-dir /tmp/chipin-phone-build
python3 -m http.server 4175 --bind 127.0.0.1 --directory /tmp/chipin-phone-build
```

Open `http://127.0.0.1:4175/`. Demo changes persist in this browser's local storage; use the profile's demo account selector to review the same group as another member. This does not create shared hosted accounts or move real money. Keep the same origin and port to retain the local demo state across rebuilds.

This workflow only serves localhost and does not publish the hosted site. The phone UI's item-list confirmation, item selection, profile/group edits, and receipt parsing require the matching RPC release before an account-mode deployment. Do not point this client at an older deployed server and assume those actions are available; deploy and verify the matching client/server contract together.

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

## Hosted web app
https://splitbill-hackathon.vercel.app is the web build pointed at the deployed Supabase server (shared accounts, with Try demo mode on Profile). Redeploy with `scripts/deploy-web.sh` from the repo root after `npx vercel login`; it exports the web app with the server's public settings, moves the exported `assets/node_modules` fonts and icons to `assets/vendor` (the Vercel CLI never uploads `node_modules` folders), adds a rewrite so deep links load the app while missing assets still return 404, and publishes to the `split-bill` Vercel project linked in the ignored root `.vercel/`. The committed `dist/` stays the local-demo build.

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

The server contract is `POST {method, args}` with the Supabase access token. `args` excludes the leading actor: the server derives identity from the token. State calls return `{db, viewerId}`; `searchUsers` returns a user array; errors return `{error, code}`. `no_profile` starts profile setup. Responses must include the referenced user profiles required to render visible groups, charges and claims. `db.spendingView` contains server-calculated availability, spending limit, pending count, withdrawal status, and any purchase blocker for the authenticated viewer. Calculate these before filtering private drafts; clients must not reconstruct pooled availability from their visible charges. `setSingleOpenCharge` is an authenticated no-op for cached clients during the transition; the setting is removed and several purchases can be open at once. Client requests time out after 15 seconds (60 seconds for photo scans) and never automatically retry writes; if a write times out, refresh to check whether it completed before trying it again.

Group creation and early invitation responses collect no money. `createGroup` accepts `initialContributionLimit`, and `respondInvite` takes `[groupId, accept, expectedContribution, initialContributionLimit?]`. The current estimate is still required for joining; the UI discloses that declines can increase the final share and explicitly submits the displayed maximum. The server stores each authorization and caps activation funding at it. Older clients omitting the limit authorize only their reviewed estimate. If a final target exceeds that limit, the remaining amount stays unpaid and auto-refill is off until the member enables it under the final terms. Once all invitations resolve with at least two joined members, the server starts the first period and collects final equal contributions once. Initial failures are recorded per member as `deposit-failed`. A member with a nonnegative balance can spend the available pool regardless of period funding.

Approvals must identify what the member reviewed. `acceptSplit` takes `[chargeId, expectedProposalId]`; `setLocked` takes `[chargeId, true, expectedReceiptKey]`, using `receiptApprovalKey` from the displayed receipt. Unlocking uses `[chargeId, false]`. Missing or stale approval values return HTTP 409 with code `stale`; the app refreshes state and asks the member to review again. Claim changes and accepted item edits clear existing locks. Other members locking an unchanged receipt do not invalidate its key. The server rechecks consent when replaying a concurrent write. Deploy the matching client and RPC code together.

The phone web UI uses the newer receipt contract: `parseReceipt` returns a private OCR result without saving it; `confirmReceiptList(chargeId, {items, tax, tip, image?}, expectedEditKey)` publishes the reviewed list; and `confirmItemSelection(chargeId, itemIds, expectedReceiptListKey)` atomically claims and confirms only the caller's items. New lists use exclusive ownership and allocate tax/tip to items before grouping by owner. An unchanged list preserves claims and confirmations; a changed list resets them. Competing claims are rejected without overwriting another member. Historical shared receipts retain their original amounts until someone explicitly confirms a replacement list.

Phone proposals pass `{acceptOwnShare: false, expectedEditKey}` to `proposeSplit`, so publishing changes does not accept a share. `updateGroup` persists group names and validated photos; `updateProfile` persists the caller's name. All API amounts are integer cents. Receipt and uploaded group images are compressed and capped at 256,000 characters. The local phone build exercises these rules through the persisted domain backend; the production RPC must be released from the matching revision before using this UI with shared accounts.

`scanReceipt` accepts `[chargeId, photo?]`, where a photo is `{data, mediaType}`. With shared accounts, Split offers Take photo and Choose photo (`src/lib/photo.ts` resizes to a 1568px JPEG); the server reads it with Gemini when `GEMINI_API_KEY` is set (`GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`), or with Claude when only `ANTHROPIC_API_KEY` is set, and falls back to one editable line when the items don't add up to the charge. "Use sample receipt" and demo mode keep the sample scanner, so the local demo never sends photos. Capture and upload run inside the first-send controller and wait for the app to be active again, so the native picker backgrounding the app, a cancelled picker or a failed upload never sends the default split. Photo scans return `scan_off` only when neither key is set (see `supabase/README.md`). On October 18, 2026 a synthetic receipt was read live with Gemini, including from the hosted app, and the items, tax, and tip matched the charge. Demo photos should be synthetic or redacted.

Subscribe authenticated clients to `public.app_state_ping`, row `id=1`, using Supabase Realtime. This table carries only a version counter; never expose the full shared `app_state` row. Every ping refetches authorized state through RPC. The server must emit a ping only when state changes, including on `fetch`, to avoid a refresh loop. Reconnect, app foreground and a 15-second fallback poll also refresh state. A selected-group or account change cleans up its subscription. HTTP state responses are serialized and obsolete account responses are discarded.

Validation: `npm run typecheck`, `npm run lint`, `npm test` (includes HTTP errors, malformed payloads, authorization headers, timeouts, no automatic write retries, and the first-send controller), `npm run test:network` (two client identities against the real RPC handler), and `npx expo export --platform web`. Network tests cover invite/join/purchase/settle, scoped responses, forged actors, stale proposal/receipt approvals during concurrent writes, unchanged-receipt locks settling once, and unchanged reads without ping loops. Browser checks covered sign-up, failed sign-in/retry, session recovery, sign-out and demo isolation against a local synthetic auth fixture, plus sent-proposal approval and Profile invitation routing in the local demo. A deployed Supabase project and two real accounts are still required for a live two-device check. Local fixtures do not establish deployment, hosted Realtime or physical-iPhone behavior.
