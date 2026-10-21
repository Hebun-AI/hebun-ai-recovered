# EXECUTION-AUTHORITY-1 · closure record · VERIFIED

A human may now execute an approved permit only while they hold the tenant's Governance authority —
the bootstrap human or an active delegate, exactly as `resolveGovernanceAuthority` answers. Before
this phase, approving and revoking asked that authority, but spending did not: any authenticated
member of the tenant could execute an approved send, Instagram or YouTube publication, work record,
placement or work-state change.

## 1 · What was implemented

| Commit | Content |
|---|---|
| `713a9f70` | `fix(security): require Governance authority for human permit execution`. `consumeActionPermit` (door one, the human spend) asks `resolveGovernanceAuthority` before the spend transaction opens and refuses `no-governance-authority` / `not-the-governance-authority`. `executeAuthorizedAction` asks the same resolver first — before the arming read, the recipient read, the publish capability and the YouTube provider read, all of which precede its spend. `executeRecordWork`, `executePlaceHuman` and `executeSetWorkDeclaredState` pass the two refusals through instead of folding them into `permit-not-consumable`. `/approvals` words the refusal from the server's reason; it holds no authority information and infers none. New `tests/execution-authority-1/execution-authority-postgres.ts` (E1–E9) and `bite-proofs.ts` (B1–B4). |

**Root cause.** `consumeActionPermit` required only `tenant.tenantId`, and the four human executors only
an authenticated tenant user (`execute-authorized-action.server.ts`, the three
`governed-internal-action` executors). `decide-action-request` and `revoke-action-permit` already asked
`resolveGovernanceAuthority`; the spend was the one human step that did not.

**Authorities reused, unchanged.** `resolveGovernanceAuthority` (bootstrap or active delegation) is the
only answer; no role, membership scope or client value is read. The single spend statement
(`spendPermit`), permits, Governance decisions, the AP-4 ceiling, WF-4 continuing authority and the Work
and Organization authorities are untouched. Door two (`consumeActionPermitAsMachine`), the machine
executor and the standing issuer do not ask the human question and were not changed. No migration,
schema, permission, provider, mandate, envelope, route or action kind was added. No executor role and
no four-eyes rule (Director decisions). Kind-specific external arming is deferred.

**Behaviour.** A refusal happens before any spend, so the permit stays `active` and nothing is written:
no work row, handoff, audit row, decision or execution attempt. An unreadable authority or a tenant
with no Governance refuses (`no-governance-authority`), never permits. Execute stays visible on
`/approvals`; the server is the one place that answers.

## 2 · Verification (V3)

V3: an authorization boundary of the execution path. Full suite run with that reason stated.

| Item | Measured |
|---|---|
| Full suite, baseline `afc5d23a` | 1063 PASS / 2 FAIL of 1065 (PostgreSQL 18.0 at 127.0.0.1:5432) |
| Full suite, candidate (= `713a9f70`) | 1065 PASS / 2 FAIL of 1067 — the two new files pass; the same two files fail with the same first messages |
| Baseline reds | `heby-product-ux-1/production-ux-fixes.ts` PRE-EXISTING ("Hebyis" spacing assertion, both trees); `r3w-flow/ambient-database-safety.ts` BLOCKED (canonical :55432 unreachable; did not run — not a pass) |
| REGRESSION | 0 |
| E1 | a non-authority member is refused by door one and by all three internal executors with `not-the-governance-authority` |
| E2 | the permits stay `active`, unconsumed, no handoff; work, attempt, spend, audit and decision counts unchanged |
| E3 | the external executor refuses the member with no arming read, control read, adapter, Instagram or YouTube seam reached |
| E4 | the bootstrap authority executes as before; a replay is still `permit-not-consumable` |
| E5 | a foreign tenant's own authority still cannot spend (`permit-not-consumable`) |
| E6 / E7 | an ungoverned tenant's human and an unreadable authority both refuse `no-governance-authority` |
| E8 | an active delegate executes — the resolver's semantics, not a bootstrap-only rule |
| E9 | door two, the machine executor and the standing issuer do not reference the resolver; door one asks before `spendPermit`; the external executor asks before `resolveExternalSendReachability` |
| Bite-proofs | B1 door one admits any member → E1 fails; B2 bootstrap-only → E8 fails; B3 external guard removed → the arming spy is reached; B4 record-work hides the refusal → E1 fails. Run in a disposable worktree, restored byte-for-byte |
| Existing negative controls | r3a, r3b, gia1, gia2, rung1, rung2 (standing, act path, delivery, containment), publish-0, youtube-write-2, l2b, wf4 and approvals-dashboard suites all pass unchanged in the candidate run |
| Static | `tsc --noEmit` 0; eslint 0 over the changed files; `next build` 0 (175/175); `git diff --check` clean |

## Closure Contract (v1)

- Phase: EXECUTION-AUTHORITY-1
- Owner: apps/dashboard/src/features/action-authorization/consume-action-permit.server.ts (door one) and action-execution/execute-authorized-action.server.ts; the three governed-internal-action executors pass the refusal through; Governance's resolveGovernanceAuthority unchanged
- Reached state: VERIFIED
- Implementation commit: 713a9f70 — local branch feat/execution-authority-1, not pushed
- Verification level: V3 — authorization boundary of human execution
- Verification evidence: full suite afc5d23a 1063/2 of 1065, candidate 1065/2 of 1067, same two reds (PRE-EXISTING heby-product-ux-1, BLOCKED r3w ambient-database-safety), 0 REGRESSION; E1–E9 PASS; B1–B4 bite; tsc 0; eslint 0; next build 0; git diff --check clean
- Test environment: throwaway detached worktrees `.claude/worktrees/ea1-suite-afc5d23a` (baseline) and `ea1-bite` (candidate diff applied; bite-proofs and full suite), run sequentially; macOS (Darwin 25.2.0); Node 24 with tsx; PostgreSQL 18.0 superuser at 127.0.0.1:5432 (`HEBUN_TEST_ADMIN_DATABASE_URL`); no provider, no model
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not deployed
- Deferred risks: EA1-PROD-ACCEPTANCE-1 (DEFERRED); EA1-KIND-ARMING-1 (DEFERRED)
- Director approvals: implementation with Governance authority required for human execution, resolveGovernanceAuthority reused, no executor role, no four-eyes rule, kind-specific arming deferred, machine and standing paths unchanged 2026-10-21; local commits 2026-10-21; push and deployment NOT approved

### Deferred risk detail

- **EA1-PROD-ACCEPTANCE-1 (DEFERRED).** After push and deploy: one real execution by the Director of
  an organically approved permit succeeds as before. A production refusal of a non-authority member is
  observed only if an organic second member exists; no member, permit or act is created for the
  purpose. Until deployed, any member of a tenant can still execute in production.
- **EA1-KIND-ARMING-1 (DEFERRED).** External arming is one conjunction checked before the kind
  dispatch, so arming email sending also arms Instagram and YouTube publication. Kind-specific arming
  was deferred by the Director; it is a design decision of its own and may need schema.

A rollback below `713a9f70` reopens the execution gap; nothing is stored by this phase, so no data or
permit is affected by one.
