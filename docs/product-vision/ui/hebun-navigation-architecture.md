# Hebun — Navigation Architecture

## Document Status

**DOCUMENT TYPE: PRODUCT VISION — UI PHASE 3 — NAVIGATION ARCHITECTURE**

**STATUS: NAVIGATION ARCHITECTURE ONLY — NO IMPLEMENTATION**

This document turns the [Information Architecture](hebun-information-architecture.md) into the canonical Navigation Architecture: how users move through Hebun's seven product workspaces plus the ambient Heby layer, across three navigation levels, four roles, and three viewports — without exposing the backend 1:1. It defines **navigation architecture only**. It writes no components, no routes, no `sidebar.config.ts` changes, no design system.

Layer separation held: System Architecture → Product Capabilities → Information Architecture → **Navigation Architecture (this document)** → UI Implementation (later).

**Discovery basis:** branch `main`, HEAD `43093c9`, `HEAD == origin/main`, 0 ahead / 0 behind, tree clean except pre-existing untracked docs. Heby Core Phases 1–9 published. Read: capability inventory, information architecture, `sidebar.config.ts`, route inventory, `app-shell.tsx`, `topbar.tsx`, `mobile-nav.tsx`, `use-sidebar-state.ts`, `auth/tenant/tenant-context.ts`.

**Evidence that shapes this phase:**
- App shell today = `Sidebar` (accordion, localStorage-persisted open sections) + `TopBar` + `main`, mobile drawer at the `lg` breakpoint (`lg:hidden`, `lg:pl-(--sidebar-w)`).
- `TopBar` already stubs **global search** and **notifications** (both `disabled`) — the global-control slots exist.
- `TenantContext` carries `tenantId`, `organizationId`, `roleId`, `permissionSummary`, `assuranceLevel`, `mfaVerified`. Multi-tenant, role, and permission enforcement already live **server-side**. This is decisive: **navigation visibility is convenience, authorization is enforced below the UI.**

No evidence contradicts the six Director gates. They are resolved as directed (Section 22).

---

## 1. Navigation Principles

1. **Three levels, strict.** Global (workspace switch + Heby + controls) · Workspace (inside one of seven) · Contextual (entity/drill-down). Level 3 never pollutes the sidebar.
2. **Compact and stable top level.** Seven workspaces + Heby launcher. This set does not grow for normal product growth.
3. **Heby is ambient, not a bucket.** A persistent launcher + contextual panel + home surface — never an eighth sidebar item.
4. **One primary home per capability.** Contextual cross-links allowed; duplicate navigation homes forbidden.
5. **Command-first.** The default authenticated landing is Command, the executive operating surface.
6. **Visibility ≠ authorization.** Hiding a workspace is a convenience, never a security control; the server enforces via `roleId`/`permissionSummary`.
7. **Depth by intent.** Breadth lives one or two levels down, reached by drilling in or by asking Heby — not by enumerating everything in the rail.
8. **Domains are packs, not top-level.** Finance/HR/Legal and future industry packs live inside Workforce; they never mint top-level entries.

---

## 2. Global Navigation Model (Level 1)

Level 1 is persistent across the whole product and contains exactly:

- **Workspace switcher** — the seven workspaces (Section 3). An icon rail (desktop/tablet) or a switcher sheet (mobile).
- **Heby launcher** — persistent, always reachable, keyboard-shortcutted; opens the contextual panel or the home surface. Not part of the seven.
- **Global controls** (Section 9) — search, command palette, notifications, approvals-attention, org/tenant selector, account, settings, help, status.

Nothing else earns Level 1. Backend modules never appear here.

---

## 3. Final Workspace Order

| Order | Workspace | Icon semantics | Why here |
|---|---|---|---|
| 1 | **Command** | gauge / cockpit | Authority + default landing; the Director starts here |
| 2 | **Intelligence** | brain / spark | Make sense of what the org is learning |
| 3 | **Knowledge** | book / graph | Reference the settled truth |
| 4 | **Operations** | activity / pulse | Run and watch live work |
| 5 | **Workforce** | people | The AI workforce + departments that do the work |
| 6 | **Governance** | shield | Guardrails, permissions, the record |
| 7 | **Platform** | layers / cog | Providers, integrations, admin |

