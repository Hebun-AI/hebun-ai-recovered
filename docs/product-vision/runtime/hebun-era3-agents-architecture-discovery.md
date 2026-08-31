# Era III — Agents Architecture Discovery

**Era III, second discovery.** Determines the legitimate architecture for Hebun to evolve from
`Director → Heby` into `Director → Heby → an appropriate real agent → bounded work → Governance
when consequential → authorized execution → result → observation`, without creating duplicate
authorities or fake multi-agent infrastructure.

**Baseline:** `main` at `6caba6e`, equal to `origin/main`. Production migration ledger **40**.
**Status:** discovery only. Nothing implemented, no schema, no migration, no agent created.
**Outcome:** Agent Plurality Foundation (APF) — **RECOMMENDED / NOT STARTED**.

---

## 1 · What this discovery is, in one sentence

> Hebun holds exactly one durable agent, and what stops it holding two is not a missing runtime —
> it is a missing selection input on two released seams, plus an action vocabulary one kind wide.

---

## 2 · The pins

```
IDENTITY      != MANDATE
MANDATE       != CAPABILITY
CAPABILITY    != PERMISSION
PERMISSION    != GOVERNANCE AUTHORIZATION
AUTHORIZATION != PERMIT
PERMIT        != EXECUTION
ATTRIBUTION   != AUTHORITY
SELECTION     != DELEGATION
REACHABLE     != AUTHORITATIVE
SEEDED        != DURABLE
```

Each rung is enforced by a distinct mechanism, not by prose. See §6.

---

## 3 · The name collision, recorded so it is never smoothed over

Two different things share one string, and the repository cannot disambiguate them because
`features/agent-identity` exports no rename authority.

| | What it is | Where it lives |
|---|---|---|
| **`"Heby"` the durable agent** | one row in `agents`, Tenant Zero, human-owned, mandate revision 2, scope `send` | `agents` table, control plane |
| **Heby the interface** | the Executive Intelligence Interface — read-only, non-authoritative | `features/heby-*` |

`heby-core/heby-identity-types.ts` states the boundary in its own words: Heby "never becomes
Runtime, Memory, Reasoning, Organizational Intelligence, a Workflow, an Orchestrator, **an Agent**,
or a Decision Engine." Its eight capabilities — `explain`, `summarize`, `clarify`, `navigate`,
`expose-runtime`, `expose-director-briefing`, `answer-director-question`, `prepare-information` —
are all read-only and terminate at the Director.

**Heby-the-interface is contractually not an Agent. The durable agent is merely named after it.**
Any multi-agent product surface must disambiguate these in copy, because
`GENESIS_DISCLOSURE.noRenameOrReplacement` means the row's name is permanent.

---

## 4 · Repository reality — surface classification

Reachability was measured by walking the import graph from all 150 route entry points under
`src/app` plus `middleware.ts`, following `import`, `export … from`, and dynamic `import()`.
1876 / 2404 files reachable. **Reachable is not authoritative**, so every agent-adjacent
directory was additionally measured for whether it touches the database at all.

### 4.1 Authoritative

| Surface | Evidence |
|---|---|
| `features/agent-identity` | exactly **two** writers to `agents`: `create-durable-agent-identity.server.ts` (insert), `retire-durable-agent-identity.server.ts` (update). No third. |
| `features/agent-mandate` | `agent_mandates` — 23 cols, 6 CHECKs, 5 FKs, 5 indexes. Governance-bound, never updated, revision-chained. |
| `features/agent-origination` | writes `heby_origination_invocations`; the mandate ceiling binds downstream in the proposal writer. |
| `features/action-authorization` | `heby_action_requests`, `action_permits`. |
| `features/action-execution` + `-live` | `action_execution_attempts` + one Resend adapter. |
| `features/governance*`, `governance-decision` | `decision_records`, `governance_sessions`, `audit_log`. |
| `features/organization-authority` | read-only seam (L3). |
| `features/agent-improvement-hypothesis` | `agent_improvement_hypotheses`. |
| `features/work-artifacts`, `features/external-recipients` | R3W / R3R. |

### 4.2 Derived

`agent-outcome-observation`, `agent-evaluation`, `live-map`, `canonical-read/actor-resolution`,
and the ten connected Heby grounding sources.

### 4.3 Placeholder / mock / seeded — zero database rows

