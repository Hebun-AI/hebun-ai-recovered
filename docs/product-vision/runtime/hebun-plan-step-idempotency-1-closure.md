# PLAN-STEP-IDEMPOTENCY-1 · closure record · VERIFIED

An AI plan step can now be followed up by at most one OPEN proposal (pending or approved) per tenant.
A repeat of the same step is refused before any model call when the origination can see it, and by a
partial unique index when two submissions race. Another step, another plan, another tenant and an
unlinked proposal are unaffected; a rejected or withdrawn proposal frees the step.

## 1 · What was implemented

| Commit | Content |
|---|---|
| `e6c00be6` | `feat(work): allow one open proposal per AI plan step`. Migration 80 (`20261022003246_plan_step_idempotency`): `heby_action_requests.plan_step_ref` (nullable text), `heby_action_requests_plan_step_ref_chk` (`^P-[0-9a-f]{12}#([1-9]|10)$`) and `heby_action_requests_open_plan_step_uq` on `(tenant_id, plan_step_ref) WHERE plan_step_ref IS NOT NULL AND status IN ('pending','approved')`. `planStepRefOf` derives `<planRef>#<step>` from a verified binding; the origination passes it beside the binding's sources through the record-work inlet to the request writer, which stores it, pre-checks inside its transaction and maps the index's violation to `plan-step-already-proposed`. `readOpenPlanStepRequest` is the origination's pre-model read (`open` / `none` / `unavailable`); `unavailable` refuses `plan-step-unverifiable`. `/heby` words both refusals. The writer reads SQLSTATE from the driver error Drizzle wraps as `cause` (see *Defect found*). New `tests/plan-step-idempotency-1/` (I1–I13, B1–B5); test pins moved for migration 80. |

**Reality before the change.** `planRef` is server-minted (`mintPlanRef`, `P-` + 48 random bits) and the
binding signs tenant, user, session, plan ref, step, move, sources and a 30-minute expiry — a trusted
step identity — but the origination kept only the sources, and the binding is deliberately not
single-use. The only duplicate guard, `heby_action_requests_one_pending_per_digest_uq`, keys on the
payload digest, and the record-work payload carries an agent-written title, so every repeat of a step
had a new digest: N submissions opened N pending proposals and cost N model calls.

**Authorities reused, unchanged.** The request writer (`recordActionRequest` /
`recordAgentOriginatedActionRequest`) is the only writer of the column; the binding remains the only
source of the identity, never the client or the model. Governance, permits, mandates, the AP-4 ceiling,
EAI, AP-3, providers, machine execution and standing authority are untouched. The value is outside the
canonical payload and digest. Request status is read as request status only — it says nothing about
whether a permit is live, spent, revoked or expired.

**No proposer CHECK.** A storage CHECK tying `plan_step_ref` to `proposed_by_actor_type = 'agent'` was
drafted and removed: the A1a and APP-2 firewalls require that no CHECK constrains an action proposal's
proposer column. The human writer has no `planStepRef` parameter, so only the agent entry point can
supply one.

**Defect found and fixed (pre-existing).** The writer classified a unique violation by `error.code`,
but Drizzle raises `DrizzleQueryError` with the driver error as `cause`. A lost race on the released
digest index was therefore reported as `persistence-unavailable`, contradicting the writer's own comment.
`driverCode` now reads the outer error or its cause; I13 proves the digest race reads `already-pending`
and B4 proves the read bites. Foreign-key classification (`purpose-work-not-found`) uses the same read.

## 2 · Verification (V3)

V3: schema/migration and the action-request writer's invariant. Full suite run with that reason stated.