Rationale: **authority → sense-making → doing → control → admin.** Command first (executive + landing); Governance and Platform last (oversight/admin, less-frequent). Icons are semantic, not decorative: cockpit, cognition, reference, pulse, people, shield, plumbing.

---

## 4. Workspace Navigation Hierarchy (Level 2)

Each workspace exposes a **compact** Level-2 set (≈4–8 destinations). Everything finer is Level 3. Per-destination attributes in Section 7.

```text
Command                        Intelligence                 Knowledge
├── Overview  (landing)        ├── Overview                 ├── Company Memory
├── Briefings                  ├── Insights                 ├── Knowledge Graph
├── Approvals & Decisions      ├── Signals & Assessments    ├── Knowledge Base
├── Strategic Goals            ├── Candidates               └── Registries  (hub)
├── Organization Health        ├── Readiness & Pathways
├── Alerts                     ├── Patterns
├── Reports                    └── Recommendations
├── Command Console  (Director)
└── Inbox

Operations                     Workforce                    Governance
├── Executions  (landing)      ├── Overview  (roster)       ├── Overview
├── Timeline                   ├── Agents                   ├── Policies
├── Failures                   ├── Finance  (dept)          ├── Compliance
├── Workflows                  ├── HR  (dept)               ├── Risk
├── Orchestration              ├── Legal  (dept)            ├── Permissions
├── Task Planning              └── Customer Ops  (dept)     ├── Audit
└── Events                                                  └── Explainability

Platform
├── Providers & Runtime
├── Integrations
├── Infrastructure
├── Models & Tools
├── Authentication  (admin)
├── Architecture Map  (advanced)
└── Settings
```

Note: **Registries** is one Level-2 hub in Knowledge; its 15 registries are Level-3 lists inside it, not 15 sidebar items. **Departments** are Level-2 groupings inside Workforce; their 8–9 pages each are Level 3.

---

## 5. Heby Global Access Model

Heby is reached three ways, none of which is a sidebar workspace:

- **Persistent launcher (Level 1).** Always visible; keyboard shortcut. The single global entry to intelligence.
- **Contextual panel (slide-over).** Opens beside the current surface. **Workspace-aware, current-page-aware, selected-object-aware** — it knows you are in Operations looking at execution X, or in Command reading briefing Y, and scopes its context accordingly.
- **Home / full interaction surface.** The front-door surface (route `/heby`) for deep sessions, executive briefings, exploration, decision review — the interaction-model conversation modes. Not the default landing (Command is), but one launcher click away.

Behavior:

- **Command integration.** Heby is strongly present in Command: it renders Director Briefings and prepares approval items — but the **approval act stays in Command's Approvals & Decisions**, never inside Heby.
- **Answer → evidence.** Every element Heby presents links to its underlying product surface (a Level-3 detail): evidence, source, the execution, the agent, the memory record. Heby is a launch point into workspaces, not a dead end.
- **Heby → workspace deep-links.** "Show me in Operations" navigates to the owning surface with context carried.
- **Director authority preserved.** Heby advises/prepares; it never renders an authoritative "approve/execute." A conversational `/approve` produces a *prepared item* handed to Command. Advice is visibly distinct from the act.
- **Mobile.** Heby is a full-screen sheet from a persistent button — the primary mobile route into intelligence when the desktop rail is unavailable.

Navigation and entry points only. No conversation UI, no visual surface designed here.

---

## 6. Command-First Landing Model

**Decision: the default authenticated landing is Command (`/` → `/command`).**

Reasoning:
- Command is the executive operating surface; the primary persona (Director) needs situational overview first — goals, health, alerts, briefings, pending approvals.
- Heby is strongly present *inside* Command (briefings, approval-prep, launcher) but must not *replace* it as the landing: a conversation surface as the front door forces every session to start by typing, when the Director most often needs an at-a-glance state.
- The current shell already lands on Director/dashboard surfaces; Command-first is continuous with existing behavior and routes.
- No repository evidence contradicts this. `TenantContext` supports role-conditioned landing (a non-Director may land on a role-appropriate workspace), which is a refinement, not a blocker.

