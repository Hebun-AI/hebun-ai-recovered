# Hebun — Product Capability Inventory

## Document Status

**DOCUMENT TYPE: PRODUCT VISION — UI PHASE 1 — CAPABILITY INVENTORY**

**STATUS: DISCOVERY AND DOCUMENTATION ONLY**

This document is an evidence-based inventory of the platform capabilities that already exist in the Hebun AI repository, produced before any Hebun UI architecture work begins. It authorizes no implementation. It defines no navigation, no sidebar, no information architecture, no components, and no routes. It records what exists, classifies it, and separates three distinct concepts — **system architecture**, **product capability architecture**, and **UI exposure** — so that the future UI is derived from the product surface, not mechanically from backend modules.

It is subordinate to the Hebun AI Enterprise Constitution, the published Program constitutions, the Heby Vision / Architecture / Roadmap trio, and Director authority. Where this inventory conflicts with a canonical source, the canonical source governs.

Scope: the `apps/dashboard` application and the `docs/` authority tree, as they stand on branch `main` at HEAD `43093c9`.

---

## 1. Executive Capability Map

Hebun is not a dashboard with a backend. It is a large enterprise-intelligence platform whose repository already contains **119 feature modules** and **~110 routed pages**, layered into five bands:

1. **Foundation (settled, canonical, code-frozen).** Enterprise Memory, Enterprise Reasoning, the Organizational Intelligence Foundation, and the canonical entity/relationship contracts. These are the store of record and the settled understanding. Mostly invisible by design.

2. **Organizational Intelligence Runtime (advisory).** Turns settled Foundation into non-authoritative advisory material — candidates, signals, assessments, readiness, pathways — each carrying provenance, explainability, and confidence, each terminating at a human decision.

3. **Enterprise Execution Runtime (governed action).** The command → authority → permit → adapter → execution pipeline: command bus, policy/authority model, risk classification, human-approval contract, execution permits, adapter framework, provider matrix, idempotency, safety guards, recovery/compensation, and runtime observability. This is the only band that turns intelligence into action, and it does so only behind the Director Approval boundary.

4. **Heby — the Executive Intelligence Interface (consumer).** A deterministic, read-only presentation layer (Heby Core, Phases 1–9, fully implemented in code) that consumes the two runtimes and renders them honestly to the Director — explain, summarize, navigate, present, clarify, prepare-for-approval — while never deciding, approving, executing, or inventing. **Heby has zero UI presence today.**

5. **Product surface (department verticals + operator consoles).** The Director console (real read-models and widget runtime), plus the department verticals — Finance, HR, Legal, AI Workforce, Customer Operations, Integrations — which currently render from **mock data**.

The single most important structural fact for the UI phase: **the current dashboard exposes the architecture, not the product.** The sidebar is explicitly "the living architecture map" (see `sidebar.config.ts` header comment), and most routes are auto-generated placeholders for backend modules. Meanwhile the intended primary product surface — Heby — is not exposed at all. The UI phase must invert this.

---

## 2. Repository Evidence Base

**Authority documents read in full:**

- [Heby — Vision](../heby-vision.md)
- [Heby — Architecture](../heby-architecture.md)
- [Heby — Interaction Model](../heby-interaction-model.md)
- [Heby Architecture Mapping](../../architecture/heby/heby-architecture-mapping.md)
- [Architecture Baseline — Phase 5 & 6](../../architecture/ARCHITECTURE-BASELINE.md)
- `apps/dashboard/src/features/heby-core/index.ts` (Heby Core public barrel, Phases 1–9)
- `apps/dashboard/src/config/sidebar.config.ts` (current UI exposure, ground truth)
- App router route listing (`src/app/(dashboard)/**`)

**Authority documents present and catalogued (not exhaustively read):** the remaining `docs/product-vision/` set — `organizational-intelligence-runtime-{vision,architecture,roadmap}.md`, `reasoning-foundation-{vision,architecture,roadmap}.md`, `heby-roadmap.md`, `heby-live-studio.md`, `research-intelligence.md`, `strategic-evolution-intelligence.md`, `security-evolution-intelligence.md`, `enterprise-economy.md`, `marketplace-ecosystem.md`, `hebun-academy.md`, `quantum-intelligence.md` — and the `docs/architecture/` tree (60+ domains including `conscious-intelligence/`, `memory/`, `reasoning-engine/`, `governance-intelligence/`, `tool-execution/`, `director-*`).

**Implementation evidence:** 119 directories under `src/features/`, ~110 `page.tsx` routes, and 130+ published git tags spanning Runtime Foundation (8 phases), Enterprise Memory Foundation (8), Memory+Reasoning Foundation (8), Organizational Intelligence Foundation (6), OI Runtime (9), Heby Core (9), Director Workspace (8), and phases 3c–4e plus a linear `phase-4` … `phase-51` program track.

