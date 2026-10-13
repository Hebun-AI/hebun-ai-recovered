# HEBY-AI-PLAN-OUTPUT-CONTRACT-1 · Controlled Agent Reasoning phase 3 · closure record · VERIFIED

This phase did two things. It closed PROJECTION-POSTGRES-PROOF-1 with a real PostgreSQL proof of the
operational planning projection's data boundary. And it added the closed output contract, strict
validator and server-written rendering for a future model-proposed operational plan.

No model was called. No candidate came from a model. No data class is authorized for disclosure,
and nothing at runtime imports the new module. AI reasoning, provider disclosure and execution
remain off.

## 1 · Baseline (re-measured 2026-10-13)

- **`origin/main`:** `64ffae70`.
- **Local commits:** `ebe6df78`, `4543af9a`, `666ce9c5` and `ee7a84e1`, all intact on
  `docs/heby-ai-planning-phase1` (worktree `.claude/worktrees/heby-ai-planning-phase1`), none pushed.
- **Instructions:** identical to `origin/main`.
- **Other trees:** none touched.

## 2 · The PostgreSQL blocker: root cause

The failure was in the **environment configuration**, not the application.

- **What runs where.** `tests/helpers/disposable-postgres.ts` defaults its admin URL to
  `127.0.0.1:55432`. On this machine that is **PostgreSQL 14.20**. The other local server,
  `127.0.0.1:5432`, is **PostgreSQL 18.0**.
- **What failed.** Applying the migrations one by one with `psql -v ON_ERROR_STOP=1` on a
  disposable PG14 database fails at migration **#74**,
  `20261007064348_ap1_agent_name_in_service_uniqueness.sql`, with
  `collation "pg_c_utf8" for encoding "UTF8" does not exist`.
- **Why.** The builtin `pg_c_utf8` collation first shipped in PostgreSQL 17.
- **Why it looked opaque.** `drizzle-kit migrate` exits 1 with no message.
- **On PG18.** The full ledger applies cleanly.
- **The fix.** The harness already supports another server through
  `HEBUN_TEST_ADMIN_DATABASE_URL`. No migration, harness or infrastructure was changed.
- **Precedent.** PG18 already holds `hebun_test_*` databases from earlier sessions.
- **How to run every Postgres suite here:**
  `HEBUN_TEST_ADMIN_DATABASE_URL=postgresql://<user>@127.0.0.1:5432/postgres`.

The production Postgres version was not measured in this phase.

**Teardown flake, observed and not fixed.** Under PG18, an occasional `pg_terminate_backend` error in
`dropDatabase()` makes a suite that printed PASS exit 1 and leaves its disposable database behind. I
saw it on the first run of `plan-postgres`, `work1 work-postgres`, `external-ai-data-use-1a
authority-postgres` and `wev1 evidence-postgres`. Each passed exit 0 on two clean re-runs, and
`projection-postgres` passed on all four runs.

This session's four leftover disposable databases on 5432 were not dropped, because deleting them is
a Director gate:

- `hebun_test_hebun_heby_action_plan_8dfce1756990c1b0`
- `hebun_test_hebun_external_ai_1a_37bd7d8e07ae51bf`
- `hebun_test_hebun_wev1_evidence_385e35dd804e5306`
- `hebun_test_hebun_work1_register_8004ab0ee31d241b`

## 3 · Real-DB proof: PASS

`tests/heby-operational-planning-projection/projection-postgres.ts` runs on disposable PostgreSQL 18
with the released readers, the released writers and two organizations. Results:

| Claim | How it is proved |
|---|---|
| Register reads are tenant-scoped | Every `readWorkRegister` row is in `select id from work_items where tenant_id = acme`, and no globex row appears. |
| Evidence reads are tenant-scoped | Acme reads its one declaration; globex reads its two. |
| Cross-tenant evidence cannot influence another projection | Globex's declarations leave acme's flags false, and the reverse. The database refuses (SQLSTATE `23503`, composite FK) a declaration that puts globex rows on acme's work, and one that has acme's work cite globex's fact. |
| Tenant context comes from the authenticated session | `TenantContext` is built from a seeded session row; with no context nothing is read. A context naming a tenant id that is no organization reads nothing (`nothing-in-scope`). *The session → context resolution itself is `resolveTenantContext`, proved by its own suites, not here.* |
| The 200-row bound cannot produce a false negative | 202 current declarations exist in the database. The released reader returns 200 and **does omit** a1's and a2's current declarations. The projection is `evidence-incomplete`, not `false`. After 3 withdrawals (199 current) the same items read `true`. |
| Unavailable when completeness cannot be established | With 201 work items the projection is `register-truncated`. Globex's projection is unchanged by acme's volume. |
| Reading writes nothing | A row census of every `public` table (from `pg_tables`, not a hand-written list) is equal before and after the projection reads. |

