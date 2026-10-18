# Split Bill — project plan and progress
Updated: October 17, 2026, Pacific. Owners: Henry Ehrnman, Connor Zacharias. Stage: hackathon MVP.

## Optional one-purchase lock — October 17, 2026 (Saahil)
The one-open-charge rule (schema 2.v) is now a group setting, on by default. With it off, several charges can be open at once: every open charge is held from the group fund, and a member who hasn't added their share this period has their share of every open charge held from their own balance, so the overspending concern behind the rule still holds. Withdrawals stay locked while any split is pending. Home lists every open charge, notifications and Home rows open the matching charge, and the Split tab shows a charge picker once your own draft is sent.
Implementation: `domain.ts` (data version 6, `Group.singleOpenCharge`, `openCharges`, `reservedFunds`, `setSingleOpenCharge`), seed, fake API, Home/Split/Profile; tests cover the lock, held funds and the restricted-member limit. TypeScript, lint and tests pass; clicked through in headless Chrome. `competitors.txt` 2.iv (Henry's) still says "one open charge at a time", which remains true by default.

## Home Screen app — October 17, 2026 (Saahil)
The web build can be installed on an iPhone from Safari (Share → Add to Home Screen, with "Open as Web App" on) and then opens full screen with its own icon, no Safari bars. Added `mobile/public/index.html` (Apple web-app tags, `viewport-fit=cover`), `mobile/public/manifest.json` and icons generated from `assets/icon.png` (still Expo's template icon). No service worker, so deploys reach phones immediately. Checked at iPhone 15 Pro size in headless Chrome; not yet tried on a physical iPhone. This is the install path for the hosted URL in `launch.txt` section 8.

## Spending rule and first proposal — October 17, 2026 (Saahil; supersedes parts of the next section)
Spending: balances have no minimum. A member who brought their balance up to their share at the start of the period (leftover balance counts) can spend whatever is in the group fund; a member who skipped their top-up can only spend up to their own balance until they add it. This replaces the $0 restriction. A confirmed split that takes someone below $0 charges their personal card back to $0; suspension if that fails is unchanged.
First proposal: after a purchase the charge is the cardholder's draft. They pick who was part of it and how much (or scan the receipt) and send it; only people with a share are notified. Leaving the split screen, backgrounding the app or switching demo user sends the group's default split; the fake backend also sends it after 10 minutes. Notifications show on Home as a stand-in for push.
Implementation: `domain.ts` (data version 5), seed, fake API, Split/Home/Card/Profile screens; tests cover both rules. TypeScript, lint and tests pass, and the new flows were clicked through in headless Chrome. `backend.txt` updated to match (authorization rule, saved-card debt recovery, send-default endpoint, draft job, notifications table).

## Schema update — October 17, 2026 (Connor and Saahil; supersedes parts of the next section)
`schema.txt` now defines a budget per period (e.g. $300 every 2 weeks) instead of a one-time buying power; invites by user ID/email/phone that members accept (deposit) or decline; period-start refills (automatic or manual) up to each member's share; restriction at a $0 balance until funds are added or the next period starts; automatic bank charge for negative balances after a split, with suspension (group carries the debt) if it fails; withdrawals only when no split is pending; pending splits shown under the fund amount; and an itemized claim board where each person claims and locks items, others suggest edits, and the split confirms once all items are claimed with no pending edits.
Implementation: `domain.ts` (data version 3), seed, fake API and all screens updated; new tests cover invites, periods, restriction, debt recovery/suspension, withdraw lock and the claim board. TypeScript, lint, tests and web export pass; not yet clicked through in a browser. Generative AI ideas that still fit the schema, and ones that don't, were added as section 6 of `schema.txt`.

## Product model change — October 17, 2026 (supersedes the flow below)
Connor's `schema.txt` replaces the original "approve first, then a one-time card" flow. The product is now a standing group fund: members make equal initial deposits that set the group's buying power; each member has their own virtual card on the fund; purchases are charged first and split afterwards through iterative proposals that every member with a share must accept; only one charge may be open at a time; balances are decreased on settlement and refilled by manual or automatic top-ups; members below their share are restricted to their own balance; buying power changes need unanimous acceptance; unagreed splits after 7 days and chargebacks freeze the group and escalate to a (hypothetical) dispute center; receipts can be scanned and items claimed, with tax/tip proportional to items; Activity and Profile track group and personal spend.

Implementation (October 17): the whole model is built in the Expo app against a fake backend (`mobile/src/lib/api.ts`) that enforces the rules in `mobile/src/lib/domain.ts` and persists to device storage. Split math (`mobile/src/lib/split.ts`) now supports any group size. A demo user switcher stands in for authentication. The previous single-bill engine, local recovery module and their tests were removed and replaced with split and domain tests. TypeScript, lint and tests pass; main flows were clicked through in the web preview. Next phase: real backend and APIs, then issuing/wallet partners. Earlier sections below are historical context; where they describe pre-approval before payment or a per-bill card, they no longer apply.

## Product
A social group-checkout app: friends link funding accounts, agree to flexible shares and pay a merchant with one app-issued virtual card. The merchant receives one payment; each participant sees their own obligation. Initial audience hypothesis: US college students dining in groups. Geography and hackathon deadline are unconfirmed.

## Current deliverable
Current native recovery behavior (October 16): drafts and up to 100 simulated receipts persist locally. Reopening revokes all approvals and discards card/wallet state; history is not synchronized or authenticated. The earlier in-memory description below is historical.
A private responsive browser demo with three sample participants, editable subtotal/tax/tip, equal/percentage/custom-amount splits, exact-cent allocation, per-person simulated approval, approval reset when the bill changes, simulated card readiness, decline/retry, and shared receipt. No real accounts, card issuance, money movement, authentication or cross-device synchronization. Demo state resets on refresh. Approvals are controls on one screen, not proof of participant consent. Source and this plan are stored in the Site repository; project folder contains the Site.

## Product decisions
Use an explicit simulation for judging the experience before obtaining issuer access. Treat the card as an app-issued payment credential; do not claim it is credit until the funding product is chosen. Prefer secured contributions before merchant authorization as the starting architecture hypothesis. This does not mean linked account balances or authorizations guarantee settled funds. Resolve liquidity, returns and risk with a qualified issuing partner before live payments.

The app must show total and shares before approval. Any material change invalidates approvals. Fees must be disclosed before consent. Handle tax, shared items and tip explicitly. A decline must not silently switch liability to the organizer. No fake Apple Pay button or claim that a browser demo can tap to pay.

## Initial market research — checked October 15, 2026
| Product | Verified overlap | Implication |
|---|---|---|
| Cino | Group cards, connected funding cards and adjustable split ratios; bills split at payment | Direct competitor. Do not claim this payment model is unique. |
| Venmo Groups | Shared-expense records, customized splits and payments due between members | Familiar social pattern; distinguish checkout experience from reimbursement. |
| Splitwise | Group expense tracking and flexible splitting | Flexible arithmetic alone is insufficient differentiation. |
| tricount | Shared-expense tracking, custom splits and bunq card expense tracking | Card-adjacent competitors matter as well as ledger apps. |

Sources: https://www.getcino.com/ ; https://www.balderton.com/news/cino-raises-e3-5m-to-revolutionise-shared-payments-with-the-first-virtual-card-that-splits-and-pays-group-bills-instantly/ ; https://help.venmo.com/cs/articles/managing-expenses-for-venmo-groups-vhel173 ; https://help.venmo.com/cs/articles/splitting-sharing-purchases-vhel189 ; https://www.splitwise.com/ ; https://www.tricount.com/features . Vendor descriptions establish advertised capabilities, not independent performance. Geographic availability, pricing and user adoption need additional verification.

Working differentiation hypothesis: clear item-level allocation plus explicit approval of tax/tip and predictable failure handling for ad-hoc restaurant groups. Validate this against Cino QuickSplit and split-by-amount before making competitive claims. No market-size or demand estimates have been invented.

## Payments feasibility
Stripe documents virtual cards and Issuing authorizations, test purchases and a separate approval path for live access. Consumer issuing documentation exists, but suitability and eligibility for this exact program are not established. Issuing does not by itself implement atomic multi-person funding. A viable system needs the issuer/processor, funding rails, a ledger and reconciler, identity/consent, fraud controls and operational support.
Sources: https://docs.stripe.com/api/issuing/cards/create ; https://docs.stripe.com/issuing/testing ; https://docs.stripe.com/issuing/onboarding-overview ; https://docs.stripe.com/issuing/consumer-compliance .

## Target architecture
Client -> authenticated API -> group/session service -> versioned split proposal -> participant approvals -> funding orchestration -> issuer authorization policy -> capture/reconciliation -> receipts/refunds.
Entities: User, FundingInstrumentToken, Group, Membership, Bill, LineItem, SplitVersion, Share, Approval, FundingAttempt, CardSession, Authorization, Capture, LedgerEntry, Refund, AuditEvent.
Money: integer minor units and explicit currency; largest-remainder allocation with stable participant ordering. Each write uses idempotency keys. Approvals reference immutable split version and amount. Webhooks authenticate signatures, deduplicate events and support out-of-order delivery. Ledger balances cannot be inferred solely from browser state.
States: draft -> awaiting approvals -> securing funding -> ready -> authorized -> captured; separate failed/cancelled/expired paths. Merchant authorization and final capture can differ, especially restaurant tips. Additional amounts require prior disclosed limits or renewed consent. Refunds follow original allocation and cannot exceed captured amounts. Production needs compensating actions for partial funding failures and reconciliation, not assumed distributed atomicity.

## Prioritized backlog
1. Add item-level assignment with shared items, tax/tip allocation and cent conservation.
2. Add meaningful persistent demo sessions, history, receipt export and partial refund simulation.
3. Add multi-device demo using authenticated server state and immutable approval versions; make single-screen simulation boundary explicit until complete.
4. Exercise payment states: changed tips, one participant unavailable, funding failure, duplicate webhook, expired approval and retry without duplicate charge.
5. Compare Cino feature-by-feature using first-party sources, verify region/pricing, then revise positioning.
6. Create issuer decision matrix including access requirements, funding latency, sandbox availability, digital-wallet provisioning, dispute ownership and fees. Do not promise live capability without evidence.
7. Prepare a 90-second pitch and 3-minute demo, test mobile usability and keyboard accessibility.
8. Define interview guide; seek evidence from 5–10 target users when Henry can recruit them. Do not contact anyone without authorization.
9. Add sandbox issuing only if suitable access is available. Do not enable live payments as part of routine automated work.

## Acceptance gates
Shares sum exactly to total. Invalid input blocks payment. Changes revoke approvals. Only all valid approvals unlock payment. Failed attempt yields no successful receipt. Duplicate pay cannot create duplicate receipt. Equal, percent and custom splits have tests. Before live integration: authenticated participant authorization, server validation, idempotency, reconciliation and partner approval.

## Research and validation plan
Measure time from bill entry to ready state, allocation errors, completion rate and participant comprehension. Test equal dinner, unequal food/shared appetizer, tax/tip change, absent friend and declined funding. Success targets are hypotheses: group can explain every charge; no unapproved amount; complete sample checkout within 60 seconds. No user tests conducted yet.

## Demo script
Open prototype. Explain one merchant payment and individual shares. Set a total and switch to percentage or custom shares. Approve three contributions. Change tip to show approvals resetting. Reapprove, simulate a decline, then retry successfully. Show receipt. State that real issuing is a separate partner-backed integration milestone.

## Progress and operating instructions
2026-10-15: Verified no prior Split Bill schedule or Site; existing daily and weekly reports paused. Created project folder and private Site. Enabled Build Split Bill hourly (highest supported scheduling frequency). First unattended run not yet verified. Created first prototype and this research/architecture/backlog. JS syntax and targeted arithmetic/state checks executed during initial build; browser visual QA unavailable in this environment.
Future runs: read this file and canonical Site source, choose the highest-value unfinished task, implement and verify it, update this log and privately deploy. Preserve user edits; avoid concurrent writers. Record completed evidence and blockers. No endless redundant tasks just to exhaust credits. Review schedule status on a later run. Scheduling is not a guarantee of uninterrupted compute or unlimited credits.

## Inputs that would sharpen the next iteration
Hackathon deadline and judging rubric; teammates and existing code; intended country; preferred stack; whether a sandbox demo is sufficient. Work can continue under current assumptions without these answers.

## Native app update — October 15, 2026
User clarified iOS/Android app-store direction and dedicated group card with Apple/Google Pay. Native React Native/Expo source lives in mobile/; browser review is exported from it. Read WALLET_PLAN.md before further payment work. The five-screen design supersedes the original web demo. Added generated demo-card session, wallet setup simulation, freeze/unfreeze and consent-gated checkout. Store signing, real issuing and real wallet provisioning remain unimplemented.
Validation: native TypeScript and lint checks passed; reducer tests passed for cent conservation, invalid shares, unanimous consent, wallet gate, frozen card, decline/retry, duplicate payment and invalidation after edit. Expo web bundle exported successfully. Physical device and browser visual QA remain outstanding. Run mobile web export into dist-next, then scripts/package-web.py before Sites packaging.
Expo iOS and Android JavaScript/Hermes bundles also exported successfully. This is bundle validation, not signed IPA/APK generation or physical-device verification.

## UI/UX redesign — October 15, 2026
Researched AI-design homogenization and NN/g hierarchy/consistency principles. Added docs/DESIGN.md with audit, source links and concrete design rules. Reworked all five native screens: bundled DM Sans, Feather icons, cobalt action palette, restrained panels, task-specific headings, four-tab navigation, persistent primary actions, compact approval rows, bill-edit disclosure, wallet selection rows and separate demo scenarios. Preserve these rules in scheduled iterations. Visual browser/device QA remains outstanding.
Redesign verification: TypeScript, lint and payment-state tests passed. Updated web, iOS and Android bundles exported successfully. No browser screenshots, physical-device QA or user testing were performed in this run.

## Background milestone — October 15, 2026, 9:50 p.m. Pacific
First recorded background entry: saved ASYNC_PLAN.md and FEASIBILITY.md. Cino already supports guest checkout; item-level consent remains a differentiation hypothesis. Wallet tokens require partner-backed live access. Native lint, typecheck and reducer tests passed. UI unchanged; visual/device QA outstanding. Next: implement shared-item splits and exact tax/tip allocation.

## Completed milestone — October 16, 2026, 3:05 a.m. Pacific
Fetched canonical source at 87e7c337; no active-writer record found. Implemented Items split mode: editable named amounts, multiple assignees per item, add/remove, proportional tax and tip with deterministic participant-order cent allocation. Item costs must match subtotal; empty/unassigned/invalid costs block approvals and card creation. Every edit revokes approvals/card. Equal, percentage and custom modes remain available. Money inputs now reject fractional cents. Activity subtitle updated to Henry’s requested “Your splits, in one place.”
Evidence: native TypeScript, Expo lint and engine tests passed. Tests cover shared-item rounding, reversed assignee order, zero assignees, invalid/duplicate assignees, subtotal mismatch, fractional cents, cent conservation across 104 bill sizes, and item-edit approval/card reset; previous wallet/freeze/decline/duplicate-payment tests still pass. Web export verified for this revision. No browser or physical-device visual QA performed; supported browser-control skill is unavailable. No signed binaries or live payment actions.
Source access initially failed through the default proxy; network-enabled retry succeeded. No project data was changed until canonical source was fetched. Reused existing matching dependencies without installing new packages.
Next: validated versioned local demo recovery and persistent receipt history. State is still in memory and approvals still simulate three people on one device. Authenticated shared sessions, live issuing, wallet provisioning and signing remain outstanding.

## Recovery milestone — October 16, 2026, 3:52 a.m. Pacific
Fetched canonical d510bc1c before editing; no active-writer record found. Added versioned, bounded local draft/receipt storage using Expo-compatible AsyncStorage. Recovery validates JSON shape, schema version, receipt cent conservation, unique receipt IDs and item bounds. Invalid saved data starts fresh; invalid but structurally valid unfinished drafts remain editable and cannot bypass the engine gate. Recovered approvals, demo cards and wallet selection are always cleared. No real financial credentials are stored.
Activity now lists persistent demo receipts with immutable wallet/share snapshots and offers another split. Restart preserves history; confirmed clear removes saved draft/history by replacing the snapshot with a fresh empty demo. Failed storage displays an honest warning. Writes are serialized after hydration so startup cannot overwrite recovered data. This is local demo recovery, not multi-user synchronization, durable server accounting or independent consent.
Verification evidence and next actions are recorded in ASYNC_PLAN.md. No browser or physical-device QA; no signed binaries or live payments. Dependency restoration repaired a self-referencing node_modules symlink; source was unchanged until canonical fetch succeeded.
