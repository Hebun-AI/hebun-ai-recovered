# Agent Platform — Phase 0 Design Gate

**Status: DESIGN GATE RECORDED (Director, 2026-10-07). Read-only. Nothing implemented.**
Baseline: origin/main `c3bfc04acc41f60f89c6767df5c593d94b212e44` (WF-3 closure). Zero schema, zero
migration, zero runtime, provider, EAI or UI change. No production read or write was made for this
record. Agent #2 is NOT selected and NOT created. Next phase selected: **AP-1 Plurality Foundation**
(design gate first).

Paths below are relative to `apps/dashboard/src/` unless stated.

## Director decisions (2026-10-07)

1. Agent #2 is **not selected**. Knowledge Steward is the **leading candidate**; its motive and its
   SCI/authorship model must be proven separately before AP-4. Engineering Agent stays the
   alternative.
2. Next phase: **AP-1 Plurality Foundation**.
3. `agents.department_id` existing as a column is **not** authority. Department placement authority
   must be proven from repository reality in AP-2.
4. The foreign uncommitted primary-tree line in
   `features/agent-identity/retire-durable-agent-identity.server.ts` (`replacedByAgentId: agentId`,
   which would make a retired agent its own successor) is **not touched** by this work.

## 1. Authoritative architecture map (measured at `c3bfc04a`)

| Area | Reality | Evidence |
|---|---|---|
| Identity genesis | Governance authority required; **one identity per tenant ever** — `count(*)` with no lifecycle predicate, so a retired row still counts; refusal `agent-identity-already-exists` | `features/agent-identity/create-durable-agent-identity.server.ts` (`resolveGovernanceAuthority`; count under `lock table agents in share row exclusive mode`) |
| Identity lifecycle | Retire = human owner AND Governance; terminal. No suspend, reinstate, rename or successor writer | `features/agent-identity/retire-durable-agent-identity.server.ts` (header) |
| Dead identity columns | `department_id`, `role`, `manager_*`, `authority_ceiling`, `suspended_at`, `replaced_by_agent_id`, all S8 profiles (`preferred_models`, `cost_limits`, `knowledge_domains`, …) have no writer | `db/schema/agent.ts` |
| Mandate | `agent_mandates`: append-only revisions, CAS on `observedMandateRevision`, one Governance decision per revision (domain `agent-mandate`). **One enforced dimension:** `proposal_scope ⊆ {send, record-work}` (DB CHECK → widening is a migration). `purpose` is display | `db/schema/agent-mandate.ts`, `features/agent-mandate/establish-agent-mandate.server.ts` |
| Proposer | `resolveAgentProposer(tenant)` takes **no agentId**; >1 in service → `ambiguous-durable-agent-identity` | `features/action-authorization/agent-proposer.server.ts` |
| Origination | Model offered only `record-work` (`NARROW_ORIGINATION_ARMS`); entry only from a human click (`/heby` WF-1 affordance, WF-3 Knowledge mode). No cron reaches origination | `features/agent-origination/originate-action.server.ts`, `app/(dashboard)/heby/actions.ts`, `app/(dashboard)/heby/knowledge-origination-actions.ts` |
| Knowledge | Per **tenant**: ≤50 listing, ≤20 candidates, ≤2,000 code points per statement, whole refusal on any bound; ratified + integrity-stamped versions only; revalidated before filing. No per-agent scope | `features/knowledge-grounding/` |
| External AI / model | Platform policy global (6 ALLOW cells, all anthropic/messages); authorization per tenant; attestation per processor. Model from `HEBUN_MODEL_ID` (deployment). Live-call budget per process, not durable | `features/external-ai-data-use/platform-disclosure-policy.ts`, `features/heby-model/model-connectivity-environment.server.ts`, `features/heby-model-live/live-spend-budget.server.ts` |
| Human authority | Approve/reject human only, enforced by DB CHECKs (human approver, human authorizer, human purpose declarer) | `features/action-authorization/decide-action-request.server.ts`, `db/schema/action-authorization.ts` |
| Ceiling enforcement | `refuseOutsideAgentMandate` at the proposal writer and at `spendPermit` (WF-4: liveness + CURRENT mandate in the spend transaction); human proposals skip it | `features/action-authorization/agent-mandate-ceiling.ts`, `features/action-authorization/record-action-request.server.ts`, `features/action-authorization/consume-action-permit.server.ts` |
| Execution | Human: `executeRecordWork` (internal), `executeAuthorizedAction` (send via Resend; Instagram/YouTube publish). Machine (RUNG 2): `record-work` only, `machine-internal-execution` root control | `features/governed-internal-action/`, `features/action-execution/`, `features/governed-machine-execution/contracts.ts` |
| Providers / tools | Real writes (Instagram publish, YouTube upload, send) reachable only from **human** proposals. GitHub and Drive read-only. Tool use, computer use, browser and shell are simulation | `features/provider-catalog/catalog.ts`, `features/heby-action-inlet/propose-commands.server.ts`, `features/providers/computer-use/provider.ts` |
| Work | `work_items.accountable_actor_type` is human-only (CHECK); agent-originated work is written as `system`. Work cannot be assigned to an agent | `db/schema/work-item.ts`, `features/organizational-work/write-work.server.ts` |
| Provenance | invocation (`agentId`, human creator) → request (`proposedByActorType = agent`, `evidence`, invocation id) → EAI audit (correlation = invocation) → decision/session → permit → attempt → work. No `audit_log` row is ever written with `actorType = agent` | `features/agent-origination/invocation-provenance.server.ts`, `features/governance-audit/` |
| Multi-agent | No primitive. Delegation is human→human Governance delegation; `managerActorType` is dead; `assignedAgents` exists only in mock workflow-crud | `features/governance-decision/authority-delegation.server.ts`, `features/workflow-crud/` |
| Mock / legacy | `agent-crud`, `agent-runtime`, `orchestration`, `task-planning`, `workflow-*`, `execution-engine`, `providers/*/simulation` are in-memory. `/director/agents`, `/director/providers/*`, `/director/executions` are labelled simulation, not gated. Ten dead tables: `missions`, `goals`, `plans`, `tasks`, `workflows`, `executions`, `commands`, `policies`, `permissions`, `role_permissions` | `features/persistence/storage-manager.ts`, `features/mock-surface-gating/gate.server.ts` |
| UI | Durable: `/agents` (identity, mandate, WF-2 capability truth), `/approvals`, `/heby`, `/knowledge` | `app/(dashboard)/agents/page.tsx` |

