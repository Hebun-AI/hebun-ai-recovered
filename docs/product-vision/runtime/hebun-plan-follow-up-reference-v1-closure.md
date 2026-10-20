# PLAN-FOLLOW-UP-REFERENCE-V1 · closure record · DEPLOYED

An AI plan step carries a server-signed binding (HMAC-SHA256 under the dedicated
`HEBUN_PLAN_FOLLOW_UP_BINDING_SECRET`, 30-minute expiry, bound to tenant, user, session, plan ref, step,
move and the ordered work item ids) of the work items it named. A follow-up proposal made from that step
records those items as its source work beside the request, outside the canonical payload and its
digest; when the approved request is spent, by the human or the machine door, the Work authority
re-checks every source and records the follow-up relationship in the same transaction. The origination
model still receives only the fixed goal sentence. This resolves PLAN-FOLLOW-UP-REFERENCE-1, deferred by
HEBY-PLAN-DELEGATION-1.

**States, as measured.** IMPLEMENTED · LOCALLY VERIFIED · MIGRATED · PUSHED · DEPLOYED · CONFIGURED.
RUNTIME VERIFICATION PENDING · PRODUCTION ACCEPTANCE PENDING. Configuration is not runtime verification:
no signed-in production render has shown a linked follow-up yet.

## 1 · What was released

| Commit | Content |
|---|---|
| `1dbb80b9` | `feat(work): link plan follow-ups to their source work with signed provenance`. Binding signer/verifier (`plan-follow-up-provenance/binding.server.ts`); Work's source rule (`organizational-work/follow-up-source-work.server.ts`); request-side reads (`action-authorization/request-source-work.server.ts`); writers in `record-action-request.server.ts` and `write-work.server.ts`; both executors read provenance from the request's own rows; `/approvals` and the work register show it. Migration 79 `20261020170430_plan_follow_up_source_work`: `heby_action_request_source_work_items` and `work_item_follow_up_sources`, tenant-composite FKs, UPDATE/DELETE/TRUNCATE refused by trigger. |
| `2e2bf5b1` | `test(work): …` — `google-capability-scope-repair-1` git-diff pin admits migration 79; `machine-provenance-postgres.ts` proves the machine door (bite-checked). |

## 2 · Verification (V3)

V3: a schema migration, the action-authorization and Work write paths, both execution doors, and a new
secret. Full suite chosen because the migration moves every ledger pin.

| Item | Measured |
|---|---|
| Full suite, baseline `abdfb872` | 1057 PASS / 2 FAIL of 1059 |
| Full suite, candidate `1dbb80b9` | 1059 PASS / 3 FAIL of 1062 — the third (`google-capability-scope-repair-1`, a `git diff <sha>` pin that sees a migration only once committed) fixed in `2e2bf5b1` |
| Baseline reds, unchanged | `heby-product-ux-1` ("Hebyis"; soft-assert sets identical on both trees, 1 assertion) and `r3w-flow/ambient-database-safety` (canonical :55432 unreachable on both trees — that proof did not run) |
| After `2e2bf5b1` | 108/108 focused (PFR tests, git-state and tests-tree pins); full suite not re-run — the delta is two test files |
| Static | `tsc --noEmit` 0; eslint 0 errors over the 102 touched files; `next build` 0; `git diff --check` clean; client bundle has 0 references to the secret name or the signing label |

## 3 · Production