Heby remains one shortcut away and is the landing *only* if a future Director preference explicitly sets it.

---

## 7. Secondary Navigation Model

For each Level-2 destination: **name · purpose · route concept · persona · in workspace nav? · contextual-only? · Director-only? · admin-only? · Heby available?** (Heby is available on every surface; noted where it is central.)

**Command**

| Name | Purpose | Route | Persona | In nav | Ctx-only | Director-only | Admin-only |
|---|---|---|---|---|---|---|---|
| Overview | Executive cockpit / landing | `/command` | Director | ✓ | – | – | – |
| Briefings | Heby-assembled advisory synthesis | `/command/briefings` | Director | ✓ | – | – | – |
| Approvals & Decisions | The human authority act | `/command/approvals` | Director | ✓ | – | ✓ (act) | – |
| Strategic Goals | Goals & objectives | `/command/goals` | Director | ✓ | – | – | – |
| Organization Health | Health signals | `/command/health` | Director | ✓ | – | – | – |
| Alerts | Critical attention | `/command/alerts` | Director/Operator | ✓ | – | – | – |
| Reports | Executive reports | `/command/reports` | Director | ✓ | – | – | – |
| Command Console | Issue governed action | `/command/console` | Director | ✓ | – | ✓ | – |
| Inbox | What needs the Director | `/command/inbox` | Director | ✓ | – | – | – |

**Intelligence** — Overview `/intelligence` · Insights `/intelligence/insights` · Signals & Assessments `/intelligence/signals` · Candidates `/intelligence/candidates` · Readiness & Pathways `/intelligence/pathways` · Patterns `/intelligence/patterns` · Recommendations `/intelligence/recommendations`. Persona: Director/analyst. All in nav; Heby central (this is advisory, consumed through Heby).

**Knowledge** — Company Memory `/knowledge/memory` · Knowledge Graph `/knowledge/graph` · Knowledge Base `/knowledge/base` · Registries `/knowledge/registries` (hub; each registry `/knowledge/registries/{name}` is Level 3). Persona: all users.

**Operations** — Executions `/operations/executions` (landing) · Timeline `/operations/timeline` · Failures `/operations/failures` · Workflows `/operations/workflows` · Orchestration `/operations/orchestration` · Task Planning `/operations/tasks` · Events `/operations/events`. Offline Execution = contextual within Executions. Persona: Operator/Director.

**Workforce** — Overview `/workforce` · Agents `/workforce/agents` · Finance `/workforce/finance/*` · HR `/workforce/hr/*` · Legal `/workforce/legal/*` · Customer Ops `/workforce/support/*`. Departments are Level-2 groups; their pages Level 3. Persona: dept leads/Director.

**Governance** — Overview `/governance` · Policies `/governance/policies` · Compliance `/governance/compliance` · Risk `/governance/risk` · Permissions `/governance/permissions` · Audit `/governance/audit` · Explainability `/governance/explainability`. Persona: Director/compliance. Permissions = admin-sensitive.

**Platform** — Providers & Runtime `/platform/providers` · Integrations `/platform/integrations` · Infrastructure `/platform/infrastructure` · Models & Tools `/platform/models` · Authentication `/platform/auth` (admin) · Architecture Map `/platform/architecture` (advanced) · Settings `/platform/settings`. Persona: operator/admin.

---

## 8. Contextual / Drill-Down Navigation Model (Level 3)

Level 3 is reached by acting on a Level-2 surface (row click, "view", Heby deep-link), **not** from the sidebar. Contextual destination **classes**:

1. Entity detail (record view for any registry/domain object)
2. Evidence / source view (provenance drill-down)
3. Agent detail
4. Execution run detail
5. Workflow run detail
6. Task detail
7. Event detail
8. Decision detail
9. Approval item detail
10. Audit entry detail
11. Memory record detail
12. Knowledge node detail
13. Policy / permission-set detail
14. Provider / integration config detail
15. Report detail