### Agent #1 today

Can: on a human click in the `hebun` tenant, file one `record-work` proposal (organization-level or
Engineering), grounded in conversation, organization and ratified Knowledge (≤20 facts), with full
provenance; a human approves; internal work follows (or the machine path, when an envelope exists and
the root control is armed).

Cannot: originate unprompted; offer `send` (permitted by mandate, arm hidden from the model); write to
a provider; use tools; approve or execute; own work; belong to a department; collaborate with another
agent; use any model in TRH or Mulify (no tenant EAI authorization).

### Agent #2 history

Era III agents discovery and APF-0: C · DEFER. The identical-ceiling blocker is removed since
`record-work` joined the vocabulary; the **motive** was never measured. MASTER-ROADMAP §20.4
sequencing remains NOT SELECTED. No APF-2 document, no APF-4, no half-built second-agent code; the
singleton guards are live.

## 2. Missing primitives

1. **Multi-identity genesis** — a Governance-decided ceremony per identity in place of one-per-tenant.
2. **Explicit proposer and authorship selection** — `resolveAgentProposer(tenant, agentId)`; the same
   ambiguity exists in work-artifact authorship.
3. **A second mandate dimension (department ceiling)** — without it two agents holding the same kind
   are indistinguishable by ceiling. Placement authority itself is unproven (Director decision 3).
4. **Durable per-tenant model spend cap** — before more than one agent can spend model calls.
5. **Suspend** (reversible lifecycle).
6. **Succession** with correct semantics.

Not needed: per-agent model routing, per-agent EAI, per-agent Knowledge scope, agent-to-agent
messaging.

