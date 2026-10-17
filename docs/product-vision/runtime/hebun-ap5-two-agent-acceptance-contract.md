# AP-5 — Same-Tenant Two-Agent Production Acceptance: Entry and Acceptance Contract

**Status: ENTRY CONTRACT RECORDED (Director authorization, 2026-10-17). AP-5 is NOT started, NOT
implemented and NOT accepted.** Baseline: `main` = `origin/main` = `f9ae3b4c`. Documentation only:
no code, schema, migration, agent, mandate, Governance decision, permit, provider call or production
read/write was made for this record. The closure record for writing it is
`hebun-ap5-entry-reconciliation-closure.md`.

This record is the single authority for what AP-5 must prove. It lives beside the Agent Platform
Phase 0 design gate (`hebun-agent-platform-phase0-design-gate.md`), which remains the program record.
It creates no new authority: every check it names is enforced, if at all, by an authority that
already exists.

Paths are relative to `apps/dashboard/src/` unless stated.

## 0. The three kinds of requirement in this record

| Kind | Meaning | Who may change it |
|---|---|---|
| **BINDING** | Already decided in an existing record; quoted, not re-decided | Only the record that owns it |
| **INHERITED** | An invariant an existing security or Governance contract already enforces; AP-5 must not weaken it and must show it still holds with two agents | The owning contract |
| **PROPOSED** | An acceptance criterion written here for the first time. **NOT APPROVED.** It binds AP-5 only after an explicit Director approval recorded in this file or in the AP-5 closure record | The Director |

No PROPOSED criterion may be reported as BINDING, and no AP-5 closure may count a PROPOSED criterion
as satisfied unless the Director approved it first.

## 1. BINDING requirements (existing records)

| ID | Requirement | Source |
|---|---|---|
| B1 | AP-5 is "Same-tenant two-agent production acceptance (distinct mandates)" | `hebun-agent-platform-phase0-design-gate.md` §5 (`AP-5` line) |
| B2 | Registration as a Governance decision has never been exercised in production (0 decisions); AP-5 carries that proof | `hebun-ap1-plurality-foundation.md`, "What is and is not proven" |
| B3 | B1 ambiguity refusal, B2 same-agent lineage, explicit selection and Heby candidates "need two in-service agents; proven by tests only"; "that proof belongs to AP-5" | `hebun-ap1-plurality-foundation.md`, same table and *Limitation* |
| B4 | Agent out-of-responsibility refusal is test-verified only; agent proposal approve → permit → spend is NOT production-exercised | `hebun-ap4b-strict-work-eligibility.md`, status table and *Open* |
| B5 | Responsibility per mandate is "what lets two agents in one tenant hold distinct jobs (AP-5)" | `hebun-ap4b-strict-work-eligibility.md`, *Three questions* 3 |
| B6 | An agent is a durable identity with its own human-owned name, its own Governance-decided ceiling and its own retirement; something that needs only different data or a different prompt is a capability | Phase 0 §3.1; `MASTER-ROADMAP.md` §20.4 *The reconciled model* |
| B7 | Before a second in-service agent is placed, the Heby state-change affordance needs an agent choice | `WORK-UPDATE-AGENT-SELECTION-1` (DEFERRED), `hebun-work-update-v1-closure.md` |

B1 fixes exactly three things: **two** agents, **one** tenant, **different** mandates. It does not name
the tenant, the second agent, the evidence or the invariants; §3 proposes them.

## 2. INHERITED invariants (existing security and Governance contracts)