**Rule:** none appears in Level 1 or Level 2. They own breadcrumb + back + Heby-context, and are deep-linkable (Heby and notifications route straight to them).

---

## 9. Global Controls Model

Conceptual placement (Level 1, top bar / global region). Visuals not designed here.

| Control | Placement | Notes / evidence |
|---|---|---|
| Global search | Top bar (exists, `disabled`) | Cross-workspace; becomes a real index later |
| Command palette (⌘K) | Global keyboard-first | Jump to any workspace/surface/action; Heby-adjacent |
| Heby launcher | Persistent, prominent | Section 5; not in the seven |
| Notifications | Top bar (exists, `disabled`) | System/attention feed |
| Approvals-attention | Distinct indicator | Counts pending items; deep-links to `/command/approvals` |
| Org/tenant selector | Global | **Multi-tenant confirmed** (`TenantContext.organizationId`); switch scope |
| Account / user | Global menu | Identity, sign-out |
| Settings access | Via account + Platform/Settings | Global entry + full surface in Platform |
| System status | Optional, subtle | Aggregate ops health (from diagnostics read-models) |

---

## 10. Role-Based Navigation Matrix

Four roles. **Visible / Restricted / Contextual.** Enforcement is server-side (`TenantContext.roleId` + `permissionSummary` + `assuranceLevel`); this matrix is **visibility convenience only**.

| Workspace | Director / Exec | Operator / Manager | Specialist / Dept | Administrator |
|---|---|---|---|---|
| Command | Visible (full) | Visible (no Console/Approvals act) | Restricted | Visible (no act) |
| Intelligence | Visible | Visible | Contextual (role-scoped) | Visible |
| Knowledge | Visible | Visible | Visible (scoped) | Visible |
| Operations | Visible | Visible (primary) | Contextual (own work) | Visible |
| Workforce | Visible | Visible | Visible (own dept only) | Visible |
| Governance | Visible | Read (compliance subset) | Restricted | Visible (permissions/auth) |
| Platform | Read/advanced | Restricted | Restricted | Visible (primary) |

Heby behavior by role: **role-appropriate scope and depth.** Same advisor, bounded by the person's authorized context; a Specialist's Heby sees only their department context; only the Director's Heby prepares approvals for the Director's act.

**Director-only surfaces:** Command Console, Approvals & Decisions (the act). **Admin-only:** Authentication config, Permissions management, most of Platform. **Hiding is not denial** — a hidden surface hit directly is still refused by the server.

---

## 11. Domain / Department Navigation Strategy

- Finance, HR, Legal, Customer Ops are **Level-2 department sub-spaces inside Workforce**, never top-level.
- A department sub-space contains its own Level-3 pages (invoices, candidates, contracts, tickets…) and its agents.
- **Domain packs / industry packs** (future marketplace) **install into Workforce** as new department sub-spaces — no top-level change, no shell restructure.
- This is the growth valve: 3 departments or 30, the top level stays seven. Marketplace itself is a surface within Workforce, not a workspace.

---

## 12. Canonical Route Namespace

```text
/                         → redirect → /command        (default landing)
/command/…                Command
/intelligence/…           Intelligence
/knowledge/…              Knowledge  (incl. /knowledge/registries/{name})
/operations/…             Operations
/workforce/…              Workforce  (incl. /workforce/{finance|hr|legal|support}/…)
/governance/…             Governance
/platform/…               Platform   (incl. /platform/architecture, /platform/auth)
/heby                     Heby home surface  (panel is an overlay, not a route)
/_internal/…              Internal-only  (unchanged, off-nav)
```

One namespace segment per workspace; departments and registries nest; Heby home is a route while the ambient panel is an overlay. Clean, guessable, stable.

---

## 13. Existing Route Migration Strategy

Dispositions for today's ~110 routes (patterns):