Bite-proofs on the real-DB suite. Each mutation was confirmed applied (match count 0 after `sed`) and
restored by `cmp`:

1. Removing the evidence-bound guard → exit 1 at "unavailable, never a false 'no evidence'".
2. Removing the register-bound guard → exit 1.

**Resolves PROJECTION-POSTGRES-PROOF-1.**

## 4 · Output contract

All of it lives in `apps/dashboard/src/features/heby-commands/operational-plan-candidate.ts`. It is
pure and imports only the `operational-record` contract and `/plan`'s vocabulary.

```
{ "planRef": "P-<12 hex>",                         // issued per response by mintPlanRef; not stored
  "steps": [ { "step": 1..n,                        // contiguous; at most 10
               "move": "review-blocked" | "find-accountable" | "review-stale" | "declare-evidence",
               "items": ["W1", …],                  // aliases of THIS projection, unique, non-empty
               "because": ["state:blocked", …],     // 1–5 codes over the five projection fields
               "priority": "high" | "medium" | "low",
               "afterStep": null | <an earlier step> } ],   // a suggested order, never a dependency
  "uncertainty": "low" | "medium" | "high" }
```

**No free text.** There is no free-text field. The reasoning is the `because` codes, which are
checked. The summary a human reads is written by Hebun from those codes. No model sentence is ever
shown, and none is claimed to be evidence-verified.

**What the model can never introduce.** There is no field for:

- a work item identity, a title or a description;
- a deadline, a dependency or a responsible person;
- a permission, an approval or an execution outcome;
- an organization fact or a piece of evidence.

The validated type is `{ planRef, kind: "recommendation", steps, uncertainty }`. It has no status,
approval, permit or outcome field.

## 5 · Evidence validation

The order is fixed and the first defect refuses the whole candidate. A refusal carries only
`{status, reason}` and nothing from the response.

1. The supplied projection must itself pass the contract (`projection-invalid`).
2. The response must be a string of at most 8,000 characters (`response-too-large`).
3. It must be one whole-string JSON object or one fenced block (`not-a-structured-object`).
4. Top-level keys must be exactly the three (`unexpected-shape`).
5. `planRef` must equal the issued ref (`plan-ref-mismatch`).
6. `uncertainty` must be a known value.
7. There must be at most 10 steps.
8. For each step:
   - exactly the six keys;
   - step number equal to its index;
   - known move and priority;
   - `afterStep` null or an earlier step;
   - known, unique aliases;
   - 1–5 known, unique codes;
   - **every code true of every item it is cited for** (`reason-not-supported`);
   - **the move's licensing fact cited** (`move-not-supported`);
   - no duplicate (move, items) step.

## 6 · Security and injection tests

`tests/heby-operational-planning-projection/plan-candidate.ts` (PASS) checks every case below with
hand-written candidates over a projection built by the real builder:

| Case | What is refused |
|---|---|
| Unknown fields | 17 field names at both levels: title, deadline, dueAt, owner, assignee, dependsOn, blocks, approved, status, permit, execute, action, reasoning, summary, evidence, tenantId, workItemId |
| Missing fields | At both levels |
| Unknown aliases | Includes a raw work item id, a title, `W0`, `W01`, `w1` |
| Cross-tenant | An alias valid only in another tenant's projection |
| Malformed steps | Duplicate alias, empty items, duplicate step, numbering start, gaps and type, more than 10 steps, oversized response, too many or duplicate reasons |
| Fabricated or unsupported evidence | Five cases, including a code that holds for one cited item and not another |
| Invented codes | Ten codes: deadline, overdue, owner, depends, verified, approved/done states, outcome, evidence id, upper case |
| Invalid order | Self, forward, alias and zero `afterStep` |
| Unauthorized moves | Ten action moves (approve, execute, assign-owner, propose-to-governance, record-work, send, close, update-state, grant-permission, case variant) |
| Other closed fields | Invalid priorities and uncertainties |
| Malformed responses | Ten malformed bodies, including JSON followed by an injected instruction and two fenced blocks |
| Prompt injection | An injected instruction placed in the move, alias, reason, priority and ref |
| Replay | A response carrying another invocation's ref |
| Tampered projection | A projection with an extra field |

**Rendering.** The rendered plan is checked for:

- the `Fact:` / `Derived:` / `Recommendation` / `Unavailable:` labels;
- server-side titles;
- no identifier and no alias in the human-facing text;
- every "approved / executed / done / success" line being a negation;
- the closing "not a decision, an approval or work done" line;
- an unresolvable alias shown as "(title unavailable)";
- a plan with no steps rendered as unavailable.

**Inertness.** The module imports only the contract and `/plan`'s vocabulary. It reaches no fetch,
db, writer, env, logger, model, Governance, permit, execution, audit or origination path, and nothing
in `src` imports it.

