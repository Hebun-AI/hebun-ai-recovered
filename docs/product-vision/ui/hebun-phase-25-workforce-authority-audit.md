# Hebun UI Phase 25A — Workforce Discovery + Authority Audit

**Mode:** Discovery / architecture audit only. No product code, runtime, nav, route, mock,
config, or test was changed to produce this document. Repository reality wins over every
prior assumption.

**Scope:** Workforce — the final remaining workspace of the seven-workspace UI/authority
completion program.

---

## 1. Baseline

| Fact | Value | Expected | Status |
|---|---|---|---|
| Branch | `main` | `main` | ✅ |
| HEAD | `6162bbd717a9300cb7ef5aa96e4f54a7be32d769` | `6162bbd…` | ✅ |
| origin/main | `6162bbd717a9300cb7ef5aa96e4f54a7be32d769` | == HEAD | ✅ |
| Ahead / behind | 0 / 0 | 0 / 0 | ✅ |
| Staged | empty | empty | ✅ |
| `hebun-ui-phase-25*` tag | none | none | ✅ |

**Tracked working tree:** clean. The only working-tree entries are pre-existing **untracked**
`docs/` product-vision/architecture files and root `learnings.md` — all authored before this
phase, none staged, none tracked. They are the Director's own work and are left untouched.

**Publication tags present (program):** `hebun-ui-phase-11-workforce-workspace-complete`
(original Workforce build), and the completion tags `hebun-ui-phase-20…24-*`.

**Legacy generic tags:** `phase-20…24-complete` and `phase-25-complete` exist. `phase-25-complete`
→ commit `ddb3ef5` (2026-07-30, "Complete Phase 25 Enterprise Work Architecture"), an ancestor of
HEAD baked into history. It belongs to the **old generic phase program**, not the `hebun-ui`
publication series. **Treated as unrelated.** It does not indicate the `hebun-ui` Workforce
completion.

---

## 2. Seven-Workspace Completion Status (from disk)

Authoritative workspace set is defined in [`workspace-nav.ts`](apps/dashboard/src/config/workspace-nav.ts):
seven Level-1 workspaces + the ambient Heby layer. Completion is verified by the presence of
Phase-20+ honesty-completion comments on each workspace's Level-2 destinations.

| # | Workspace | Route | Completion evidence | Status |
|---|---|---|---|---|
| 1 | Command | `/command` | Phase 20B L2 comments (workspace-nav:92) + tag 20 | ✅ complete |
| 2 | Intelligence | `/intelligence` | Phase 20C L2 comments (workspace-nav:114) + tag 20 | ✅ complete |
| 3 | Knowledge | `/knowledge` | Phase 21B/C comments (workspace-nav:136) + tag 21 | ✅ complete |
| 4 | Operations | `/operations` | Phase 22B/C/D comments (workspace-nav:163) + tag 22 | ✅ complete |
| 5 | **Workforce** | `/workforce` | **no honesty-completion comments; bare labels** | ⛔ **remaining** |
| 6 | Governance | `/governance` | Phase 23B/C/D comments (workspace-nav:200) + tag 23 | ✅ complete |
| 7 | Platform | `/platform` | Phase 24B/C/D comments (workspace-nav:235) + tag 24 | ✅ complete |

**Decisive disk signal:** every workspace except Workforce carries dense phase-completion
provenance comments on its destinations. Workforce's destination block
(workspace-nav:182–189) is bare — six generic labels ("Finance department.", "The AI agents.")
with no honesty pass. Workforce is the last un-completed workspace. Confirmed from routes,
nav config, and tags — not from conversation.

---

## 3. Workforce Route Inventory

Two navigation models are overlaid in the repository:

- **Authoritative (mounted):** `workspace-nav.ts`, rendered by `HebunShell` via
  [`(dashboard)/layout.tsx`](apps/dashboard/src/app/(dashboard)/layout.tsx).
- **Legacy (orphaned):** `sidebar.config.ts`. Its sidebar components
  (`sidebar-section.tsx`, `sidebar-item.tsx`) are **not mounted** by `HebunShell`. It survives
  only as the route/placeholder registry consumed by the `[...slug]` catch-all.

### 3a. Authoritative Workforce surface (workspace-nav Level-2)

| Route | Page / component | Backing | Data source | Runtime | Mutation | Classification |
|---|---|---|---|---|---|---|
| `/workforce` | `WorkforceWorkspace` | `workforce/workspace-model.ts` | static info-model | none | none | **EMPTY (honest)** |
| `/agents` | `AgentRegistryWorkspace` + 4 panels | `agent-runtime` → `agent-crud` | seeded (from mock) | simulation | in-memory CRUD | **SEEDED + DERIVED** |
| `/finance` (+7 sub) | `FinancePage` | `finance/mock`, `agents/mock` | mock | none | offline-sim command | **MOCK** |
| `/hr` (+7 sub) | `HrPage` | `hr/mock`, `agents/mock` | mock | none | offline-sim command | **MOCK** |
| `/legal` (+8 sub) | `LegalPage` | `legal/mock`, `agents/mock` | mock | none | offline-sim command | **MOCK** |
| `/tickets` | `TicketsPage` | `tickets/mock` | mock | none | none | **MOCK** |

