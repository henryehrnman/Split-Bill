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
As of October 18, 2026 the app implements the group-fund model in `schema.txt`. Authenticated shared accounts run on the deployed Supabase RPC server (project `uiwbsedibgvwaklmwjna`). A local demo is still available. Money, cards, deposits, wallets, and payments are still simulated. Receipt photos need `ANTHROPIC_API_KEY` on the function; until it is set, scans return 503 `scan_off`. Two signed-in clients have been checked against this server. A check on two physical phones, and a hosted web URL, are still outstanding. See `README.md` for the current state.

The original hosting metadata in `.openai/` is retained for reference; do not publish against that project unintentionally.
