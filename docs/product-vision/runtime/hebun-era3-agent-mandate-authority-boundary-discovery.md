# Era III — Agent Mandate Authority · Boundary Discovery (READ-ONLY)

**Status:** DISCOVERY COMPLETE — read-only. No runtime code, schema, migration or production row was
changed to produce it. The only repository mutation carrying this work is the docs-only roadmap edit
that records the Director's Era III activation decision, plus this file.

**Measured against:** `main` at `52b4605`, migration ledger **39 entries** (authored), production
control plane `neondb` / `pg_control_system().system_identifier = 7675444875863894887`, read-only.

**Question put by the Director:** where should authoritative agent *mandate* truth live? Prove or
reject the previous conclusion that "a mandate is just a Governance subject" from repository
architecture, and do not let Governance quietly become agent identity, agent lifecycle, workforce,
task, capability-registry or execution authority.

---

## 1 · Era III activation record

Era III is opened by **Director decision**, recorded in `docs/MASTER-ROADMAP.md` §4, §9, §13 and §20.
It is opened in the state §9 defines as **OPEN** — *"an era that has not closed and has no milestone
currently active"* — which is the same state Era II occupied between E2-3 closing and E2-4 being
selected.

What the activation does **not** do:

```
ERA III OPEN        != A MILESTONE IS SELECTED
ERA III OPEN        != AGENT MANDATE APPROVED
CANDIDATE           != PROGRAM
BOUNDARY DISCOVERY  != IMPLEMENTATION AUTHORIZATION
```

Entry constraint checked, not assumed: §13 states *"No Era III capability may be opened while Era I
remains open."* Era I is **CLOSED** at `047dde8` (§11.3), so the constraint is satisfied. The three
standing Era III constraints in §13 are carried forward unchanged; opening the era does not relax
them.

Agent Mandate Authority is recorded as the **first candidate**, gated on this discovery. It is not
implemented and no implementation was attempted.

---

## 2 · Existing agent authority map

Every row below was measured from `src` at the baseline and, where a count is given, from the
production control plane read-only.

### 2.1 Agent identity and lifecycle

| Concept | Class | Evidence |
|---|---|---|
| Durable agent identity | **AUTHORITATIVE** | `src/features/agent-identity/create-durable-agent-identity.server.ts` — the only `insert(agents)` in the repository. Writes **six** columns: `tenant_id`, `name`, `human_owner_type`, `human_owner_id`, `created_by`, `created_by_type`. Everything else is left NULL by design. |
| Agent identity read | **AUTHORITATIVE (read-only)** | `read-durable-agent-identity.server.ts` — no insert, no update, no transaction. `inService` is **derived** from the absence of `retired_at`, never stored. |
| Agent retirement | **AUTHORITATIVE** | `retire-durable-agent-identity.server.ts` — the only `update(agents)`. Moves exactly four things: `agent_lifecycle_status → 'retired'`, `retired_at`, the `updated_by` pair, and `updated_at`/`version`. |
| Agent lifecycle beyond create/retire | **UNOWNED** | The feature barrel exports *"no update, rename, delete, archive, restore, reinstate, suspend, succeed, activate, authenticate or authorize surface"*. Those verbs are **absent**, not guarded. |
| Agent actor resolution | **DERIVED (read-only)** | `canonical-read/actor-resolution.ts` selects on `id` + `tenant_id` with no lifecycle and no soft-delete filter. Resolving as an actor is not authenticating. |
| Agent CRUD (`/agents` lower surface) | **PLACEHOLDER — in-memory seed** | `features/agent-crud/agent-adapter.ts` seeds from `features/agents/mock`. Writes **no** database row. The page labels it as a simulation beneath the durable ceremony. |

**Production reality:** `agents` = **1 row** — `name = 'Heby'`, and every one of
`agent_lifecycle_status`, `agent_type`, `risk_level`, `authority_ceiling`, `department_id`, `role`,
`manager_actor_id`, `allowed_tools`, `required_capabilities`, `execution_posture`,
`knowledge_domains`, `retired_at` is **NULL**. `human_owner_type = created_by_type = 'human'`,
`version = 1`.

### 2.2 The one-shot, and what it means for "a second agent"

