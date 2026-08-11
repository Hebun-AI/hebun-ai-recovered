# Hebun — Product Information Architecture

## Document Status

**DOCUMENT TYPE: PRODUCT VISION — UI PHASE 2 — INFORMATION ARCHITECTURE**

**STATUS: INFORMATION ARCHITECTURE ONLY — NO IMPLEMENTATION**

This document transforms the [Product Capability Inventory](hebun-capability-inventory.md) into the canonical Product Information Architecture (IA) for Hebun. It defines **information architecture only** — the set of product workspaces, which capabilities live in each, what stays internal, what is cross-cutting, and where Heby and Director authority sit. It does **not** define navigation implementation, sidebar structure, components, routes, or page designs. It modifies no source code.

Four layers are kept strictly separate, and this phase defines only the third:

1. **System Architecture** — what exists technically (119 feature modules).
2. **Product Capability Architecture** — what a user can understand and use (Phase 1).
3. **Information Architecture** — how product capabilities are organized into workspaces and surfaces (**this document**).
4. **Navigation** — the concrete sidebar/menu implementation (a later phase).

It is subordinate to the Enterprise Constitution, the Heby Vision / Architecture / Interaction Model, the Organizational Intelligence Runtime Vision/Architecture, and Director authority. Where it conflicts with a canonical source, the canonical source governs.

**Discovery basis:** branch `main`, HEAD `43093c9`, `HEAD == origin/main`, 0 ahead / 0 behind, tree clean except pre-existing untracked docs. Heby Core Phases 1–9 published (9 tags). Read from disk: the capability inventory, Heby Vision/Architecture/Interaction Model, OI Runtime Vision, `sidebar.config.ts`, full route inventory.

---

## 1. Product Architecture Principles

1. **Product, not plumbing.** IA is derived from the Product Capability Architecture (concept B), never from backend modules (concept A). A module's existence is not a reason for a surface.
2. **One operating system.** Hebun must feel like a single OS, not 119 modules. Top-level structure stays compact (target 6–8 workspaces).
3. **Heby is ambient.** The primary way to reach intelligence is conversation with Heby, available everywhere — not 150 separate pages.
4. **Director authority is visible and singular.** The human decision boundary has one coherent home and is never blurred into advice.
5. **Intelligence ≠ operations ≠ reference.** Advisory (uncertain, forward-looking), operational (live, running), and reference (settled, what-is) surfaces are distinguished, never mixed.
6. **One primary home per capability.** Every user-facing capability has exactly one owning workspace. Cross-links are allowed; duplicate ownership is not.
7. **Internal stays internal.** Engines, normalization, grounding internals, provenance binders, lifecycle plumbing never become first-class navigation.
8. **Growth without top-level explosion.** New capabilities land inside existing workspaces as surfaces/sub-sections, not as new top-level entries.
9. **Depth on demand.** Top level is shallow and stable; complexity lives one or two levels down, reached by intent (via Heby) or by drilling into a workspace.

---

## 2. Final Proposed Workspace Model

**Heby is not a workspace.** It is a **global intelligence layer** (persistent, present in every workspace) plus a **home/front-door surface** (the default landing). See Section 6.

Beneath the Heby layer, **seven top-level workspaces**:

| # | Workspace | Primary purpose | Primary persona |
|---|---|---|---|
| 1 | **Command** | Executive cockpit + the human authority boundary | Director |
| 2 | **Intelligence** | Advisory output: what the organization is learning, where it stands, where it could go | Director / analyst |
| 3 | **Knowledge** | Settled reference: what the organization knows and remembers | All enterprise users |
| 4 | **Operations** | Live running work: executions, workflows, orchestration, events | Operator / Director |
| 5 | **Workforce** | The AI workforce and the business departments it runs | Department leads / Director |
| 6 | **Governance** | Rules, permissions, risk, compliance, audit — the guardrails and the record | Director / compliance |
| 7 | **Platform** | Providers, integrations, infrastructure, models, auth, architecture map | Operator / admin |