### 3b. Workforce sub-routes with real pages (`page.tsx` present)

- Finance: `/finance/{analytics,budgets,expenses,invoices,payments,tax-compliance}`
- HR: `/hr/{candidate-screening,employee-support,interviews,learning,offboarding,onboarding,performance}`
- Legal: `/legal/{compliance,contract-generation,contract-review,contracts,ip-trademark,policies,regulatory,risk}`

### 3c. Shadow / orphan Workforce routes (no `page.tsx`)

- **`/workforce/{dept}/{agent}`** (e.g. `/workforce/sales/lead-qualifier-agent`, `…/finance/cash-flow-agent`)
  — defined only in `sidebar.config.ts` (sidebar.config:302–462), **not** in any mounted nav and
  **not** in `staticRoutes`. Reachable only by direct URL → resolves through `[...slug]` catch-all
  → `ModulePlaceholder`, which renders the **mock `AgentCard`** for the linked `agentId`. ~40 orphan
  shadow routes.
- **Stale `staticRoutes` entries:** `/finance/cash-flow` and `/hr/recruiting` are listed in
  `staticRoutes` (sidebar.config:756,760) but have **no `page.tsx`**. They fall to the catch-all
  placeholder at runtime — the `staticRoutes` claim is stale (shadow defect, not a dead 404).

### 3d. Cross-workspace agent consumers (same roster, other workspaces)

The agent roster also surfaces at `/director/agents` (legacy Command) and
`/director/registries/agents` (Knowledge → Registries). Both import `@/features/agent-runtime`.
The Agent Registry is simultaneously a **Knowledge registry** and the **Workforce → Agents** surface.

---

## 4. Current Workforce IA

From `workspace-nav.ts` (workspace-nav:174–190), authoritative today:

```
Workforce  (tagline: "The AI workforce and the departments that do the work.")
├── Overview      → /workforce
├── Agents        → /agents
├── Finance       → /finance
├── HR            → /hr
├── Legal         → /legal
└── Customer Ops  → /tickets
match: /agents, /finance, /hr, /legal, /tickets
```

Six Level-2 surfaces. The IA fuses two distinct ideas under one workspace: a **workforce/agent**
concept (Overview, Agents) and four **enterprise department applications** (Finance, HR, Legal,
Customer Ops). None of the six carries a Phase-20+ honesty comment.

---

## 5. Overview Truth (`/workforce`)

**Verdict: honest, empty-state — already Phase-11-honest, but pre-completion (bare).**

[`workforce/workspace-model.ts`](apps/dashboard/src/features/workforce/workspace-model.ts) carries an
explicit provenance contract (lines 4–21): "Hebun has NO real, populated organizational-workforce
identity model… the agent-crud seed roster… is SYNTHETIC, deliberately NOT imported here."

- `workers: []` — always empty (workspace-model:109,119).
- `EntityTypeView.connected: 0` for both Human and AI Agent (workspace-model:29–45).
- Renders only a static **information model**: entity types, concept layers
  (Identity/Role/Capability/Responsibility/Assignment/Authority/Availability), a capability chain,
  and inspector lenses.

No fabricated KPI, no department count, no agent count, no operational activity, no mutation.
It is the one Workforce surface that is already honesty-clean — though it is *explanatory copy*, not
a working roster. Phase 25B should preserve its honesty and connect the real (seeded) roster only
under an explicit provenance banner, or keep it as the honest empty frame.

---

## 6. Agents Presentation Truth (`/agents`)

**Verdict: MIXED — the CRUD table is honestly disclosed; the roster framing and the activity
metrics are seeded/derived and presented as if live.**

Source: [`agents/page.tsx`](apps/dashboard/src/app/(dashboard)/agents/page.tsx) →
`AgentRegistry.listAgents()` (agent-runtime) + `AgentRegistryWorkspace` +
`AgentContextPanel`/`AgentReasoningPanel`/`TaskPlanningPanel`/`ExecutionQueuePanel`.

| Value | Source | Classification |
|---|---|---|
| "N digital employees **registered**" (header) | seeded roster count (37) | **SEEDED, framed as real** |
| `status` (running/idle/paused/error) | mock → agent-crud (mock:9…) | **SEEDED** |
| `tasksToday` | mock | **SEEDED** |
| `costToday` | mock | **SEEDED** |
| `lastActive` ("2m ago", "just now") | mock | **SEEDED** |
| `version` | mock | **SEEDED** |
| `provider` / `model` / `tools` / `permissions` / `capabilities` | agent-crud seed maps (agent-adapter:13–56) | **SEEDED** |
| `health`, `riskLevel`, `utilizationScore` | computed by services over seeded stores | **DERIVED (from seed)** |
| `reasoningProfile.confidenceScore`, `contextHealth` | derived from memory/context snapshots | **DERIVED (from seed)** |
| `knowledgeProfile`, `memoryProfile`, `learningProfile` | derived from knowledge-crud / memory-crud | **DERIVED (from seed)** |
| `executionReadiness` | `getAgentExecutionReadiness()` | **DERIVED / UNAVAILABLE** |
| Registry telemetry (creates/updates/writes/latency) | live client-session counters | **REAL (session), correctly gated post-mount** |