- **Keep (rename to namespace):** `/director`→`/command`, `/director/goals`→`/command/goals`, `/director/reports`→`/command/reports`, `/director/knowledge-graph`→`/knowledge/graph`, `/knowledge`→`/knowledge/base`, `/workflows`→`/operations/workflows`, `/events`→`/operations/events`.
- **Redirect:** `/dashboard`→`/command`, `/director/memory` & `/memory`→`/knowledge/memory`, `/approvals` & `/director/governance/approvals`→`/command/approvals` (act) with governance cross-link.
- **Merge:** `/director/execution-center/*` + `/director/executions` + `/director/execution` + `/director/offline-execution`→`/operations/executions` (one monitor + drill-downs). Provider framework/matrix/routing/invocation + per-provider + `/infrastructure/*`→`/platform/providers` + `/platform/infrastructure`.
- **Demote to contextual (Level 3):** all `/director/registries/{name}`→`/knowledge/registries/{name}` (inside hub); per-agent pages→`/workforce/agents/{id}`; per-record detail routes.
- **Retire:** placeholder-only sections with no capability (top-level `Governance` placeholder duplicate, `Marketplace` until built, dead `/infrastructure` mirrors of providers).
- **Internal-only:** `/_internal/*`, all shadow/dual-read, persistence, projections — never navigable.
- **New:** `/heby` and all Heby surfaces (none exist today).

No implementation here — strategy only.

---

## 14. Current Sidebar Migration Table

Every current entry gets a disposition — **KEEP · MOVE · MERGE · DEMOTE · HIDE · RETIRE · REDIRECT.**

| Current section / entry | → Workspace | → Level | Action |
|---|---|---|---|
| Director › Executive Overview, Dashboard | Command | L2 Overview | MERGE/REDIRECT |
| Director › Goals, Org Health, Alerts, Insights, Recommendations, Reports | Command (insights/recs → Intelligence) | L2 | MOVE |
| Director › Execution group (center/timeline/graphs/failures/active) | Operations | L2 Executions | MERGE |
| Director › Intelligence group | Intelligence | L2 | MOVE |
| Director › Registry Center + 15 registries | Knowledge › Registries | L2 hub + L3 | DEMOTE |
| Director › Knowledge Graph, Company Memory | Knowledge | L2 | MOVE |
| Director › Cognitive & Control Chain (reasoning, policy, planning, task, orchestration, execution, adapters) | Ops (planning/orchestration/exec) + Governance (policy) + internal (reasoning) | L2/hidden | MOVE/HIDE |
| Director › Providers & Runtime group | Platform › Providers | L2 | MERGE |
| Director › Governance group (8) | Governance | L2 | MOVE |
| Director › Workspace (Command Console, Live Org, Inbox, Weekly Insights, Approvals) | Command | L2 | MOVE |
| Architecture & Orchestration › AI OS cores/engines/registries/flow | Platform › Architecture Map | L2 advanced | MOVE |
| Architecture › Runtime (director/planner/orchestrator/workflow/event/state/memory/agent/lifecycle/context) | Operations + internal | L2/hidden | MOVE/HIDE |
| AI Workforce (all departments/agents) | Workforce | L2/L3 | MOVE |
| Customer Operations (tickets, KB) | Workforce › Customer Ops (KB → Knowledge) | L2/L3 | MOVE |
| Finance Center (8) | Workforce › Finance | L2 dept + L3 | MOVE |
| HR Center (9) | Workforce › HR | L2 dept + L3 | MOVE |
| Legal Center (9) | Workforce › Legal | L2 dept + L3 | MOVE |
| Infrastructure (10) | Platform › Infrastructure | L2 | MOVE |
| Governance (placeholder, 6) | Governance | L2 | MERGE/RETIRE dup |
| Learning (5) | Intelligence (org-learning) / Workforce-HR / Knowledge | L2/L3 | MOVE (split) |
| Marketplace (placeholder, 5) | Workforce (future pack surface) | L2 later | RETIRE until built |
| Integrations (overview + 4) | Platform › Integrations | L2 | MOVE |
| `/_internal/*` | — | — | HIDE (internal) |
| *(Heby — absent)* | Heby layer + `/heby` | L1 launcher + home | NEW |

Result: 12 sections → 7 workspaces + Heby launcher; every entry dispositioned.