| ID | Invariant | Owner / evidence |
|---|---|---|
| I1 | Approve, reject, authorize and declare purpose are human-only, enforced by DB CHECKs | `db/schema/action-authorization.ts`; `features/action-authorization/decide-action-request.server.ts` |
| I2 | Every identity registration is one Governance decision (domain `agent-registration`, outcome `agent-registered`) with its audit row in the same transaction; a reason is required | `features/agent-identity/create-durable-agent-identity.server.ts` (AP-1) |
| I3 | In-service agent names are unique per tenant (`agents_tenant_name_in_service_uq`) and visible (`agents_name_visible_chk`) | migration 74 (AP-1) |
| I4 | Mandate revisions are append-only, CAS-guarded, one Governance decision each; `proposal_scope ⊆ AGENT_ORIGINABLE_ACTION_KINDS` = `send`, `record-work`, `set-work-declared-state` (DB CHECK) | `features/agent-mandate/establish-agent-mandate.server.ts`; `features/agent-origination/contracts.ts:74` |
| I5 | Responsibility is a dimension of a mandate revision; `record-work` requires a non-empty grant; organization-level covers no domain and a domain grant covers no organization work | `hebun-ap4a-work-domain-foundation.md` *Contract*; AP-4B |
| I6 | Work scope is the human's input on every path; the model never sees or returns it | AP-4B *What changes* |
| I7 | The proposer is resolved, never guessed: more than one in-service agent without a selection refuses `ambiguous-durable-agent-identity`; a selection is a lookup key verified by the identity read seam (`selected-agent-unresolvable`, `selected-agent-retired`) | `features/action-authorization/agent-proposer.server.ts`; `features/work-artifacts/agent-authorship.server.ts` |
| I8 | Mandate ceiling is checked at the proposal writer and again at `spendPermit` with liveness and the CURRENT mandate in the spend transaction | `features/action-authorization/agent-mandate-ceiling.ts`; `consume-action-permit.server.ts` (WF-4, AP-4B) |
| I9 | Approval refuses `proposing-agent-not-in-service`, reading the proposer row FOR SHARE before any decision is written | `features/action-authorization/decide-action-request.server.ts:66` (L-1a) |
| I10 | Retirement, suspension and reactivation are `agent-lifecycle` Governance decisions written with the lifecycle change and audit in one transaction; retirement is terminal; reactivation never revives a retired agent and is refused while the agent holds a usable permit or a valid standing envelope | `features/agent-identity/retire-durable-agent-identity.server.ts`, `suspend-durable-agent-identity.server.ts` (L-1b, L-2b) |
| I11 | Spend, standing issuance and envelope authorization read agent liveness FOR SHARE; email, Instagram and YouTube re-check the proposing agent immediately before the provider call | L-2b (`13bc65da`) |
| I12 | No agent id is model-facing (E2-5); an agent name never enters a minted system instruction (SCI-1; AP-5A gate G1) | `hebun-ap1-plurality-foundation.md` AP-5A revision note |
| I13 | External AI data use is decided per tenant and platform cell, not per agent; agent origination is allowed only for `conversation`, `organization`, `knowledge` | `features/external-ai-data-use/platform-disclosure-policy.ts:91` |
| I14 | The AI dispatch safety cap is per tenant × class per UTC day (model 50, media 5); two agents share it | `features/ai-dispatch-cap/ai-dispatch-safety-cap.server.ts:66` (AP-3) |
| I15 | Work cannot be accountable to an agent: `work_items.accountable_actor_type` is human-only | `db/schema/work-item.ts` |
| I16 | Every read and write is scoped to the server-resolved tenant; no caller supplies a tenant | `agent-proposer.server.ts` (`no-authorized-tenant-context`) |
| I17 | A push to `main` is a production deploy; push success is not deployment success | `CLAUDE.md` *Kritik Kurallar* |

## 3. PROPOSED acceptance criteria — **NOT APPROVED**

Each criterion names what must be shown and where. "Test" means a PostgreSQL 18 test or bite-proof in
the repository; "production" means a read-only production measurement, or a Director-executed write
through a released writer, recorded with its ids. A criterion is not met by a test where it says
production.

