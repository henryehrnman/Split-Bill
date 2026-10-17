# Split Bill — desktop handoff

Snapshot: October 16, 2026 (Pacific)
Source commit: 9692178a7fa4de013d799015cac524321feb7cf4

## Contents
- mobile/: canonical React Native / Expo app, assets, tests, lockfile and build configuration.
- docs/: project/progress, async plan, design research, feasibility and wallet plan.
- dist/: saved web preview and downloadable native source.
- scripts/: web packaging helper.

## Run locally
Install a current Node.js LTS release and npm, then from this folder:

```sh
cd mobile
npm ci
npm run web
```

For native preview use `npm start`; see mobile/README.md for device/build requirements.
Checks: `npm run typecheck`, `npm run lint`, `npm test` from mobile/.
Dependencies are intentionally excluded and restored using the lockfile.

## Start your own Git repository
From this top-level Split-Bill folder:

```sh
git init -b main
git add .
git commit -m "Import Split Bill prototype"
```

Create an empty repository at your preferred Git host, then use its supplied remote URL:

```sh
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

This is a source snapshot, not the previous repository's Git history. No credentials or installed dependencies are included. The original hosting metadata is retained for reference; do not run Sites publishing against the existing project unintentionally. Desktop edits will not automatically synchronize with the existing hourly cloud task.

## Verified status at export
Completed source includes equal/percentage/custom/item splits, shared items, exact tax/tip allocation, approval invalidation, simulated group-card/wallet/payment flows, local draft recovery and receipt history. Prior milestone logs report lint/typecheck/tests and web/iOS/Android bundle checks passing. Export did not modify application code or rerun those builds.

Outstanding: partial refunds, authenticated shared sessions, physical-device and browser visual/reload QA, signed installable builds, live issuing and wallet integrations. All payments remain simulated. Recent automated runs reported source-access failures; source retrieval succeeded for this export. The hourly task remains enabled; an enabled schedule is not continuous execution.

See docs/ASYNC_PLAN.md for milestone detail. Some earlier sections of docs/PROJECT.md are historical; the dated recovery milestone supersedes the initial in-memory-only description.
