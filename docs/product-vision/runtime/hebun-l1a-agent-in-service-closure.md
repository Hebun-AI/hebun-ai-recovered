# L-1a — One In-Service Rule for Agents — Closure (reconciled 2026-10-17)

Written after the fact by the AP-5 entry reconciliation (`hebun-ap5-entry-reconciliation-closure.md`).
No closure record existed.

## Provenance

| Item | Evidence |
|---|---|
| Implementation commit | `cf2e66a752ef4581e88e0590eb13cc9f730e2348` (parent `5a392d0d`), 2026-10-08, 20 files, no schema, no migration, no new lifecycle writer |
| On `main` | yes — ancestor of `f9ae3b4c` |
| Recorded verification at release | commit message: "L3 PG18 sequential 919/987; failing set identical to the 5a392d0d baseline (68)" |

## What it changed (from the commit message)

"In service" had been spelled by hand in six places as "not retired". One pure allowlist rule now
lives in `features/agent-identity/in-service.ts`: `retired_at` NULL, `suspended_at` NULL, lifecycle
NULL or `active`. The identity reader, runtime liveness, mandate writer, placement reader/writer and
hypothesis reader ask it. `approveActionRequest` reads an agent proposer's row FOR SHARE inside its
transaction before any decision is written and refuses `proposing-agent-not-in-service`
(`features/action-authorization/decide-action-request.server.ts:66`); retirement locks the same row
FOR UPDATE, so the two serialize.

## Evidence available, and evidence missing

- Re-measured at `f9ae3b4c`: `tests/l1a-agent-in-service/predicate.ts` and `firewall.ts` exit 0.
  `in-service-postgres.ts` and `bite-proofs.ts` were not re-run.
- No production acceptance, push approval or deploy approval is recorded in the repository, and no
  recorded production approval exercised the `proposing-agent-not-in-service` refusal.

## Closure Contract (v1)

- Phase: L-1a
- Owner: Agent Identity (`features/agent-identity/in-service.ts`) and the action decision writer (`features/action-authorization/decide-action-request.server.ts`)
- Reached state: DEPLOYED
- Implementation commit: cf2e66a752ef4581e88e0590eb13cc9f730e2348 — on `main` (ancestor of f9ae3b4c)
- Verification level: V3 — lifecycle and authorization boundary (approval refuses a proposer out of service)
- Verification evidence: at release, recorded in the commit message — L3 PG18 sequential 919/987, failing set identical to the 5a392d0d baseline (68); re-measured 2026-10-17 at f9ae3b4c — `tests/l1a-agent-in-service/predicate.ts` exit 0 ("predicate: ok"), `firewall.ts` exit 0 ("firewall: ok"); postgres and bite-proof suites not re-run
- Test environment: at release, local PostgreSQL 18 (per commit message); re-measure in worktree `.claude/worktrees/ap-5-entry` at f9ae3b4c, `node --import tsx`, `DATABASE_URL` unset
- Deployment evidence: dpl_3WiFeB1jLebse3vTuBKdp1at21Ri — production at 1f8f9a47 (`hebun-eai-history-origin-1-closure.md`), and cf2e66a7 is an ancestor of 1f8f9a47; no deployment of cf2e66a7 itself is recorded in the repository; not re-measured by this reconciliation (the Vercel read seam available to it returned 404 for the project)
- Production acceptance evidence: N/A — no L-1a production acceptance is recorded in the repository; acceptance stays OPEN (L1A-PROD-ACCEPTANCE-1)
- Deferred risks: L1A-PROD-ACCEPTANCE-1 (DEFERRED); AP-RECON-POSTGRES-UNMEASURED-1 (DEFERRED)
- Director approvals: this reconciliation record, docs only, local commit, no push (Director, 2026-10-17); the original commit, push and deploy approvals are not recorded in the repository

## Deferred risks

- **L1A-PROD-ACCEPTANCE-1 (DEFERRED)** — the in-service rule and the approval refusal have no recorded
  production acceptance. Closes with a recorded production read of the deployed rule's effect, or as
  part of AP-5 acceptance A12 (`hebun-ap5-two-agent-acceptance-contract.md`).