| # | Area | PROPOSED criterion | Evidence required |
|---|---|---|---|
| A1 | Two durable identities | Exactly two in-service agents in the acceptance tenant at acceptance time; both rows tenant-owned, distinct ids, distinct canonical names | production read-back of `agents` for the tenant (count, ids, service status) |
| A2 | Same tenant | Both identities carry the same `tenant_id`; no row in any other tenant changes (agents, mandates, responsibilities, decisions, requests, permits) | production before/after md5 or counts for every other tenant |
| A3 | Distinct mandates | Each agent's effective mandate revision differs in `proposal_scope` or in responsibility; both written through the released `/agents` mandate writer, one Governance decision each | production read of both effective revisions and their decision ids |
| A4 | Governance-authorized registration | Agent #2 is registered through the released `/agents` registration path: one `agent-registration` decision (outcome `agent-registered`) and one `governance.decision.recorded` audit row, same transaction, reason recorded (closes B2) | production read of the agent row, the decision and the audit row |
| A5 | Explicit selection | Every human surface that originates or prepares on an agent's behalf offers a chooser when more than one agent serves and sends the chosen `agentId`; one live origination per agent records that agent as proposer | test for every surface; production: one origination per agent, invocation `agentId` = request proposer = chosen agent |
| A6 | Ambiguous-selection refusal | With two in-service agents and no selection, the proposer and authorship seams refuse `ambiguous-durable-agent-identity` before any provider call, dispatch-cap admission or row write | test (both seams, every entry); production: no provider dispatch is made to prove it — the refusal is shown by test only unless the Director approves a production probe |
| A7 | Agent-specific lineage | invocation → request (`proposedByActorType = agent`, proposer id) → decision → permit → attempt → work keeps the proposing agent's id; no request names the other agent | production read of the chain for each agent's request |
| A8 | Work-domain eligibility | Each agent can propose only inside its own responsibility; an out-of-responsibility scope is refused before Governance and is listed as disabled in the affordance (closes the test-only half of B4 if run in production) | test; production: affordance read showing the disabled scope; a live refused origination only with Director approval |
| A9 | Tenant isolation | Selecting an agent of another tenant, or a malformed id, refuses `selected-agent-unresolvable`; no cross-tenant row is read into grounding | test; production read that both tenants' agent sets are unchanged |
| A10 | Human authorization | Every approve/reject/execute step is a human act under I1; no agent decision, approval or permit row exists | production read of decision/permit actor types |
| A11 | Permit integrity | If the Director approves the spend step: one approved agent proposal yields one permit, consumed once by the matching agent under its current mandate; the other agent's permit cannot be spent for it | test; production only with Director approval of the spend step (B4) |
| A12 | Lifecycle safety | Suspending one agent leaves the other originating; the suspended agent's proposal cannot be approved or spent; reactivation follows I10 | test; production suspend/reactivate only with Director approval |
| A13 | Production evidence | The deployment SHA, deployment id, ledger number and digest, before/after snapshots and every created id are recorded; no PASS is claimed for an unmeasured item | closure record under §16.1 |
| A14 | Failure and refusal evidence | Every refusal the acceptance relies on (A6, A8, A9, A12) is named with its exact refusal code and the test that bites; any production refusal shows zero provider calls and zero writes beyond its own audit | test output; production delta |
| A15 | Rollback and retirement limits | The acceptance record states §5 verbatim and the exact end state left behind (which agent stays in service, which requests are pending or rejected) | closure record |

## 4. Out of scope (AP-5 does NOT include)

Autonomous or cron origination; agent-to-agent messaging or delegation; an orchestrator, registry or
runtime; model-based agent selection; browser control, computer use or shell execution; any new
provider, provider scope or EAI cell; a new action kind or scope CHECK migration; per-agent model,
Knowledge or cap; a budget-holding agent; TRH enrolment of a second agent; RUNG 3.

## 5. Rollback and retirement limitations (facts, not choices)

- A registered agent row is never deleted. The only way out of service is **retirement (terminal)**
  or **suspension (reversible)**, each a Governance decision.
- Registration, mandate, lifecycle decisions and their audit rows are append-only. A mistaken
  registration is corrected forward (retire), never erased.
- A retired agent's name is free again for a new identity (uniqueness is among in-service rows only);
  the retired row and its lineage remain.
- Mandate revisions cannot be withdrawn; narrowing is a new revision.
- Code rollback below the release that adds the work-state chooser re-opens
  `WORK-UPDATE-AGENT-SELECTION-1` for the whole tenant while two agents serve: the affordance would
  refuse `ambiguous-durable-agent-identity`. Rollback with two agents in service is therefore a
  Director decision, preceded by suspending or retiring one agent.

