# HEBY-OPERATIONAL-PLANNING-PROJECTION-1 · Controlled Agent Reasoning phase 2 · closure record · VERIFIED

Hebun can now derive a bounded, tenant-isolated planning projection from this organization's own Work
records, and checks it against the `operational-record` contract (EAI-OPERATIONAL-RECORD-1,
666ce9c5). The projection goes nowhere. Nothing at runtime imports the module; no purpose, platform
cell or tenant scope exists that would let it cross; no model has seen it. AI reasoning, provider
disclosure and execution remain off.

## 1 · Baseline (re-measured 2026-10-13)

- **`origin/main`:** `64ffae70`.
- **Local commits:** `ebe6df78`, `4543af9a` and `666ce9c5`, all intact, all fast-forwards on
  `docs/heby-ai-planning-phase1` (worktree `.claude/worktrees/heby-ai-planning-phase1`), none pushed.
- **Instructions:** identical to `origin/main`.
- **Primary tree** (`b18cb693`), `nl-plan` and `heby-org-action-planning`: not touched.

## 2 · Reused seams

| Need | Seam | Why it is the authority |
|---|---|---|
| Work items | `readWorkRegister(tenant)` → `WorkItemView` | Work's one register read. It takes no tenant, item or department parameter and predicates on `workItems.tenantId = tenant.tenantId`. Order: newest recorded first. Bound: 200, with `truncated`. |
| Declared evidence | `readWorkEvidenceReferences(tenant)` (WEV-1) | Work's one relationship read: current declarations only, tenant predicate, at most 200, **no truncation flag**. |
| Department | `/plan`'s `matchesDepartment`, now exported, over a scope that Organization Authority already resolved (`resolvePlanDepartment`) | It is the existing filter, not a copy. |
| Staleness | `/plan`'s rule, now the exported `isStale` | `composeActionPlan` calls the same function; its output is unchanged. |
| Contract | `validateOperationalPlanningProjection` | EAI-OPERATIONAL-RECORD-1 |

## 3 · What was built

All of it lives in `apps/dashboard/src/features/heby-commands/operational-planning-projection.server.ts`.

**`projectOperationalPlanning({ register, evidence, scope, now })`** is pure. It:
1. keeps only in-service items in scope;
2. maps each item to the five contract fields;
3. assigns aliases;
4. validates the result against the contract;
5. returns either `{ status: "projected", projection, dataClasses: ["operational-record"], aliases }` or `{ status: "unavailable", reason }`.

**`readOperationalPlanningProjection(tenant, scope)`** hands both reads the one authenticated tenant,
then calls the pure function. Without a tenant it reads nothing.

Fail-closed reasons: `no-tenant`, `register-unavailable`, `register-truncated`,
`evidence-unavailable`, `evidence-incomplete` (a read at its 200 bound may be partial),
`nothing-in-scope`, `too-many-items` (over 40), `contract-refused`. Nothing is truncated or guessed.

## 4 · Field semantics

| Field | Derivation | Means | Never means |
|---|---|---|---|
| `state` | `declaredState`: planned / active / blocked / complete | What a human declared | Observed progress or outcome |
| `accountable` | `accountableActorId !== null` | A human is recorded accountable | Who, or that the person is still an active member. Membership status is Identity's fact and is not projected. |
| `stale` | `isStale`: last change at least 30 days ago | No change recorded for 30 days | Late or overdue (no deadlines exist) |
| `evidenceDeclared` | A current WEV-1 declaration names this item | Work records a declaration, whether or not its referent still resolves | `false` never means "no evidence exists". It means Work records no current declaration, and only when the read was available and below its bound. |

## 5 · Alias isolation

- **Ordering:** `W1..Wn` follow the register's order and are deterministic for the same input.
- **Where the mapping lives:** the alias → id map is returned beside the projection as a `Map`, so an
  accidental `JSON.stringify` of the whole result carries no id. The map is not in the projection,
  any log, audit metadata, error, client bundle or persisted record. No such path exists: the module
  writes nothing, logs nothing, and nothing imports it.
- **Scope of an alias:** it resolves only in the map that minted it, which was built from one
  tenant's register. It grants nothing.

## 6 · Tenant isolation

- **No tenant field:** the projection carries none.
- **One tenant for both reads:** both readers receive the one authenticated tenant. The wrapper
  cannot pair two tenants, and the test pins that call by source.
- **Unrepresentable cross-tenant read:** each reader predicates on its own tenant column (pinned by
  source), so a read of another organization cannot be expressed.
- **Foreign declarations:** a declaration for a work item outside the register marks nothing.

## 7 · Verification