| Surface | Files | DB-touching |
|---|---|---|
| `features/agent-runtime` | 10 | **0** |
| `features/agent-crud` | 13 | **0** — seeds from `agents/mock.ts`, in-memory, per-process |
| `features/orchestration` | 17 | **0** — `agent-selector.ts` imports `@/features/agents/mock` |
| `features/agent-reasoning` | 11 | **0** |
| `features/task-planning` | 12 | **0** |
| `features/workflow-crud` | 13 | **0** |
| `features/workflow-runtime` | 10 | **0** |
| `features/agent-context` | 6 | **0** |
| `features/workforce` | 4 | **0** — reads the `agent-crud` snapshot |
| `features/goal-runtime`, `mission-runtime` | 3 + 3 | **0** |
| `features/agents/mock.ts` | 480 lines, ~36 entries | — |
| `features/live-dispatch` | 10 | **0**, and **0/10 reachable from any route** — dead code |

`orchestration/agent-selector.ts` is the existing "routing": lowercase substring matching
(`text.includes("budget") → department "finance"`) over the seeded array, with `agents[0]` as final
fallback. No tenant, no database, no governance. **A demo, not a router.**

### 4.4 Dead schema

`tasks`, `missions`, `workflows`, `goals`, `plans`, `permissions`, `role_permissions`, `policies`,
`departments`, `organizations`, `registries` — zero schema-importers outside `src/db/schema/`,
zero production rows.

Dead **columns** on the live `agents` table: `allowed_tools`, `required_capabilities`,
`knowledge_domains`, `agent_type`, `risk_level`, `manager_actor_*`.

The `governance_domain` enum value `agent-registration` exists and has never been used.

### 4.5 The one hazard

`agents.authority_ceiling` has **no writer anywhere**, but `canonical-read/actor-resolution.ts`
**already reads it** and summarizes it into `authority_ceiling_summary`. Writing mandate content
there would publish a *constraint* as an *authority ceiling* through canonical actor resolution, on
the same deploy, with no test failing. `agent_mandates` declined this column for exactly that
reason and left it byte-untouched. It stays untouched.

### 4.6 Unavailable

Multi-agent runtime, agent selection authority, agent work/delegation authority. None exists.

---

## 5 · The minimum ontology — three persisted concepts, not ten

| # | Concept | Needs its own persisted concept? | Basis |
|---|---|---|---|
| 1 | Heby | **NO — not an agent** | its own released identity contract |
| 2 | durable agent | **YES** | `agents` row |
| 3 | domain agent | NO | a durable agent with a domain-scoped mandate |
| 4 | specialist agent | NO | same |
| 5 | temporary worker / sub-agent | **NO, and not justified** | proposing requires a mandate; a mandate requires `agent_id NOT NULL` + a Governance decision. An ephemeral agent needs an ephemeral Governance decision. |
| 6 | tool / provider | already separate | `integrations`, `providers`, `heby-actions/action-registry.ts` |
| 7 | workflow | NO | dead schema, zero writers |
| 8 | task | NO | dead schema, zero writers |
| 9 | capability | **NO — a global constant** | `AGENT_ORIGINABLE_ACTION_KINDS = ["send"]`, identical for every tenant and every agent |
| 10 | mandate | **YES** | `agent_mandates` |

Plus one already-built concept easy to miss: **invocation provenance**
(`heby_origination_invocations`), which already carries `agent_id` and already owns "an invocation
was registered, this is how far it got, and this is what the provider returned".

**Lifecycle is derived, never stored:** `inService = retiredAt IS NULL && lifecycle != retired`.

---

## 6 · The ladder, each rung by mechanism

- **identity ≠ mandate** — two tables, two authorities; neither `agents` writer touches a mandate.
- **mandate ≠ capability** — the mandate is a *subset*: `CHECK proposal_scope <@ array['send']`.
- **capability ≠ permission** — `permissions` / `role_permissions`: 0 readers, 0 writers, 0 rows.
  Permission has no representation at all.
- **permission ≠ Governance authorization** — `resolveGovernanceAuthority` reads
  `decision_records.bootstrap` and nothing else; not `roles.type`, not `authority_rank`, not
  `permissions`.
- **authorization ≠ permit** — `heby_action_requests` and `action_permits` are separate tables with
  separate writers, both human-only CHECK-constrained on the deciding actor.