Count: **7 workspaces + 1 ambient Heby layer.** Within the 6–8 target.

---

## 3. Capability-to-Workspace Mapping

Every user-facing capability from Phase 1 (Section 6 of the inventory) is assigned exactly one primary home. `→` marks a cross-link (surfaced there, owned elsewhere).

### Heby layer (ambient — owns interaction, not data)
Natural-language interaction · conversation modes · explainability continuation (`/why /evidence /sources`) · smart suggestions · command palette · approval-prep panels · briefing rendering. Owns no data; renders every other workspace's material.

### 1. Command (Director)
Executive Overview · Strategic Goals · Organization Health · Critical Alerts · Executive Insights (headline) → *Intelligence* · AI Recommendations (headline) → *Intelligence* · Executive Reports · **Director Briefings** (assembled by Heby Phase 8, rendered here) · **Command Console** (governed action, phase-4b) · **Approvals & Decisions** (the authority act) · Director Inbox · Weekly Insights · carried questions/decisions.

### 2. Intelligence
OI Runtime advisory output — candidates · signals · assessments · readiness · pathways · Pattern Discovery · Executive Insights · AI Recommendations · Organization Intelligence · **Organizational Learning** (improvement, the OI meaning of "learning"). Consumed primarily through Heby. Excludes reference data (→ Knowledge) and running work (→ Operations).

### 3. Knowledge
**Company Memory** (what the org remembers — single home) · Knowledge Graph · Knowledge Base (customer-facing answers) · **Registries** (master-data browse: agents, goals, plans, executions, tools, models, capabilities, events, workflows, memory, entities, governance, risk, learning, experience). Reference/settled only.

### 4. Operations
**Executions** (single live monitor) · Execution Timeline · Execution Failures · Execution Graphs · Workflows · Orchestration · Task Planning · Planning Engine · Events (ops) · Offline Execution · Live Dispatch · Observability/Monitoring (ops view). Live/running only.

### 5. Workforce
AI agents (registry + per-agent) · department groupings (Sales, Operations, Finance, HR, Legal, Research, Quality) · **Finance Center** · **HR Center** · **Legal Center** · **Customer Operations** (Tickets + Knowledge Base surface → *Knowledge*). The agents and the business functions they run.

### 6. Governance
Governance Center · Policies · Policy Engine · Compliance · **Risk** (single home) · Permissions · **Audit** (single home) · Explainability (focused page) · Human-Approval **rules** (the act → *Command*). Security folds here (auth rules → *Platform* for config).

### 7. Platform
Provider Framework/Matrix/Routing/Invocation (single Providers home) · per-provider config (Claude, Codex, GitHub, Browser, Computer Use, Communication) · Runtime Boundary/Activation (operator) · Integrations · Infrastructure (tools, MCP, external APIs, model router, storage, cost engine) · Model/Tool registries (config view) · Authentication/Authorization config · Settings · **Architecture Map** (operator/technical OS view).

---

## 4. Internal-Only Capability List (MUST NOT become first-class navigation)

Supported by inventory §5. These are system architecture with no product surface — behaviors, engines, plumbing:

- **Persistence & lifecycle:** enterprise-persistence, unit-of-work, projections, projection-providers, runtime-projection, crud-core, platform-core, canonical-repository internals.
- **Migration-era reads:** shadow-read-core, knowledge-shadow-read, silent-dual-read, actor-shadow-read, execution-shadow-read, `/_internal/*`.
- **Runtime internals:** composition-root, provider-port, transformation-runtime, application-services, runtime safety guards, idempotency/concurrency, execution-permit lifecycle internals, target resolution, recovery/compensation.
- **Event plumbing:** enterprise-event-bus internals, domain-events plumbing.
- **Memory internals:** admission-engine, persistence, retrieval, selection, query internals, context assembly.
- **Reasoning internals:** Reasoning Foundation (settled; consumed, never shown), decision-domain internals.
- **OI internals:** candidate-formation internals, assembly internals, normalization/validation infrastructure, provenance binders.
- **Heby internals (behaviors, not pages):** identity anchor, input/context admission, grounding validator, governance gate, intent-routing determinism, composition closure, provenance carriage mechanics, tenant/org isolation.
- **Diagnostics:** diagnostics-read-models, platform-diagnostics internals (surface only as aggregate ops health).

