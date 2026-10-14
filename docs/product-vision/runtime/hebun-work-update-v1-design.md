# WORK-UPDATE V1 · `set-work-declared-state` · DESIGN ONLY

Status: **DESIGN ONLY.** Nothing here is implemented, migrated, revised or deployed. This document is
not a closure record and does not change the §16.1 legacy census.

Base: `1a9ce862` (production code `9308e12c`). All file references are under `apps/dashboard/src`
unless they start with `docs/` or `tests/`.

Director decisions this design is bound by (2026-10-14): **D1** the human selects the target work item
and the reference stays server-side; no work identifier, title, description or other organizational
data reaches the model · **D2** no new EAI permission · **D3** `PermitConsumptionTx` is not widened
directly · **D4** design the minimum mandate CHECK migration and mandate revision ceremony, execute
neither · **D5** V1 = `set-work-declared-state` only · **D6** agent responsibility is checked against
the target's work domain at origination and at authorized execution · **D7** no machine or standing
execution · **D8** the incorrect `version` comment is documented, not silently fixed.

---

## 1 · What V1 does, in one paragraph

A human, looking at a work item they can already see, asks the organization's agent whether that item's
**declared state** should change to a state the human picks. The agent sees only a fixed Hebun sentence
naming the closed target state, never the item. If it proposes, a PENDING `heby_action_requests` row is
filed whose digest binds the item, its state **at proposal time** (`fromState`), the target state
(`toState`) and the item's work domain. A human with Governance authority approves; a human clicks
Execute; the Work Authority changes exactly one column of exactly one row, authored `system`, only if
the item is still in `fromState`, still active, still in that work domain, and the agent is still in
service and still responsible for that domain. Anything else changes nothing.

---

## 2 · Authority ownership map

| Concern | Owner (released) | V1 change |
|---|---|---|
| `work_items` rows, every mutation of them | Organizational Work Authority, `features/organizational-work/write-work.server.ts` | One new **governed door** and one shared **state-declaration core** used by both the human and the governed path. No second writer. |
| Which acts an agent may propose | Agent Mandate Authority (`agent_mandates.proposal_scope`, `features/agent-mandate/*`) | Vocabulary gains `set-work-declared-state` (TS constant + DB CHECK, migration 78). A Heby revision adding it is a separate ceremony. |
| Agent responsibility (work domains) | AP-4 ceiling, `features/action-authorization/agent-mandate-ceiling.ts` | The responsibility check applies to the new kind too (today it applies to `record-work` only). |
| Proposal filing, digest | Action Authorization, `record-action-request.server.ts`, `canonical-payload.ts` | New kind, new tool id, new payload shape. Digest function unchanged. |
| Approval / rejection | Governance, `decide-action-request.server.ts` | Unchanged. |
| Permit spend, single-spend, three-way digest, continuing agent authority | Action Authorization, `consume-action-permit.server.ts` | **Unchanged.** `PermitConsumptionTx` stays `insert | select`. |
| The act | Work Authority, called by a per-kind executor | New executor file `governed-internal-action/execute-set-work-state.server.ts` that owns nothing. |
| Model call + EAI gate | Agent origination, `features/agent-origination/*`, EAI purpose `agent-origination` | New fixed goal family; data classes stay `{conversation, organization}`. |
| Trigger | Human click in `/approvals` (`app/(dashboard)/approvals/actions.ts`) | New server action beside `executeGovernedInternalActionAction`. Never automatic. |

---

## 3 · End-to-end sequence