- **permit ≠ execution** — `action_execution_attempts` is a third table; permit consumption is its
  own module.

---

## 7 · Heby's role in a multi-agent Hebun

**Verdict: a conversational surface over a separate selection concern.** Not a peer agent, and
explicitly not a privileged supervisor.

| Question | Measured answer |
|---|---|
| Can Heby choose an agent? | **NO.** `heby-runtime/runtime.ts` resolves *workspace → source classes* from a static registry. No agent identity enters the path. |
| Is selection consequential? | **YES.** The chosen agent id is written into `heby_action_requests.proposed_by_actor_id` — durable, human-facing attribution on an irreversible-action proposal. |
| Can Heby delegate work? | **NO.** No delegation concept exists in any table, contract or module. |
| Who owns delegation truth? | **Nobody.** |
| Can Heby stop / cancel work? | **NO, not as Heby.** `revoke-action-permit` and `execution-control` are human-authority seams. |
| Can Heby inspect another agent's result? | **YES, already** — `heby-agent-source.server.ts` iterates all identities. |
| Can Heby combine results? | as **evidence**, yes; as **work product**, no. |
| Does Heby need persistent task ownership? | **NO.** `heby_origination_invocations` already holds the causal record, owned by origination. |
| Is routing a read/selection concern or a lifecycle authority? | **Selection only.** There is no lifecycle for an authority to own, and the one durable fact about a selection already has a home. |

**The specific superuser risk, named:** if Heby gains "choose the agent", the chosen id becomes a
durable attribution Heby authored on an irreversible-action proposal. The mitigation is structural:
selection is an *input the server verifies*, and the human authorization steps stay CHECK-constrained
to `human` in Postgres.

---

## 8 · Selection and routing

Evaluated against repository reality, not preference.

| Architecture | Truth owner | Deterministic | Model can invent an agent | Verdict |
|---|---|---|---|---|
| Deterministic capability routing | a new capability→agent map | yes | no | **reject today** — the vocabulary is one element wide and globally identical; it discriminates nothing |
| **Mandate-based routing** | `agent-mandate` (exists) | yes | no | **strongest** — adds no truth owner; the mandate revision that made an agent eligible is itself an auditable row |
| Model-based semantic selection | **nobody** | no | **yes — the core risk** | acceptable **only** as a ranking layer over a server-built eligible set |
| Registry-based selection | in-memory seeded adapter | yes | n/a | **reject** — converts fiction into architecture |
| Domain hierarchy | `departments` | n/a | n/a | **reject** — zero writers, zero rows |
| **Explicit Director selection** | the human | yes | no | **strong, and already released** — `write-improvement-hypothesis.server.ts` takes `agentId`, verifies it against `readDurableAgentIdentityState`, refuses `agent-unresolvable` / `agent-retired` |
| Hybrid | human (authority) + mandate (eligibility) | yes | no | **recommended shape** |

**Failure semantics.** No eligible agent → typed refusal, write nothing (mirrors AMA-2, whose
mandate refusal writes no request row). Multiple eligible → require explicit selection; **never
auto-pick**. Authority unreachable → `unavailable`, a third state distinct from "none eligible".

**Tenant isolation is inherited, not re-implemented.** `readDurableAgentIdentityState` takes a
server-resolved `TenantContext` with no widening parameter, and `agent_mandates` carries the
composite FK `(tenant_id, agent_id) → agents(tenant_id, id)`.

---

## 9 · Domain agent vs specialist agent

**The test:** does this thing need its own *name a human owns*, its own *Governance-decided proposal
ceiling*, and its own *retirement*? If it only needs different data or a different prompt, it is not
an agent.

| Candidate | Verdict today |
|---|---|
| Finance / Sales / HR domain-manager agents | **not justified now** — they manage nothing, because no delegation authority exists for a manager to exercise |
| Expense analysis | a read plus an answer; proposes nothing, so no mandate can bound it |
| Invoice extraction | tool / pipeline — `provider-content-admission` + Knowledge already own the shape |
| Lead research | provider capability; no connected read seam |
| Email drafting | capability of an existing agent — `prepare-work-artifact.server.ts` already mints authorship |
| Sales follow-up (the send) | the strongest candidate, and still indistinguishable — see below |
| HR recruiting, Legal review | no seam; review is a human Governance act |
| GitHub analysis | tool — `provider-github` is a read seam |