**Suite:** `tests/heby-operational-planning-projection/projection.ts`, PASS. It covers:
- state mapping across all four states;
- accountable (none, active member, inactive member);
- staleness at the 30-day edge, cross-checked against `/plan`'s own `Derived` count;
- evidence (declared, unresolved referent, none, foreign, unreadable, at the bound);
- department filtering (case and spacing as `/plan`, other department, none, retired, no scope);
- stable aliases and per-invocation maps;
- bounds 40 / 41 and truncated or unavailable register;
- exactly the contract's five fields, accepted by the validator;
- no UUID, date, title, name, department name, referent label or secret in either the projection or
  the whole serialized result;
- tenant pairing and no read without a tenant;
- the module imports only two Work seams, the Work vocabulary, the contract and `/plan`'s rules;
- no writer, model, Governance, permit, execution or audit module is reachable;
- nothing in `src` imports the module.

**Bite-proofs.** Each mutation was applied to a copy and restored from it (`cmp` equal). Each made
the suite exit 1:

1. A projected `title`.
2. Treating a read at its bound as complete.
3. Handing the evidence read a different tenant object.
4. Moving the stale edge from `>=` to `>` (a first attempt did not apply the mutation, which was
   caught by a zero match count and redone).
5. Deriving `accountable` from membership.

**Regression.** I ran the 127 suites that name `heby-commands`, the Work readers, `organizational-work`,
`action-plan` or `external-ai-data-use` (non-Postgres) before and after the change. The results are
identical (`diff` empty): 103 pass and 24 were already red at 666ce9c5. None of the 24 failure
messages mentions this phase's files. The red suites that could hide a Work-reader census
(rev3, wev1, int5c) fail on unrelated earlier assertions or on the Postgres harness.

`/plan` and natural-language planning (`heby-org-action-planning/action-plan.ts`,
`natural-language.ts`) PASS.

**EAI firewall.** `external-ai-data-use-1a/firewall-and-inertness.ts` PASS, with its importer census
extended by this module and a stated reason. A new assertion pins that the module imports only the
contract from the authority.

**Not run.** No Postgres test exists for this module. The disposable Postgres harness fails at
`npx drizzle-kit migrate` in this worktree; `heby-org-action-planning/plan-postgres.ts` fails the same
way at baseline. Isolation over real readers therefore rests on the readers' pinned predicates and
their own suites. The gap is recorded as `PROJECTION-POSTGRES-PROOF-1`.

## 8 · Limits

- An inactive accountable member reads `accountable: true`. The contract's boolean says "recorded",
  not "reachable"; a reachability flag would be a new contract field and a Director decision.
- A register over 200 rows, or more than 200 current evidence declarations, makes the projection
  unavailable for the whole organization.

## 9 · Remaining blockers for phase 3

- **Director decisions** D1 (`work-planning` purpose, one migration), D2 (adopt the
  `operational-record` meaning), D7 (whether states and flags without titles are worth a disclosure)
  and D4 (the platform cell). Without them nothing may declare `operational-record`.
- **The model side:** the closed output contract (steps over aliases, `because` codes checked against
  this projection), its parser, its evidence validator and the server-side rendering. These are
  designed in the phase-1 design record and not implemented.
- **A tenant ceremony** and **one billable acceptance call** (D5, D6), each its own gate.

## Closure Contract (v1)

- Phase: HEBY-OPERATIONAL-PLANNING-PROJECTION-1
- Owner: apps/dashboard/src/features/heby-commands (operational-planning-projection.server.ts; action-plan.ts exports `matchesDepartment` and `isStale`)
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V2 — the shared `/plan` module gained two exports that `composeActionPlan` now calls, and the EAI importer census gained one reader. Every suite that names those seams was run before and after, alongside the tenant, failure and bound scenarios in §7. Not V3: no authority, policy, purpose, schema, provider, execution or runtime path changed; nothing imports the module.
- Verification evidence: `node --import tsx tests/heby-operational-planning-projection/projection.ts` exit 0; five bite-proofs each exit 1, restored by `cmp`; 127 related suites before and after identical (103 pass, the same 24 baseline failures); `external-ai-data-use-1a/firewall-and-inertness.ts`, `eai-operational-record/contract-and-boundary.ts`, `heby-org-action-planning/action-plan.ts` and `natural-language.ts` exit 0; `tsc --noEmit` exit 0; `eslint` on the four touched files exit 0; `git diff --check` exit 0; development-continuity closure-contract exit 0
- Test environment: worktree `.claude/worktrees/heby-ai-planning-phase1` at 666ce9c5 plus this phase's changes; macOS (Darwin 25.2.0); tsx from the shared `apps/dashboard/node_modules`; no database, no provider, no credential
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not released; nothing at runtime imports the projection
- Deferred risks: PROJECTION-POSTGRES-PROOF-1 (DEFERRED)
- Director approvals: the projection builder, alias isolation, targeted security tests, the importer census extension and a focused local commit (CONTROLLED AGENT REASONING · PHASE 2 brief, 2026-10-13); push, deploy, disclosure activation, a new purpose, tenant ceremony, provider calls and arming NOT approved