**Honesty already present** in `AgentRegistryWorkspace`
([agent-registry-workspace.tsx](apps/dashboard/src/components/agents/agent-registry-workspace.tsx)):
"In-memory CRUD through the Command Bus · soft delete only" (l.257); renders `activeProvider()` =
`memory` (l.381); drawer footer "Runs through the Command Bus and mutates the in-memory store…
no runtime or database writes" (l.635). `CommandAction` ("Create Agent") is explicit: "Offline ·
Simulation… Nothing is executed or persisted" (command-action:200–243).

**Dishonesty that remains** (the Phase-25B target): the `AgentCard`
([agent-card.tsx](apps/dashboard/src/features/agents/agent-card.tsx)) renders a **pulsing** status dot
(`StatusBadge … pulse`, l.21) plus `tasksToday`, `$costToday`, and `lastActive` with **no
disclosure** — the single most "live-looking" fabrication. The header's "digital employees
registered" and the four activity panels present a running workforce that has never run.

---

## 7. Agent Subsystem Inventory

| Feature dir | Files | Role |
|---|---|---|
| `features/agents` | `agent-card.tsx`, `mock.ts` | Presentation + the **root seed** (37 agents, 7 departments) |
| `features/agent-crud` | 14 files | Registry data layer: service, repository, adapter (seed), mutations, projections, queries, validator, audit, history, telemetry, report |
| `features/agent-runtime` | 10 files | Read projection + services: registry, runtime-engine, authority, capability, context, health, responsibility, workload |
| `features/agent-context` | (context) | Semantic context package/report (Knowledge-derived) |
| `features/agent-reasoning` | (reasoning) | Reasoning overview (consumes agent-crud) |
| `db/schema/agent.ts` | Drizzle schema | **Designed** Postgres agent table — **not connected** |

The substrate is structurally substantial (24 files across crud + runtime) but operationally empty
(seeded, in-memory, no execution).

---

## 8. Agent Authority Map

| Concept | Owner (repository) | Backing | State |
|---|---|---|---|
| Agent definition | **Workforce** (`agent-crud` service/repository) | in-memory adapter | seeded, in-memory |
| Agent identity | `agent-crud` record `id/slug` + `organization-runtime` identity | in-memory | seeded |
| Agent configuration | `agent-crud` (`createAgent`/`updateAgent` via Command Bus) | in-memory | mutable in-memory |
| Capabilities / tools | `agent-crud` seed maps + `AgentCapabilityService` (agent-runtime) | in-memory | seeded/derived |
| Permissions (declared) | `agent-crud` record `permissions[]` | in-memory | seeded |
| Permission **authority** (grant) | **Decisions** (`heby.decisions.grant-permission`, action-registry:130–150) | none | not connected |
| Runtime state | `agent-runtime` projection (`AgentEmployeeRuntimeModel`) | in-memory projection | simulated |
| Execution | **Operations** (execution-center / dispatcher / offline-execution) | none | not runnable |
| Orchestration | `features/orchestration` (agent-selector/fallback/availability) | seeded from mock | simulated |
| Task assignment | `agent-runtime` `AgentResponsibilityService` + `task-planning` | derived | simulated |
| Agent memory | **Knowledge** (`enterprise-memory` / `memory-crud`), read via `AgentContextService` | in-memory | seeded/derived |
| Provider / model selection | **Platform** (`provider-framework/provider-registry`), *referenced* by agent-crud | offline descriptors | referenced, not connected |
| Human approval | **Decisions** (`/approvals` DecisionWorkspace, `human-approval` engine) | contract-only | honest/empty |

**Boundary integrity is good in the substrate:** Workforce owns the *definition*; it *references*
Platform providers, *reads* Knowledge memory, and *defers* execution to Operations and authority to
Decisions. The `AgentAuthorityService` only *declares* an `approvalMode` label
(`none/manager/director/human-review`, agent-authority-service:4–9) — it computes a display value, it
does not grant authority. No silent absorption of neighboring authorities was found in the substrate.

---

## 9. Agent Runtime Truth

Separated, as required — each answered from disk:

| Dimension | Verdict | Evidence |
|---|---|---|
| Designed? | **Yes** | `agent-runtime` types + services; `db/schema/agent.ts`; migrations |
| Implemented? | **Yes (read + CRUD)** | `agent-crud` CRUD verbs; `AgentProjectionBuilder` |
| Connected? | **No (to real backend)** | `ACTIVE_PROVIDER = "memory"` (storage-manager:17) |
| Configured? | **Partly** | seed maps for tools/models/provider; provider = `reference-simulation-provider` |
| Persisted? | **No** | in-memory adapter; DB adapter commented out |
| Executable? | **No** | `runtime: "simulation"`; no dispatcher; no substrate |
| Live? | **No** | no live provider, no execution path |