**Bite-proofs.** Each mutation was confirmed applied by an md5 change, restored by `cmp`, and made
the suite exit 1:

1. Dropping the fabricated-evidence check.
2. Accepting extra keys.
3. Accepting unknown aliases.
4. Dropping the ref check.
5. Relabelling the steps "Approved".

## 7 · Regression

- **Recorded set.** The same 127 suites as phase 2, before and after: identical (103 pass, the same
  24 baseline failures).
- **New and focused suites.** `projection.ts`, `plan-candidate.ts`, `projection-postgres.ts` and
  `eai-operational-record/contract-and-boundary.ts` exit 0.
- **Postgres suites (PG18).** `heby-org-action-planning/plan-postgres.ts`,
  `wev1 evidence-postgres`, `work1 work-postgres`, `external-ai-data-use-1a authority-postgres`,
  `-b2 egress-postgres` and `-b1d tenant-writer-postgres` exit 0, with the teardown flake noted in §2.
- **Firewall.** `external-ai-data-use-1a/firewall-and-inertness.ts` PASS. Its importer census gains
  `operational-plan-candidate.ts` with a stated reason and a pin that it imports only the contract.
- **Static checks.** `tsc --noEmit` exit 0; `eslint` on the touched files exit 0.

## 8 · Implemented vs unavailable

**Implemented and verified:**
- the real-DB proof of the projection boundary;
- the output contract, its validator and its rendering.

**Implemented, not connected.** The rendering is the `ActionPlan` shape `/plan` already returns.
Connecting it to the conversation would need a model invocation that is not authorized, so nothing
calls it. `/plan` and natural-language planning are unchanged.

**Designed only:**
- the purpose and platform cell that would let a projection cross;
- the generator call that would carry it;
- the parse provenance a real invocation would record;
- the surface entry point.

**Not available:**
- model reasoning over Work data;
- any execution.

## 9 · Remaining decisions for controlled model invocation

- D1 (purpose `work-planning`, one migration), D2 (adopt the `operational-record` meaning),
  D7 (whether states and flags without titles are worth a disclosure) and D4 (the platform cell).
  None has been decided.
- D5, a tenant ceremony for `hebun`; D6, one billable acceptance call.
- Whether an invocation records parse provenance as origination does (TRH-18). That would be a
  persistence change and is not designed here.
- Cleaning up the four leftover test databases listed in §2.

## Closure Contract (v1)

- Phase: HEBY-AI-PLAN-OUTPUT-CONTRACT-1
- Owner: apps/dashboard/src/features/heby-commands (operational-plan-candidate.ts; the projection proof covers operational-planning-projection.server.ts)
- Reached state: VERIFIED
- Implementation commit: THIS COMMIT
- Verification level: V2 — a new contract at the future model-output seam, plus a real-database proof of the projection's tenant boundary. Every suite that names those seams was run, and the tenant, failure, bound, injection and governance scenarios are in §3 and §6. Not V3: no authority, policy, purpose, schema, provider, execution or runtime path changed, and nothing imports the module. V3 applies to the phase that first invokes a model with it.
- Verification evidence: `projection-postgres.ts` exit 0 on PostgreSQL 18 (four runs), two real-DB bite-proofs exit 1 (applied, restored); `plan-candidate.ts` exit 0, five bite-proofs exit 1 (applied by md5, restored by cmp); `projection.ts`, `eai-operational-record/contract-and-boundary.ts`, `external-ai-data-use-1a/firewall-and-inertness.ts` exit 0; 127 related suites identical to the recorded baseline (103 pass, 24 baseline failures); Postgres suites plan-postgres, wev1 evidence-postgres, work1 work-postgres, EAI 1a authority-postgres, b2 egress-postgres, b1d tenant-writer-postgres exit 0 on clean runs; `tsc --noEmit` exit 0; `eslint` on touched files exit 0; `git diff --check` exit 0; development-continuity closure-contract exit 0
- Test environment: worktree `.claude/worktrees/heby-ai-planning-phase1` at ee7a84e1 plus this phase's changes; macOS (Darwin 25.2.0); tsx from the shared `apps/dashboard/node_modules`; disposable databases on local PostgreSQL 18.0 at 127.0.0.1:5432 through `HEBUN_TEST_ADMIN_DATABASE_URL`; no provider, no credential, no production data
- Deployment evidence: N/A — not deployed
- Production acceptance evidence: N/A — not released; nothing at runtime imports the contract
- Deferred risks: PROJECTION-POSTGRES-PROOF-1 (CLOSED)
- Director approvals: the Postgres proof, the closed output contract, its validator, the inert rendering, targeted tests, the importer census extension and a focused local commit (CONTROLLED AGENT REASONING · PHASE 3 brief, 2026-10-13); push, deploy, schema/migration, disclosure policy, a new purpose, tenant ceremony, provider calls, arming and deletion of the leftover test databases NOT approved