**Zero categories qualify today, including the strongest.** Not because they are bad products —
because two agents would draw their mandates from the same one-element vocabulary, so their ceilings
would be *identical*, and selection would be arbitrary in the only dimension that could justify it.

> **This is a statement about current repository reality, not permanent product doctrine.**
> The absence of delegation and domain authority means these roles are **not justified now**. It
> does not mean Hebun may never have domain agents, specialist agents, or agent-to-agent
> delegation. Those become legitimate when a real product requirement and a real authority model
> justify them — never before, and never by promoting a seed.

---

## 10 · The authority chain, per transition

| Transition | State owner | Persistence | Human authorization | Reversible | External consequence |
|---|---|---|---|---|---|
| Director → Heby | Heby (in-request) | no | no | yes | no |
| Heby → agent selection | **none today** | **no new row needed** | no | yes | no |
| agent → evidence retrieval | existing read seams | no | no | yes | no |
| agent → analysis (model call) | origination | `heby_origination_invocations` | no | yes | no |
| agent → proposal | action-authorization | `heby_action_requests` | no (proposing ≠ authorizing) | yes | no |
| → Governance decision | governance-decision | `decision_records` | **YES — human-only CHECK** | no (record permanent) | no |
| → permit | action-authorization | `action_permits` | **YES — human-only CHECK** | revocable until consumed | no |
| → execution | action-execution | `action_execution_attempts` | permit-gated, one-shot | **NO** | **YES** |
| result → Heby | agent-outcome-observation | no (derived) | no | yes | no |

**Do the five candidate nouns need new authorities? Measured — all NO.**

| Noun | New authority? | Where the fact already lives |
|---|---|---|
| agent assignment | NO | a *value*: `heby_action_requests.proposed_by_actor_id` |
| agent delegation | NO | nothing delegates; inventing it *is* the authority collapse |
| work ownership | NO | `work_artifacts`, already carrying agent authorship |
| agent run lifecycle | NO | `heby_origination_invocations`, two orthogonal axes |
| result ownership | NO | derived by `agent-outcome-projection.server.ts` |

---

## 11 · What blocks a second durable agent

| # | Blocker | Mechanism | Class |
|---|---|---|---|
| 1 | Genesis one-shot | `lock table agents in share row exclusive`, then `count(*) where tenant_id = X`; `> 0` ⇒ `agent-identity-already-exists`. **No lifecycle predicate** — retired rows still count, so retire-then-recreate is closed too. | architectural |
| 2 | Ceremony disclosure | `GENESIS_DISCLOSURE.genesisIsOneShot`, `.retirementDoesNotReopen`, `.retirementIsTerminal`, `.noRenameOrReplacement` — humans were shown, in product copy, that this is permanent. | historical ceremony |
| 3 | Proposer ambiguity | `resolveAgentProposer`: `serving.length > 1` ⇒ `ambiguous-durable-agent-identity`. | architectural |
| 4 | Authorship ambiguity | `resolveAgentAuthorship`: identical refusal in `work-artifacts`. | architectural |
| 5 | Tests pinning one agent | 11 references across 8 files. | temporary implementation — updated by the phase that legitimately changes the contract, **never deleted to make a test pass** |
| 6 | UI | `/agents` already renders `identities` as a list; the ceremony affordance is gated on `genesisSpent`. | product |
| 7 | Mandate schema | **not a blocker** — `agent_id NOT NULL`, `(tenant_id, agent_id, mandate_revision)` UNIQUE; admits a second agent's mandate with zero schema change | — |
| 8 | Heby grounding | **not a blocker** — `heby-mandate-source` loops all identities; `agent-outcome-projection` maps all identities; `resolveAgentProposerDisplays` resolves a set | — |
| 9 | Runtime | **not a blocker** — no multi-agent runtime exists to break | — |
| 10 | **Mandate indistinguishability** | `AGENT_ORIGINABLE_ACTION_KINDS = ["send"]` is a global constant mirrored by a DB CHECK. Two agents' ceilings would be identical. | architectural — **the ordering constraint** |

Singleton protections are **not** removed to make a test pass. They are replaced by a *narrower*
protection, under a Governance decision, with the disclosure corrected in the same commit.

---

## 12 · The seeded catalog — audited, not promoted