Direct answers:

- Create an agent definition? **Yes** — in-memory, via `createAgent` through the Command Bus.
- Persist one? **No** — in-memory singleton; lost on process restart; no DB write.
- Configure capabilities? **Yes** — form + seed maps (in-memory).
- Attach tools? **Yes** — declared list on the record (in-memory).
- Attach a model/provider? **Yes, by reference only** — selects a Platform offline descriptor;
  the provider is not connected.
- Start an agent runtime? **No.**
- Stop one? **No.**
- Dispatch work? **No** — no dispatcher/queue substrate is connected.
- Observe real agent activity? **No** — all activity is seeded/derived.
- Execute an external action? **No.**
- Use Computer Use? **No** — reserved, Platform-owned, `substrateConnected: false`.
- Invoke a live model? **No.**
- Can Heby manage agents? **No** — see §19.

---

## 10. Agent Persistence Truth

`ACTIVE_PROVIDER = "memory"` (storage-manager:17). Every collection resolves to
`createMemoryAdapter`. A **complete** Postgres path exists but is disconnected:
`db/schema/*.ts` (40+ tables incl. `agent`, `department`), 20+ migrations under `db/migrations/`,
`supabase-postgres-adapter.ts`, and a `HEBUN_PERSISTENCE_POSTGRES_DATABASE_URL` gate — all commented
out in the storage-manager `switch`.

| State | Classification |
|---|---|
| Agent definitions | **IN-MEMORY** (seeded from `agents/mock`, lost on restart) |
| Agent runtime state | **SIMULATED** (computed projection, in-memory) |
| Department data (finance/hr/legal/tickets) | **MOCK** |
| Tasks / assignments | **SEEDED / DERIVED** (in-memory) |
| Permissions | **SEEDED** (declared on record) |
| Memory | **IN-MEMORY** (`enterprise-memory` / `memory-crud`) |
| Activity history | **IN-MEMORY** (session CRUD/audit/telemetry) |
| Real DB (Postgres) | **DESIGNED, NOT CONNECTED** |

CRUD-looking UI does not imply persistence: the UI itself discloses "no runtime or database writes."

---

## 11. Workforce ↔ Operations Boundary

**Model holds.** Workforce owns *who* (agent definitions, roster, roles, capability declarations,
organizational assignment). Operations owns *how work executes* (execution-center, dispatcher,
queues, receipts, failures, runtime observation, device/computer-use execution).

Evidence: `agent-crud` never imports an executor; `runtime: "simulation"`; the Heby action tool that
touches runtime (`heby.operations.restart-workflow`) is **owner `operations`**, not workforce
(action-registry:88–107). `inspect-system-state` and `prepare-operational-plan` are owner
`operations`. No contradiction found — Workforce does not execute.

---

## 12. Workforce ↔ Governance Boundary

**Model holds, with one legacy-mock caveat.** Governance owns policy, permission grants, and
approval requirements; Heby's governance profile is `restricted` and "never modifies… or grants
authority" (workspace-registry:137–142). Policy mutation and permission grant are owned by
**Decisions**, not Workforce (action-registry:130–172). Workforce records only *declare* permissions;
they do not evaluate or grant them.

Caveat: the **Finance** page embeds `ApprovalRow` (finance/page:88–90), which renders
`approval.approve` / `approval.reject` Command actions (approval-row). See §12/§15 and the Decisions
boundary below — this is a *presentation* duplication via the legacy `approvals` mock, offline-sim
only, not a real authority path.

---

## 13. Workforce ↔ Platform Boundary

**Model holds.** Platform owns providers/models/credentials/eligibility (`provider-framework`,
`provider-matrix`, `provider-invocation`). Workforce **references** them:
`agent-adapter.ts:6,11` calls `providerById("reference-simulation-provider")` and stores a provider
id string on the record; the CRUD form's provider `<select>` is populated from
`providerRecords` (agent-registry-workspace:24,522). Workforce does not own provider descriptors,
availability, or credentials, and no secret is exposed. Correct boundary.

---

## 14. Workforce ↔ Knowledge Boundary

**Model holds — no second memory system.** Agent memory/context is *read* from Knowledge-owned
stores: `AgentContextService` and the projection builder call `getMemorySnapshot()` (memory-crud)
and `getNodeSnapshot()` (knowledge-crud) (agent-projection-builder:46–103). `AgentMemoryProfile`
and `AgentKnowledgeProfile` are derived views over those stores, not a new store. Enterprise
Memory / Knowledge ownership stays coherent.

---

## 15. Workforce ↔ Decisions Boundary

**Authoritative Decisions surface is honest.** `/approvals` = `DecisionWorkspace` (Phase 14):
"no approve / reject / authorize action — no real server-authorized decision-mutation path exists"
(approvals/page header). `features/human-approval` (10 files) is the real (contract/in-memory)
approval engine.