```
HUMAN (Work surface or AI-plan follow-up)
  picks work item W (id crosses the browser as a lookup key only) and toState S
        │
        ▼
ORIGINATION SERVER ACTION  (human session, tenant from session)
  1. read W by (tenant, id): active? work_scope_kind = 'domain'? → else refuse, no model call
  2. fromState := W.declared_state ; domain := W.work_domain_id ; S ∈ closed vocab and S ≠ fromState
  3. agent in service; mandate admits `set-work-declared-state`;
     responsibility admits `domain` (D6, at origination) → else refuse, no model call
  4. EAI gate: purpose agent-origination, classes {conversation, organization} (D2)
  5. model sees the fixed goal  "Propose declaring the work item the person selected as <S>."
     + organization structure. It returns propose | decline + rationale. Nothing else is read.
  6. server builds the canonical payload itself (model output never enters it):
        { workItemRef: "work-item/<W>", fromState, toState: S,
          workScope: "domain", workDomainRef: "work-domain/<domain>" }
     target_kind "record", target_ref "work-item/<W>", target_label = W.title (human surfaces only)
  7. file PENDING request (one per digest — existing unique index)
        │
        ▼
GOVERNANCE (human)  approve → decision_records + action_permits (TTL 60–86400 s, default 3600 s)
        │
        ▼
EXECUTE (human click in /approvals)
  executeSetWorkDeclaredState(tenant, { permitId })            ← owns nothing, opens nothing
    └─ Work Authority door  declareWorkStateUnderPermit(tenant, { permitId }, { spendWithin })
         BEGIN                                                  ← the Work Authority's transaction
           spendWithin(tx) = consumeActionPermit(tenant, {permitId},
                               { getDb: () => tx,              ← joins as a SAVEPOINT
                                 onAuthorizedWithin: envelope check only (kind, payload shape) })
             • single-spend UPDATE, three-way digest, agent liveness FOR SHARE,
               current mandate, responsibility vs payload domain        (released, unchanged)
           SELECT W ... WHERE tenant_id = $t AND id = $W FOR UPDATE
           W active?                     else refuse  work-retired
           W.work_domain_id = payload?   else refuse  work-scope-changed   (D6, at execution)
           W.declared_state = fromState? else refuse  work-state-changed   (stale / conflict)
           declareWorkStateCore(tx, …, author system, handoffId)  ← the ONE declared_state UPDATE
             + audit `work.state-declared` (executor system, handoffId, from, to)
         COMMIT     — or ROLLBACK on any refusal: permit back to `active`, nothing written
```

---

## 4 · Exact proposed code boundaries (no code written)

| File | Change |
|---|---|
| `features/heby-action-inlet/contracts.ts` | `SET_WORK_DECLARED_STATE_ACTION_KIND = "set-work-declared-state"`; its non-effect sentences |
| `features/agent-origination/contracts.ts` :64 | add the kind to `AGENT_ORIGINABLE_ACTION_KINDS` |
| `features/agent-mandate/contracts.ts` :53 | the TS echo of the vocabulary |
| `db/schema/agent-mandate.ts` :120 | `ORIGINABLE_ACTION_KINDS_SQL` gains the kind (paired with migration 78) |
| `features/action-authorization/agent-mandate-ceiling.ts` :96–113 | responsibility applies to `{record-work, set-work-declared-state}`; scope read from the payload exactly as today |
| `features/heby-actions/contracts.ts` + `action-registry.ts` | `HebyActionKind` member; one registry entry: tool `heby.work.set-declared-state`, `CONSEQUENTIAL_MUTATION`, `deterministic-inverse`, `human-review-required`, `governanceGated`, `ownerWorkspace: command` |
| `features/agent-origination/*` | one fixed goal family keyed by the closed target state (the HEBY-PLAN-DELEGATION-1 pattern: a key selects a Hebun sentence); payload built server-side from the row read in step 1 |
| `features/organizational-work/write-work.server.ts` | (a) extract `declareWorkStateCore(tx, ctx, input, author, handoffId?)` — the only `declared_state` UPDATE; `setWorkDeclaredState` calls it (behaviour unchanged); (b) new door `declareWorkStateUnderPermit`; (c) D8 comment correction at :595 (see §11) |
| `features/governed-internal-action/execute-set-work-state.server.ts` | new; ~the shape of `execute-place-human.server.ts`; validates the envelope, owns no table, opens no transaction |
| `app/(dashboard)/approvals/actions.ts` | one server action, permit id the only client-crossing value |
| UI | a "change declared state" offer on a work item the human can see; Approvals card copy for the new kind |
| **Not touched** | `consume-action-permit.server.ts`, `PermitConsumptionTx`, `WorkRecordingTx`, `decide-action-request.server.ts`, `MACHINE_EXECUTABLE_ACTION_KINDS`, standing authorization, EAI policy, `work_evidence_references`, every other Work mutation |

---

## 5 · Transaction / firewall alternatives (D3)

The constraint: `PermitConsumptionTx = Pick<…, "insert" | "select">` (`consume-action-permit.server.ts:75`),
pinned by `tests/gia1-governed-internal-action/internal-act-firewall.ts:587–596`. Changing a declared
state needs `update`.

| # | Alternative | Verdict |
|---|---|---|
| **T1** | **Work-Authority-owned transaction, permit spend joined as a savepoint.** The Work Authority opens the transaction (as `mutateWork` already does), passes it to `consumeActionPermit` via `deps.getDb`, and performs the UPDATE on its own handle after the spend returns `authorized`. Drizzle node-postgres nests `transaction()` as `savepoint` / `release savepoint` (`node_modules/drizzle-orm/node-postgres/session.js:206–216`). | **Recommended.** One DB transaction, so atomicity is identical to GIA-1. `consume-action-permit.server.ts` and both narrowed types are untouched. The UPDATE is performed by the authority that owns the table, never by the permit callback. |
| T2 | Two transactions: spend + insert an "authorized transition" row, then the Work Authority applies it separately, idempotent on `handoff_id`. | Rejected. Reintroduces the crash window R3B removed (spent permit, no act); needs a new table and a retry path. |
| T3 | Widen `PermitConsumptionTx` to include `update`. | Excluded by D3. Widens every future callback. |
| T4 | Cast the callback's handle, or update through `insert … on conflict do update`. | Rejected. Covert widening; to be banned by the new firewall. |
| T5 | Insert-only ledger + DB trigger updating `work_items`. | Rejected. A second mutation authority, in SQL. |
| T6 | Make declared state an append-only declaration ledger. | Rejected for V1. Changes every reader of `work_items.declared_state`. |