## 6. First implementation target — DESIGN PROPOSAL, NOT APPROVED

| Item | Proposal |
|---|---|
| Tenant | **Hebun AI** (`hebun`). The only tenant whose recorded EAI authorization holds `agent-origination` (WORK-UPDATE-V1 G5: revision 4 `242a0db8`, `agent-origination × conversation`). Turkish Rug House holds assistance only (`hebun-heby-ai-plan-production-acceptance-closure.md`: "TRH revision 1 assistance only"), so a TRH acceptance would first need an EAI ceremony |
| Agent #1 | The existing Heby identity (`4ffeeb83`). Last repository-recorded mandate: revision 5 `e1f3a684`, scope `{send, record-work, set-work-declared-state}`, responsibility organization + Engineering `e48da4bb` (WORK-UPDATE-V1 G4). **Not modified by this record** |
| Agent #2 | An **Engineering-focused candidate**, name and purpose undecided. Proposed mandate revision 1: scope `{record-work}`, responsibility Engineering only. Zero schema, zero new kind, zero new EAI cell |
| Initial action kind | `record-work` |
| Distinctness | Holds without changing Heby: Agent #2 lacks `send`, `set-work-declared-state` and the organization grant. Engineering is held by both, so Engineering work needs an explicit choice (A5) — that overlap is what exercises selection. Making the responsibilities disjoint would need a Heby revision 6, which this proposal does **not** include |
| Known limit | The candidate's model inputs are identical to Heby's (goal, organization structure, optional Knowledge); it is distinct by ceiling and lineage only, not by capability. Under B6 that is acceptable for an acceptance of plurality, and it is not a claim of new capability |

**Not done here:** Agent #2 is not created, no mandate is changed, no ceremony is executed.

### Known blocker — `WORK-UPDATE-AGENT-SELECTION-1` (DEFERRED, owned by WORK-UPDATE-V1)

The Heby work-state affordance sends no `agentId`. With a second in-service agent the work-state
origination refuses `ambiguous-durable-agent-identity` for the whole tenant before any provider call.
The authoritative seam for the future fix, measured at `f9ae3b4c`:

1. **Surface (the only missing piece):** `components/layout/heby/heby-work-state-affordance.tsx` —
   renders no chooser and passes no `agentId`.
2. **Server action (already accepts it):** `app/(dashboard)/heby/work-state-origination-actions.ts:22-30`
   — `agentId?: string`, forwarded only when a string.
3. **Origination (already resolves it):** `features/agent-origination/originate-work-state.server.ts:199`
   — `resolveAgentProposer(tenant, …, { agentId })`.
4. **Pattern to reuse, not re-implement:** the origination affordance chooser
   (`components/layout/heby/heby-origination-affordance.tsx:181-287`), the shared
   `components/agents/agent-choice-select.tsx`, and the in-service list read already used by
   Operations (`listInServiceAgentsAction`, `app/(dashboard)/operations/actions.ts`). No second
   resolver.

The fix is not implemented in this phase.

### Other prerequisites before AP-5 acceptance

- Director approval of §3 (all, some, or amended).
- Director selection of Agent #2's name and purpose.
- `EHO-1-RED-SUITE-BASELINE-1` (DEFERRED): the full suite is red at the last recorded baseline, so a
  V3 run must compare against a recorded baseline set, not claim green.
- A disposable PostgreSQL 18 two-agent acceptance of every surface (A5, A6) before release.

## 7. Director decisions required (none taken by this record)

1. Approve, amend or reject each PROPOSED criterion A1–A15.
2. Tenant: Hebun AI (proposed) or another.
3. Agent #2 identity: name, purpose, mandate revision 1.
4. Whether Heby's mandate changes (not proposed).
5. Commit, push and deploy of the work-state chooser.
6. Production registration ceremony (irreversible except by retirement).
7. Mandate revision 1 for Agent #2.
8. Live model calls for one origination per agent.
9. Whether the approve → permit → spend step is exercised in production (A11).
10. Whether a production suspend/reactivate is exercised (A12).
11. The end state: Agent #2 stays in service, is suspended, or is retired after acceptance.