**Maturity signal — real vs. mock.** Enterprise/runtime/intelligence features are real deterministic TypeScript (contracts, boundaries, normalization, validation, rules). Department verticals are presentation shells: `src/features/finance`, `hr`, `legal`, `agents`, `integrations` each resolve from `mock.ts`. This distinction drives the internal/user-facing classification below.

---

## 3. Three Concepts, Separated

The task requires these to never be conflated. They are the spine of every classification in Section 4.

- **A. System Architecture — what exists technically.** All 119 feature modules, both runtimes, the Foundation layers, persistence, projections, event bus. Includes many things that must never surface (unit-of-work, projection providers, shadow-read, dual-read, canonical-read internals).

- **B. Product Capability Architecture — what a user can understand and use.** A much smaller set: "ask Heby a question," "review a briefing," "approve a pending item," "see why," "watch executions," "read company memory," "run the finance department." A product capability may be realized by many system modules and may hide most of them.

- **C. UI Exposure — what deserves a visible interface.** Smaller still, and not a 1:1 image of either A or B. Runtime is foundational infrastructure that need not be a sidebar item. Grounding is visible through evidence/source behavior, not a "Grounding" page. Governance spans many surfaces yet still deserves one management console.

The current product commits the classic error: it maps **A → C almost 1:1**. The UI phase must route **B → C**, letting A stay mostly invisible.

---

## 4. Complete Capability Inventory

Legend — **Maturity:** Frozen (canonical/contract-complete), Impl (implemented feature code), Read-models (real projections/UI data), Mock (shell/mock data), Reserved (documented, not opened). **Exposure need:** Workspace / Page / Sub-page / Panel / Heby-surface (contextual, no standalone page) / None. **Class:** Internal (system architecture only) or User-facing (product capability).

### 4.1 Organizational Intelligence

| Capability | What it does | Evidence | Maturity | Class | Exposure | Heby rel | Director rel |
|---|---|---|---|---|---|---|---|
| OI Foundation | Assembles the organization picture; defines candidates, signals, assessments, readiness, pathways vocabulary | `features/enterprise-organizational-intelligence`, `organizational-intelligence`, OI Foundation tags (6 phases) | Frozen/Impl | Internal | None (feeds Heby) | Source Heby consumes read-only | Produces material for Director judgment |
| OI Runtime | Turns settled Foundation into non-authoritative advisory output with provenance, explainability, confidence; assembles Director Briefings | `features/enterprise-organizational-intelligence-runtime`, OI Runtime tags (9 phases) | Impl | Internal→feeds product | Heby-surface + Panel | Heby's primary upstream (Output Boundary) | Terminates at Director decision |
| Director Briefings | Advisory synthesis assembled for the accountable human | OI Runtime + `heby-core` briefing phase | Impl | User-facing | Heby-surface / Page | Assembled and rendered by Heby (Phase 8) | The Director's core intelligence artifact |
| Enterprise Intelligence | Cross-domain intelligence services | `features/enterprise-intelligence`, `intelligence` | Impl | Internal | Panel | Consumed | Advisory |

### 4.2 Enterprise Runtime (Execution)

| Capability | What it does | Evidence | Maturity | Class | Exposure | Heby rel | Director rel |
|---|---|---|---|---|---|---|---|
| Runtime Composition | Composition root wiring the runtime; projection providers, configuration | `features/enterprise-runtime-composition` (composition-root, provider-port) | Impl | Internal | None | Below Heby | Infrastructure |
| Execution Engine | Execution session, pipeline, dispatcher, result model, retry/compensation, error model | `features/execution-engine`, `execution`, `execution-bridge`; phase-4e.1–4e.9 tags | Impl | Internal→observable | Page (as monitor) | Heby presents outcomes read-only | Director watches; never hand-runs |
| Command Bus / Dispatcher | Command architecture, registry, permission integration, confirmation safety, execution bus, history/audit | `features/commands`, `director-command`; phase-4b.1–4b.8 tags | Impl | User-facing (Director) | Workspace (Command Center) | Distinct from Heby (Heby never commands) | Director's action surface |
| Authority / Policy / Permits | Authority-subject binding, runtime policy model, risk classification, human-approval contract, execution-permit lifecycle | phase-4d.1–4d.7 tags; `features/policy`, `human-approval` | Impl | Internal + governance surface | Panel / governance Page | Heby prepares items; never grants | Approval boundary lives here |
| Runtime Safety | Target resolution, adapter framework, idempotency/concurrency, safety guards, recovery/compensation | phase-4c.1–4c.8 tags | Impl | Internal | None / Panel | Below Heby | Trust guarantees |
| Runtime Boundary / Activation | The runtime on/off boundary and activation gate | `features/runtime-boundary`, `runtime-activation` | Impl | Internal | Panel | Below Heby | Operational control |
| Offline Execution | Deferred/queued execution when live path unavailable | `features/offline-execution`, `execution-queue` | Impl | Internal | Panel | Below Heby | Operational |
| Provider Framework | Provider abstraction, matrix, routing, invocation; adapters for Claude, Codex, GitHub, Browser, Computer Use, Communication | `features/provider-*`, `adapters`, `providers`; provider routes | Impl (framework) / Mock (provider detail pages) | Internal | Panel / Settings | Below Heby | Infrastructure |