| Gate | Measured |
|---|---|
| Migration | Director ran `platform:migrate` (this session's attempt was refused by the tool permission layer): SUCCESS, Neon PostgreSQL 18.6, ledger 78 → 79, digest `a69aca9af0a9a2f61ab17281259814a1`, backup verified, organizational data UNCHANGED. Reported by the Director; not read by this session. |
| Push | Director pushed `abdfb872..2e2bf5b1` to `main` (fast-forward); `origin/main` read as `2e2bf5b1aeb13341da58eb8a9cf982a0c35d29a9`. |
| Deploy (dark) | `dpl_5boTRQNEQ3TicswXwb9vdBJhoz2F` READY, `githubCommitSha` `2e2bf5b1…`, source git, 2026-10-20T20:20:23Z → 20:21:59Z; secret absent. |
| Secret | `HEBUN_PLAN_FOLLOW_UP_BINDING_SECRET` present in Production, type `sensitive`, updated 2026-10-20T20:46:14Z (name and metadata read; value never read). Length ≥ 32 is not verifiable from metadata. |
| Deploy (configured) | `dpl_7FqXaQMY5d4PSJ491fuEYA44udji` READY, `githubCommitSha` `2e2bf5b1…`, source redeploy, created 2026-10-20T20:47:14Z (after the secret). `www.hebuntech.com` and `hebuntech.com` resolve to it (Vercel alias record). |
| Smoke | `/` 200, `/login` 200; signed-out `/approvals`, `/director/work`, `/heby` 307 → `/login`. |
| Runtime binding | PENDING — no signed-in render of the "will be linked" line has been observed. |
| End-to-end acceptance | PENDING — see PFR-RUNTIME-ACCEPTANCE-1. |

## Closure Contract (v1)

- Phase: PLAN-FOLLOW-UP-REFERENCE-V1
- Owner: apps/dashboard/src/features/organizational-work (source rule, follow-up relationship writer and reader) with plan-follow-up-provenance/binding.server.ts (signed binding), action-authorization (request-side provenance) and both record-work executors; Governance, permits and the canonical payload/digest unchanged
- Reached state: DEPLOYED
- Implementation commit: 1dbb80b9676006cb70d89a06ab687239a0717045 with 2e2bf5b1aeb13341da58eb8a9cf982a0c35d29a9 — released on `main` (fast-forward from abdfb872)
- Verification level: V3 — schema migration 79, action-authorization and Work write paths, both execution doors, a new secret
- Verification evidence: full suite abdfb872 1057/2 of 1059, 1dbb80b9 1059/3 of 1062 (third red fixed in 2e2bf5b1, 2 baseline reds identical by soft-assert set); 108/108 focused after 2e2bf5b1; machine-door Postgres test bite-checked; tsc 0; eslint 0 errors; next build 0; git diff --check clean
- Test environment: throwaway detached worktrees `.claude/worktrees/pfr1-suite-1dbb80b9` and `pfr1-suite-abdfb872`, run sequentially; macOS (Darwin 25.2.0); Node 24 with tsx; PostgreSQL 18.6 superuser instance at 127.0.0.1:55433 (`HEBUN_TEST_ADMIN_DATABASE_URL`); no provider, no model
- Deployment evidence: dpl_7FqXaQMY5d4PSJ491fuEYA44udji READY production at 2e2bf5b1aeb13341da58eb8a9cf982a0c35d29a9 (source redeploy, created 2026-10-20T20:47:14Z, after the secret), aliases www.hebuntech.com and hebuntech.com; earlier dark deploy dpl_5boTRQNEQ3TicswXwb9vdBJhoz2F; smoke `/` 200, `/login` 200, signed-out `/approvals`, `/director/work`, `/heby` 307
- Production acceptance evidence: N/A — runtime binding and end-to-end acceptance PENDING (PFR-RUNTIME-ACCEPTANCE-1)
- Deferred risks: PLAN-FOLLOW-UP-REFERENCE-1 (CLOSED); PFR-RUNTIME-ACCEPTANCE-1 (DEFERRED); PFR-ROLLBACK-FLOOR-1 (DEFERRED)
- Director approvals: read-only release-readiness gate and local corrections 2026-10-20; production migration 79 2026-10-20 (executed by the Director); push of 1dbb80b9..2e2bf5b1 and deployment 2026-10-20 (pushed by the Director); secret configured and redeployed by the Director 2026-10-20; read-only deployment verification 2026-10-20; this closure record 2026-10-21; push of this documentation NOT approved

### Deferred risk detail

- **PLAN-FOLLOW-UP-REFERENCE-1 (CLOSED).** A follow-up proposal now carries a model-invisible,
  server-verified reference to its source work; deployed in `2e2bf5b1`.
- **PFR-RUNTIME-ACCEPTANCE-1 (DEFERRED).** Not yet observed in production, in order: a real AI plan
  over existing work whose step shows "The proposal will be linked to the N work items…" (proves the
  configured secret mints a binding); a follow-up proposed from it with no `binding-*` refusal;
  `/approvals` showing "Follow-up of N work items: …"; a legitimate human authorization; an actual
  execution (human, or machine delivery where the tenant is enrolled); the register showing "Follows
  up: …" on the new item and "Follow-up work recorded for this item: …" on its sources. Acceptance
  dependency: organic work and a Director decision; no synthetic work, request or permit is created.
- **PFR-ROLLBACK-FLOOR-1 (DEFERRED).** Code at or after `1dbb80b9` must never serve a schema below 79:
  every record-work spend reads the new table and would refuse `execution-unavailable` (fail closed).
  A deployment older than `1dbb80b9` would spend a pending linked request without re-checking its
  sources and without recording the relationship (request-side provenance stays; Governance, digest
  and single-use permits are unaffected). Before any such rollback: remove the secret, check for
  pending linked requests, prefer a forward fix. Never drop the tables, delete provenance rows,
  disable the triggers or force-push. Acceptance dependency: a Director decision whenever a rollback
  below `1dbb80b9` is considered.

**Lesson.** A pin built on `git diff <sha>` passes falsely before the migration it should see is
committed; run the full suite on the committed candidate before calling it green.
