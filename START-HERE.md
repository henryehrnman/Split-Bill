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
As of October 18, 2026 the app implements the group-fund model in `schema.txt`. Authenticated shared accounts run on the deployed Supabase RPC server (project `uiwbsedibgvwaklmwjna`). The hosted web app is [https://splitbill-hackathon.vercel.app](https://splitbill-hackathon.vercel.app). A local demo is still available. Money, cards, deposits, wallets, and payments are still simulated. Receipt photos are live with Gemini (`GEMINI_API_KEY` on the function; `gemini-3.5-flash-lite` by default). A synthetic receipt was read onto the claim board on October 18, 2026. Claude is the fallback. Scans return 503 `scan_off` only when neither key is set. Two signed-in clients have been checked against this server, including the hosted itemized claim board in two browsers. A check on two physical phones is still outstanding. See `README.md` for the current state.

The original hosting metadata in `.openai/` is retained for reference; do not publish against that project unintentionally.