### 4.3 Heby (Executive Intelligence Interface)

| Capability | What it does | Evidence | Maturity | Class | Exposure | Director rel |
|---|---|---|---|---|---|---|
| Heby Core (Phases 1–9) | Deterministic read-only pipeline: identity → input/context admission → presentation → grounding/anti-hallucination → intent/NL → approval preparation → governance gate → Director briefing → composition closure | `features/heby-core/index.ts` (39 files, 9 phase blocks) | **Impl, zero UI** | **User-facing (primary)** | **Workspace (the flagship, missing)** | The interface *is* the Director's surface |
| Natural-language interaction | Interpret intent within authorized context; clarify ambiguity, never assume | Heby Phase 5 (intent) + Interaction Model | Impl (deterministic boundary) | User-facing | Heby-surface | Director asks in own language |
| Explainability (why/evidence/sources) | Expose basis, assumptions, uncertainty already carried by outputs | Heby Phase 3–4 + Interaction Model `/why` `/evidence` `/sources` | Impl | User-facing | Heby-surface (contextual) | On-request transparency |
| Approval preparation | Prepare items for a human process; advice ≠ approval; states consequences | Heby Phase 6 | Impl | User-facing | Panel in approval flow | Terminates at Director |
| Conversation modes | Executive Briefing / Exploration / Decision Review / Explainability / Planning / Learning | Interaction Model | Vision + Phase-5 substrate | User-facing | Heby-surface | Adapts depth to Director purpose |

### 4.4 Knowledge

| Capability | What it does | Evidence | Maturity | Class | Exposure |
|---|---|---|---|---|---|
| Knowledge Domain / Canonical Repository | Canonical knowledge nodes and repository | `features/knowledge`, `knowledge-domain`, `knowledge-canonical-repository`; phase-3c.2 tag | Frozen/Impl | Internal→user-facing | Page |
| Knowledge Graph | Relationship graph over entities | `features/knowledge-graph`; route `/director/knowledge-graph` | Impl/Read-models | User-facing | Page |
| Knowledge Runtime / Read Facade | Read-only knowledge access surface | `features/knowledge-runtime`, `knowledge-read-facade` | Impl | Internal | None |
| Knowledge shadow/dual read | Migration-era read paths | `features/knowledge-shadow-read`, `knowledge-silent-dual-read` | Impl | **Internal-only** | **None (never expose)** |
| Knowledge Base (Ops) | Customer-facing KB answering tickets | route `/knowledge`; `mock` | Mock | User-facing | Page |

### 4.5 Memory

| Capability | What it does | Evidence | Maturity | Class | Exposure |
|---|---|---|---|---|---|
| Enterprise Memory | Store of record; admission, context, persistence, query, retrieval, selection, reasoning | `features/enterprise-memory*` (8 sub-modules); Memory Foundation tags (8 phases); phase-3c.5 | Frozen/Impl | Internal (mostly) | Some surfaces, many internals |
| Company Memory (product) | What the organization remembers, made explorable | route `/director/memory`, `/memory`; `features/memory`, `memory-engine`, `memory-runtime` | Impl/Read-models | User-facing | Page (Heby-navigable) |
| Memory admission engine | Governs what enters memory | `features/enterprise-memory-admission-engine` | Impl | Internal-only | None |

### 4.6 Reasoning

| Capability | What it does | Evidence | Maturity | Class | Exposure |
|---|---|---|---|---|---|
| Reasoning Foundation | Settled reasoning/understanding layer | `features/reasoning`; Memory+Reasoning tags (8 phases); `reasoning-foundation-*` docs | Frozen/Impl | Internal | None (feeds Heby) |
| Decision domain / runtime | Decision representation and runtime | `features/decision-domain`, `decision-runtime` | Impl | Internal | Panel |
| Goal / Mission runtime | Goal and mission modelling | `features/goal-runtime`, `mission-runtime`; route `/director/goals` | Impl | User-facing | Page |
| Planning / Task Planning | Prospective structuring, task decomposition | `features/planning`, `task-planning`; routes `/director/planning`, `/director/task-planning` | Impl | User-facing (Director) | Page |
| Agent reasoning | Reasoning context for agents | `features/agent-reasoning`, `agent-context` | Impl | Internal | Panel |