---

## 15. Duplicate-Resolution Rules

One primary navigation home each; contextual links elsewhere.

| Risk | Primary home | Contextual link |
|---|---|---|
| Director vs Command | **Command** (Director = persona/authority concept, not a nav bucket) | — |
| Approvals vs Governance | Act → **Command/Approvals**; rules+audit → **Governance** | Governance ↔ Command |
| Decisions vs Approvals | **Command/Approvals & Decisions** (one surface) | Audit trail in Governance |
| Knowledge vs Memory | **Knowledge/Company Memory** | — |
| Intelligence vs Reasoning | **Intelligence** (Reasoning = internal engine, no nav) | — |
| Operations vs Execution | **Operations/Executions** (one monitor) | Execution registry = Knowledge reference |
| Workforce vs Agents | **Workforce/Agents** | Agent registry = Knowledge reference |
| Platform vs Architecture | **Platform** (Architecture Map = advanced surface within) | — |
| Platform vs Integrations | **Platform/Integrations** | — |
| Governance vs Security | **Governance** (auth *config* → Platform) | Platform ↔ Governance |
| Audit across workspaces | **Governance/Audit** | Per-record history in situ |

---

## 16. Desktop Navigation Behavior (≥ 1280)

- **Level 1** persistent (workspace rail + Heby launcher + global controls). Current shell reserves `lg:pl-(--sidebar-w)` — the space exists.
- **Level 2** shown for the active workspace (panel/column beside the rail). Entering a workspace shows its Level-2 set; active destination is `aria-current`.
- **Expanded/collapsed:** Level-1 rail may collapse to icons; Level-2 open/closed state persists (existing `use-sidebar-state` localStorage pattern extends naturally).
- **Workspace switching:** click a rail icon → switch workspace → Level-2 swaps → land on the workspace's landing surface.
- **Level 3** opens in the content area (not the rail), with breadcrumb + back.

---

## 17. Tablet Navigation Behavior (~768)

- **Level 1** collapses to an **icon rail** (workspace switch + Heby launcher + a controls overflow).
- **Level 2** becomes an **overlay/drawer** triggered from the active workspace icon — not a permanent column.
- **Heby** panel opens as a slide-over (as desktop).
- **Level 3** full-width in the content area.

---

## 18. Mobile Navigation Behavior (~375)

Do **not** reproduce the desktop sidebar (the current mobile drawer replays the full accordion — the wrong model at scale).

- **Workspace switching:** a bottom bar or a switcher sheet exposing the seven — not a nested tree.
- **Workspace secondary nav:** a **sheet** listing Level-2 for the chosen workspace; tap to navigate, sheet dismisses.
- **Heby access:** a **persistent button → full-screen Heby sheet.** On mobile Heby is the primary intelligence entry (typing/asking beats deep tree-walking on a phone).
- **Contextual drill-down:** full-screen push with back.
- **Approvals/attention:** a badge on the bottom bar / Heby button, deep-linking to `/command/approvals`.

---

## 19. Scalability Stress Test

| Growth vector | Absorbed by | Top-level impact |
|---|---|---|
| 100+ routes | Level 3 (never in rail) | None |
| 50+ capabilities | Distributed across 7 workspaces as L2/L3 | None |
| 20+ agents | `Workforce/Agents` list (data, not nav) | None |
| Many departments | Workforce department sub-spaces / packs | None |
| Multiple tenants/orgs | Global org selector (`TenantContext.organizationId`) | None |
| Hundreds of events | `Operations/Events` filtered list | None |
| Many approvals | `Command/Approvals` filtered queue + attention badge | None |
| Marketplace / extensions | Surface within Workforce | None |
| Domain / industry packs | Installable Workforce sub-spaces | None |

**Result: no growth vector requires a new top-level item.** The seven-workspace top level is stable by construction.

---

## 20. Accessibility / Navigation Requirements