`createDurableAgentIdentity` takes `lock table agents in share row exclusive mode`, then counts:

```
select count(*) from agents where tenant_id = <tenant>      -- no lifecycle, no soft-delete predicate
if count > 0  ->  refused: "agent-identity-already-exists"
```

Soft-deleted and retired rows still count, and retirement writes no DELETE. **A tenant may hold at
most one durable agent identity, ever.** This is not policy prose; it is arithmetic inside a lock.

The proposal path holds the mirror of the same fact. `resolveAgentProposer` carries the refusal
`ambiguous-durable-agent-identity` and its own comment states the reason: *"the day Marketing and
Finance both serve, a resolver that quietly chose one would attribute a Finance proposal to
Marketing. Selection must then become an explicit, server-derived input."*

### 2.3 Capability, permission, workforce

| Concept | Class | Evidence |
|---|---|---|
| Action tool registry (`heby-actions/action-registry.ts`) | **AUTHORITATIVE for vocabulary, not for grants** | A closed, compile-time list of declared tools with `substrateConnected` honestly false for every mutation and device class. It declares that a capability *exists*; it grants nobody the use of one. |
| `AGENT_ORIGINABLE_ACTION_KINDS` | **AUTHORITATIVE — and a global constant** | `["send"]`, in `agent-origination/contracts.ts`. Identical for every tenant and every agent. **This is today's de-facto mandate.** |
| Origination candidate set | **DERIVED, per-tenant** | `candidate-set.server.ts` builds the choice space from `listActiveRecipients` (R3R) and `listWorkArtifacts` (R3W), projected to `{ref,label}` so an address cannot enter model context. |
| `permissions` / `role_permissions` | **DEAD SCHEMA** | Zero readers, zero writers, zero value importers outside `src/db/schema/`. Production: **0** rows each. `authority-read.server.ts` records that it consults neither. |
| `roles` | **PARTIAL** — written by the tenant role baseline, not consulted for authority | Production: 2 rows. `roles.type` and `authority_rank` are **not** consulted by `resolveGovernanceAuthority`. |
| `agents.authority_ceiling` | **PLACEHOLDER WITH A LIVE READER — a hazard** | No writer anywhere. But `canonical-read/actor-resolution.ts` **already summarizes it** into `authority_ceiling_summary` (jsonb key list / `array:N` / type name), surfaced through `ActorResolutionResult`. Writing mandate content into this column would make a mandate appear inside canonical *actor authority* resolution the same day. |
| `agents.allowed_tools`, `required_capabilities`, `knowledge_domains`, `agent_type`, `risk_level`, `manager_actor_*` | **DEAD SCHEMA** | Zero references anywhere outside `src/db/schema/`. |
| `features/workforce/*` (`/agents` Capabilities, Teams, Workspace models) | **PLACEHOLDER — reads the seeded CRUD adapter** | `capabilities-model.ts` and `agents-truth-model.ts` both read `agent-crud/agent-adapter.getSnapshot()`. They own no fact and declare their own provenance classes (`seeded`, `simulated`, `unavailable`). |
| `features/agent-runtime/*` (authority/capability/responsibility services) | **PLACEHOLDER — computed over mock projections** | e.g. `agent-authority-service.ts` derives an `approvalMode` from `authorityRank >= 85` over `AgentProjectionSourceRecord`, a seeded shape. Nothing durable reads it. |

### 2.4 Work, goals, missions, tasks

| Table | Class | Production rows |
|---|---|---|
| `missions`, `goals`, `plans`, `workflows`, `tasks`, `executions`, `commands`, `command_audit`, `registries`, `approvals`, `policies`, `departments`, `organizations`, `providers`, `permissions`, `role_permissions`, `improvement_proposals`, `learning_sessions`, `memories`, `working_memories`, `reasoning_traces`, `event_log`, `telemetry_events`, `notifications`, `documents`, `knowledge_edges`, `invitations`, `identity_enrollment_requests`, `membership_authorizations` | **DEAD SCHEMA / PLACEHOLDER** — no durable writer reached in `src` | **0** |

The Workflow / Registry / Memory / Knowledge-node CRUD repositories write through
`features/persistence` adapters seeded from mocks — the same in-memory substrate as `agent-crud` —
not through the control-plane handle.

