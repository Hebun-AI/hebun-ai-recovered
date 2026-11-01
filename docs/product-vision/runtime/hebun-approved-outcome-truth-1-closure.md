# APPROVED-OUTCOME-TRUTH-1 · What became of approved agent proposals · closure record · VERIFIED

Local fix for two defects the signed-in Live Map acceptance found on 2026-11-01. Not pushed, not deployed:
production still shows the old numbers and the old focus ring.

## Root causes

**"Never executed" was false for internal acts. A projection defect, not a missing relation.**
`approvedWithoutExecution` is `approved - attempts`, and `action_execution_attempts` is the external ledger: a
governed internal act writes no row there, by design (GIA-1). So every executed internal act counted as never
executed. The relation already exists: the Work Authority declares the link in the permit's own transaction
(`audit_log` `metadata.handoffId`), and `readGovernedWorkOutcomes` reads it. GIA-1 fixed the same contradiction
on `/approvals` in `permitOutcomeSentence`; the per-agent count was never moved. No migration is needed.

**The focus ring was painted over.** `.lm-agent` clips its overflow, so the ring sat on `.lm-node` with an inset
offset. `.lm-field` is `position: relative`, so it paints after that outline; `.lm-foot` is static with no
background, so the ring showed only around the footer. Proven in the production tab: making `.lm-field` static
showed the whole ring and lost the scene; drawing the ring on the card, outside its edge, showed the whole
ring and kept the scene. The card's own edge cannot be painted over by its clipped children.

## Semantics

Each approved agent proposal is in exactly one class, and the five sum to `approved`.

| Class | Rule |
|---|---|
| `notStarted` ("never executed") | no attempt and no spent permit: a live, expired or revoked permit, or none |
| `internalRecorded` | permit spent AND the Work Authority's link to that exact spend is proven |
| `providerAccepted` | attempt `accepted`, which is not delivered |
| `failedOrRefused` | attempt `failed` or `refused` |
| `unknown` | attempt `pending` or `unknown`, or a spend with no proven outcome: a legacy spend, a contradictory link, any other kind |

A spent permit alone is never a success. A failed internal act rolls its spend back, so it reads as
`notStarted`: Hebun records no failure for it and none is implied. `approvedWithoutExecution` keeps its true
meaning, "no attempt row", because Heby grounding and SIA-2 read it. An unreadable Work Authority makes the whole
read `unavailable`, never a zero. A proposal's class comes from authoritative rows only; nothing is backfilled.

## Production records, read-only, 2026-11-01

| Request | Agent | Kind | Permit | Attempts | Work link | Class |
|---|---|---|---|---|---|---|
| `d288c6c9` | Engineering (AP-5) | record-work | consumed | 0 | `work.recorded` → `5ba33201` | `internalRecorded` |
| `bc195e09` | Heby | set-work-declared-state | consumed | 0 | `work.state-declared` | `internalRecorded` |
| `fdc0e57b` | Heby | record-work | consumed | 0 | none | `unknown` |

`4149c43f` run over production rows in a read-only session: Engineering approved 1, never executed 0, internal 1,
unknown 0; Heby approved 2, never executed 0, internal 1, unknown 1; Content and Security Planning all zero.
`fdc0e57b` was spent at 17:51Z on 2026-10-12, before spends carried the link (22:43Z the same day). A work item
from it may exist; no persisted record proves which, so it stays `unknown` and is not repaired.

## Closure Contract (v1)

- Phase: APPROVED-OUTCOME-TRUTH-1
- Owner: features/agent-outcome-observation (classes, read, composition) + features/live-map and components/agents (surfaces) + globals.css (card focus)
- Reached state: VERIFIED
- Implementation commit: 4149c43f
- Verification level: V3 — a new tenant-scoped read inside a shared seam, and model-facing grounding text; no schema, authority or provider change
- Verification evidence: 2026-11-01 on 4149c43f, node_modules matching the lockfile: `next build` exit 0, 46 s, minimum 11.48 GiB, 0 seam or secret-shaped hits in `.next/static`; full suite 1131 exit 0, 0 FAIL, 1 BLOCKED of 1132, tree clean, 0 REGRESSION; approved-outcome-classes 56 combinations; approved-outcome-postgres 10 cases; ra-prep-1, sia1, e23 and live-map-experience bite-proofs exit 0; `tsc --noEmit` exit 0; `eslint` on changed files exit 0. Nine mutations: seven bit their named suites, the tenant predicate bit the exact firewall pin and survived the Postgres suite because the view is keyed by the tenant's own identities, and dropping the agent-proposer filter is equivalent because a human id matches no agent. `plan-step-idempotency-1/bite-proofs` exited 0 in this run; it is PRE-EXISTING and flaky (`HW1-PSI-BITE-FLAKE-1`), so that green is not a PASS. `r3w-flow/ambient-database-safety` is BLOCKED (`OR2-R3W-AMBIENT-DB-BLOCKED-1`), not a PASS. Pins changed with reason: e23 firewall tenant bindings 13 to 16, e23 query-shape statements 9 to 10 and aggregates 8 to 9, card-anatomy ring selector and offset, e23 bite M14 anchor
- Test environment: disposable detached worktree at 4149c43f; session-created PostgreSQL 18.6 on 127.0.0.1:55496, C locale, system_identifier 7703168786362907610, removed after the run. Disk gate CONDITIONAL, minimum 11.45 GiB; an earlier build attempt was stopped by the 10 GiB watchdog at 9.58 GiB and is not evidence
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not deployed; the read of production rows above measures the data, not a release
- Deferred risks: AOT-NOT-RELEASED-1 (DEFERRED); AOT-LEGACY-SPEND-UNKNOWN-1 (DEFERRED); AOT-CARD-GLANCE-1 (DEFERRED); AOT-NO-ATTEMPT-WORDING-1 (DEFERRED)
- Director approvals: root cause, minimal fix, tests and local commit, 2026-11-01 ("HEBUN AI, DIRECTOR DECISION", both findings); no push, deployment, migration or production data change was authorized or made

### Deferred risk detail

- **AOT-NOT-RELEASED-1 (DEFERRED).** Production still serves `471e0dc8`. The focus ring in a real browser and the
  corrected counts on the page are unproven until a Director-gated release and a signed-in re-read.
- **AOT-LEGACY-SPEND-UNKNOWN-1 (DEFERRED).** `fdc0e57b` and any spend before the link stay `unknown`. Filling
  them in would be a production data change and an invented record.
- **AOT-CARD-GLANCE-1 (DEFERRED).** The card keeps its three counts, so Heby's card reads "never executed 0" and
  its unknown shows only on the office page and in Details. True, not complete; a fourth card count is a
  Director design decision.
- **AOT-NO-ATTEMPT-WORDING-1 (DEFERRED).** Tenant-level attention (`approvedWithoutAttempt`) and SIA-2
  (`authorizedWithAttempt`) still count attempts only. Their words say "attempt", so they are true, and an
  executed internal act still counts as having none there.
