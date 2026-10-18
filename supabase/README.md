# Supabase server (hackathon build)

Implements `launch.txt` 8.ii for the server track: one `app_state` row, one `rpc` Edge Function running `domain.ts`.

## How it works
- `migrations/0001_app_state.sql`: `app_state(id=1, db, links, version)` (service role only, RLS on, no policies) and `app_state_ping(id=1, version)` which clients may read.
- `functions/rpc/index.ts`: verifies the JWT, then calls `core.ts`. `core.ts` holds all logic and is tested in Node.
- Request: `POST /functions/v1/rpc` with `{method, args}`. `args` are the `api.ts` arguments **without** the leading actor. The actor is the caller's linked domain user, never the body.
- Response: `{db, viewerId}` where `db` is filtered to the caller (their groups, people in them, own cards/ledger/notifications, no unsent drafts of others). `searchUsers` returns a plain array. Errors: `{error, code}` with 400 rule, 401 unauthenticated, 403 `no_profile`, 409 `has_profile`, 503 `busy`.
- Sign-up: after Supabase sign-up, the app calls `createUser` with `[{name, handle, email, phone}]` once. This links the JWT user to a new domain user.
- Writes are compare-and-set on `version` with up to 6 replays. `fetch` and `searchUsers` only write when `tick()` changed something.
- Demo mode (`DEMO_MODE=1`): body may include `actor` for seeded users that have no login, and `resolveDisputes`, `skipAhead`, `reset` work. `reset` reseeds and clears all logins.

## Receipt photos
- `scanReceipt [chargeId, photo?]`. `photo` is `{data, mediaType}`: a base64 JPEG/PNG/WebP/GIF, about 4.5 MB max (the app sends a 1568px JPEG).
- With a photo, `functions/rpc/receipt.ts` asks a Claude vision model for items, tax and tip as JSON. The model is called once, after checking the caller can scan that open charge and before the write loop, so a lost race doesn't pay for a second read.
- `fromScan()` in `fakeOcr.ts` checks the read: if items + tax + tip don't equal the charge, the receipt becomes one editable line and members fix items by hand before claiming.
- Errors: 503 `scan_off` when `ANTHROPIC_API_KEY` isn't set, 502 `scan_failed` when the model call fails, 400 `bad_photo` for anything that isn't a photo (so a client can't submit its own read), 400 `rule` if the caller couldn't scan that charge anyway.
- Without a photo, the sample scanner still runs (demo merchants get exact receipts, others get one line).

## Realtime
Differs from launch.txt 8.ii.e: subscribe to `postgres_changes` on **`app_state_ping`**, not `app_state`, then call rpc `fetch`. This keeps other groups' data off the realtime channel.

## Deploy
```sh
node scripts/copy-shared.mjs          # copies domain/split/money/fakeOcr/seed into functions/_shared
supabase link --project-ref <ref>
supabase db push
supabase secrets set DEMO_MODE=1      # optional, for judges
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # receipt photos; RECEIPT_MODEL defaults to claude-sonnet-5-5
supabase functions deploy rpc
```
Supabase dashboard: turn off email confirmations. Re-run the copy script after any change to `mobile/src/lib`.

## Test
```sh
node scripts/copy-shared.mjs && node --experimental-strip-types supabase/tests/core.test.ts
```