### 2.5 Action, permit, execution, audit — the live chain

| Concept | Class | Owner | Production rows |
|---|---|---|---|
| Action request (frozen proposal) | **AUTHORITATIVE** | `action-authorization/record-action-request.server.ts` | `heby_action_requests` = **3** |
| Agent proposer resolution | **AUTHORITATIVE (read-only brand)** | `agent-proposer.server.ts` — a module-private runtime `Symbol` brand, unforgeable by cast | — |
| Origination provenance | **AUTHORITATIVE** | `heby_origination_invocations`, composite-FK bound to `(agents.tenant_id, agents.id)` | **1** |
| Governance decision | **AUTHORITATIVE** | `governance-decision/decision-authority.server.ts` | `decision_records` = **4**, `governance_sessions` = **4** |
| Permit | **AUTHORITATIVE** | `decide-action-request.server.ts` (mints), `consume-action-permit.server.ts` (spends), `revoke-action-permit.server.ts` | `action_permits` = **1** |
| Execution attempt | **AUTHORITATIVE** | `execute-authorized-action.server.ts` | `action_execution_attempts` = **1** |
| Recorded act ledger | **AUTHORITATIVE** | nine `governance-audit` writers, and nothing else | `audit_log` = **31** |
| Agent evidence / evaluation | **DERIVED** | `agent-outcome-observation/`, `agent-evaluation/` — unbounded `count(*) filter (…)`, no time window | — |
| Agent improvement hypothesis | **AUTHORITATIVE** | `agent-improvement-hypothesis/` — its own table, no status column | **0** |

---

## 3 · Existing Governance boundary — the part that decides the answer

Governance has **two layers**, and conflating them is what makes the "just a Governance subject"
conclusion look either obviously right or obviously wrong depending on which one you read.

### 3.1 The generic human inlet — CLOSED at one subject

`recordGovernanceDecision` (`decision-authority.server.ts`) validates against
`GOVERNANCE_SUBJECT_TYPES`, which is **`["knowledge_node"]`** and nothing else, with
`GOVERNANCE_DECISION_TYPES = ["ratify","reject"]`. Its own comment states the cost of widening:
*"Adding a second subject means proving a second server-side existence check, which is a deliberate
edit here."*

### 3.2 The transaction-joinable writer — ALREADY multi-subject

`writeGovernanceDecisionWithin(tx, tenant, authority, input, now)` accepts **eight** subject types
today, each owned by a different authority, each mapped to its own `governance_domain`:

| Subject type | Owning authority | Domain |
|---|---|---|
| `knowledge_node` | Knowledge (K4) | `knowledge-ratification` |
| authority subjects | Governance delegation (G3) | `authority-delegation` |
| `membership_authorization` | Membership (I1) | `membership-authorization` |
| organizational role | Tenant role baseline (I1.1) | `organizational-role` |
| `identity_enrollment` | Identity enrollment (I1.2) | `identity-enrollment` |
| `heby_action_request` | Action authorization (R3A) | `action-authorization` |
| `action_permit` | Action authorization (R3A) | `action-authorization` |
| `improvement_hypothesis` | Agent improvement (SIA-3) | `learning` |

`decision_records.subject_type` is **`text`**, not an enum, so a ninth subject type needs **no
migration**. `decision_records.decision_type` is an enum already containing `approve`, `revoke`,
`suspend`, `reject`. `governance_sessions.governance_domain` **is** an enum, and it already carries
an unused value `agent-registration`.

### 3.3 The named pattern

`decide-improvement-hypothesis.server.ts` states it outright:

> *"This is the shape every other subsystem already uses to submit its own subject —
> `decide-action-request`, `decide-enrollment`, `authorize-membership`, `ratify-version`,
> `provision-member-role`."*
>
> `SIA-3 OWNS the hypothesis, before and after a decision. GOVERNANCE OWNS the decision itself.`

And its schema pins the rule that matters most for a mandate:

> *"There is no status column, and that is the design. HYPOTHESIS STATUS ≠ GOVERNANCE DECISION …
> A status column would be a second copy of a decision, and the two could disagree."*