### 4.7 Governance

| Capability | What it does | Evidence | Maturity | Class | Exposure |
|---|---|---|---|---|---|
| Governance Center | Policies, compliance, risk, permissions, audit, explainability | `features/governance`; routes `/director/governance/*` (8 pages) | Impl/Read-models | User-facing (Director) | Workspace |
| Policy engine | Policy model and signal-policy engine | `features/policy`; phase-3e.3 tag | Impl | Internal + surface | Page |
| Human Approval | The human-approval contract | `features/human-approval`, `approvals`; routes `/approvals`, `/director/governance/approvals` | Impl | User-facing | Page (cross-cutting) |
| Heby Governance Gate | Blocks presentation crossing tenant/org boundary or exposing protected elements | Heby Phase 7 | Impl | Internal (enforced in Heby) | None (behavior, not page) |

### 4.8 Security

| Capability | What it does | Evidence | Maturity | Class | Exposure |
|---|---|---|---|---|---|
| Authentication | Auth schema + infrastructure | `features/auth`; phase-3d.2b/2c tags | Impl | Internal + Settings | Sub-page (Settings) |
| Authorization / Permissions | Permission management | route `/director/governance/permissions` | Impl | User-facing | Page |
| Tenant / Org isolation | Immutable tenant + org boundaries | Heby Architecture §12; Heby Phase 7 | Impl (enforced) | Internal-only | None |
| Risk classification | Risk scoring for execution/approval | phase-4d.4; routes `/director/governance/risk`, `/director/registries/risk` | Impl | User-facing | Page |

### 4.9 Director / Human Authority

| Capability | What it does | Evidence | Maturity | Class | Exposure |
|---|---|---|---|---|---|
| Director Console | Executive overview, goals, health, alerts, insights, recommendations, reports | `features/director-dashboard*` (7 modules), `director`; routes `/director/*` | Read-models (real) | User-facing (primary) | Workspace |
| Director Command Center | Command console for governed action | `features/director-command`, `director-workspace`; phase-4b tags | Impl | User-facing | Workspace |
| Director AI Runtime | Executive navigation engine, AI-assisted director runtime | `features/director-ai-runtime` (executive-navigation-engine) | Impl | Internal→product | Heby-surface |
| Executive read-models | Overview aggregation, executive insights, timeline, widget runtime, evidence wiring | phase-4a.1–4a.8 tags; `director-dashboard-widget-runtime`, `-executive-*` | Read-models | User-facing | Panels/widgets |

### 4.10 Approvals (cross-cutting)

Covered in 4.7. Approvals are not one page — they are a **cross-cutting flow** surfaced wherever a pending item exists (Director console badge, governance console, Heby approval-prep panel). Evidence: `features/approvals` + `human-approval` + Heby Phase 6, badge in `sidebar.config.ts`.

### 4.11 Events / Signals

| Capability | What it does | Evidence | Maturity | Class | Exposure |
|---|---|---|---|---|---|
| Domain Events / Event Bus | Enterprise domain events and bus | `features/enterprise-domain-events`, `enterprise-event-bus`, `events`; route `/events` | Impl | Internal | Page (ops) |
| Live Dispatch | Live event dispatch surface | `features/live-dispatch` | Impl | Internal | Panel |
| Signals | OI signals (advisory) | OI Runtime | Impl | Internal→Heby | Heby-surface |
| Event Registry | Master list of event types | route `/director/registries/events` | Read-models | User-facing | Sub-page |

### 4.12 Audit / Provenance

| Capability | What it does | Evidence | Maturity | Class | Exposure |
|---|---|---|---|---|---|
| Provenance carriage | Every presented element traces to a settled source | Heby Phase 4 (grounding) | Impl | Internal (behavior) | None (visible via evidence UI) |
| Audit trail | Attributable, versioned record of presentations, prepared items, decisions | Heby Phase 8; route `/director/governance/audit` | Impl | User-facing | Page |
| Canonical read / Runtime projection | Read-only canonical + projection surfaces (internal diagnostics) | `features/canonical-read*`, `runtime-projection`; routes `/_internal/*` | Impl | **Internal-only** | **None (internal route already)** |
| Diagnostics read-models | Platform diagnostics projections | `features/diagnostics-read-models`, `platform-diagnostics`; phase-3e.7 | Impl | Internal | Panel |

### 4.13 Integrations