**What T1 changes in doctrine, stated plainly.** GIA-1's firewall pins, for the record-work executor,
"the mutation runs inside `onAuthorizedWithin`" and "the executor opens no transaction". T1 keeps the
second (the *executor* still opens nothing; the Work Authority does) and replaces the first, for this act
only, with: **the permit spend runs inside the Work Authority's transaction**. The guarantee the GIA-1
rule protects — spend and act commit together or not at all — is unchanged. This is a Director decision
(U1), and the GIA-1 firewall is not edited; the new act gets its own firewall.

**T1 details to prove in implementation.** (a) a refusal inside the savepoint makes `consumeActionPermit`
return `refused` and the Work Authority must not continue; (b) any refusal after `authorized` must
throw so the outer transaction rolls the spend back; (c) the WF-4 liveness `FOR SHARE` and the target
`FOR UPDATE` are both held to commit; lock order is permit → agent → work item, and the human Work path
locks only the work item, so no cycle is introduced; (d) `consumeActionPermit`'s own `catch` paths are
exercised with an outer transaction (Postgres test, not a stub).

---

## 6 · Security and tenant isolation

- **Tenant.** No RLS; isolation is explicit predicates and composite FKs. Every read and the UPDATE carry
  `tenant_id = <session tenant>`; the permit spend already scopes by tenant (the single-spend `UPDATE` in `spendPermit`); the target
  is resolved by `(tenant, id)`, so a foreign id is `work-unresolved`, indistinguishable from absent.
- **Client-crossing values.** Origination: work item id and target state (validated, closed). Execution:
  permit id only. No tenant, actor, state or domain is accepted at execution.
- **Model boundary (D1, D2).** The model receives a fixed sentence parameterised only by a closed state
  word, plus the already-authorized organization structure. It never receives the item's id, title,
  description, current state, department, accountable human, domain or plan reference. Its output is
  propose/decline + rationale; the payload is built by the server. Reviewer note: the target state word
  reveals an intent about an unnamed item; it is conversation-class content the human chose, not
  operational-record data. If the Director reads it as operational-record, the goal drops the state word
  and the agent can only decline or propose blind (U3).
- **Authority.** The executing human is not a new authority: the permit is. Approval still requires
  Governance authority and a justification. The agent's continuing authority is re-checked at spend
  (released WF-4/AP-4B).
- **No escalation paths.** Not in `MACHINE_EXECUTABLE_ACTION_KINDS`, not standing-authorizable (D7);
  the new firewall asserts both.

---

## 7 · Stale and conflicting updates; failure and rollback

`work_items.version` is never incremented (§11), so concurrency is precondition-based under the row lock.

| Situation | Where caught | Result |
|---|---|---|
| State changed after proposal (human or another governed act) | execution, under `FOR UPDATE` | `work-state-changed`; rollback; permit stays `active` until TTL or revocation |
| Two pending proposals on one item (`planned→active`, `planned→blocked`) | execution | first executed wins; the second fails `work-state-changed` |
| Identical proposal twice | filing | existing one-PENDING-per-digest index refuses the duplicate |
| Item retired | execution | `work-retired`; rollback |
| Item moved to another work domain | execution | `work-scope-changed`; rollback |
| Agent suspended / retired / mandate or responsibility withdrawn | spend (released) | `agent-not-in-service` / `agent-mandate-refused`; rollback |
| Permit expired, revoked, already spent, foreign tenant | spend (released) | `permit-not-consumable`; nothing written |
| Unscoped item (`work_scope_kind` NULL) or organization-scoped | origination | refused before any model call (no domain to check, D6) |
| `toState = fromState` | origination | refused (a governed no-op is not offered) |
| DB failure anywhere | — | whole transaction rolls back |

**Rollback of an executed change** is not automatic. The inverse is the same act with `from`/`to`
swapped, proposed and approved again. The `work.state-declared` audit row and the Governance record
remain. Executor code may not call any inverse (same ban as GIA-1).

---

## 8 · Minimum schema changes