**Rule:** these may power visible affordances (an evidence chip, a confidence badge, a "why" answer) but never earn a nav entry.

---

## 5. Cross-Cutting Capabilities

Threaded through workspaces; each has **one** primary owner plus contextual affordances:

| Capability | Primary owner | Appears as, elsewhere |
|---|---|---|
| **Heby** (interaction) | Ambient layer | Command bar + panel in every workspace |
| **Approvals** — the act | Command (Approvals & Decisions) | Badge on Director surfaces; panel in Heby approval-prep |
| **Approvals** — rules & record | Governance (policy + audit) | Cross-linked from Command |
| **Provenance / Explainability** | Governance (Explainability page) | Evidence/source/"why" affordances wherever Heby renders |
| **Audit** | Governance | Per-record history trails in any workspace |
| **Events / Signals** | Operations (events) / Intelligence (signals) | Contextual surfacing in intelligence + ops |
| **Search / navigation** | Heby-native (natural language) | Replaces much of the current static tree |
| **Risk** | Governance | Risk labels on executions, approvals, agents |
| **Guided Explanation** | Heby (ambient) + presentation layer | Temporary visual guidance on real workspace regions wherever a region is explainable |

### 5.1 Guided Explanation Layer — a cross-cutting presentation capability (FUTURE)

**Status: architecture principle only — not implemented.** This section records a future,
authoritative product/architecture principle. It defines no component, overlay, animation,
route, anchor contract, model call, or tool. It authorizes no implementation.

**Guided Organizational Intelligence.** Hebun is not "a dashboard with an AI chatbot." Its
target interaction model is *guided organizational intelligence*: an authorized user can
**ask → understand → see → learn → investigate → decide → authorize → act** without ever
losing the distinction between AI explanation and human authority. Heby therefore has two
complementary roles — the **Organizational Intelligence Interface** and a **contextual
teacher/guide** — and the UI itself becomes part of the explanation.

**Core principle — "Heby explains the organization through the organization."** When the
answer to a question corresponds to information already represented in a workspace, Heby
should prefer to (1) navigate to the relevant workspace, (2) identify the relevant region,
(3) visually guide attention to it, (4) explain what the user is seeing, (5) connect it to
evidence and provenance, (6) explain why it matters, (7) optionally continue to the next
relevant region, and (8) preserve the user's decision authority.

**Not a new workspace.** The Guided Explanation Layer is a **shared presentation capability
across Hebun**, owned with Heby (ambient) and the presentation layer. It adds **no eighth
workspace** — the seven-workspace IA is unchanged — and it **extends the Phase 15 Heby
context architecture** rather than creating a second assistant. Conceptual flow:
`Heby Response → Guidance Instruction → Navigation Target → Workspace → Stable UI Anchor →
Guidance Overlay → Explanation`.

**Semantic UI anchors — not coordinate-first.** Explainable regions should eventually expose
**stable semantic anchors** (e.g., conceptually `operations.active-agents`,
`governance.approval-required`, `knowledge.provenance`, `intelligence.candidate`,
`platform.authentication`, `security.attack-path`, `decisions.consequences` — illustrative
only; the naming contract is defined at implementation). Guidance must **not** rely on guessed
coordinates, brittle selectors, DOM-position assumptions, text scraping, or model-generated
pixel locations. The presentation layer resolves an anchor's current geometry, so anchors
must survive desktop, tablet, and mobile.

**Guidance Instruction (future typed).** A future instruction may reference `workspace`,
`route`, `anchorId`, `guidanceType`, `explanationReference`, `duration`, `sequence`,
`emphasis`, and `authorityContext`. Guidance types may include HIGHLIGHT, SPOTLIGHT, CIRCLE,
UNDERLINE, ARROW, PULSE. The architectural requirement is fixed; the visual treatment is a
presentation concern. Guidance is **temporary and non-destructive** (a bounded duration —
e.g. ~5 s — is a presentation default, not an intelligence assumption) and **never modifies
organizational state**.