**Six independent precedents. Zero precedents for Governance owning a subject's state.**

---

## 4 · Mandate ownership alternatives

### A · Governance owns mandate state directly

| Dimension | Verdict |
|---|---|
| Source of truth | `decision_records` (+ `evidence` jsonb for the mandate's content) |
| Writer | `writeGovernanceDecisionWithin` |
| Lifecycle owner | Governance |
| Proposal enforcement seam | would have to scan the ledger's untyped jsonb on every proposal |
| Tenant isolation | `tenant_id` present, but no composite FK to `agents` — a mandate could name another tenant's agent |
| Second source of truth | no |
| Improper expansion | **YES — this is the failure the Director named.** Governance would own workforce state. |
| Multi-agent later | poor: no uniqueness, no per-agent constraint, no supersession chain |

**REJECTED.** Not because of preference — because of two structural facts. First, mandate content in
`evidence` jsonb has no CHECK, no closed vocabulary, no uniqueness and no supersession, and every
other governed subject in this repository has a typed owning table precisely so its content is
constrained. Second, and decisively: **G6A established that Governance authority resolves from
`decision_records` and nothing else.** Putting mandate state in the same table makes "what this
agent is for" a Governance-derived fact, which is the exact collapse the Director forbade.

The previous conclusion — *"a mandate is just a Governance subject"* — is **REJECTED as stated.** It
is true only in the halved sense that a mandate *change* must be a Governance subject. A mandate is
not a Governance-owned fact.

### B · Agent/Workforce authority owns mandate state, Governance authorizes changes

Split in two, because "workforce" and "agent authority" are different things here.

**B-workforce: REJECTED on measurement.** `features/workforce/*` reads
`agent-crud/agent-adapter.getSnapshot()`, an in-memory registry seeded from `features/agents/mock`
that writes no database row. It is not an authority; it is a read model over a fiction, and the
roadmap already records `RUNTIME AGENT != WORKFORCE IDENTITY` (§12.5). Giving it durable mandate
state would promote seeded state into organizational truth — Master Principle 5, and §18 rule 7.

**B-agent-authority: this is the correct half**, and it collapses into the C/D question of *where
inside agent authority*.

### C · Extend agent identity to own mandate state (columns on `agents`)

| Dimension | Verdict |
|---|---|
| Source of truth | `agents` row |
| Writer | a third writer inside `features/agent-identity` |
| Lifecycle owner | agent identity |
| Governance relationship | correct in shape |
| Revocation/change | **destroys history** — a mandate change overwrites the previous mandate |
| Second source of truth | no |
| Improper expansion | **YES, of a different authority** |
| Multi-agent later | fine |

**REJECTED**, on three repository facts:

1. `features/agent-identity/index.ts` states *"TWO authorities, TWO transitions, and no third"* and
   exports no update surface. A mandate writer inside it makes that sentence false, and the
   retirement writer's own contract enumerates the exact four columns that may move.
2. A mandate must be **changeable and revocable**. A column on a single mutable row cannot carry a
   supersession chain; the repository's own answer to versioned governed state is the
   `knowledge_facts` (identity) / `knowledge_nodes` (version) split.
3. The nearest-looking column, `authority_ceiling`, is already read and summarized by
   `canonical-read/actor-resolution.ts` into `authority_ceiling_summary`. Writing a mandate there
   would make a *constraint* surface as an *authority ceiling* in canonical actor resolution —
   MANDATE != AUTHORITY violated in the first read, by a seam nobody edited.

### D · A dedicated Agent Mandate Authority — a versioned sibling table under the agent

| Dimension | Answer |
|---|---|
| Source of truth | one new table, e.g. `agent_mandates`, tenant-owned, one row per mandate **version** |
| Writer | one server-only writer in a new `features/agent-mandate/` |
| Lifecycle owner | the mandate authority — never `agent-identity`, never Governance |
| Governance relationship | every consequential transition submitted through `writeGovernanceDecisionWithin` with subject type `agent_mandate`, inside the mandate writer's own transaction |
| Proposal enforcement seam | `recordAgentOriginatedActionRequest` / `buildOriginationCandidates` — one read, one place |
| Tenant isolation | composite FK `(tenant_id, agent_id) → agents(tenant_id, id)`, using the **already existing** `agents_tenant_id_uq` anchor |
| Audit provenance | the existing `governance-audit` writers; the mandate row itself carries the `tenantColumns` actor pairs |
| Revocation/change | a **new version row**, never an in-place edit; withdrawal is a version with no permitted scope |
| Second source of truth | **no** — no status column; whether Governance decided is read from `decision_records` |
| Improper expansion | **no** — identity keeps two transitions, Governance keeps the ledger, workforce keeps its fiction |
| Multi-agent later | **yes** — `agent_id` NOT NULL, one agent per mandate, exactly SIA-3's shape |

**D is the repository's own pattern applied to a new subject.** Two sibling tables
(`heby_origination_invocations`, `agent_improvement_hypotheses`) already bind to `agents` through the
composite anchor that `agent.ts` says exists *"so a sibling table can carry `(tenant_id, agent_id)`"*.

---

## 5 · Recommended authoritative owner

**A new Agent Mandate Authority (architecture D).** Mandate truth lives in its own tenant-owned,
agent-bound, versioned table, owned by a new `features/agent-mandate/`. Governance authorizes every
transition and owns none of the state.

```
AGENT IDENTITY AUTHORITY   owns   who the agent is          (agent-identity, 2 transitions)
AGENT MANDATE AUTHORITY    owns   what it is for            (NEW — D)
CAPABILITY REGISTRY        owns   what actions exist        (heby-actions/action-registry, declarative)
GOVERNANCE                 owns   who may authorize         (decision_records, ledger only)
ACTION AUTHORIZATION       owns   whether one act is permitted (permits)
EXECUTION                  owns   whether it ran            (attempts)
```

---

## 6 · Why Governance is not the owner

1. **It already refuses to be, six times over.** Knowledge, Membership, Role provisioning, Identity
   enrollment, Action authorization and Agent improvement each own their own subject's state and
   borrow only the decision writer.
2. **Owning mandate state would make Governance the workforce authority**, because Governance
   authority itself is *derived from* `decision_records` (G6A). A mandate stored there is a
   Governance-derived fact about an agent, which is the collapse the Director named.
3. **The typed constraint would be lost.** `evidence` jsonb has no CHECK and no closed vocabulary.
   A mandate that cannot be constrained by the database is a mandate enforced by inspection.
4. **The generic inlet is closed at one subject on purpose**, and its comment says widening it costs
   a proven server-side existence check. The mandate does not need that inlet at all: it needs
   `writeGovernanceDecisionWithin`, joined inside its own transaction, which is what every sibling
   already does.

What Governance **does** own here, without exception: the decision that a mandate may be created,
widened, narrowed or withdrawn. Nothing about a mandate is self-service.

---

## 7 · Exact mandate semantics

> **A mandate is the organization's recorded statement of the bounded purpose an agent serves, and
> the maximum surface inside which it may propose. It is a CEILING, never a floor.**

Formally, for one agent, at one version:

```
MANDATE  =  (agent, scope, version, established-by-decision, effective-from [, withdrawn-by-decision])

PERMITTED(agent, act)  =>  act ∈ MANDATE.scope        (necessary)
act ∈ MANDATE.scope    =/=> PERMITTED(agent, act)     (never sufficient)
```

The second line is the entire invariant. A mandate can only ever **subtract** from what is already
reachable. Every existing gate stays in front of it: the closed originable action kinds, the
server-built candidate set, the human review boundary, the Governance approval, the permit, the
execution arming.

```
MANDATE      != IDENTITY
MANDATE      != AUTHORITY
MANDATE      != PERMISSION
MANDATE      != CAPABILITY
MANDATE      != PERMIT
MANDATE      != EXECUTION
MANDATED     != AUTHORIZED
IN SCOPE     != APPROVED
WIDER MANDATE != MORE POWER   (it removes a constraint; it grants nothing)
```

---

## 8 · What a mandate CAN express

Only narrowings of things that already exist and are already server-derived:

1. **A purpose statement** — prose, addressed to a human, carried into the review card. Read by
   people, never by a gate.
2. **A subset of `AGENT_ORIGINABLE_ACTION_KINDS`** — a set that must be a subset of the released
   constant, checked at write time. This is the single most valuable thing it can express, because
   that constant is today a global with no tenant and no writer.
3. **A bound on the candidate classes** the agent may be offered — e.g. artifacts only, recipients
   only — expressed as a filter over sets `candidate-set.server.ts` already builds.
4. **An effective-from instant, and a withdrawal.** Both are facts, not judgements.

Everything above is *representable as a subtraction*. Nothing above requires a new read of a
subsystem the mandate authority does not already reach.

---

## 9 · What a mandate can NEVER express — and how that is structural, not stated

| Forbidden meaning | Structural enforcement available today |
|---|---|
| authorized to execute | The mandate module imports no execution module; `execute-authorized-action.server.ts` requires a permit, and a permit requires a Governance `approve` decision. A firewall test walking the value-import closure asserts the absence — the technique R6C, E2-1 and R3A.1 already use. |
| authorized to approve | Seven human-only CHECK constraints guard every approve/authorize surface. `heby_action_requests_approved_chk` requires the approver pair, and `resolveGovernanceAuthority` reads `decision_records.bootstrap` and nothing else. A mandate row is not consulted there and **cannot be**: there is no parameter for one. |
| authorized to grant permissions | `permissions` / `role_permissions` have zero writers repository-wide. There is no grant path to reach. |
| authorized to modify Governance | `GOVERNANCE_SUBJECT_TYPES` is closed; `grant-permission` and `modify-governance-policy` are excluded from `AGENT_ORIGINABLE_ACTION_KINDS`, which a mandate may only ever subset. |
| authorized to widen its own mandate | The mandate writer requires a resolved **human** Governance authority. `resolveAgentProposer` yields an `AgentProposer` brand that is *not assignable* to any authority type and grants nothing. An agent has no credential and no session — the retirement contract already records that *"an agent cannot: there is no agent authentication in Hebun."* |
| authorized to access a provider | Provider access runs through `provider-connectivity-controls` + the possession ceremony + the production arming gate. The mandate module imports none of them. |
| authorized to perform every technically available capability | The mandate is a **subset check**, and the type of the scope field admits only members of the released constant. A mandate wider than the constant is unrepresentable, not merely refused. |

**Verdict: the invariant is structurally enforceable**, using techniques already released in this
repository — a closed subset type, a module-private runtime brand, database CHECKs that mention only
`human`, and an import-closure firewall. Nothing here needs a new kind of guarantee.

One hazard is recorded rather than hidden: **do not store mandate scope in
`agents.authority_ceiling`.** It has no writer but it *does* have a reader that summarizes it into
`ActorResolutionResult.authorityCeilingSummary`. Filling it would publish a mandate as an authority
ceiling through the canonical actor read, on the same deploy, with no test failing.

---

## 10 · Proposal enforcement boundary

There is exactly one place a mandate may bite, and it is already a single seam:

```
human goal
   -> resolveAgentProposer            (identity: WHICH agent)          [released]
   -> buildOriginationCandidates      (the choice space)               [released]
   -> [ MANDATE CHECK ]               (the ceiling)                    [NEW — one read]
   -> model selection + membership check                               [released]
   -> recordAgentOriginatedActionRequest                               [released]
   -> pending. A human still decides. Governance still decides.
```

Today `record-action-request.server.ts` states: *"NO AUTHORITY IS CONSULTED, AND NONE IS GRANTED …
anyone with a tenant session may propose."* That sentence stays true for the **human** entry point.
The mandate constrains only `recordAgentOriginatedActionRequest`, the entry point that already
requires a verified `AgentProposer`.

Two properties the seam must hold, both testable:

- **Fail closed.** No mandate, or an unreadable mandate authority, refuses the agent-originated
  proposal with a typed reason. It must never fall back to the released constant, because that would
  make the mandate advisory the moment the database blinked.
- **NO MANDATE != UNLIMITED MANDATE**, and **UNAVAILABLE != NO MANDATE.** Both are distinct refusal
  reasons, in the shape `resolveAgentProposer` already uses.

The mandate check performs no widening in the other direction: it can refuse a proposal, and it can
never make one eligible that the released gates would have refused.

---

## 11 · Revocation and change model

Modelled on `knowledge_facts` / `knowledge_nodes`, not on a mutable row:

- A mandate **change** is a **new version row** bound to the same agent, authorized by its own
  Governance decision. The previous version is not edited and not deleted.
- A **withdrawal** is a version that permits nothing — expressed as an empty scope, not as a
  `withdrawn` boolean, so "withdrawn" and "never mandated" stay distinguishable by the presence of a
  row rather than by a nullable flag.
- **No status column.** Whether Governance decided about a version is answered by reading
  `decision_records` for that version's id — SIA-3's rule, for SIA-3's reason: a status column is a
  second copy of a decision and the two can disagree.
- Exactly one version may be effective per agent at a time — a **partial unique index** on
  `(tenant_id, agent_id) WHERE <effective>`, the shape already used by
  `heby_action_requests_one_pending_per_digest_uq` and
  `membership_authorizations_one_active_per_email_uq`.
- **Retirement interaction, stated rather than discovered later:** retiring an agent does not
  withdraw its mandate, and a mandate does not survive as permission because the proposal seam
  already refuses a retired identity upstream of the mandate check.

---

## 12 · Is schema/persistence actually required?

**Yes — one table, and only one.** The alternatives were measured, not assumed:

| Alternative | Why it fails |
|---|---|
| A compile-time constant per tenant | This is precisely today's state (`AGENT_ORIGINABLE_ACTION_KINDS`). A constant cannot be established, narrowed or withdrawn by a human, and this repository has already recorded the failure mode: *"a designed-for value with no writer is a constant wearing the costume of a measurement."* |
| Reuse `agents.authority_ceiling` | No writer, but a live summarizing reader in canonical actor resolution. Publishes a constraint as an authority. |
| Reuse `improvement_proposals` | Zero writers, every column nullable, no agent column, `learning_session_id` points at a table with zero writers. SIA-3 measured and refused it for the same reasons; nothing changed. |
| Governance `evidence` jsonb only | No CHECK, no closed vocabulary, no uniqueness, no supersession — and it makes Governance the owner. |
| No persistence at all | A mandate nobody can record is not a mandate. |

**Migration cost:** one new table. `decision_records.subject_type` is `text`, so the new subject type
needs **no** migration. `governance_sessions.governance_domain` **is** an enum: either reuse the
existing unused `agent-registration` value — semantically wrong, a mandate is not a registration — or
add one value. Recommend adding `agent-mandate`, which makes the ledger **39 → 40** in a single
migration alongside the table. Every prior domain carve (`membership-authorization`,
`organizational-role`, `identity-enrollment`) took the same decision for the same reason: the ledger
must be able to say what kind of change a decision was.

---

## 13 · Is a second agent required for production acceptance?

**No. The previous discovery's proposed acceptance condition is REJECTED, on two measured facts.**

1. **A second agent is structurally unreachable.** `createDurableAgentIdentity` refuses with
   `agent-identity-already-exists` when `count(*) > 0` for the tenant, under a table lock, with
   retired and soft-deleted rows counted. Production already holds one (`Heby`). Creating a second
   would require **reopening a released one-shot ceremony** — a one-way door the ceremony
   disclosure tells humans is permanent.
2. **It would break a released path.** `resolveAgentProposer` refuses
   `ambiguous-durable-agent-identity` when more than one identity is in service. A second agent
   therefore also requires designing agent *selection* in the proposal path — a second phase, with
   its own gate — before anything could be proposed at all.

Requiring a second agent would mean **manufacturing two new authorities so a test could pass**,
which is exactly the failure mode the Director named. Hebun has no product role for a second agent
today; the honest sequence is mandate first, second agent when a real second role exists.

**Heby's existing identity is architecturally sufficient**, and it is the *stronger* proof:
constraining the only agent that actually proposes actions in production exercises the real seam
against the real agent, and the multi-agent property is proved by schema shape — `agent_id` NOT
NULL, one mandate per agent, a partial unique index that admits a second agent's mandate without
edit — rather than by inventing a second agent to look at.

---

## 14 · Minimum legitimate implementation scope

One milestone. Everything below is necessary; nothing below is optional.

1. **One table** — `agent_mandates`: `tenantColumns`, `agent_id` NOT NULL, composite FK
   `(tenant_id, agent_id) → agents(tenant_id, id)`, a scope field whose type admits only subsets of
   `AGENT_ORIGINABLE_ACTION_KINDS`, a purpose statement, a version chain pointer, an
   effective-from instant, a partial unique index for one effective version per agent, and a CHECK
   that the scope is a subset. **No status column.**
2. **One writer** — `features/agent-mandate/establish-agent-mandate.server.ts`: server-only,
   resolves the human Governance authority through `resolveGovernanceAuthority`, writes the mandate
   version and the Governance decision (`subject_type = 'agent_mandate'`) in **one** transaction,
   plus the audit row through the existing `governance-audit` writer.
3. **One read** — `read-agent-mandate.server.ts`: read-only, no insert/update/transaction, returns
   the effective version or a typed unavailability.
4. **One enforcement point** — the mandate check inside the agent-originated proposal path, failing
   closed, with `no-mandate` and `mandate-authority-unavailable` as distinct refusals.
5. **One surface** — the mandate block on `/agents`, above the simulation and below the identity
   ceremony, with a disclosure listing exactly what a mandate does and does not mean, in the shape
   `ceremony-disclosure.ts` already established (a ladder that cannot lose a rung, a persisted-field
   list asserted against the writer's own `.values({…})`).
6. **Firewalls** — an import-closure test asserting the mandate feature reaches no permit, no
   execution, no provider, no credential and no permission module; a test asserting the scope type
   cannot express a superset; a test asserting the mandate check widens nothing.

**Explicitly out of scope:** a second agent, agent selection, agent authentication, mandate
templates, mandate policy, automatic mandate derivation, applying a mandate to anything other than
the agent-originated proposal path, and any read of the mandate by Heby's answer flow.

---

## 15 · Minimum production acceptance condition

Against Tenant Zero, the one real agent (`Heby`), in production, measured against a baseline
captured before the act:

1. A human with Governance authority establishes a mandate for `Heby` that is a **strict subset** of
   the released originable kinds, through the released surface.
2. Exactly one mandate row and exactly one `decision_records` row appear, bound to each other, in one
   transaction, at the same instant, with `subject_type = 'agent_mandate'` and a human actor and a
   human authority source.
3. `agents` is **unchanged** — same version, same six written columns, `authority_ceiling` still
   NULL. The mandate did not touch identity.
4. An agent-originated proposal **inside** the mandate is recorded as before, still `pending`, still
   requiring a human decision. Nothing became easier.
5. An agent-originated proposal **outside** the mandate is refused, with the mandate's own reason,
   and **no** `heby_action_requests` row is written.
6. `action_permits` and `action_execution_attempts` are **unchanged**. `permissions` and
   `role_permissions` remain **0**. No provider was reached.
7. A mandate **narrowing** is recorded as a second version with its own decision; the first version
   still exists and is still readable.
8. Heby, asked what it is permitted to do, says what the mandate constrains **and** states plainly
   that a mandate is not permission to act.

Item 5 is the acceptance. The others prove it cost nothing it should not have cost.

---

## 16 · Exact next implementation decision

The authority question is settled by this discovery: **architecture D**, a dedicated Agent Mandate
Authority. What is **not** settled, and is the next Director decision, is one thing only:

> **Is Agent Mandate Authority the first Era III program, or does a prerequisite outrank it?**

Two facts belong in that decision and neither is an argument for or against:

- **Nothing blocks it.** Every seam it needs is released and production-exercised: identity, proposer
  resolution, origination candidates, the Governance decision writer, the audit writers.
- **It is the first Era III capability that would carry a migration** (39 → 40) and the first agent
  work since AGENT-ID-0.1 to write a durable row. Every Era II milestone was zero-schema; this one is
  not, and that is a Director-visible change of character, not a detail.

If the answer is yes, the first implementation step is the schema and writer of §14 items 1–2, and
nothing else — the enforcement point in §14 item 4 is where a mandate stops being a record and starts
being a constraint, and it should be reviewed against a real proposal before it is written.

**Nothing is implemented. No runtime code was changed. The authority question is answered; the
program question is the Director's.**