**Duplication via legacy mock:** `features/approvals` (`approval-row.tsx` + `mock.ts`) is a **legacy**
approvals control whose `ApprovalRow` renders Approve/Reject `CommandAction`s (approval-row:32–42).
It is surfaced on the **Finance** department page. This duplicates the Decisions *concept* in
presentation (offline-sim, nothing persists), and should be removed from Workforce surfaces in
Phase 25C/D — Decisions must remain the single human-decision authority.

---

## 16. Finance Audit

Sources: [`finance/page.tsx`](apps/dashboard/src/app/(dashboard)/finance/page.tsx), `finance/mock.ts`,
`finance/events.ts`, plus `agents/mock` + `workflows/mock` + `approvals/mock`.

| Aspect | Reality |
|---|---|
| Real runtime | **None** |
| Real financial data | **None** — `monthlyRevenue/netProfit/cashBalance/taxComplianceScore` are mock constants (finance/page:21–26) |
| Integrations (banking/accounting) | **None** |
| Persistence | **None** |
| Calculations / invoices / expenses / budgets / forecasts | **Presentation only** — mock arrays + KPI cards |
| Mutations | "Create Invoice" → `CommandAction` (`invoice.create`) — **offline simulation** |
| Agent cards | seeded `agents/mock` filtered by department — fabricated activity |

**Cross-workspace weight:** `finance/mock` also feeds Command-dashboard components
(`finance-overview`, `finance-alerts`, `cash-flow-panel`, `budget-panel`). Not department-local.

**Is Finance a Workforce concept?** Repository answer: **F — legacy/mock product experiment**,
adjacent to **B — a separate future enterprise domain**. It is a full domain application (Finance
software), not a workforce/agent concept. It sits under Workforce only by nav placement.

---

## 17. HR Audit

Sources: [`hr/page.tsx`](apps/dashboard/src/app/(dashboard)/hr/page.tsx), `hr/mock.ts`, `hr/events.ts`.

Fabricated KPIs: `openPositions`, `candidates`, `activeInterviews`, `employeeSatisfaction%`
(hr/page:10–15). Sub-pages for candidate-screening, interviews, onboarding, performance, learning,
offboarding, employee-support — all mock. No payroll/leave engine, no ATS/HRIS integration, no
persistence, no runtime.

**Distinction:** *workforce composition / agents / organizational roles* ≠ *full HR software*. The
current HR pages are the latter — a domain application. Same disposition as Finance:
**F/B (legacy-mock domain experiment → future enterprise domain)**, not Workforce.

**Cross-workspace weight:** `hr/mock` feeds `organization-projection-builder` and the Command
`hr-overview` panel.

---

## 18. Legal Audit

Sources: [`legal/page.tsx`](apps/dashboard/src/app/(dashboard)/legal/page.tsx), `legal/mock.ts`,
`legal/events.ts`.

Fabricated KPIs: `openReviews`, `highRiskContracts`, `complianceScore%`, `approvalQueue`
(legal/page:10–15). Sub-pages: contracts, contract-review/-generation, compliance, risk, policies,
regulatory, ip-trademark — all mock. No document store, no matter management, no deadline engine, no
persistence, no runtime.

**Overlap risk:** Legal's *compliance/risk/policies* vocabulary overlaps **Governance**
(compliance/risk/policies) and **Knowledge** (documents) and **Decisions** (approvals). Governance is
the completed, honest compliance authority; **Legal must not become a second compliance authority.**
Disposition: **B/F — future enterprise domain / legacy-mock**, explicitly *not* a duplicate Governance.

**Cross-workspace weight:** `legal/mock` feeds the Command `legal-overview` panel.

---

## 19. Customer Ops / Tickets Audit

Source: [`tickets/page.tsx`](apps/dashboard/src/app/(dashboard)/tickets/page.tsx), `tickets/mock.ts`.

A pure mock ticket table (id, subject, customer, status, assignee, SLA, updated). No ingestion, no
email, no CRM/helpdesk integration, no runtime, no persistence. The page labels itself "Support
queue owned by the **Operations Department**" (tickets/page:27) — an internal contradiction with the
nav, which files it under **Workforce → Customer Ops**.

Classification: **support-operations / service-desk mock**. `tickets/mock` is imported **only** by
`/tickets` — UI-only, the lightest retirement candidate. Conceptually it is closer to
**Operations** (support execution) than to Workforce.

---

## 20. Department Strategy Comparison

| Criterion | A: Keep under Workforce | B: Reduce Workforce to agents/roles; move departments out | C: New enterprise-domain layer (separate from the 7) |
|---|---|---|---|
| Architectural coherence | Low — fuses "who works" with "domain apps" | **High** — Workforce = organizational layer only | **High** — domains get an honest home |
| Authority collisions | Legal↔Governance, Finance↔Decisions (via mock) | Removed from Workforce | Contained in the new layer |
| Product value | Preserves visible breadth | Honest, smaller, true | Highest long-term (marketplace of domains) |
| Implementation complexity | Lowest (no change) | Low-medium (nav + disposition) | High (new L1 layer, IA, shell) |
| Future extensibility | Poor — Workforce bloats per domain | Good | **Best** |
| Enterprise realism | Misleading (mock software as product) | Honest | Honest + scalable |
| Migration cost | None now, high later | Medium (redirects, dashboard rewiring) | High |