| Object | Change |
|---|---|
| `agent_mandates_scope_subset_chk` | literal array `['send','record-work']` → `['send','record-work','set-work-declared-state']` (both the subset and the cardinality term) |
| everything else | **none.** `heby_action_requests.action_kind / tool_id / target_kind` are unconstrained text; `action_permits`, `work_items`, `audit_log` need nothing; no new table |

Not needed and not proposed: a `work_items.version` trigger, any change to
`work_evidence_references_human_declarer_chk`.

---

## 9 · Migration and ceremony plan (not executed)

**Migration 78** — `ALTER TABLE agent_mandates DROP CONSTRAINT agent_mandates_scope_subset_chk;
ADD CONSTRAINT … CHECK (<new literal>);` Every existing row is a subset of the larger set, so validation
cannot fail. Order (GIA-1 lesson: a production CHECK must not lag the code):

1. Director gate: backup (`pg_dump` 18, full `pg_restore -f /dev/null`), ledger 77 + digest measured.
2. Migration 78 through `scripts/platform-migrate.ts`; read-only verify: ledger 78, digest equal to
   local, constraint text, `convalidated = true`, all other tables' counts unchanged.
3. Deploy the code (it cannot be used yet: no mandate holds the kind).
4. Mandate ceremony (below).

**Rollback floor.** Before step 4 the migration reverses cleanly. After step 4 a historical mandate
revision holds the kind, so the CHECK cannot shrink without rewriting history: rollback is a new
revision without the kind plus a code disable. Record this as a deferred risk at closure.

**Mandate revision ceremony.** `scripts/agent-mandate-responsibility-ceremony.ts` deliberately cannot
change scope (it re-states it). Minimum: a scope ceremony of the same shape — show / dry run /
`--confirm` with a typed phrase — that writes ONE new Heby revision through
`establishAgentMandateWithResponsibility` (`establish-agent-mandate.server.ts:549`), re-stating
responsibility exactly, adding only `set-work-declared-state`, and with a Director-supplied purpose (the
revision 4 purpose names only sending and recording, so it would be false after the change — U4).
Governance decision + session + audit as in prior ceremonies. Post-read: exactly +1 mandate revision,
responsibility rows equal, scope = previous ∪ {kind}, nothing else changed.

No EAI ceremony (D2).

---

## 10 · V3 acceptance criteria

Level V3: authority, execution boundary, schema. Tests run in an isolated worktree; the full suite runs
with its reason written first.

Local, before any production gate:

1. Unit: vocabulary, registry entry honest, fixed goals closed and free of work data, payload built only
   from server reads, refusals for every row of §7.
2. Postgres: the T1 transaction with a real outer transaction — spend + update commit together; each
   refusal leaves the permit `active` and `work_items` byte-identical; tenant crossing refused;
   concurrent human `setWorkDeclaredState` vs governed execute serialize and the loser refuses.
3. Firewall (new, `tests/work-update-v1/`): `PermitConsumptionTx` and `WorkRecordingTx` unchanged; the
   callback performs no write; exactly one `declared_state` UPDATE in the Work Authority shared by both
   paths; executor opens no transaction, imports no provider, calls no inverse, has no `on conflict`;
   kind absent from machine and standing sets; model request carries no work field.
4. Bite-proofs (each must fail the suite, files restored by md5): B1 update inside the callback via cast;
   B2 `fromState` check removed; B3 execution-time domain check removed; B4 kind added to machine set;
   B5 model text placed in the payload; B6 tenant predicate removed from the target read; B7 a second
   `declared_state` UPDATE path; B8 responsibility ceiling not applied to the kind.
5. GIA-1, GIA-2, AP-4B, WF-4, APF-3, HEBY-PLAN-DELEGATION-1 suites unchanged.

Production (each a separate Director gate, measured read-only before/after over every table):

6. Migration 78 as §9.
7. Mandate ceremony: delta exactly the ceremony's rows.
8. One origination on a domain-scoped Hebun item (two exist today; two Hebun items are unscoped and
   must be refused): one EAI `agent-origination` audit, classes `{conversation, organization}`; one
   invocation; one PENDING request, digest recomputed; `work_items` md5 unchanged.
9. Separately authorized: one approval and one execution → exactly one `work_items` row changed, only
   `declared_state`, `updated_at`, `updated_by_type = 'system'`; one `work.state-declared` audit row with
   the handoff id; permit consumed; no other table changed.

Provider-account reconciliation stays out of scope (GATE-D-PROVIDER-RECONCILIATION-1).

---

## 11 · D8 — the incorrect `version` comment

`write-work.server.ts:594–596` says the `version` column "moves" under the row lock. No writer sets
`version` and no trigger does; it stays at its default. Concurrency in the Work Authority rests on
`FOR UPDATE` alone. V1 does not depend on `version`. Proposal: correct only that sentence in the
implementation commit that already edits this function; no behaviour change, no trigger.

