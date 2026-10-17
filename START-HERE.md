# Split Bill — start here

Repository: https://github.com/henryehrnman/Split-Bill

## Contents
- `schema.txt`: product schema (source of truth for product rules).
- `README.md`: current state, architecture and next steps.
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
As of October 17, 2026 the app implements the group-fund model in `schema.txt` entirely on the front end, backed by a fake in-app backend that saves to the device. No real accounts, cards, deposits or payments exist. Backend/APIs, real card issuing and wallet provisioning are the next phases. See `README.md` for details.

The original hosting metadata in `.openai/` is retained for reference; do not publish against that project unintentionally.