**Recommendation: B now, with C as the destination.** Reduce authoritative Workforce to true
workforce/agent concepts (Overview, Agents, and role/capability views). Treat Finance / HR / Legal /
Customer Ops as **domain applications** — kept reachable and honesty-tagged in 25C, then relocated to
a future **Enterprise Domains** layer (C) outside the seven core workspaces. Do **not** delete their
mocks in 25A/B: they are cross-workspace load-bearing (Command dashboard + org projection).

---

## 21. Definition of "Workforce" in Hebun

Stress-tested candidate model:

> **Workforce = the organizational layer describing WHO can perform work** (human or AI agent
> identities, roles, capabilities, responsibilities, assignments, authority declarations).
> Operations = HOW work executes. Governance = WHAT is permitted. Platform = WHAT providers/tools
> exist. Knowledge = WHAT the org knows. Decisions = WHERE humans decide. Command = WHAT the org is
> trying to achieve. Intelligence = WHAT Hebun infers.

**It fits.** The honest Overview (§5) already encodes exactly this: entity types (Human, AI Agent)
and the concept layers Identity/Role/Capability/Responsibility/Assignment/Authority/Availability,
each explicitly *not-equal* to the next, and each deferring execution to Operations, permission to
Governance, tools/models to Platform, memory to Knowledge.

**Where it fails today:** the *current* Workforce IA violates its own definition by hosting four
**domain applications** (Finance/HR/Legal/Customer Ops) that are about *what work exists in a domain*,
not *who performs work*. And `/agents` presents the roster as a *running runtime* (activity metrics),
which is an Operations concern, not a Workforce-identity concern. The definition is right; the surface
must be reduced to match it. This definition should govern 25B/C/D.

---

## 22. Heby Workforce Truth (from contracts)

From [`heby-integration/workspace-registry.ts`](apps/dashboard/src/features/heby-integration/workspace-registry.ts:117)
and [`heby-actions/action-registry.ts`](apps/dashboard/src/features/heby-actions/action-registry.ts):

| Question | Answer | Evidence |
|---|---|---|
| Authority mode | **advisory-only** | workspace-registry:126 |
| Allowed observations | workforce-inspection, **contract-only**; sources unconnected | workspace-registry:120–121 |
| May explain | "Explain this identity, role, or responsibility"; "Organizational workforce identity — not a runtime agent." | workspace-registry:123–127 |
| Create agents | **No** — no workforce action tool exists | action-registry (none) |
| Modify agents | **No** | — |
| Assign agents | **No** (design note: "Workforce may prepare assignments, never grant authority") | action-registry:135–136 |
| Activate / terminate | **No** | — |
| Change tools / models | **No** | — |
| Change permissions | **No** — grant-permission is owner `decisions`, `substrateConnected:false` | action-registry:130–150 |
| Dispatch work | **No** | — |

Heby can, at most, *inspect and explain* workforce identity (contract-only, not connected) and
navigate/prepare. It cannot create, mutate, assign, activate, terminate, retool, remodel, re-permission,
or dispatch. The registry's honesty invariants are machine-validated (`validateActionRegistry`,
action-registry:221).

---

## 23. Mock / Seed / Legacy Dependency Graph

| Mock | Importers | Classification |
|---|---|---|
| **`agents/mock`** (37 agents, 7 depts) | `agent-crud/agent-adapter` (seed) → agent-runtime; `orchestration/{agent-selector,fallback,availability}`; `planning/plan-builder`; `runtime-projection/{agent,organization}-builder`; `module-placeholder`; `components/orchestration-agents`; `/finance`,`/hr`,`/legal` pages | **LOAD-BEARING · CROSS-WORKSPACE · ENGINE-INPUT** |
| `finance/mock` | `/finance` (+7 sub); Command `dashboard/{finance-overview,finance-alerts,cash-flow-panel,budget-panel}` | **LOAD-BEARING · CROSS-WORKSPACE** |
| `hr/mock` | `/hr` (+7 sub); `organization-projection-builder`; `dashboard/hr-overview` | **LOAD-BEARING · CROSS-WORKSPACE · ENGINE-INPUT** |
| `legal/mock` | `/legal` (+8 sub); `dashboard/legal-overview` | **LOAD-BEARING · CROSS-WORKSPACE** |
| `tickets/mock` | `/tickets` only | **UI-ONLY** |
| `approvals/mock` | `/finance` (ApprovalRow); sidebar badge | **CROSS-WORKSPACE (legacy)** |

**No mock is a safe blind delete** except possibly `tickets/mock` (UI-only) — and even that is the
sole backing for Customer Ops. `agents/mock` is the spine of the entire agent + orchestration +
projection stack. Retirement requires importer-proof rewiring (Phase 25D), not deletion in 25A/B.