---

## 12 · Risks and unresolved decisions

| ID | Decision / risk | Recommendation |
|---|---|---|
| U1 | Accept T1: the permit spend joins the Work Authority's transaction (doctrine change for this act; GIA-1 firewall untouched) | Accept |
| U2 | Who chooses `toState`: human (this design) or model | Human; the model only proposes or declines |
| U3 | Does the closed state word in the goal count as conversation-class (D2 holds) | Yes; otherwise goal without the state |
| U4 | New Heby mandate purpose text for the revision | Director wording at ceremony |
| U5 | Which surface offers it first: Work item page, AI-plan follow-up, or both | Work item page only in V1 |
| U6 | Should Approvals show "state has changed since proposal" before approval (read-only) | Defer; execution refuses anyway |
| R1 | Rollback floor after the mandate ceremony (§9) | Record at closure |
| R2 | A stale permit stays `active` until TTL (≤ 24 h) | Accept; Governance can revoke |
| R3 | Unscoped legacy items cannot use V1 | Accept; scope them through the human path first |
| R4 | PLAN-FOLLOW-UP-REFERENCE-1 remains open; V1 does not link a follow-up to its item | Unchanged |

Preserved, untouched by this design: acceptance commit `1a9ce862` (unpushed); PENDING request
`159b49ce` (not approved, not executed).

---

## 13 · Director decisions after design review (2026-10-14)

U1 T1 conditionally approved · U2 the human selects `toState` · U3 the state word in the fixed prompt is
conversation data · U4 mandate purpose: "Assist authorized people in proposing changes to the declared
state of existing work items within the agent's assigned responsibility domains. Every change requires
explicit human governance approval and a separate execution action." · U5 work item detail page only ·
U6 a minimal stale-state warning in the existing approval/execution card (server read of the target's
current state, tenant-scoped; no notification system).

## 14 · T1 architecture validation (no application code)

### 14.1 Transaction boundary

```
executeSetWorkDeclaredState(tenant, {permitId})          per-act executor: opens nothing, writes nothing
  └─ declareWorkStateUnderPermit(tenant, {permitId}, {spendWithin})      Work Authority
       BEGIN  ─────────────────────────────────────────────── outer tx (Work Authority owns it)
       │  spendWithin(tx)  →  consumeActionPermit(tenant, {permitId}, {getDb: () => tx, onAuthorizedWithin})
       │     SAVEPOINT sp1 ───────────────────────────────── permit authority, unchanged code
       │     │ UPDATE action_permits … status='active' AND expires_at > now() AND tenant  (single spend)
       │     │ three-way digest · agent liveness FOR SHARE · current mandate · responsibility
       │     │ audit governance.action.permit.consumed
       │     │ onAuthorizedWithin(tx: insert|select)  ← envelope check only, no write
       │     RELEASE sp1   (or ROLLBACK TO sp1 → consume returns `refused` → door throws)
       │  SELECT work_items … WHERE tenant AND id FOR UPDATE
       │  active? · domain = payload? · declared_state = fromState?   else throw
       │  declareWorkStateCore(tx) : the ONE declared_state UPDATE + audit work.state-declared(handoffId)
       COMMIT  (any throw → ROLLBACK of everything, permit back to `active`)
```

### 14.2 Atomicity — measured with a throwaway probe

A disposable-PostgreSQL probe (scratchpad only, not in the repository) ran the released
`consumeActionPermit` inside an outer transaction exactly as above, against the released schema at
`1a9ce862`, with real Governance approvals and permits. **12 / 12 checks passed:**

| # | Proof | Result |
|---|---|---|
| P1 | Work failure after an authorized spend | permit `active`, `consumed_at` NULL, work unchanged, `audit_log` unchanged; the same permit then executes once |
| P2 | Spend refused (already consumed) after a work UPDATE in the same tx | work UPDATE rolled back; outer tx still usable after the savepoint refusal |
| P2b | Refusal thrown inside consume's savepoint (digest drift) | permit `active`, work unchanged, no audit |
| P3 | Two parallel executions of one permit | one `executed`, one `permit-not-consumable`; exactly one permit-consumed event |
| P3b/P6 | Two permits, same item, same `fromState`, racing | second blocks on `FOR UPDATE`, re-reads, `work-state-changed`, rolled back, its permit stays `active` |
| P6b | Human `setWorkDeclaredState` racing a governed execution | human writer waited ~310 ms on the lock; serialized, no lost update |
| P6c | Human changed state after proposal | governed execution `work-state-changed`, permit `active` |
| P4a | Foreign tenant spends the permit | zero-row single spend, nothing written |
| P4b | Own permit aimed at a foreign work item | `work-unresolved` under the tenant predicate, spend rolled back |
| P5 | Mandate revised to drop the kind after approval | released continuing-authority check refuses inside the joined savepoint (`agent-mandate-refused`), permit `active`, work unchanged |
| P9 | Released `executeRecordWork` beside the probe | executes unchanged |