- Keyboard-navigable at all three levels; workspace switch and Heby launcher have shortcuts; command palette is keyboard-first.
- `aria-current` on the active workspace and destination; ARIA landmarks for nav/main/complementary (Heby panel).
- Focus management on overlays/drawers/Heby panel — trap + restore (the current mobile drawer already traps focus; extend that pattern).
- Skip-to-content link; visible focus rings (topbar already uses `focus-visible` rings).
- Attention/notification state exposed to assistive tech (`sr-only` counts), not color-only.
- Respect reduced-motion for panel/drawer transitions.

---

## 21. Security / Governance Implications

- **Visibility ≠ authorization.** Every hidden/role-scoped item is still enforced server-side via `TenantContext.roleId`, `permissionSummary`, `assuranceLevel`, `mfaVerified`. Hitting a hidden route directly is refused below the UI.
- **Elevated surfaces.** Command Console and Approvals & Decisions (the act) require elevated assurance; the UI reflects, never grants, that requirement.
- **Tenant/org isolation** is immutable; the org selector switches scope but never blends tenants; no cross-tenant leakage through navigation state.
- **Heby preserves the boundary** in navigation too: it links to evidence and prepares items, but the authoritative act is reached only through Command.
- **Audit** of navigation-triggered actions belongs to Governance/Audit; the record is not rewritten, only superseded.

---

## 22. Director Gates — Resolved

No evidence blocks any gate; all resolved as directed.

1. **Default landing → Command-first.** (Section 6.)
2. **Naming → "Command" is the product workspace; "Director" stays the authority/persona concept.**
3. **Finance/HR/Legal → not top-level;** department sub-spaces inside Workforce. (Section 11.)
4. **Non-Director users → role-appropriate reduced navigation.** (Section 10.)
5. **Registries → Knowledge primary home;** contextual links from Operations/Workforce where operationally relevant.
6. **Architecture Map → Platform, advanced/admin surface,** not primary product navigation.

**Remaining (non-blocking) unresolved decisions:**
- (a) Role-conditioned landing for non-Directors (which workspace does an Operator land on?).
- (b) Exact Level-1 breakpoint — keep `lg` (1024) or move Level-2 permanence to `xl` (1280)?
- (c) Whether the org/tenant selector is always visible or only for multi-org identities.
- (d) Whether Command "Overview" and Heby "home" ever merge for a Heby-first Director preference.

---

## 23. Implementation Constraints for the Future App Shell

Binding constraints for whoever builds the shell (not built here):

1. Three-level model is structural: Level 1 (rail + Heby + controls), Level 2 (per-workspace), Level 3 (content area). Level 3 must never write to the rail.
2. Navigation config must be **role-filterable** but must **not** be the authorization mechanism — server enforcement is authoritative.
3. Heby launcher and panel are shell-level, not workspace-level — available on every route.
4. One route namespace segment per workspace (Section 12); departments/registries nest.
5. Level-2 open/expanded state persists per user (extend existing `use-sidebar-state`).
6. Org/tenant selector reads `TenantContext`; switching re-scopes, never blends.
7. Mobile is a distinct model (switcher sheet + Heby full-screen), not a re-rendered desktop tree.
8. Attention/approvals state is a first-class shell concern, deep-linking into Command.
9. Adding a capability = adding an L2/L3 destination inside an existing workspace — **never** a new top-level entry for normal growth.

---

## 24. Compact Final Hierarchy (navigation feel — NOT implementation)

```text
Hebun  ── landing: Command
│
│  [ Level 1: Command · Intelligence · Knowledge · Operations · Workforce · Governance · Platform ]
│  [ Global: Heby launcher · search · ⌘K · notifications · approvals · org selector · account ]
│
├── Command        Overview · Briefings · Approvals & Decisions · Goals · Health · Alerts · Reports · Console* · Inbox
├── Intelligence   Overview · Insights · Signals · Candidates · Readiness/Pathways · Patterns · Recommendations
├── Knowledge      Company Memory · Graph · Base · Registries▸
├── Operations     Executions · Timeline · Failures · Workflows · Orchestration · Tasks · Events
├── Workforce      Overview · Agents · Finance▸ · HR▸ · Legal▸ · Customer Ops▸
├── Governance     Overview · Policies · Compliance · Risk · Permissions · Audit · Explainability
└── Platform       Providers · Integrations · Infrastructure · Models & Tools · Auth* · Architecture Map · Settings

   Heby  ── ambient: launcher (everywhere) · contextual panel (page/object-aware) · home /heby
   ▸ = expands to Level-3    * = Director/admin-elevated
   Level 3 (never in rail): entity · evidence · agent · execution · event · decision · approval · audit · record · config
```

