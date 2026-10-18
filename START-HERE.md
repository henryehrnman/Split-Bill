# Split Bill — start here

Repository: https://github.com/henryehrnman/Split-Bill

## Contents
- `schema.txt`: product schema (source of truth for product rules).
- `README.md`: current state, architecture and next steps.
- `backend.txt`: draft backend plan (stack, endpoints, data model, build order).
- `launch.txt`: launch plan (APIs and hosting, steps to TestFlight with test-mode money, then real cards).
- `mobile/`: React Native / Expo app, fake backend, tests, lockfile and build configuration.
- `docs/`: project log, design research, feasibility and wallet plan.
- `dist/`: saved web preview and downloadable native source.
- `scripts/`: web packaging helper.

## Run locally
Install a current Node.js LTS release and npm, then from this folder:

```sh
cd mobile
npm ci
npm run web
```

For native preview use `npm start`; see `mobile/README.md` for device/build requirements.
Checks: `npm run typecheck`, `npm run lint`, `npm test` from `mobile/`.

## Status
As of October 17, 2026 the app implements the group-fund model in `schema.txt` with a local persisted demo and authenticated shared accounts backed by a Supabase RPC server. Sign-in, profile setup, remote invite search, live refresh, and approvals tied to the reviewed split or receipt are implemented. Configure and deploy the server and public client settings to use shared accounts; a live two-device check remains outstanding. Cards, deposits, wallets and payments are still simulated. See `mobile/README.md` for setup and checks, `supabase/README.md` for deployment, and `launch.txt` section 8 for the hackathon outline and ownership.

The original hosting metadata in `.openai/` is retained for reference; do not publish against that project unintentionally.