**Sequential and cross-workspace teaching.** Guidance may run as multi-step explanations
(e.g. highlight an operational failure → the related governance restriction → the supporting
evidence → the Director's options) and may cross workspace boundaries. Cross-workspace
guidance **references the owning workspace** and does not duplicate foreign workspace state;
context is preserved across the sequence.

**Evidence-first teaching.** Heby must not point at a region and then invent an explanation
for it. Guided explanation preserves `SOURCE → EVIDENCE → PROVENANCE → UI REPRESENTATION →
HEBY EXPLANATION`. Where evidence is incomplete, Heby says so; where the source is
unavailable, Heby does not fabricate the explanation. **Uncertainty survives presentation** —
known / supported / incomplete / uncertain / unavailable — and visual confidence must never
exceed evidential confidence (uncertain relationships must not look definitive).

**Education vs authority — an explicit invariant.** Heby *shows, explains, teaches,
investigates, connects, compares, traces, prepares*. The Director/authorized human *decides,
approves, rejects, authorizes*. An authorized runtime *executes*. These three layers are
never collapsed: a visual highlight is not an action, navigation is not authorization,
explanation is not approval, a recommendation is not a decision, and prepared action is not
execution. Guidance is never a backdoor around Governance or Director authority.

**Security and privacy.** A UI anchor is never an authorization bypass. If a target exists
but is restricted, Heby may state that access is restricted; it must not reveal the withheld
content. Visibility remains server-authorized. The canonical future use case is a security
walkthrough (initial signal → affected identity/device → attack progression → policy/control
response → supporting evidence → Director options); every highlighted security fact must
originate from **real security evidence** — Heby must not fabricate attack paths.

**Accessibility.** Visual guidance must not be sight-dependent: every highlight has an
equivalent semantic explanation, with support for screen readers, keyboard navigation,
reduced motion, non-color-only emphasis, focus management, and dismissal. A "red circle" may
be one treatment; it can never be the only information channel.

**Boundaries.** Guided explanation and the Tool Runtime remain separate — a guidance
instruction is *never* permission to invoke a tool; tool execution stays independently gated.
For Hebun-owned UI, guidance uses semantic application anchors and does **not** require
Computer Use; Computer Use may later be necessary only for *external* applications whose
DOM/components Hebun does not control (Device Runtime territory).

**Current vs future (no overclaiming).** Implemented today: the typed Heby workspace-context
architecture (Phase 15) and the deterministic, evidence-grounded Heby runtime whose model
boundary reports *unavailable* (Phase 16 foundation). **Not implemented:** the Guided
Explanation Layer, semantic UI anchors, visual overlays, sequential teaching, and Computer
Use. None of these is live.

**Roadmap dependency (architectural, not a phase renumbering).** Heby context architecture →
Heby intelligence / evidence / reasoning → guidance + safe tool/action capabilities → Device
Runtime / Computer Use → domain-specific experiences such as a Security Center. The
architectural dependency governs; speculative phase numbers do not.

**Invariants.** (1) Heby may teach; Heby does not gain human authority. (2) Explanation never
implies execution. (3) Guidance never bypasses authorization. (4) UI targets are semantic,
not coordinate-first. (5) Evidence precedes authoritative explanation. (6) Uncertainty
survives presentation. (7) Cross-workspace guidance references owning systems. (8) Restricted
information remains withheld. (9) Visual guidance has accessible equivalents. (10) Hebun-owned
UI guidance should not require Computer Use. (11) Guided Explanation extends Heby; it does not
create a second assistant. (12) Future tool execution remains independently gated. (13) Human
decision authority remains explicit. (14) No private chain-of-thought is exposed.

The learner-facing and organizational-learning consequences of this principle are recorded in
the [Heby Interaction Model](../heby-interaction-model.md#guided-organizational-intelligence-and-learning).

---

## 6. Heby Placement Model

Explicit answers to the required questions:

- **Is Heby a workspace?** No. Reducing Heby to one bucket among seven contradicts its identity as *the* interface between the Director and enterprise intelligence.
- **Is Heby a global interaction layer?** Yes — the primary model. A persistent command bar + conversational panel available in every workspace, so any surface can be explained, navigated, or queried in natural language without leaving it.
- **Is Heby embedded inside Command Center?** Present there (briefings, approval-prep), but not owned by it. Heby is not Director-only; standard users get a role-appropriate Heby.
- **Is Heby persistent across all workspaces?** Yes. Same coherent advisor everywhere; context-aware of the current workspace/subject.
- **Does Heby have a home?** Yes — the **front-door / default landing surface**: a full conversational surface for deep sessions, briefings, exploration, decision review. This is a *surface*, not a workspace bucket.
- **Visible Heby Core capabilities (UI behavior):** explain · summarize · navigate · present · clarify · expose Runtime results · expose Director Briefings · answer questions · prepare-for-approval (as distinct panels). Plus interaction-model surfaces: conversation modes (Executive Briefing / Exploration / Decision Review / Explainability / Planning / Learning), command palette, slash commands (`/why /evidence /sources /summarize /compare /review /approve`), smart suggestions, context awareness.
- **Invisible Heby Core internals:** identity anchor, input/context admission, grounding validator, governance gate, intent-routing determinism, provenance carriage, composition closure. These are enforced behaviors; they surface only as evidence/confidence/uncertainty affordances and blocked-presentation notices.
- **Not a chatbot page.** Heby is the connective intelligence tissue of the whole product: a layer + a home + contextual panels, distinguishing observation, interpretation, recommendation, uncertainty, and decision — never crossing the Director boundary.

---

## 7. Director Placement Model

**One workspace — Command — owns the Director's authority surface.** Grouping:

- **Cockpit:** Executive Overview, Strategic Goals, Organization Health, Critical Alerts, Executive Reports.
- **Briefings:** Director Briefings (assembled by Heby, rendered here) — the core intelligence artifact for judgment.
- **Command Console:** the only surface that issues governed action (phase-4b), always behind approval.
- **Approvals & Decisions:** the human authority *act* — grant/deny of pending items; recorded decisions and carried questions. This is the decision boundary; it lives with the Director.
- **Inbox:** what needs the Director's attention.

**Split decisions (deduplication):**
- **Approvals:** the *act* lives in Command; the *policy/rules* and the *audit record* live in Governance. Two ends of one flow, no duplicate ownership.
- **Audit:** owned by Governance (the record); Command cross-links its own decisions.
- **Insights/Recommendations:** headline versions surface in Command; full advisory home is Intelligence.

**Human authority boundary — visibly preserved:** Command Console requires approval before action; Heby prepares but never approves; advice is never rendered as authority. One Director workspace, not scattered — so authority reads as coherent.

---

## 8. Governance / Security Placement

- **One home: the Governance workspace.** Policies, Policy Engine, Compliance, Risk, Permissions, Audit, Explainability, Human-Approval rules.
- **Security folds in:** tenant/org isolation, protected-element suppression, and Heby's governance gate are enforced *behaviors* (internal), surfaced here as constraint/blocked notices. Auth **configuration** (authentication/authorization setup) lives in Platform; the **rules/enforcement view** lives in Governance.
- **Cross-cutting reach:** risk labels, permission gates, and audit trails appear inside every workspace but are owned here.
- **Kills the duplication:** the current top-level placeholder "Governance" section and `director/governance/*` tree collapse into this single workspace; `registries/{governance,risk}` become reference views cross-linked from Knowledge.

---

## 9. AI Workforce Placement

- **One workspace — Workforce — holds both the agents and the departments they run.** In Hebun a "department" *is* an AI-run function, so agents and their business vertical belong together.
- **Sub-structure:** department groupings (Sales, Operations, Finance, HR, Legal, Research, Quality), each with its agents and its operational surfaces (Finance Center, HR Center, Legal Center, Customer Operations).
- **Agent registry** (identity/lifecycle reference) cross-links to Knowledge/Registries; the **live agent** surfaces live here.
- **Maturity note:** these are currently mock. IA gives them a coherent home now so real data can land without restructuring.
- **Tension (flagged as risk):** Finance/HR/Legal are also standalone business domains some users think of separately. Kept under one Workforce workspace for top-level compactness; may warrant promotion later.

---

## 10. Knowledge / Memory / Intelligence Separation

The sharpest IA line in the product. Three distinct meanings, three homes:

- **Knowledge** = *settled, reference, what-is.* Company Memory (the org's record, single home), Knowledge Graph (relationships), Knowledge Base (answers), Registries (master data). Read-mostly.
- **Intelligence** = *advisory, derived, what-could-be.* OI Runtime candidates/signals/assessments/readiness/pathways, insights, patterns, recommendations, Organizational Learning. Uncertain, non-authoritative, consumed through Heby.
- **Memory** (system) is *settled* → its product surface is **Company Memory inside Knowledge**. All admission/retrieval/selection internals stay hidden.
- **Reasoning** (system) is *settled* → **internal-only**; it feeds Intelligence and Heby, no page.

**"Learning" disambiguated** (Phase 1 risk): Organizational Learning (improvement) → **Intelligence**; Learning & Development (people) → **Workforce/HR**; Learning Registry (record) → **Knowledge/Registries**. Same word, three homes, separated by name.

---

## 11. Integration / Marketplace / System Placement

- **Integrations** → **Platform** (external services wired to the event bus; Gmail/GitHub/Supabase/Vercel).
- **Infrastructure** (tools, MCP servers, external APIs, model router, storage, cost engine, computer use) → **Platform**.
- **Providers/Runtime** (framework, matrix, routing, invocation, per-provider) → **Platform** (single Providers home).
- **Architecture Map** (cognitive/execution/intelligence/governance cores, engines, system flow) → **Platform** as the operator/technical OS view — *not* duplicated in Command.
- **Marketplace** (installable departments/employees/packs — placeholder, not built) → reserved; when built, a surface inside **Workforce** (install into the workforce), not a new top-level workspace.
- **Settings** → **Platform**.

---

## 12. Duplicate-Resolution Decisions

Each Phase 1 overlap resolved to one primary home:

| Overlap | Decision — single primary home | Collapses / cross-links |
|---|---|---|
| **Memory** (`/director/memory`, `/memory`, `registries/memory`, 8 enterprise-memory-*) | **Knowledge → Company Memory** | Internals hidden; Memory Registry = reference view |
| **Governance / Approvals / Risk / Policy** (governance/*, top-level placeholder, /approvals, registries/{governance,risk}) | Rules+record → **Governance**; approval act → **Command** | Kill placeholder section; registries become reference |
| **Execution** (execution-center, executions, engine, queue, bridge, readiness, offline, registries/executions) | **Operations → Executions** | One monitor + drill-downs; Execution Registry = reference |
| **Providers / Integrations** (provider-*, per-provider, infrastructure mirror) | **Platform → Providers / Integrations** | Single config home |
| **Learning** (3 meanings) | Split by meaning: **Intelligence** / **Workforce-HR** / **Knowledge** | Disambiguated by name |
| **Director vs Architecture** (both expose engines/registries/cores) | Executive → **Command**; technical → **Platform/Architecture Map** | No shared engine pages |
| **Registry vs operational** (definitions vs live state) | Live → **Operations**; reference → **Knowledge/Registries** | Cross-link both ways |

**Invariant:** one primary home per capability. Cross-links yes; duplicate ownership no.

---

## 13. Current-Route Migration Map

Representative mapping of today's ~110 routes into the model (patterns, not exhaustive):

| Current route(s) | → Workspace / surface |
|---|---|
| `/director`, `/dashboard`, `/director/goals`, `/director/organization-health`, `/director/alerts`, `/director/reports` | **Command** (cockpit) |
| `/director/command-center`, `/director/inbox`, `/director/weekly-insights` | **Command** (console/inbox) |
| `/approvals`, `/director/governance/approvals` | **Command** (act) ↔ **Governance** (rules/audit) |
| `/director/insights`, `/director/recommendations`, `/director/intelligence/*` | **Intelligence** |
| `/director/memory`, `/memory`, `/director/knowledge-graph`, `/knowledge` | **Knowledge** |
| `/director/registries/*` (15) | **Knowledge → Registries** (live variants cross-link to Operations/Workforce) |
| `/director/execution-center/*`, `/director/executions`, `/director/execution`, `/director/orchestration`, `/director/task-planning`, `/director/planning`, `/director/offline-execution`, `/workflows`, `/events` | **Operations** |
| `/agents`, `/workforce/**`, `/finance/**`, `/hr/**`, `/legal/**`, `/tickets` | **Workforce** (Tickets' KB → Knowledge) |
| `/director/governance/*` (policies, compliance, risk, permissions, audit, explainability), `/director/policy` | **Governance** |
| `/director/provider*`, `/director/providers/**`, `/director/runtime*`, `/director/adapters`, `/integrations/**`, `/infrastructure/**`, `/architecture/**`, `/settings` | **Platform** |
| `/_internal/*`, all shadow/dual-read, persistence, projections | **Internal-only** (no nav) |
| Heby Core (no current route) | **Heby layer + home surface** (new) |

Every current real route lands in a workspace; every placeholder either lands or is retired; internals stay off-nav.

---

## 14. Current Sidebar → Proposed IA Migration

Today's **12 sidebar sections** → **7 workspaces + Heby layer**:

| Current section | → Proposed |
|---|---|
| Director | **Command** (+ headline insights → Intelligence) |
| Architecture & Orchestration | Split: Orchestration/runtime ops → **Operations**; Architecture Map → **Platform** |
| AI Workforce | **Workforce** |
| Customer Operations | **Workforce** (KB → Knowledge) |
| Finance Center | **Workforce → Finance** |
| HR Center | **Workforce → HR** |
| Legal Center | **Workforce → Legal** |
| Infrastructure | **Platform** |
| Governance (placeholder) | **Governance** (merged; placeholder retired) |
| Learning | Split by meaning → **Intelligence** / **Workforce-HR** / **Knowledge** |
| Marketplace (placeholder) | Reserved surface inside **Workforce** |
| Integrations | **Platform → Integrations** |
| *(none — Heby absent)* | **Heby layer + home** (new, primary) |

Net: 12 flat, partly-duplicated, mostly-placeholder sections → 7 deduplicated workspaces under one ambient Heby layer.

---

## 15. Compact Hierarchy (IA shape — NOT final navigation)

```text
Hebun
├── Heby  (ambient layer + home surface — present in every workspace)
│   ├── Home / conversational front door
│   ├── Command bar + panel (global)
│   └── Modes: Briefing · Exploration · Decision Review · Explainability · Planning · Learning
│
├── Command  (Director authority)
│   ├── Executive Overview · Goals · Org Health · Alerts · Reports
│   ├── Director Briefings
│   ├── Command Console  (governed action, behind approval)
│   └── Approvals & Decisions  (the authority act) · Inbox
│
├── Intelligence  (advisory / derived)
│   ├── Candidates · Signals · Assessments · Readiness · Pathways
│   ├── Insights · Patterns · Recommendations
│   └── Organizational Learning
│
├── Knowledge  (settled / reference)
│   ├── Company Memory
│   ├── Knowledge Graph · Knowledge Base
│   └── Registries  (master data)
│
├── Operations  (live / running)
│   ├── Executions · Timeline · Failures · Graphs
│   ├── Workflows · Orchestration · Task Planning
│   └── Events · Offline Execution · Observability
│
├── Workforce  (agents + departments)
│   ├── Agents (by department)
│   └── Finance · HR · Legal · Customer Operations
│
├── Governance  (guardrails + record)
│   ├── Policies · Policy Engine · Compliance
│   ├── Risk · Permissions
│   └── Audit · Explainability
│
└── Platform  (operator / admin)
    ├── Providers · Runtime · Integrations
    ├── Infrastructure · Models · Tools · Auth config
    └── Architecture Map · Settings

Internal-only (NEVER navigation): persistence · projections · shadow/dual-read ·
composition root · event-bus internals · memory/reasoning internals ·
grounding validator · governance gate · provenance binders · crud-core · normalization/validation infra
```

---

## 16. Validation

- **Every user-facing capability has a product home** — Section 3 maps all of inventory §6; no orphans.
- **Every internal-only capability remains hidden** — Section 4 lists them; none appears in a workspace.
- **No conflicting primary ownership** — Section 12 resolves each overlap to one home; cross-links only.
- **Heby placement coherent** — ambient layer + home + contextual panels (Section 6); not a chatbot page, not one bucket.
- **Director authority coherent** — one Command workspace; approval act with the Director, rules/record in Governance (Section 7).
- **Top-level compact** — 7 workspaces + Heby layer, within 6–8 target.
- **No workspace is a backend-module bucket** — each is a product concept (authority, advisory, reference, live work, workforce, guardrails, platform), not a module dump.
- **Current routes migrate** — Sections 13–14 land every real route; placeholders retire or land; internals off-nav.
- **Future growth fits** — new capabilities land as surfaces inside existing workspaces (e.g., Marketplace → Workforce); no top-level explosion.

---

## 17. Final Report

- **Exact workspace count.** 7 top-level workspaces + 1 ambient Heby layer.
- **Workspace names.** Command · Intelligence · Knowledge · Operations · Workforce · Governance · Platform (+ Heby layer/home).
- **Capability count mapped.** ~25 user-facing capabilities (inventory §6) → homed; ~55 total capabilities reconciled across mapping + internal-only + cross-cutting.
- **Internal-only count.** ~20+ capability families (Section 4).
- **Cross-cutting count.** ~8 (Heby, Approvals-act, Approvals-rules/record, Provenance/Explainability, Audit, Events/Signals, Search, Risk).
- **Major duplicate resolutions.** Memory → Knowledge/Company Memory; Governance/Approvals/Risk/Policy → Governance (act → Command); Execution (9 modules) → Operations/Executions; Providers/Integrations → Platform; Learning (3 meanings) split by name; Director vs Architecture → Command vs Platform; Registry vs operational → Knowledge vs Operations.
- **Heby placement decision.** Not a workspace. **Global ambient interaction layer + home/front-door surface + contextual panels**, persistent across all workspaces, role-appropriate. Deterministic internals stay invisible.
- **Director placement decision.** **One Command workspace** owns the authority surface (cockpit, briefings, command console, approvals & decisions, inbox). Approval *act* with the Director; approval *rules* and *audit* in Governance.
- **Route migration implications.** 12 sidebar sections → 7 workspaces + Heby; ~110 routes re-homed (Sections 13–14); placeholders retired or landed; `/_internal/*` and all plumbing stay off-nav; Heby needs new surfaces (none exist today).
- **Unresolved IA decisions (for Director).** (1) Is Heby the *default landing* for all roles, or Command-first for the Director? (2) Should Finance/HR/Legal stay under Workforce or be promoted to standalone workspaces as they gain real data? (3) Is "Command" the right name, or "Director"? (4) Do standard (non-Director) users see a reduced workspace set? (5) Registries: one Knowledge home, or split reference-vs-config across Knowledge/Platform? (6) Architecture Map: keep as a product surface at all, or demote to internal/technical docs?
- **File created.** `docs/product-vision/ui/hebun-information-architecture.md`. No source code modified. No commit, tag, or push.

---

**DOCUMENT STATUS: INFORMATION ARCHITECTURE ONLY — NO IMPLEMENTATION**