---

## 25. Validation

- **One primary home per capability** — Section 15; no duplicate nav homes.
- **No backend module becomes navigation by existing** — internal list (IA §4) stays off-nav; reasoning/persistence/projections hidden.
- **Top level compact** — 7 workspaces + Heby launcher; stable under Section 19 stress test.
- **Heby globally accessible, not a bucket** — launcher + panel + home (Section 5).
- **Command owns the Director operating surface** — Section 7; Console + Approvals act are Command/Director.
- **Governance owns governance/security policy surfaces** — Section 15; auth config split to Platform.
- **Human approval act stays Command/Director-owned** — Sections 7, 15, 21.
- **Platform is not a dumping ground** — bounded to providers/integrations/infra/models/auth-config/architecture/settings; each a coherent admin concept.
- **Contextual destinations don't pollute primary nav** — Section 8.
- **Role model ≠ authorization** — Sections 10, 21; server enforces.
- **Desktop/tablet/mobile coherent** — Sections 16–18.
- **Every current sidebar entry has a disposition** — Section 14.
- **Every existing route has a migration strategy** — Sections 12–13.
- **Future growth needs no sidebar explosion** — Section 19.

---

## 26. Final Report

- **Final workspace order.** Command · Intelligence · Knowledge · Operations · Workforce · Governance · Platform (+ ambient Heby launcher).
- **Primary navigation entries (Level 1).** 7 workspaces + 1 Heby launcher = 8 persistent entries; global controls separate.
- **Secondary destinations (Level 2).** ~50 across the seven workspaces (Command 9 · Intelligence 7 · Knowledge 4 · Operations 7 · Workforce 6 · Governance 7 · Platform 7), plus the Heby home.
- **Contextual-only destination classes (Level 3).** 15 (Section 8).
- **Heby access decision.** Ambient — persistent launcher + context-aware panel + `/heby` home; never an eighth workspace; approval act excluded from Heby.
- **Default landing decision.** Command-first (`/` → `/command`); Heby one shortcut away.
- **Role-navigation summary.** 4 roles (Director/Exec, Operator/Manager, Specialist/Dept, Administrator) × 7 workspaces visibility matrix; Director-only = Console + Approvals act; admin-only = Auth/Permissions/Platform; visibility ≠ authorization (enforced via `TenantContext`).
- **Route migration summary.** One namespace segment per workspace; keep/rename, redirect, merge (execution×9, providers), demote registries+agents to L3, retire placeholders, hide `/_internal` + plumbing, add `/heby`.
- **Current sidebar migration summary.** 12 sections → 7 workspaces + Heby; every entry dispositioned (Section 14).
- **Major duplicate resolutions.** Director→Command; Approvals act→Command / rules+audit→Governance; Memory→Knowledge; Reasoning→internal; Execution×9→Operations; Agents→Workforce; Architecture→Platform; Integrations→Platform; Security→Governance (auth config→Platform).
- **Responsive model.** Desktop: rail + Level-2 column + Level-3 content. Tablet: icon rail + Level-2 drawer. Mobile: switcher sheet + Level-2 sheet + full-screen Heby + attention badge (not a re-rendered desktop tree).
- **Unresolved decisions.** Role-conditioned landing for non-Directors; Level-1 breakpoint (`lg` vs `xl`); org-selector always-on vs multi-org-only; optional Heby-first landing preference.
- **File created.** `docs/product-vision/ui/hebun-navigation-architecture.md`. No source code, `sidebar.config.ts`, or routes modified. No commit, tag, or push.

---

**DOCUMENT STATUS: NAVIGATION ARCHITECTURE ONLY — NO IMPLEMENTATION**