Bite-proofs of the probe itself: removing `FOR UPDATE` → P3b fails (both racers execute); spending on a
detached handle instead of the outer tx → P1 fails (permit consumed although the work write failed).

Not provable before implementation: P5 for the NEW kind (the responsibility ceiling applies only to
`record-work` today) and responsibility at origination — both are code to be written and are in the
§10 test plan.

### 14.3 Existing suites, unchanged code, re-run at `1a9ce862`

GIA-1 firewall OK · GIA-1 Postgres OK · GIA-1 bite-proofs "all guards bit" · GIA-2 Postgres OK ·
closure contract PASS. Pre-existing red, unrelated to T1: `tests/wev1-work-evidence/evidence-firewall.ts`
(pins 3 executable kinds, 21 source classes and journal 67; reality is 5 / 22 / 77).

### 14.4 Firewall compatibility

No existing assertion counts `db.transaction(` or `.update(workItems)` in the Work Authority, and none
pins `updatedByType: "human"` on updates. `PermitConsumptionTx` and `WorkRecordingTx` stay byte-identical;
the state core gets its own type, `WorkStateTx = Pick<ControlPlaneDatabase, "select" | "insert" | "update">` (the insert is its audit row),
used only by the Work Authority.

Implementation constraints so no protection weakens:

- write-work receives the spend as an **injected function**; it never value-imports action-authorization
  (WORK-1 pins the writer's import graph) and never names `actionPermits` / `hebyActionRequests` /
  `decisionRecords`, and does not import `@/features/heby*` or `@/features/agent-*`.
- The door's domain check must not copy the AP-4B B8 anchor line verbatim (it must stay unique).
- The new executor mirrors every GIA-1 executor assertion except the one T1 replaces (§14.5).

Named census additions required (category: extension by the tests' own procedure, no assertion
deleted): GIA-1 feature-file census and approvals server-action list; `EXECUTABLE_ACTION_KINDS` pins;
the origination vocabulary pinned in **20** test files plus the AMA-1 bite-proof anchor; the migration
ledger pinned at 77 in **26** test files (→ 78). Pins whose message states a historical fact ("WORK-1
adds no originable kind", "THE VOCABULARY GREW BY ONE") are kept as dated facts and the new kind is
recorded beside them, never by rewriting history.

### 14.5 The narrow GIA-1 doctrine exception T1 needs

> **GIA-1 doctrine:** a governed internal act's mutation runs inside `consumeActionPermit`'s
> `onAuthorizedWithin`, on the permit's own `insert | select` transaction; the executor opens no
> transaction.
>
> **Exception WORK-UPDATE-V1-T1 (one act only: `set-work-declared-state`).** For this act the order of
> nesting is inverted: the Organizational Work Authority opens the transaction, the permit spend joins
> it as a savepoint through the released `consumeActionPermit` (`getDb`), and the Work Authority
> performs the single `declared_state` UPDATE on its own handle after the spend returns `authorized`.
> What does not change: one database transaction commits the spend and the act or neither; the permit
> authority's code and `PermitConsumptionTx` are untouched; `onAuthorizedWithin` still writes nothing
> beyond insert/select; the executor still opens no transaction; no other act may use this shape
> without its own Director decision. WORK-1's authority model is reworded from "writes no action
> authorization" to "writes no action-authorization row itself; its governed door hosts a spend
> performed by the Action Authorization Authority".

### 14.6 Migration and rollback gates

G0 implementation verified (V3, full suite with stated reason, new firewall, bite-proofs B1–B8 plus the
probe promoted to `tests/work-update-v1/`) → G1 Director commit → G2 backup + migration 78 (ledger
77 → 78, digest, CHECK validated, every other table unchanged) → G3 push = production deploy (deploy
after the migration, never before) → G4 mandate scope ceremony with the U4 purpose → G5 one origination
(PENDING, digest, `work_items` md5 unchanged) → G6 separately: one approval + one execution (exactly
one row, one column). Reversal: before G4 the migration reverses; after G4 only a new mandate revision
without the kind plus a code disable (rollback floor).

### 14.7 Verdict

**GO for implementation**, conditional on: (1) Director acceptance of the §14.5 exception text;
(2) the census ripple done as named additions only; (3) wev1's pre-existing red recorded as baseline and
not "fixed" inside this phase without approval; (4) every §10 and §14 proof re-run on the real
implementation before any production gate.

## 15 · Implementation notes (local, uncommitted, 2026-10-14)

Implemented as §4 and §14 describe, with these recorded deviations:

- **U5 surface.** No work item detail page exists. The control is `HebyWorkStateAffordance`
  (`components/layout/heby/`), backed by `app/(dashboard)/heby/work-state-origination-actions.ts`,
  rendered inside each in-service item's panel on `/director/work`. WORK-1's own modules (actions, page,
  panel, `features/organizational-work/*`) still import no agent origination — the WORK-1 firewall is
  unchanged; the panel renders a Heby component (Director decision on whether that transitive reach is
  acceptable).
- **Responsibility at origination** is enforced by the one writer before insert (as for `record-work`),
  i.e. after the single model call. Item, state, retirement and domain-scoping are refused before any
  model call. *Superseded by §16.2: a read-only preflight now refuses mandate and responsibility
  before any invocation or model call; the writer remains the authority.*
- **Mandate form.** The vocabulary widening would have made the new kind default-checked on `/agents`;
  `MANDATE_SCOPE_NEVER_PRESELECTED` keeps revisions starting from the scope in effect.
- **U6.** `WorkStateConflictNotice` reads `readWorkStateConflictAction` once per shown card (pending
  request and active permit), read-only.
- **D8.** The `version` sentence in `mutateWork`'s header is corrected; no behaviour change.
- **WF-2 capability truth** reports the kind as "not exposed" (it is not on Heby's composer path); open UX gap.
  *Superseded by §16.3: the card now reports it as offered from a selected work item.*

## 16 · Final architecture review (2026-10-14, uncommitted)

### 16.1 WORK-1 authority boundary — the Work panel integration is NOT compliant

Measured with a value-import graph walk (read-only probe, not in the repository) from
`components/organizational-work/work-register.tsx`:

| | at base `1a9ce862` | with §15's panel integration |
|---|---|---|
| model / provider / EAI seams reachable | **0** | **15** — `originate-work-state`, `invocation-provenance`, `heby-model/*` incl. `claude-model-client` and `claude-transport`, `authorize-external-ai-disclosure`, `compose-external-ai-disclosure` |
| chain | — | panel → `heby-work-state-affordance` → `heby/work-state-origination-actions` → `originate-work-state` → `heby-model` |

The WORK-1 firewall (§6 "No WORK-1 module reaches … agent origination") and F9 pass only because they
match the literal specifier one hop away. The released exception for this panel (WORK-1 §7,
`INLET_CONSUMERS`) admits the **deterministic** action inlet, whose own firewall states the model
selects nothing. The base panel already reaches the mandate reader *through the one writer*, so the
doctrine was never "no transitive reach"; it is "the Work surface is not an origination or model
trigger". §15's integration turns `/director/work` into one. **Doctrine prohibits it. STOP.**

Minimum options, Director's choice:

- **A (no amendment, recommended).** Keep agent origination on the Heby surface, where every other
  origination entry already lives. The Work panel renders a plain navigation link (no import) to a
  Heby view that takes the item as a lookup key, resolves it server-side for the session tenant, and
  renders `HebyWorkStateAffordance` there. WORK-1's modules reach no model seam; U5 changes from
  "work item detail page" to "Heby, opened from the work item".
- **B (minimum explicit amendment).** Add to WORK-1 §7 a second named exception, parallel to
  `INLET_CONSUMERS`: *"`work-register.tsx` may render exactly one Heby component,
  `components/layout/heby/heby-work-state-affordance.tsx`, whose only server reach is
  `heby/work-state-origination-actions.ts` → `originate-work-state.server.ts`. WORK-1's actions,
  page and feature files still reach no model seam. The Work surface may TRIGGER one
  agent-origination call for a human-selected item; it holds no origination logic and decides
  nothing."* Enforced by a transitive graph firewall (not a literal match): the panel's model-seam
  set equals exactly that chain; `actions.ts`, `page.tsx` minus the panel, and every
  `features/organizational-work/*` module reach zero model seams.

The panel integration remains in the working tree, unchanged, pending this decision. *Resolved by §17: Option A.*

### 16.2 Pre-model responsibility check — implemented

Earliest trusted point: inside `originateWorkStateChange`, after the proposer and the target item
(and so its work domain) are resolved, before the Director control, invocation registration and any
provider call. AMA-2 forbids mandate reads in `features/agent-origination` and `src/app`, and AP-4B
pins the responsibility askers, so the check lives in the existing WF-1 read-only projection:

- `preflightWorkStateOrigination` (`origination-availability/read-origination-availability.server.ts`):
  effective mandate through the shared `refuseOutsideAgentMandate`; responsibility through
  `listEligibleAgents`, which now takes the responsibility-scoped kind to ask about (default
  `record-work`; any kind outside `RESPONSIBILITY_SCOPED_REGISTRY_KINDS` is unanswerable). No new
  asker of either ceiling; writes nothing; any unreadable answer or exception refuses.
- Injected by `heby/work-state-origination-actions.ts`; **required** — a missing, throwing or
  non-admitting preflight refuses with no invocation and no model call.
- The writer's ceiling (AMA-2/AP-4B) and the spend are unchanged and remain authoritative.

Proved (`tests/work-update-v1/work-state-postgres.ts` T10): revoked responsibility, withdrawn scope,
unreadable mandate, missing and throwing preflight → refused, zero invocations, zero model calls,
nothing filed; a mandate revised **while the model runs** is refused by the writer
(`work-outside-agent-responsibility`, invocation `filing_outcome = refused`); restoring responsibility
proposes again. Firewall F10; bite-proofs B11 (preflight skipped) and B12 (preflight ignores
responsibility).

### 16.3 WF-2 capability truth — corrected

Four layers, one source each, no new authority:

| Layer | Source |
|---|---|
| Platform supports | `AGENT_ORIGINABLE_ACTION_KINDS` = mandate CHECK; a mandate cannot exceed it |
| Mandate permits | effective `proposalScope`, read by the WF-1 projection |
| Offered through a UI | `canProposeNow` (Heby proposal path, fully checked) · `proposableFromWorkItem` (asked from one selected item; responsibility checked per item at ask time, §16.2) |
| Authorized to execute | never a capability: one Governance decision and one permit per proposal; the card says so |

`set-work-declared-state` is no longer reported as "permitted, not offered". The surface fact is a
literal in the derivation (it stays value-import-free per the WF-2 firewall). Residual limit: the WF-1
projection is `record-work`-centric — a mandate holding `set-work-declared-state` without `record-work`
yields "proposal-scope-unavailable" for the whole card (fail-closed, not a false claim).

## 17 · Director decision: Option A (2026-10-14) — implemented, uncommitted

**Decision.** WORK-1 doctrine is preserved: the Work register is not an AI origination surface. U5
changes from "work item detail page" to "Heby, opened from the work item".

**Rationale.** Every agent-origination entry already lives on the Heby surface; the Work surface's
released exception admits only the deterministic inlet. Keeping origination in Heby needs no doctrine
amendment, keeps one place where a model can be asked about work, and the cost is one navigation hop.

**What changed.**

| File | Change |
|---|---|
| `components/organizational-work/work-register.tsx` | the Heby component and its import removed; a plain `<a href="/heby?workItem=<encoded id>">` |
| `app/(dashboard)/heby/page.tsx` | reads `workItem` from the query, resolves it with `readWorkStateSelection(await resolveTenantContext(), …)`; passes the rendered selection as a slot |
| `features/heby-action-inlet/work-state-proposal.server.ts` | `readWorkStateSelection`: the Work Authority's tenant-scoped `readWorkStateTarget`; a foreign or malformed id is `unresolved`; writes nothing, asks no model |
| `components/layout/heby/heby-work-state-selection.tsx` (new) | server component: the chosen item's title and state for the person; renders `HebyWorkStateAffordance` only for an in-service, domain-scoped item; explains every other case |
| `components/layout/heby/heby-workspace.tsx`, `heby-workspace-client.tsx` | optional `selection` slot under the header (the workspace is a fixed-height surface, so nothing can sit above it) |
| `tests/work-update-v1/work-register-reach-firewall.ts` (new) | transitive value-import firewall (static, re-export and dynamic imports) from the panel, the Work route's actions and page, and every `features/organizational-work` module |
| `tests/work-update-v1/bite-proofs.ts` | B10 re-anchored (the import it anchored on is gone); B13: one Heby component imported by the panel must bite the reach firewall |

**Trust.** The id is a lookup key only; the tenant is the session's; origination re-resolves the item
itself, and the model still receives only the fixed sentence (T8). Human selection (item, state) and
the explicit "Ask Heby to propose" click are unchanged.

**Import-graph evidence** (value imports, transitive):

| Entry | model / transport / EAI / origination modules reachable |
|---|---|
| `work-register.tsx` at base `1a9ce862` | 0 |
| `work-register.tsx` with §15's panel integration | 15 |
| `work-register.tsx` with Option A | 0 (firewall R1) |
| Heby `work-state-origination-actions.ts` (positive control) | reaches `originate-work-state`, `heby-model`, `authorize-external-ai-disclosure` (R3) |

Allowed and asserted still reachable from the panel: the Work route's actions, the GIA-1
`record-work-proposal` inlet and the one writer behind it. The only `agent-origination` module the Work
graph may contain is the pure vocabulary `contracts.ts`, which itself reaches none of the forbidden
modules.