---

## 24. Route / Shadow Audit

| Finding | Detail | Severity |
|---|---|---|
| Orphan shadow tree | `/workforce/{dept}/{agent}` (~40) exist only in orphaned `sidebar.config`; reachable by direct URL → placeholder with mock `AgentCard`; absent from mounted nav | Medium |
| Stale `staticRoutes` | `/finance/cash-flow`, `/hr/recruiting` listed as static but have no `page.tsx` → catch-all placeholder at runtime | Low |
| Dual nav divergence | authoritative `workspace-nav` (mounted) vs legacy `sidebar.config` (orphaned) describe different Workforce IAs | Medium |
| False-authority labels | Workforce L2 "Finance department / Legal department" imply owned domains that are mock apps | Medium |
| Cross-nav duplicate | agent roster appears at `/agents`, `/director/agents`, `/director/registries/agents` | Low |
| Redirect candidates (later) | `/workforce/{dept}/{agent}` and department apps are future redirect/relocation targets | (25D) |

No route change is made in 25A.

---

## 25. Security / Execution Audit

**Workforce introduces no execution reachability.** A repository grep across
`/agents`, `/workforce`, `/finance`, `/hr`, `/legal`, `/tickets`, `agent-crud`, `agent-runtime`,
`workforce`, and the four department features for
`device-runtime | computer-use | live provider | child_process | exec( | spawn( | fetch(`
returned **zero** hits.

| Capability | Reachable from Workforce? |
|---|---|
| Shell / terminal | **No** |
| Filesystem mutation | **No** |
| Browser automation | **No** |
| Computer Use | **No** — reserved, Platform-owned, `substrateConnected:false` (action-registry:174–187) |
| Provider invocation (live) | **No** — `reference-simulation-provider`, offline |
| Credentials / secrets | **No** — none referenced |
| Network execution | **No** |
| External mutations | **No** — all mutations offline-sim / in-memory |

The action-registry header states it plainly: "discovery proved no real mutation/device/execution
substrate exists in this repository." Nothing is connected here.

---

## 26. Proposed Minimal Authoritative Workforce IA

Repository-evidence-driven, smallest coherent set:

| L2 | Purpose | Authority owner | Real backing seam | Provenance | Implementable now | Read-only | Future-runtime dependent |
|---|---|---|---|---|---|---|---|
| **Overview** | The workforce information model + honest roster state | Workforce | `workforce/workspace-model` (+ optional banner over agent-crud count) | static + seeded (tagged) | Yes | Yes | No |
| **Agents** | AI agent definitions/registry (identity, role, capability, tools, provider-ref, permission declaration) | Workforce (definition) | `agent-crud` (in-memory) | seeded + in-memory CRUD, disclosed | Yes | No (in-memory CRUD) | Execution deferred to Operations |
| **Teams & Roles** | Organizational structure: departments, roles, membership, reporting | Workforce | `organization-runtime` roles/departments (derived) | derived (from seed) | Yes | Yes | No |
| **Capabilities** | Capability ↔ tool ↔ permission declarations (no grants) | Workforce (declare) / Governance (permit) / Platform (tools) | `AgentCapabilityService` + provider refs | derived / referenced | Yes | Yes | No |

Everything on these four is honestly implementable today as read-or-in-memory, with execution and
permission-grant explicitly deferred. Activity metrics (tasks/cost/status-as-live) are **removed**
from identity surfaces or relabeled as Operations-observed.

**Department disposition (shown separately, not forced into the model):**

| Surface | Disposition |
|---|---|
| Finance | Relocate to future **Enterprise Domains** layer; honesty-tag as mock in 25C; keep mock (Command-dashboard load-bearing) |
| HR | Same as Finance (also org-projection load-bearing) |
| Legal | Same; explicitly *not* a Governance duplicate |
| Customer Ops / Tickets | Relocate toward **Operations** (support execution) or Enterprise Domains; UI-only mock |

---

## 27. Phase 25B Plan — Workforce Overview + Agents truth surface

1. Keep `/workforce` Overview honest; if a roster is shown, gate it behind an explicit
   "seeded · in-memory · not a live workforce" provenance banner.
2. `/agents` honesty pass (the core 25B work):
   - Remove/relabel the pulsing live status, `tasksToday`, `costToday`, `lastActive` on `AgentCard`
     — these are Operations-observed, not agent-identity facts; render honest empty/derived states.
   - Reframe the header: not "N digital employees registered" as if operating, but a disclosed
     seeded-registry count.
   - Keep and strengthen the already-honest CRUD disclosure ("in-memory · offline · no DB writes").
   - Audit the four panels (Context/Reasoning/TaskPlanning/ExecutionQueue) for seeded-as-live claims;
     mark derived-from-seed.
3. Add Workforce-scoped honesty comments to the `workspace-nav` destinations (parity with 20–24).
4. No persistence, no execution, no provider connection, no nav restructure yet.