`features/agents/mock.ts`: 480 lines, ~36 entries. Consumers: three department pages, the planning
builder, three orchestration engines, the `agent-crud` adapter, the organization projection builder,
and one component.

| Category | Classification |
|---|---|
| Finance / HR / Sales / Legal "Department Manager" entries | **UI fiction — the most dangerous seeds.** They encode a hierarchy over `departments`, which is dead schema with zero rows and zero writers. |
| Invoice, Payment, Expense, Budget, Cash Flow, Tax, Financial Analytics | capability or pipeline, not agent |
| SEO, Support, Research, Lead Qualifier, Proposal, Negotiation, Customer Success, Renewal, Ticket, Knowledge Base | UI fiction today; capability or workflow at best |
| Candidate Screening / Recruiting | insufficient evidence — no seam of any kind |

**Containment, measured.** `mock-surface-gating/gate.server.ts` has exactly two consumers —
`command-goals/workspace-model.ts` and `director-dashboard-ui/adapter.server.ts`. The pages
`app/(dashboard)/{hr,finance,legal}/page.tsx` import `@/features/agents/mock` **without** passing
through that gate. Recorded as an open containment question; how those pages label the data was not
assessed here, so this is not asserted as a truth defect.

---

## 13 · The recommended program — Agent Plurality Foundation (APF)

**Status: RECOMMENDED / NOT STARTED.** No milestone of APF is approved by this document.

**Problem.** Hebun can hold one durable agent and cannot hold two *meaningfully*. Two blockers, in
a fixed order: every mandate draws from a one-element global vocabulary, so two agents' ceilings
would be identical; and two released seams refuse when more than one agent serves, because selection
does not exist.

**Genuinely necessary new authority: NONE.** All five candidate nouns already have a durable home
or no subject at all (§10).

**Not gained:** no delegation, no orchestration, no task/workflow/mission authority, no agent-run
authority, no assignment authority, no Heby write, no agent-to-agent messaging, no autonomy, no
provider-permission widening.

**Reused:** Agent Identity, Agent Mandate, Agent Origination, Action Authorization, Action
Execution, Governance, Organization Authority.

**Persistence model:** zero new tables, zero new columns.

**Proposed milestone sequence** (subject to the APF-0 gate, which re-tests both the ordering and
whether any of it is justified yet):

1. a second originable action kind, only if real product capability demands one
2. explicit, server-verified agent selection on the two ambiguity seams
3. a read-only mandate-eligibility seam
4. a Governance-authorized second-identity ceremony with a corrected disclosure
5. production acceptance: two agents with **different** mandates, one refused for the kind the
   other is permitted

**Production acceptance definition.** In production, by a human: two durable agents exist with
different mandates; agent B proposes a kind agent A's mandate forbids; agent A is refused for that
same kind; both proposals carry correct, distinct `proposed_by_actor_id`; every refusal leaves zero
consequential rows.

---

## 14 · Rejected architectures

**Agent Runtime Foundation** — promoting `agent-runtime` + `orchestration` + `task-planning` to
durable. Sixty-three files across those directories touch **zero** database rows, own no fact, and
seed from `agents/mock.ts`. Promoting them converts a demo into architecture, manufactures at least
five authorities for nouns with no durable subject, and activates six dead tables with zero
production rows.

**Agent Selection Authority as a new authority** — an `agent_assignments` table plus a writer. The
selected agent already has two durable homes: `heby_action_requests.proposed_by_actor_id` and
`heby_origination_invocations.agent_id`. A third record of the same fact is one fact in three places
that can disagree — the exact reasoning `agent_mandates` used when it declined
`agents.authority_ceiling`, and that `heby_origination_invocations` used when it put the causal link
on the other side rather than on both.

**Heby as privileged supervisor** — refused by Heby's own released identity contract, whose eight
capabilities are all read-only.

---

## 15 · Discovery verdict

```
Current durable agents:                 1 (one `agents` row, named "Heby", Tenant Zero)
Multi-agent runtime exists:             NO
Agent selection authority exists:       NO
Agent work/delegation authority exists: NO
Second agent safe today:                NO
New authority required:                 NONE
Recommended next Agents program:        Agent Plurality Foundation (APF)
APF status:                             RECOMMENDED / NOT STARTED
Implementation started:                 NO
Agent #2 created:                       NO
```