| Capability | What it does | Evidence | Maturity | Class | Exposure |
|---|---|---|---|---|---|
| Integrations hub | Gmail, GitHub, Supabase, Vercel wired to event bus | `features/integrations` (`mock`); routes `/integrations/*` | Mock | User-facing | Page |

### 4.14 Agent / AI Workforce

| Capability | What it does | Evidence | Maturity | Class | Exposure |
|---|---|---|---|---|---|
| Agent registry / CRUD / runtime | Agent identity, lifecycle, runtime, context | `features/agents`, `agent-crud`, `agent-runtime`, `agent-context`; phase-3c.3 | Impl / Mock (cards) | User-facing | Page |
| AI Workforce (departments) | Digital employees by department (Sales, Ops, Finance, HR, Legal, Research, Quality) | `sidebar.config.ts` workforce section; `agents/mock` | **Mock** | User-facing | Workspace |
| Orchestration | Multi-agent orchestration engine | `features/orchestration`; route `/director/orchestration` | Impl | Internal→product | Page |

### 4.15 Tasks / Workflows

| Capability | What it does | Evidence | Maturity | Class | Exposure |
|---|---|---|---|---|---|
| Workflows | Workflow domain + runtime + CRUD | `features/workflows`, `workflow-runtime`, `workflow-crud`; phase-3c.4; route `/workflows` | Impl | User-facing | Page |
| Task planning | Task decomposition and planning | `features/task-planning` | Impl | User-facing | Page |

### 4.16 Computer Use

| Capability | What it does | Evidence | Maturity | Class | Exposure |
|---|---|---|---|---|---|
| Computer Use provider | Computer-use execution adapter | route `/director/providers/computer-use`, `/infrastructure/computer-use`; Program VII Reserved in Heby mapping | Mock / Reserved | Internal→product | Panel |

### 4.17 System / Operational

| Capability | What it does | Evidence | Maturity | Class | Exposure |
|---|---|---|---|---|---|
| Persistence / Unit of Work | Enterprise persistence, unit-of-work, projections, projection providers | `features/enterprise-persistence`, `enterprise-unit-of-work`, `enterprise-projections`, `persistence` | Impl | **Internal-only** | **None** |
| Registries | Master-data registries (agents, goals, plans, executions, tools, models, capabilities, events, workflows, memory, entities, governance, risk, learning, experience) | `features/registries`, `registry-crud`; routes `/director/registries/*` (15 pages) | Read-models | User-facing | Workspace of sub-pages |
| CRUD core | Shared CRUD substrate | `features/crud-core` | Impl | Internal-only | None |
| Observability / Monitoring / Evaluation | Collection pipeline, health engine, monitoring, evaluation | `features/observability`, `monitoring`, `evaluation`, `runtime-observability*`; phase-3e.4–3e.8 | Impl | Internal→ops | Panel/Page |
| Architecture map | Cognitive/execution/intelligence/governance cores, engines, system flow | `features/architecture`; routes `/architecture/*` (8 pages) | Read-models | User-facing (technical) | Workspace |
| Platform core | Cross-cutting platform services | `features/platform-core` | Impl | Internal-only | None |

### 4.18 Department Verticals (product surface, mock)

| Capability | Evidence | Maturity | Class | Exposure |
|---|---|---|---|---|
| Finance Center | `features/finance` (`mock`); routes `/finance/*` (8 pages) | Mock | User-facing | Workspace |
| HR Center | `features/hr` (`mock`); routes `/hr/*` (9 pages) | Mock | User-facing | Workspace |
| Legal Center | `features/legal` (`mock`); routes `/legal/*` (9 pages) | Mock | User-facing | Workspace |
| Customer Operations | routes `/tickets`, `/knowledge`; `features/tickets` | Mock | User-facing | Workspace |

---

## 5. Internal-Only Capabilities (never a product surface)

These are system architecture (concept A) with **no** direct UI. Surfacing them would leak plumbing and, in several cases, violate isolation guarantees.

- Persistence, unit-of-work, projections, projection-providers, canonical-repository internals
- Shadow-read / silent-dual-read / actor-shadow-read / execution-shadow-read (migration-era)
- Runtime composition root, provider-port, transformation runtime, application services
- Enterprise event bus internals, domain-events plumbing
- Memory admission engine, memory persistence internals, retrieval/selection internals
- Reasoning Foundation internals (settled; consumed, not shown)
- Heby governance gate, grounding validator, tenant/org isolation (behaviors, not pages)
- CRUD core, crud-core substrate, platform-core
- `/_internal/*` routes (already segregated: canonical-read, runtime-projections)

**Provenance and grounding are the model case:** they are internal *behaviors* that become visible only as evidence/source affordances inside other surfaces — never as a "Provenance" page.