## 3. Agent Platform v1 — design answers

1. **An Agent** is a durable identity with its own human-owned name, its own Governance-decided
   proposal ceiling (mandate) and its own retirement. It **proposes**; it does not decide. Anything
   that needs only different data or a different prompt is a **capability**, not an agent.
2. **Agent vs assistant.** Heby chat (`assistance`) writes no record and files no proposal. An agent
   writes a governed request under `agent-origination`, bound to a proposer identity and its mandate.
   The boundary is write authority and accountability, not model quality.
3. **Lifecycle.** Create (Governance decision) → mandate revision 1 → placement → suspend/resume →
   retire → succession (new identity + lineage link). Specialisation = mandate + placement +
   capabilities, not a type table.
4. **Representation.** Role/goal = `purpose` (display). Authority = `proposal_scope` (+ department
   ceiling, AP-2). Knowledge, model and EAI stay at tenant/platform level. Tools and providers stay
   capabilities under their own authorities. Dead S8 columns are not revived.
5. **Separation.** Human/Governance decides; agent proposes; permit carries authority; executor (human
   or armed machine) applies; WF-4 re-checks at spend. "Decide" stays human.
6. **Agent collaboration.** No direct agent-to-agent messaging. Collaboration runs through governed
   work: an approved proposal becomes a work item that another agent reads as grounding. No agent
   assigns work to an agent; the accountable actor is always human.
7. **Organization.** An agent has at most one department, or is an organization-level generalist
   (Heby). The department owner is human; the agent carries that department's work.
8. **Scale.** Section 2 items 1–5. No registry runtime or orchestrator is needed for tens or hundreds
   of agents; explicit selection and cheap ceilings at every seam are.
9. **Not now.** Mock promotion; dead-table activation; `agent_assignments`; ephemeral sub-agents;
   model-based selection as authority; agent-to-agent chat; budget/spend-holding agents; origination
   from cron; Security Agent; per-agent model/EAI/Knowledge; a tool-use runtime.
10. **Agent #2.** See section 4.

## 4. Agent #2 — leading candidate (not selected)

**Knowledge Steward** for the `hebun` tenant: internal authority only, no provider.

- Measured bottleneck: Agent #1's grounding universe holds exactly one eligible fact (WF-3D).
- A real agent, not a capability: it needs a different action kind (draft knowledge proposal, or
  `retract-knowledge-source`, already classified B), so its ceiling differs structurally.
- Low risk: no egress, no provider write; its output enters as draft and cannot pass SCI-2B
  admissibility without human ratification.

Alternative: **Engineering Agent** (GitHub read). Indistinguishable from Agent #1 without a
department ceiling, and it needs a new EAI cell for GitHub data. Later.

Open before AP-4: a new originable kind needs a migration of the `agent_mandates` scope CHECK, an
action-registry entry and an executor; the trust and authorship model of agent-written Knowledge
drafts is **unverified**; the motive is a Director decision.

## 5. Phase sequence (only AP-1 selected)

```
AP-0  this gate — recorded
AP-1  Plurality Foundation — explicit proposer/authorship selection, Governance-decided
      multi-identity genesis, corrected disclosure            ← SELECTED (design gate first)
AP-2  Department ceiling — placement authority proven first, then mandate enforcement
AP-3  Durable per-tenant model spend cap
AP-4  Agent #2 action kind design gate (scope CHECK migration, executor, SCI authorship)
AP-5  Same-tenant two-agent production acceptance (distinct mandates)
then  suspend / succession → RUNG 3 prerequisites
```

## Three questions

1. **What did we learn?** The agent platform already exists as authorities — identity, mandate,
   proposal, decision, permit, spend re-check, execution — and is singular only at two refusal seams
   and one genesis count. The missing pieces are selection and ceiling dimensions, not a runtime.
2. **How does this improve Turkish Rug House?** It does not yet: TRH holds no EAI authorization. It
   fixes the order in which a TRH agent could later carry department work without a parallel system.
3. **How does this become part of Hebun AI?** As the reference model every later agent phase is
   checked against: one authority per fact, human decision, agents as proposers.
