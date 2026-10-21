# WORK-UPDATE-ORGANIZATION-SCOPE-1 · closure record · VERIFIED

An agent may now propose a declared-state change for **organization-level** work — every AI plan
follow-up is recorded that way — and not only for domain work. It is admitted only by an explicit
`organization` responsibility grant in the agent's mandate. A human still chooses the item and the
state, a human authorizes, and the Work authority performs the change.

## 1 · What was implemented

| Commit | Content |
|---|---|
| `e93f904b` | `feat(work): allow governed state proposals on organization-level work`. `readWorkStateTarget` returns the item's recorded `workScope` (organization, domain, or `null`); the inlet freezes it with `workScopeArguments`; the registry admits `workScope ∈ {domain, organization}` with `workDomainRef` present exactly for domain; the executor reads it back with `workScopeFromPayload`; `declareWorkStateUnderPermit` re-checks the held scope under its row lock; the preflight and agent chooser pass the item's scope to `listEligibleAgents`; the `/heby` selection copy names only NULL scope as refused. New `tests/work-update-organization-scope-1/organization-scope-postgres.ts`; four pins restated. |
| `9699515d` | `test(work): …` — WORK-UPDATE bite-proof B3 anchored on the scope-typed check; the mutation is unchanged. |

**Authorities reused, unchanged.** The AP-4 responsibility ceiling (`refuseOutsideAgentResponsibility`,
which already treats organization and domain grants as disjoint) asked at origination, preflight,
spend and standing issuance; Governance approval and single-use permits; the Work authority's governed
state door. No migration, schema, route, provider permission, action kind, lifecycle or execution
authority was added; the model request is unchanged.

**Canonical payload.** Domain: `{workItemRef, fromState, toState, workScope: "domain", workDomainRef}` —
byte-identical, digest proven equal to the released shape's. Organization:
`{workItemRef, fromState, toState, workScope: "organization"}` — no domain reference (one would make the
scope contradictory and unreadable).

**Machine execution.** Unsupported for this kind, as before: the machine allowlist holds `record-work`
only and refuses with `action-kind-not-machine-executable`, permit untouched.

## 2 · Verification (V3)

V3: the canonical authorization payload and the Work authority's governed write path changed. Full
suite run with the reason stated.

| Item | Measured |
|---|---|
| Full suite, baseline `6e4fe747` | 1062 PASS / 2 FAIL of 1064 (PostgreSQL 18.0 at 127.0.0.1:5432) |
| Full suite, candidate `e93f904b` | 1062 PASS / 3 FAIL of 1065 — the third, `work-update-v1/bite-proofs.ts` B3, anchored on the replaced line |
| Correction `9699515d` | diff is that anchor only (+3/−2, one test file); B1–B13 all bite |
| Focused at `9699515d` | 8/8 exit 0: `work-update-v1/*` (5), `work-update-agent-selection-1/*` (2), `organization-scope-postgres.ts` (O1–O10) |
| Baseline reds | `heby-product-ux-1` (soft-assert sets identical on both trees, 1 assertion) and `r3w-flow/ambient-database-safety` (canonical :55432 unreachable; did not run) |
| New-test bite-proofs | organization lock check forced true; executor rejecting organization; target read dropping organization — all caught |
| Static | `tsc --noEmit` 0; eslint 0 over the changed files; `next build` 0 (175/175) at `e93f904b` (source unchanged since); `git diff --check` clean |

## Closure Contract (v1)

- Phase: WORK-UPDATE-ORGANIZATION-SCOPE-1
- Owner: apps/dashboard/src/features/heby-action-inlet/work-state-proposal.server.ts and organizational-work (scope read and governed state door) with governed-internal-action/execute-set-work-state.server.ts; the AP-4 ceiling, Governance, permits and the machine allowlist unchanged
- Reached state: VERIFIED
- Implementation commit: e93f904b with 9699515d — local branch feat/work-update-organization-scope-1, not pushed
- Verification level: V3 — canonical authorization payload and the Work authority's governed write path
- Verification evidence: full suite 6e4fe747 1062/2 of 1064, e93f904b 1062/3 of 1065 (third = B3 anchor, fixed in 9699515d); 8/8 focused at 9699515d including B1–B13 and O1–O10; 3 new-test mutations caught; tsc 0; eslint 0; next build 0; git diff --check clean
- Test environment: throwaway detached worktrees `.claude/worktrees/wuos-suite-e93f904b` (moved to 9699515d) and `wuos-suite-6e4fe747`, run sequentially; macOS (Darwin 25.2.0); Node 24 with tsx; PostgreSQL 18.0 superuser at 127.0.0.1:5432 (`HEBUN_TEST_ADMIN_DATABASE_URL`); no provider, no model
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not deployed
- Deferred risks: WUOS-PROD-ACCEPTANCE-1 (DEFERRED); WUOS-ROLLBACK-FLOOR-1 (DEFERRED)
- Director approvals: implementation of organization-scoped state proposals with an explicit organization grant, NULL scope still refused 2026-10-21; local commits and this record 2026-10-21; push, deployment and any production mandate or responsibility change NOT approved

### Deferred risk detail

- **WUOS-PROD-ACCEPTANCE-1 (DEFERRED).** Inert in production until a Director-chosen agent holds an
  `organization` responsibility grant (a mandate revision through the existing ceremony; none exists
  today). Then: one proposal on a real organization-level item, a human approval, one human execution,
  the register showing the new state authored by the system. The new `/heby` copy is server-rendered
  only. Acceptance dependency: push and deploy, the grant decision, organic work; nothing synthetic.
- **WUOS-ROLLBACK-FLOOR-1 (DEFERRED).** A deployment older than `e93f904b` cannot read an organization
  payload: it refuses such a permit fail-closed and the permit stays active, so pending organization
  requests become unexecutable during a rollback; nothing is corrupted and no migration is involved.
  Acceptance dependency: a Director decision whenever a rollback below `e93f904b` is considered while
  organization-scope requests are pending.