---

## 6. User-Facing Capabilities (the product surface)

The set that a Director or enterprise user can understand and use:

- **Heby** — ask, explore, get briefings, ask why, review, prepare approvals (primary; unbuilt UI).
- **Director console** — overview, goals, organization health, alerts, insights, recommendations, reports (real read-models).
- **Approvals** — review and act on pending items (cross-cutting).
- **Governance console** — policies, compliance, risk, permissions, audit, explainability.
- **Company Memory** — explore what the organization remembers.
- **Knowledge Graph + Knowledge Base** — relationships and answers.
- **Executions monitor** — watch running work, timelines, failures.
- **Registries** — master data browse (agents, goals, plans, tools, models, etc.).
- **AI Workforce** — digital employees by department (mock).
- **Department verticals** — Finance, HR, Legal, Customer Ops (mock).
- **Integrations** — external service status.
- **Architecture map** — technical/operator view of the OS.
- **Settings** — auth, preferences.

---

## 7. Cross-Cutting Capabilities

These deserve **one management surface** but appear as affordances across many workspaces:

- **Approvals** — a badge/queue on the Director console, a panel in Heby's approval-prep, a full page in Governance.
- **Governance & Security** — a console, plus per-surface constraints (risk labels, permission gates, blocked-presentation notices).
- **Provenance / Explainability** — evidence + "why" affordances everywhere Heby renders; a focused explainability page in Governance.
- **Audit** — a page, plus per-record history trails.
- **Events/Signals** — an ops page, plus contextual signal surfacing inside intelligence.
- **Search/Navigation (Heby-native)** — natural-language navigation replacing much of the current tree.

---

## 8. Director-Specific Capabilities

Reserved to the accountable human; the authority boundary is architectural, not cosmetic:

- Executive overview, strategic goals, organization health, executive reports.
- **Command Center** — the only surface that issues governed action (behind approval).
- **Approval authority** — grant/deny of pending items; Heby prepares, Director decides.
- Director Briefings — assembled advisory synthesis.
- Weekly insights / director inbox (defined in sidebar; some placeholder).

Per Heby Vision/Architecture: Heby **advises**, the Director **decides**. No Heby path crosses the Director Approval boundary. Director and standard-user experiences may differ in depth and scope while remaining one coherent experience.

---

## 9. Heby-Specific Surfaces

Heby Core is implemented end-to-end in code but has **no route, no component, no navigation entry**. The interaction model already names its future surfaces (as product vision, not authorization):

- Conversational surface (natural-language-first).
- Command palette + slash commands (`/why`, `/evidence`, `/sources`, `/summarize`, `/compare`, `/review`, `/approve`).
- Conversation modes (Executive Briefing, Exploration, Decision Review, Explainability, Planning, Learning).
- Smart suggestions, context awareness, explainability continuation.
- Voice/multimodal (reserved).

**Heby is the intended terminus for most user-facing capability above** — memory, briefings, evidence, approvals, intelligence are meant to be reached *through* Heby, not through 150 separate pages. This is the central UI-phase thesis and must be confirmed by the Director before IA begins.

---

## 10. Governance / Security Capabilities

- Governance console (policies, compliance, risk, permissions, audit, explainability) — real routes.
- Human-approval contract + execution permits + risk classification (runtime-enforced).
- Heby governance gate + tenant/org isolation + protected-element suppression (behaviors).
- Authentication/authorization (schema + infrastructure implemented).
- Immutable audit trail and decision record (supersession, not rewrite).

Governance **spans** Director, Heby, Runtime, and every vertical, yet still warrants a single management console. Do not fragment it; do not collapse it into one page either.

---

## 11. Existing UI Routes and What They Currently Represent

**Twelve sidebar sections** (`sidebar.config.ts`): Director, Architecture & Orchestration, AI Workforce, Customer Operations, Finance Center, HR Center, Legal Center, Infrastructure, Governance (placeholder), Learning, Marketplace (placeholder), Integrations.

**Reality of those routes:**

- **Real pages** (`staticRoutes` set, ~95 entries): Director console + registries + governance + architecture cores + finance/hr/legal/tickets/knowledge/agents/workflows/events/approvals/integrations/settings.
- **Auto-generated placeholders** (`placeholderPaths()` = every sidebar href not in `staticRoutes`): most of AI Workforce (all department agents), Infrastructure, Learning, Marketplace, several Director/provider detail pages, `/director/command-center`, `/director/inbox`, `/director/weekly-insights`.
- **Data source:** department verticals + agents + integrations render from `mock.ts`. Director console + registries + governance render from real read-models/projections (phase-4a evidence wiring).
- **Internal routes:** `/_internal/canonical-read`, `/_internal/runtime-projections` (correctly segregated).

