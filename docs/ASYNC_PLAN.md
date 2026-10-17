# Overnight and Friday execution plan
Saved October 15, 2026, Pacific. Priorities, not completion-time promises.

Native Expo app remains canonical. Preserve DESIGN.md and private audience. Read canonical source and current docs before every run; if another writer is active, do independent read-only research. Roughly 70% building/verification, 30% decision-focused research. No real money, paid purchases, external messages or store submission. Other reports remain paused.

## Tonight: October 15–16
1. DONE: bounded competitor/issuer memo, FEASIBILITY.md.
2. DONE: item editing and shared assignment; proportional tax/tip with integer cents and stable largest-remainder ties. Preserve equal/percentage/custom modes. Reject unassigned items/subtotal mismatches; edits revoke approvals/card. Test shared items, rounding and conservation.
3. IMPLEMENTED: Validated, versioned local demo recovery and receipt history; reset invalid data safely. Persist simulated nonsensitive data only. Local recovery is not multi-user synchronization. Device restart QA remains outstanding.
4. Fix observed invalid-total, changed-tip, pending-person, frozen-card, decline/retry and duplicate-payment issues. Review accessibility/small screens with supported tools; record unavailable QA.

## Friday: October 16
5. Finish overnight gates before expansion.
6. Save 90-second pitch, 3-minute demo and concise architecture/competitor explanation with clear simulation boundary.
7. If stable, implement authenticated server membership and versioned approvals; otherwise document exact handoff. Single-screen controls are not independent consent.
8. Prepare native internal-build instructions and remaining signing/account/device requirements. Do not claim signed binaries or store submission.

## Completed run: October 15, 2026, 9:50 p.m. Pacific
Retrieved canonical source at 3cf7f02. Confirmed redesign present; no prior ASYNC_PLAN.md or completed unattended log entry. Three existing source revisions alone do not establish unattended execution. Saved plan and primary-source feasibility memo; exposed both through progress packaging.
Checks: native lint, TypeScript and existing reducer tests passed. No native API or UI changes; existing bundles reused.
Next: item-level shared splits with exact tax/tip and approval invalidation, then persistence.
Blocked: live issuer/program access, developer/signing accounts and physical-device QA. Browser visual QA remains unverified. These do not block simulated implementation.

## Completed milestone — October 16, 2026, 3:05 a.m. Pacific
Fetched canonical source at 87e7c337; no active-writer record found. Implemented Items split mode: editable named amounts, multiple assignees per item, add/remove, proportional tax and tip with deterministic participant-order cent allocation. Item costs must match subtotal; empty/unassigned/invalid costs block approvals and card creation. Every edit revokes approvals/card. Equal, percentage and custom modes remain available. Money inputs now reject fractional cents. Activity subtitle updated to Henry’s requested “Your splits, in one place.”
Evidence: native TypeScript, Expo lint and engine tests passed. Tests cover shared-item rounding, reversed assignee order, zero assignees, invalid/duplicate assignees, subtotal mismatch, fractional cents, cent conservation across 104 bill sizes, and item-edit approval/card reset; previous wallet/freeze/decline/duplicate-payment tests still pass. Web export verified for this revision. No browser or physical-device visual QA performed; supported browser-control skill is unavailable. No signed binaries or live payment actions.
Source access initially failed through the default proxy; network-enabled retry succeeded. No project data was changed until canonical source was fetched. Reused existing matching dependencies without installing new packages.
Next: validated versioned local demo recovery and persistent receipt history. State is still in memory and approvals still simulate three people on one device. Authenticated shared sessions, live issuing, wallet provisioning and signing remain outstanding.

## Recovery milestone — October 16, 2026, 3:52 a.m. Pacific
Implemented draft recovery, bounded receipt history, fresh consent after reopening, restart-with-history and confirmed deletion. Recovery unit tests cover malformed/unknown versions, invalid receipt sums, duplicate IDs, invalid item shape, invalid unfinished drafts, receipt deduplication and approval/card reset. Storage is nonsensitive simulation only. Dependency: AsyncStorage installed via Expo SDK 58 compatible installer; SDK source consulted: https://docs.expo.dev/versions/v58.0.0/sdk/async-storage/ (October 16).
Evidence: TypeScript, Expo lint, existing arithmetic/payment tests and new recovery tests passed; Expo web export passed. Tests validate pure serialization/state behavior, not real browser/device restart behavior. Removed a tracked self-referencing dependency symlink and restored dependencies from lockfile; dependencies themselves remain ignored.
Expo iOS and Android Hermes bundle exports passed with AsyncStorage included. These are JavaScript bundle checks, not installable signed binaries or native storage/device tests.
Next: check persistence on physical iOS/Android and browser reload; add partial-refund simulation with cumulative caps and idempotency tests. Then demo/pitch and authenticated-session architecture. Supported browser-control skill remains unavailable, so no visual/reload/device success is claimed. Live issuer access, signing accounts and authenticated server membership remain blockers to those production features, not this demo.