## 28. Phase 25C Plan — remaining surfaces + department disposition

1. Add **Teams & Roles** and **Capabilities** read surfaces (org-runtime / capability service).
2. Department honesty pass: Finance/HR/Legal/Customer Ops each gets a clear "mock · no runtime · no
   integration · no persistence" disclosure; strip the legacy `ApprovalRow` from Finance (Decisions
   duplication).
3. Decide the authoritative Workforce L2 (recommend the four of §26); mark departments as
   *domain applications* pending relocation.
4. Still no deletion, no route change.

## 29. Phase 25D Plan — legacy redirects, mock retirement, closure

1. Prove importers for every department/agent mock; rewire Command-dashboard and org-projection
   consumers off department mocks where a real seam exists, or retain-with-provenance.
2. Redirect the orphan `/workforce/{dept}/{agent}` shadow tree and stale `staticRoutes`
   (`/finance/cash-flow`, `/hr/recruiting`) to their canonical surfaces (single hop), matching the
   22D/23D/24D pattern.
3. Relocate Finance/HR/Legal/Customer Ops to the future Enterprise Domains layer (or Operations for
   Tickets) — only after cross-workspace consumers are rewired.
4. Cross-workspace closure + publication readiness; tag `hebun-ui-phase-25-workforce-*`.

**Note:** the recommended sequence keeps the proven 20–24 pattern (truth surface → remaining
surfaces + disposition → redirects/retirement/publication). Repository evidence supports it; no better
sequence is indicated.

---

## 30. What Phase 25 Completion Will Mean

**UI / authority completion (7/7):** every workspace tells the truth over the real (mostly offline,
in-memory, contract-only) substrate; authority boundaries are explicit and honest; Heby is bounded to
advise/inspect/prepare with machine-validated invariants; no fabricated health/activity/data is
presented as real; navigation and provenance are coherent.

This is a **completed honest UI and authority model** — a truthful control surface over a
not-yet-live system.

## 31. What Will Still Remain After Seven-Workspace Completion

Confirmed from disk, none of this is delivered by finishing the UI program:

- **Persistence** — `ACTIVE_PROVIDER = "memory"`; Postgres schema/migrations/adapter designed, not connected.
- **Live providers** — offline descriptors only; `reference-simulation-provider`.
- **Execution dispatcher** — no runnable execution substrate; `runtime: "simulation"`.
- **Computer Use runtime** — reserved, not implemented.
- **Integrations** — none connected (Gmail/GitHub/Supabase/Vercel are descriptors).
- **Authorization substrate** — permission grants are contract-only (Decisions), not enforced at a server.
- **Production security** — no secrets/credential handling; nothing to secure yet.
- **Observability** — session telemetry only; no real runtime observability.
- **Real enterprise data** — all domain data (finance/hr/legal/tickets) is mock.
- **Deployment / runtime hardening** — out of scope of the UI program.

Completing Phase 25 completes the **honest UI/authority layer**, not the Hebun product runtime. None
of the above is started here.

---

## 32. Director Decisions Required

1. **Workforce definition** — adopt "Workforce = who can perform work" (§21) as the governing
   definition for 25B/C/D? (Recommended: yes.)
2. **Department strategy** — approve **Strategy B now → C later** (§20): reduce authoritative
   Workforce to agent/role/capability surfaces; treat Finance/HR/Legal/Customer Ops as domain
   applications pending relocation to a future Enterprise Domains layer? Or keep them under Workforce
   (A)?
3. **Authoritative Workforce L2** — approve the four surfaces (Overview, Agents, Teams & Roles,
   Capabilities, §26)? Or a different minimal set?
4. **Agents activity metrics** — confirm removal/relabel of live status + tasks/cost/last-active
   from identity surfaces (they are Operations-observed)?
5. **Finance ApprovalRow** — approve removing the legacy Approve/Reject control from Finance
   (Decisions duplication) in 25C?
6. **Customer Ops** — Workforce, Operations, or Enterprise Domains as its eventual home?
7. **Sequence** — approve the 25B → 25C → 25D plan (§27–29)?

No implementation proceeds until these are answered.

---

## 33. Final Recommendation

Workforce is honest at the root (`/workforce` Overview) and dishonest at the edges (`/agents` activity
metrics; the four mock department apps). The substrate is real in shape (24-file agent crud/runtime,
full Postgres schema) and empty in operation (in-memory, seeded, simulation, no execution).

Do the smallest honest thing: **reduce Workforce to what it truly is** — the organizational layer of
identities, roles, and capabilities — make `/agents` tell the truth, and stop four mock domain
applications from masquerading as owned product. Keep every load-bearing mock in place; relocate, do
not delete. Follow the proven 20–24 completion pattern. Then Phase 25 closes the seven-workspace
honesty program — and the artifact of §31 makes explicit that the *product runtime* remains the work
after the *UI* is done.

---

*Phase 25A — discovery only. No product code, runtime, nav, route, mock, config, or test was
modified. Working-tree delta from this phase is exactly this file.*