**The header comment states the intent plainly:** the sidebar *is* the architecture map — "Adding a module learned in the AI Systems Architect Program = adding one entry here." This is A→C 1:1 by design. It served the architecture-learning phase; it is the wrong basis for a product UI.

---

## 12. Missing Product Surfaces

Capabilities that exist (or are settled) with **no adequate UI**:

- **Heby** — fully implemented, zero UI. The single largest gap.
- **Director Briefings** — assembled by Heby Phase 8; nowhere rendered.
- **Explainability-as-conversation** — implemented behavior, no surface.
- **Approval preparation flow** (Heby Phase 6) — no UI distinct from raw approvals.
- **Command Center** — sidebar entry is a placeholder despite phase-4b command engine being implemented.
- **Director Inbox / Weekly Insights** — sidebar entries, placeholder pages.
- **OI Runtime advisory output** (candidates/signals/assessments/readiness/pathways) — implemented, only indirectly surfaced.
- **Real data for verticals** — Finance/HR/Legal/Workforce are mock; the product story implies real execution behind them.

---

## 13. Capability Overlaps / Duplication Risks

Naming has drifted across the linear phase track; several concepts now have **multiple modules and multiple routes**:

- **Memory** appears as `/director/memory`, `/memory`, `/director/registries/memory`, and Company Memory — plus 8 `enterprise-memory-*` modules. Product needs one "Company Memory" surface; the rest are internal.
- **Governance / Approvals / Risk / Policy** are duplicated between the `director/governance/*` tree, the top-level `governance` (placeholder) section, `/approvals`, and `registries/{governance,risk}`. One console should own this.
- **Execution** spans `execution-center`, `executions`, `execution` (engine), `execution-queue`, `execution-bridge`, `execution-readiness`, `offline-execution`, `execution-engine`, plus `registries/executions`. Product needs one "Executions" monitor.
- **Providers** — framework, matrix, routing, invocation, plus per-provider pages and an `infrastructure` mirror. Collapse to one provider settings surface.
- **Intelligence** — `director/intelligence/*`, `director/insights`, `enterprise-intelligence`, `organizational-intelligence`, OI Runtime. Overlapping advisory surfaces.
- **Learning** — `director/intelligence/learning`, `hr/learning`, `registries/learning`, top-level `Learning` section. Three different meanings under one word.
- **Director vs. Architecture sections** both expose engines/registries/cores — two views of the same substrate.

**Duplication risk for the UI phase:** if navigation is derived from modules, every one of these becomes a separate entry again. The inventory above collapses them to product capabilities precisely to prevent that.

---

## 14. Candidate Workspace Clusters (NOT finalized navigation)

Possible groupings supported by the inventory. **These are candidates only** — no navigation, order, hierarchy, or naming is decided here. Director confirmation gates the IA phase.

- **Cluster A — Heby (Executive Intelligence Interface).** The conversational front door: ask, briefings, explainability, suggestions, approval preparation. Candidate primary surface.
- **Cluster B — Director Command.** Executive overview, goals, health, alerts, reports, Command Center (governed action), inbox.
- **Cluster C — Intelligence.** OI advisory output, insights, patterns, recommendations, organization intelligence, learning.
- **Cluster D — Knowledge & Memory.** Company Memory, Knowledge Graph, Knowledge Base, registries (as reference data).
- **Cluster E — Execution & Operations.** Executions monitor, timeline, failures, workflows, orchestration, events, observability.
- **Cluster F — Governance, Security & Approvals.** One console: policies, compliance, risk, permissions, audit, explainability, human approval.
- **Cluster G — AI Workforce & Departments.** Agents by department + Finance / HR / Legal / Customer Ops verticals.
- **Cluster H — Platform & Settings.** Providers/runtime, integrations, infrastructure, auth, architecture map (operator/technical).

Cross-cutting (Approvals, Governance affordances, Provenance/Explainability, Search) thread through all clusters and are not a cluster of their own.

---

## 15. Real Current Scale of Hebun

Compact hierarchy, grounded in repository evidence (feature modules + routes + tags). Illustrative shape, not a proposed navigation tree.