| Item | Measured |
|---|---|
| Full suite, baseline `9ea2847b` | 1065 PASS / 2 FAIL of 1067 (PostgreSQL 18.0 at 127.0.0.1:5432) |
| Full suite, candidate (= `e6c00be6` content) | first pass 988/81 — migration-80 pin fan-out and one firewall (A1a/APP-2, the dropped proposer CHECK); second pass after the fixes 1067 PASS / 2 FAIL of 1069 |
| Reds, both trees | `heby-product-ux-1/production-ux-fixes.ts` PRE-EXISTING ("Hebyis" spacing, same first message); `r3w-flow/ambient-database-safety.ts` BLOCKED (:55432 unreachable; did not run — not a pass) |
| REGRESSION | 0 |
| Commit-sensitive pins | the 6 tests that read git history re-run on the committed `e6c00be6`: all pass |
| I1 | a verified step is proposed; `plan_step_ref` = `<planRef>#<step>` |
| I2 | the same step, and a re-minted binding for it, refused `plan-step-already-proposed`; no model call; nothing written |
| I3 | two concurrent originations of one step: exactly one proposal, the other `plan-step-already-proposed` (index) |
| I4 / I5 | another step of the same plan, and another plan naming the same work, are proposed |
| I6 | another tenant with the same `planRef#step` is unaffected |
| I7 / I9 | rejection frees the step; withdrawal frees it (index predicate; no product writer withdraws a request today) |
| I8 | an approved proposal holds the step |
| I10 | unlinked origination unchanged, `plan_step_ref` null |
| I11 | malformed ref and a ref without sources refused `arguments-invalid`; storage CHECK on shape; the index refuses a second open row directly |
| I12 | without the column: the plan step refuses `plan-step-unverifiable` with no model call and nothing written, and any proposal fails closed |
| I13 | the digest invariant's lost race now reads `already-pending` |
| Bite-proofs | B1 index removed → I3 fails; B2 pre-model read removed → I2 fails; B3 writer drops the step → I1 fails; B4 wrapped SQLSTATE ignored → `persistence-unavailable`; B5 unreadable treated as free → I12 fails. Disposable worktree, restored byte-for-byte |
| Static | `tsc --noEmit` 0; eslint 0 errors over the 78 changed files (one pre-existing warning in an untouched line of `trh24-machine-observation/authority-firewall.ts`); `next build` 0 (175/175) after the last src change; `git diff --check` clean; continuity PASS |

## Closure Contract (v1)

- Phase: PLAN-STEP-IDEMPOTENCY-1
- Owner: apps/dashboard/src/features/action-authorization/record-action-request.server.ts (the one request writer) with migration 80 on heby_action_requests; origination pre-read in agent-origination/originate-action.server.ts; identity from plan-follow-up-provenance/binding.server.ts
- Reached state: VERIFIED
- Implementation commit: e6c00be6 — local branch feat/plan-step-idempotency-1, not pushed
- Verification level: V3 — schema/migration and the action-request writer invariant
- Verification evidence: full suite 9ea2847b 1065/2 of 1067, candidate 1067/2 of 1069, same two reds (PRE-EXISTING heby-product-ux-1, BLOCKED r3w ambient-database-safety), 0 REGRESSION; 6 git-history tests re-run on e6c00be6 pass; I1–I13 PASS; B1–B5 bite; tsc 0; eslint 0 errors; next build 0; git diff --check clean
- Test environment: throwaway detached worktrees `.claude/worktrees/psi1-suite-9ea2847b` (baseline) and `psi1-bite` (candidate diff applied; bite-proofs and full suite), run sequentially; macOS (Darwin 25.2.0); Node 24 with tsx; PostgreSQL 18.0 superuser at 127.0.0.1:5432 (`HEBUN_TEST_ADMIN_DATABASE_URL`); fake model transport; no provider
- Deployment evidence: N/A — not deployed; migration 80 not applied to production
- Production acceptance evidence: N/A — not deployed
- Deferred risks: PSI1-PROD-MIGRATION-1 (DEFERRED); PSI1-ROLLBACK-FLOOR-1 (DEFERRED); PSI1-PROD-ACCEPTANCE-1 (DEFERRED); PSI1-NO-WITHDRAW-WRITER-1 (DEFERRED); GATE-D-PROVIDER-RECONCILIATION-1 (BLOCKED)
- Director approvals: migration 80 design and V1 open = pending + approved 2026-10-22; local implementation and commits 2026-10-22; production migration, push and deployment NOT approved

### Deferred risk detail

- **PSI1-PROD-MIGRATION-1 (DEFERRED).** Production stands at ledger 79. Order is fixed: migration 80
  through the existing production migration ceremony, ledger and digest (`771a7118128a4b2aaea16a757987b3ce`)
  verified, and only then push and deploy. Code at or after `e6c00be6` names the column in every
  action-request insert, so on a ledger-79 database every proposal — human or agent — fails closed
  (`persistence-unavailable`, nothing written) and every plan follow-up refuses `plan-step-unverifiable`.
- **PSI1-ROLLBACK-FLOOR-1 (DEFERRED).** A rollback of code below `e6c00be6` on ledger 80 is safe (the
  column is nullable and unwritten by older code; the index then binds nothing new). A rollback of the
  schema below 80 under code at or after `e6c00be6` stops all proposals; it is a Director decision.
- **PSI1-PROD-ACCEPTANCE-1 (DEFERRED).** After migration and deploy: an organic repeat of a plan
  follow-up is refused in production with no model call recorded, and the first proposal carries
  `plan_step_ref`. Nothing synthetic. Also gated by GATE-D for the AI plan itself.
- **PSI1-NO-WITHDRAW-WRITER-1 (DEFERRED).** `withdrawn` is in the request status enum and frees a step,
  but no product writer withdraws a request; a pending follow-up holds its step until a Governance
  decision rejects it. Product reach, not safety.
