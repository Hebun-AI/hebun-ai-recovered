# CONTENT-AGENT-2 — Revise a Prepared Draft from Its Review Change Request — Closure (reconciled 2026-10-17)

Written after the fact by the AP-5 entry reconciliation (`hebun-ap5-entry-reconciliation-closure.md`).
No closure record existed.

## Provenance

| Item | Evidence |
|---|---|
| Implementation commit | `e75bdfa26d0d5b8307b2341fd66303631b360bc4` (parent `41eeba29`, AGENT-TEST-RECOVERY), 2026-10-10, 14 files, no schema |
| Test repair in the same line | `3c722c398258a9c0c4dc1c28aa5f846d9b1e25e3` — operations census names the CONTENT-AGENT-2 read action; bite-proofs M13–M17 |
| Follow-up fix, not part of this phase | `2c6a41298b3f094f8b235c812e98d955958d4aa7` (CA-2 preparation failure legibility) — its message records that "a production revision request ended as no-model-answer" and that own-caption grounding was refused by the platform disclosure policy |
| On `main` | all three are ancestors of `f9ae3b4c` |
| Deployment | `dpl_GJzNEvCUGj8ZC6VsHVHFpJqt7MR1` (`2c6a4129`) named as the rollback target in `hebun-content-integrity-gs2-closure.md`; `e75bdfa2` is an ancestor of `2c6a4129` |

## What it changed (from the commit message)

Hebun preparation reads the reviewer's recorded change request for a revision and prepares the next
revision against it: a read-only change-request lookup, the operations action and UI wiring, and the
CA-2 surface, firewall, bite-proof and PostgreSQL tests.

## Evidence available, and evidence missing

- Re-measured at `f9ae3b4c`: `tests/content-agent-2/surface-and-firewall.ts` and
  `tests/ca2-preparation-failure-legibility/surface-and-firewall.ts` exit 0. The PostgreSQL and
  bite-proof suites were not re-run.
- The only recorded production use (in `2c6a4129`'s message) is a revision request that ended as
  `no-model-answer`. That is a production failure observation, not an acceptance.
- No CONTENT-AGENT-2 production acceptance, push approval or deploy approval is recorded.

## Closure Contract (v1)

- Phase: CONTENT-AGENT-2
- Owner: Work Artifacts preparation (`features/work-artifacts/`) and the Operations preparation surface
- Reached state: DEPLOYED
- Implementation commit: e75bdfa26d0d5b8307b2341fd66303631b360bc4 + 3c722c398258a9c0c4dc1c28aa5f846d9b1e25e3 — on `main` (ancestors of f9ae3b4c)
- Verification level: V2 — shared preparation seam and review lifecycle read
- Verification evidence: re-measured 2026-10-17 at f9ae3b4c — `tests/content-agent-2/surface-and-firewall.ts` exit 0 ("PASS content-agent-2 surface and firewall"), `tests/ca2-preparation-failure-legibility/surface-and-firewall.ts` exit 0 ("all assertions passed"); the release commit records no counts; postgres and bite-proof suites not re-run
- Test environment: worktree `.claude/worktrees/ap-5-entry` at f9ae3b4c, `node --import tsx`, `DATABASE_URL` unset; no PostgreSQL
- Deployment evidence: dpl_GJzNEvCUGj8ZC6VsHVHFpJqt7MR1 — recorded at 2c6a4129 in `hebun-content-integrity-gs2-closure.md` (e75bdfa2 and 3c722c39 are ancestors); also contained in dpl_3WiFeB1jLebse3vTuBKdp1at21Ri (production at 1f8f9a47); not re-measured by this reconciliation (the Vercel read seam available to it returned 404 for the project)
- Production acceptance evidence: N/A — the only recorded production use ended `no-model-answer`; no acceptance is recorded; acceptance stays OPEN (CA2-PROD-ACCEPTANCE-1)
- Deferred risks: CA2-PROD-ACCEPTANCE-1 (DEFERRED); AP-RECON-POSTGRES-UNMEASURED-1 (DEFERRED)
- Director approvals: this reconciliation record, docs only, local commit, no push (Director, 2026-10-17); the original commit, push and deploy approvals are not recorded in the repository

## Deferred risks

- **CA2-PROD-ACCEPTANCE-1 (DEFERRED)** — no recorded production revision prepared from a change
  request has succeeded under CONTENT-AGENT-2. Closes with a recorded production revision whose
  preparation read the reviewer's change request, with its revision and invocation ids.