```text
Hebun
├── Foundation (settled, mostly invisible)
│   ├── Enterprise Memory        (8 modules, 8-phase foundation)
│   ├── Enterprise Reasoning      (reasoning foundation, settled)
│   ├── OI Foundation             (candidates·signals·assessments·readiness·pathways)
│   └── Canonical Contracts       (entities, relationship graph — frozen)
├── Organizational Intelligence Runtime (9 phases)
│   └── Advisory output + provenance·explainability·confidence + Director Briefings
├── Enterprise Execution Runtime
│   ├── Command bus / dispatcher        (phase-4b, 8 phases)
│   ├── Execution engine / pipeline     (phase-4e, 9 phases)
│   ├── Runtime safety / permits        (phase-4c·4d)
│   ├── Provider framework + adapters   (Claude, Codex, GitHub, Browser, Computer Use, Comms)
│   └── Observability / monitoring / evaluation (phase-3e)
├── Heby — Executive Intelligence Interface  ← implemented, ZERO UI
│   └── Identity → Input → Presentation → Grounding → Intent → Approval-prep
│       → Governance gate → Director Briefing → Composition (Phases 1–9)
├── Director / Human Authority
│   ├── Director console (real read-models, phase-4a)
│   ├── Command Center (governed action)
│   └── Approval authority (the decision boundary)
├── Governance · Security · Approvals   (console + cross-cutting enforcement)
├── Knowledge · Memory                  (graph, base, company memory, registries)
├── AI Workforce                        (7 departments, ~40 agents — MOCK)
├── Department Verticals                (Finance, HR, Legal, Customer Ops — MOCK)
└── Platform / Ops                      (providers, integrations, infrastructure, architecture map)

Scale: 119 feature modules · ~110 routes · 130+ published phase tags · 12 sidebar sections
```

---

## 16. Final Report

- **Repo state.** Branch `main`, HEAD `43093c9`, `HEAD == origin/main`, 0 ahead / 0 behind. Working tree clean except untracked docs (`docs/product-vision/`, `docs/architecture/{heby,conscious-intelligence}/`, `docs/architecture-backlog/future-architecture-backlog.md`). This inventory adds one file under the untracked `docs/product-vision/ui/`.
- **Published tags verified.** Runtime Foundation (8), Enterprise Memory Foundation (8), Memory+Reasoning Foundation (8), OI Foundation (6), OI Runtime (9), **Heby Core Phases 1–9 (all present)**, Director Workspace (8), phase-3c/3d/3e, phase-4a–4e, and a linear `phase-4`…`phase-51` + `program-04`…`program-09` track. 130+ tags total.
- **Authority documents read.** Heby Vision, Heby Architecture, Heby Interaction Model, Heby Architecture Mapping, Architecture Baseline (Phase 5 & 6), Heby Core barrel, sidebar config, full route listing. Remainder of `docs/product-vision/` and `docs/architecture/` catalogued.
- **Systems inspected.** 119 `src/features` modules; ~110 routes; sidebar config; heby-core (39 files); mock vs. read-model data sources.
- **Total capabilities discovered.** ~55 distinct capabilities across 18 domain groups (Sections 4.1–4.18).
- **Internal-only count.** ~20 (persistence, projections, shadow/dual-read, composition root, event-bus internals, memory/reasoning internals, grounding/governance behaviors, crud-core, platform-core, canonical-read internals).
- **User-facing count.** ~25 product capabilities (Section 6), of which the flagship (Heby) is unbuilt in UI and ~10 render from mock data.
- **Cross-cutting count.** ~6 (Approvals, Governance/Security, Provenance/Explainability, Audit, Events/Signals, Heby-native search).
- **Existing UI surfaces.** 12 sidebar sections, ~95 real routes, dozens of auto-generated placeholders; 2 segregated `/_internal` routes.
- **Major capability clusters.** 8 candidates (Section 14): Heby, Director Command, Intelligence, Knowledge & Memory, Execution & Ops, Governance/Security/Approvals, AI Workforce & Departments, Platform & Settings.
- **A / B / C distinctions discovered.** Current dashboard maps **System Architecture → UI Exposure ~1:1** (sidebar = architecture map by explicit design). The **Product Capability Architecture** (B) is a much smaller set that today is under-exposed (Heby, briefings, explainability) while internals are over-exposed.
- **Important gaps.** Heby has zero UI despite full implementation; Director Briefings, explainability-as-conversation, approval preparation, and Command Center are unrendered or placeholder; verticals are mock.
- **Contradictions.** (1) Heby is the intended primary surface yet absent from navigation. (2) Governance/Memory/Execution/Providers/Learning each duplicated across multiple modules and routes. (3) "Learning" carries three different meanings. (4) Director and Architecture sections expose the same substrate twice.
- **Proposed candidate workspace clusters.** Section 14 (A–H) — candidates only, not navigation.
- **File created.** `docs/product-vision/ui/hebun-capability-inventory.md` (this document). Note: requested path used `hebu-`; corrected to `hebun-` to match repository naming convention. No source code modified. No commit, tag, or push performed.

---

**DOCUMENT STATUS: DISCOVERY AND DOCUMENTATION ONLY — NO IMPLEMENTATION**
