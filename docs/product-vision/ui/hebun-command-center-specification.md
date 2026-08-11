# Hebun — Director Command Center Specification

## Document Status

**DOCUMENT TYPE: PRODUCT VISION — UI PHASE 6A — DIRECTOR COMMAND CENTER ARCHITECTURE & SCREEN SPECIFICATION**

**STATUS: DISCOVERY + PRODUCT ARCHITECTURE + SCREEN SPECIFICATION ONLY — NO IMPLEMENTATION**

This document defines what `/command` must become before any Command Center visual implementation begins. It writes no components, no routes, no application code, and introduces no data. It is derived from the **real** Hebun platform — its read models, Runtime contracts, Heby Core boundaries, governance/authority model, and existing Director surfaces — not from a generic SaaS dashboard.

Layer separation held: System → Capabilities → IA → Navigation → Design System → **App Shell (Phase 5, shipped)** → **Command Center Specification (this document)** → Command Center Implementation (Phase 6B, later).

It is subordinate to the four UI authority documents (`hebun-capability-inventory.md`, `hebun-information-architecture.md`, `hebun-navigation-architecture.md`, `hebun-design-system-foundation.md`), the Heby Vision/Architecture/Interaction Model, the Organizational Intelligence Runtime, and the Director authority model. Where it conflicts with a canonical source, the canonical source governs.

**Discovery basis:** branch `main`, HEAD `b4ba8c8` (`Complete Hebun UI Phase 5 App Shell`), `HEAD == origin/main`, 0 ahead / 0 behind, tracked tree clean (only pre-existing untracked docs). Phase 5 App Shell published (`hebun-ui-phase-5-app-shell-complete`, annotated). Heby Core Phases 1–9 published (9 tags). Read from disk: the four UI authority docs; `director-dashboard-*` read models; widget runtime; `enterprise-projection-providers` + `enterprise-runtime-composition`; `human-approval`; `director-command`; `enterprise-organizational-intelligence-runtime`; `goal-runtime`; `heby-core`; and the existing `/command`, `/dashboard`, `/director`, `/director/goals`, `/director/alerts`, `/director/organization`, `/approvals` surfaces.

---

## 1. Discovery Findings

### 1.1 Repository / publication state
- Phase 5 App Shell is live: seven-workspace rail + Level-2 nav + ambient Heby launcher/panel; `/command` currently renders a **structural landing** (`WorkspaceLanding` + "Command Center — coming in a later phase" note + destination cards to existing surfaces). This landing is the placeholder this phase replaces.
- Heby Core Phases 1–9 published and **untouched**. Organizational Intelligence Runtime **untouched**.

### 1.2 The one genuinely data-backed Director pipeline
`/dashboard` → `getDirectorDashboardUiModel()` (`director-dashboard-ui/adapter.server.ts`) → **widget runtime** → `director-dashboard-data` read models. This is the only Director surface with a real, load-bearing read-model pipeline. Its shape:

- **Read models** (`director-dashboard-data/types.ts`): `runtimeOverview`, `agentOverview`, `workflowOverview`, `monitoringSummary`, `healthSummary`, `diagnosticsSummary`, `evaluationSummary`, `authenticationSummary`. Every snapshot carries `completeness` (EvidenceCompleteness), `sourceVersions`, `projectionVersion`, and `authoritative: false`.
- **Executive Overview** (`director-dashboard-executive-overview`): folds eight **system sections** — platform-status, runtime-status, active-agents, active-workflows, monitoring-summary, diagnostics-summary, evaluation-summary, authentication-summary — into `organizationHealth = worst(section health)` over states `healthy | unknown | warning | unavailable | critical`, plus `criticalAlertCount`, `warningCount`, `unavailableCount`, and `freshness (fresh|stale|unknown)`. Marked `authoritative: false`.
- **Executive Insights** (`director-dashboard-executive-insights`): deterministic, template-built insights derived from overview sections; severity reuses the overview health states; each carries `evidenceCount`, `evidenceSource` (widget id), `recommendedAction`, `reasonCode`. Never free-form text. `authoritative: false`.

**Decisive fact:** what the platform can authoritatively compute today as "organization health" is **system/operational health** (platform, runtime, monitoring, diagnostics, evaluation, auth) plus **agent/workflow activity states** — not strategic/business health. Widget states are honest about absence: `loading | ready | empty | unavailable | failed`, and empty ≠ healthy.

### 1.3 The mock-projection surfaces (real contracts + real load path, synthetic data)
`/director`, `/approvals`, `/director/organization`, `/knowledge` load via `getActiveEnterpriseProjectionProvider()` → `enterprise-application-services` `load*Projection(unitOfWork)`. The composition root can be Postgres-backed, but no real business data is populated; the pages self-label **"Mock projection"**, and `/approvals` states outright: *"prepares and records local simulated Director intent only. It does not make decisions, persist approvals, start workflows, or execute enterprise actions."*

Covered projections: `getDirectorWorkspaceProjection` (statusMetrics, dailyBrief, priorities, decisions, recommendations, timeline, knowledge), `getEnterpriseIntelligenceProjection` (domainHealth, overall, signals, unifiedHealth, contexts), `getDecisionProjection` (overview, decisions, attentionSignals, relationships, suggestions), `getOrganizationProjection`, `getKnowledgeProjection`, `getHebyContextProjection`, `getTimelineProjection`. **Real shape, non-authoritative synthetic data.**

### 1.4 Pure-mock surfaces
`/director/goals` (`strategicGoals` from `@/features/director/mock`) and `/director/alerts` (`criticalAlerts` from `@/features/director/mock`) are static mock arrays with no projection path.

### 1.5 Contracts/engines with no Director-facing populated read model
- **OI Runtime** (`enterprise-organizational-intelligence-runtime`): `RuntimeCandidate`, `RuntimeApproval`, `RuntimeConfidence`, `RuntimeArtifact`, candidate kinds, confidence levels, approval states, lifecycle states, restrictions, stages, failure kinds. Real advisory contracts; no populated Director candidate/signal stream surfaced.
- **director-command** (phase-4b…4e): command dispatcher, execution pipeline/session, permit lifecycle, risk classification, human-approval runtime, policy, authority identity/request. Engine/contract layer; the "Command Console" concept lives here. No populated command feed.
- **human-approval**: approval-policy/resolver/validator/history/telemetry/report/engine; statuses `approved|rejected|changes-requested|pending`; risk `critical|high|medium|low`. Engine + badges; approvals **data** is simulated (see 1.3).
- **goal-runtime**: goal types + service; no Director read model populated.
- **Heby Core**: deterministic boundary/rules/normalization/validation modules for approval, briefing, composition, governance, grounding, identity, input-context, intent, presentation. **No model call, no live conversation, no data pipeline** — these are enforced behaviors, not a surface.

### 1.6 Consequence for Command
Command must be built as the **real architecture with honest states**: one region is genuinely data-backed today (System/Operational Status + derived Insights); the rest must render as **honest empty / "not yet available"** rather than fake numbers. No fabricated health score, risk score, agent count, revenue, or alert.

---

## 2. Command Center Mission

The Director Command Center is the Director's **operating surface across Hebun**: the single place that prioritizes what the Director must attend to, decide, and understand — and routes them into the owning workspace to act.

It answers, in priority order derived from repository evidence:
1. **What requires a human decision?** (pending approvals / decision pressure)
2. **What requires my attention now?** (critical/warning system + governance-blocked items)
3. **What is the state of the organization?** (system/operational health today; business health when real)
4. **What is running and what is stuck?** (executions, agents, workflows, human gates)
5. **What changed and why does it matter?** (significant changes + Heby explanation)
6. **What should I investigate next?** (advisory signals/recommendations, when real)

It is **not**: a BI dashboard, an architecture dashboard, a metric wall, a chatbot, an agent control panel, an approval queue, a monitoring dashboard, or a generic executive dashboard. It **summarizes and prioritizes**; the owning workspace **investigates and manages**.

The Command Center does **not** exercise authority by itself: it surfaces decision pressure and previews items, but the authoritative approve/execute act happens on the dedicated decision surface (Command Approvals & Decisions), never inline and never in Heby.

---

## 3. Director Mental Model

The Director opens Command and reads it top-to-bottom as a **pressure gradient**:

> *"Is anything waiting on me? → Is anything on fire? → Is the machine healthy? → What's running? → What changed? → What should I look into?"*

Two registers coexist (per design foundation §1): the **attention/decision band is dense and cockpit-like**; everything below is **calmer, summarizing**. Command is a **launch point**, not a workbench — every region ends in a drill-down into the owning workspace.

Honesty is load-bearing: the Director must be able to trust that a quiet Command means *quiet*, and that an empty region means *no evidence*, not *hidden failure*. Non-authoritative and synthetic data must be visibly marked.

---

## 4. Attention Hierarchy

Five priority tiers. Terminology anchors to existing Runtime/Overview semantics (`critical|unavailable|warning|unknown|healthy`; approval `pending`; risk `critical|high|medium|low`; governance `blocked/restricted`). These must **not** collapse into one generic notification feed.

| Tier | Meaning | Real source today | Examples |
|---|---|---|---|
| **P0 — Immediate intervention** | Something is broken or governance-blocked and needs the Director now | Executive Overview `critical` / `unavailable` sections; Heby governance-blocked presentation | platform/runtime critical; auth failure; governance block |
| **P1 — Decision required** | A human authority act is pending | human-approval `pending` (data mock today); OI Runtime `RuntimeApproval` awaiting (not-yet) | approval pending; decision awaiting Director |
| **P2 — Important change / risk / opportunity** | Material change the Director should know | Overview `warning`; significant-change deltas (derivable); risk (not-yet real) | degraded section; new significant signal |
| **P3 — Operational awareness** | Live work worth a glance | agent/workflow/execution states (real states, data sparse) | running executions, agents active/waiting |
| **P4 — Background information** | Reference / context | freshness, source versions, counts | last refreshed, evidence completeness |

**Type separation (never merged into one feed):** `alert` (system health event) · `risk` (governance-owned classification) · `opportunity` (advisory, OI) · `recommendation` (advisory, OI/Heby) · `briefing` (Heby-composed synthesis) · `approval` (pending authority act) · `decision` (recorded act) · `governance block` (enforcement) · `uncertainty` (confidence/evidence grammar) · `agent activity` (workforce state) · `execution state` (operations) · `informational update` (background). Each has its own visual grammar (design foundation §11–14).

The Command Center maps **attention tiers → screen regions**, not attention tiers → one list.

---

## 5. Screen Information Architecture

Regions are derived from **information priority + real provenance**, not from cards. Section 7 specifies each region fully. The candidate set (A–M from the brief) is dispositioned here:

| Cand. | Region | Disposition | Rationale |
|---|---|---|---|
| A | **Director Attention / Needs You** | **ACCEPT — primary** | The Director's first question; composed from P0/P1 across real system health + (mock) approvals. |
| D | **Decision Pressure (Approvals summary)** | **ACCEPT — merged into Attention + own strip** | Decision act is Command-owned; summary here, act on the dedicated decision surface. |
| C | **System / Operational Status** (was "Organization Health") | **ACCEPT — renamed** | Only genuinely data-backed health today (Executive Overview). Named honestly. |
| H/I | **Operational Pulse** (executions + agents + workflows) | **ACCEPT — merged** | Real states from widget runtime; one summary strip, drill to Operations/Workforce. |
| B | **Executive Briefing** | **ACCEPT — as Heby-composed, honest-empty** | Heby Core has briefing boundaries; no live composer yet → render "no briefing available." |
| K | **Recent Significant Changes** | **ACCEPT — derivable, below fold** | Composable from freshness/version deltas of real read models. |
| J | **Governance / Security Blocks** | **ACCEPT — folded into Attention (P0)** | Governance block is a P0 attention type, not a standing widget. |
| M | **Heby contextual advisory** | **ACCEPT — ambient, not a region** | Heby is the shell launcher + panel + inline "why", per Phase 5 + §6. |
| E | **Risks** | **DEMOTE — Governance-owned; link only** | No real risk read model for Director; Governance owns it. Surface only when real. |
| F | **Opportunities** | **DEFER — NOT YET AVAILABLE** | Requires OI Runtime candidate stream; not populated. |
| G | **Strategic Goals** | **DEMOTE — Command owns, but mock** | Goals are Command cockpit material but pure mock today → honest-empty summary + link. |
| L | **System / Integration Health** | **MERGE into System/Operational Status** | Already inside Executive Overview sections (platform/auth/integration). |

**Final Command regions (in priority order):**
1. Command Header (context + freshness + honesty markers)
2. **Director Attention** (P0/P1: system-critical + governance-blocked + decision pressure) — primary
3. **Decision Pressure** strip (pending approvals summary → decision surface)
4. **System / Operational Status** (Executive Overview: 8 sections + folded state) — real
5. **Operational Pulse** (executions / agents / workflows summary) — real states
6. **Executive Briefing** (Heby-composed; honest-empty today)
7. **Recent Significant Changes** (derivable; below fold)
8. **Strategic Goals** summary (Command-owned; honest-empty/mock-marked; below fold)
9. Ambient **Heby** (launcher + panel + inline "why") — not a boxed region

---

## 6. Above-the-Fold Architecture (1280px)

The first viewport must communicate **decision pressure → attention → organization state** without scrolling, and must not be filled with decorative metrics. Target 4–6 meaningful regions above the fold.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ COMMAND HEADER   "Command · {org}"        freshness · last refreshed · state │  (full width, ~56px)
├───────────────────────────────────────────────────────────────────────────┤
│ DIRECTOR ATTENTION (primary)                        │ DECISION PRESSURE      │
│ P0/P1 items: system-critical · governance-blocked · │ pending approvals      │
│ decision-required — labeled, prioritized list       │ count + top item(s) →  │
│ (empty state: "Nothing requires your attention")    │ decision surface       │
│  ~ 8 columns                                        │  ~ 4 columns           │
├───────────────────────────────────────────────────────────────────────────┤
│ SYSTEM / OPERATIONAL STATUS   (Executive Overview: folded state + 8 sections)│
│ status strip: platform · runtime · agents · workflows · monitoring · diag ·  │
│ evaluation · auth   — each a labeled health chip (not a gauge)               │  (full width)
├───────────────────────────────────────────────────────────────────────────┤
│ OPERATIONAL PULSE  executions · agents · workflows  (compact summary rows)   │  (fold line near here)
└───────────────────────────────────────────────────────────────────────────┘
   Below fold: Executive Briefing · Recent Significant Changes · Strategic Goals summary
```

- **Primary region:** Director Attention (top-left, largest). If empty, it collapses to a confident empty state and System/Operational Status rises.
- **Secondary:** Decision Pressure (top-right).
- **Tertiary:** System/Operational Status strip (full width).
- **Below fold:** Operational Pulse detail, Briefing, Recent Changes, Goals.
- **Never on Command:** raw tables, per-record detail, orchestration plumbing, architecture cores, provider config, full registries, charts-for-decoration.

---

## 7. Region-by-Region Specification

For each region: purpose · shown · source/domain · why on Command · Director action · drill-down · refresh · empty · loading · blocked/restricted · confidence/uncertainty · Heby.

### 7.1 Command Header
- **Purpose:** orient + set honesty frame.
- **Shown:** "Command · {organization}"; overall state token (from Executive Overview `organizationHealth`); freshness (`fresh|stale|unknown`) + `refreshedAt`; a non-authoritative marker when the view includes synthetic projections.
- **Source:** Executive Overview `freshness`, `organizationHealth`; TenantContext org.
- **Why on Command:** frames everything below; single source of "as of".
- **Action:** none (informational); Heby "why this state?".
- **Drill-down:** none.
- **Refresh:** on load; stale badge when `ageSeconds > threshold`.
- **Empty/Loading:** skeleton header; "state unknown" when overview unavailable.
- **Blocked/Restricted:** if org context unavailable → "Organization context unavailable" (do not invent org name).
- **Confidence:** overall token is `authoritative: false` — never styled as a guaranteed fact.
- **Heby:** header carries an inline "Ask Heby about this state" affordance.

### 7.2 Director Attention (primary, P0/P1)
- **Purpose:** the one place that says *what needs you now*.
- **Shown:** a prioritized, **typed** list of P0/P1 items — each with type badge (alert · governance-block · decision-required), label, one-line consequence, severity, source chip, timestamp. No raw payloads.
- **Source:** Executive Overview `critical`/`unavailable` sections + `criticalAlertCount`/`warningCount` (REAL); Heby governance-blocked presentation notices (REAL boundary, honest-empty); pending approvals summary (human-approval; **data mock** → marked).
- **Why on Command:** the Director's first question; aggregates across domains that individually live elsewhere.
- **Action:** click item → drill to owning surface; Heby "why does this matter?".
- **Drill-down:** system item → `/dashboard` section (later `/platform` or `/operations`); governance block → `/governance`; decision → decision surface.
- **Refresh:** with overview snapshot; attention count exposed to shell attention badge.
- **Empty:** confident, deliberate empty — "Nothing requires your attention right now." (This is a *feature*, not a blank.)
- **Loading:** shimmer rows.
- **Blocked/Restricted:** if a source is governance-suppressed, show a "withheld" notice (hatch/lock), never the content.
- **Confidence/uncertainty:** items derived from non-authoritative sources carry the non-authoritative marker; uncertain items use the `~`/evidence grammar.
- **Heby:** inline "why" per item; panel opens with evidence/source/assumptions within Heby's authority boundary.

### 7.3 Decision Pressure (P1 strip)
- **Purpose:** show human-decision load at a glance; route to the act.
- **Shown:** pending-approval count by risk (`critical|high|medium|low`), top 1–3 subjects with risk badge + "requires your approval" marker. **No approve control here.**
- **Source:** human-approval (statuses/risk REAL; **data simulated** → "simulated intent" marker).
- **Why on Command:** decision boundary is Command-owned (IA §7).
- **Action:** "Review decisions" → dedicated decision/approval surface (where the act lives).
- **Drill-down:** `/approvals` (Enterprise Decision Center) → later `/command/approvals`.
- **Empty:** "No decisions are waiting on you."
- **Loading/Blocked:** standard; restricted role → count only, no subjects.
- **Confidence:** approvals are simulated today → explicit "simulated / not persisted" band.
- **Heby:** may **prepare** and explain an item; may **never** approve. Advisory band "Prepared for your decision" is visibly not the act.

### 7.4 System / Operational Status (real)
- **Purpose:** honest health of the running platform.
- **Shown:** 8 section chips (platform, runtime, agents, workflows, monitoring, diagnostics, evaluation, auth), each `healthy|warning|unavailable|critical|unknown` with label + icon (color-independent); folded `organizationHealth`; counts (`criticalAlertCount`, `warningCount`, `unavailableCount`).
- **Source:** `director-dashboard-executive-overview` (REAL, `authoritative: false`).
- **Why on Command:** the only real, load-bearing health today; system failure is Director-relevant.
- **Action:** click section → its Operations/Platform surface; Heby "why is X degraded?".
- **Drill-down:** section → `/dashboard` widget (later `/operations` or `/platform`).
- **Refresh:** snapshot-driven; freshness surfaced.
- **Empty:** section `empty` → "no evidence" (not "healthy"); `unavailable` → hatch/lock.
- **Loading:** `unknown` until resolved.
- **Blocked/Restricted:** auth/diagnostics sections may be restricted per role → "restricted."
- **Confidence:** every chip inherits `authoritative: false`; empty ≠ healthy is enforced (health.ts semantics).
- **Heby:** inline "explain this section" using the section's reasonCode/evidence.

> **Naming note:** this region is **not** called "Organization Health." Business/strategic organization health is **NOT YET AVAILABLE** (see §10).

### 7.5 Operational Pulse (real states)
- **Purpose:** minimum Command-level operational summary — what's running / waiting / stuck.
- **Shown:** compact counts + a few rows: active executions (state), agents (idle/planning/running/waiting/blocked), workflows (execution status), failures/human-gates count. Agent-state grammar per design §14.
- **Source:** `runtimeOverview`, `agentOverview`, `workflowOverview` (REAL states; data sparse).
- **Why on Command:** "what is executing / what is blocked" is a Director question; **summary only** — Operations owns investigation.
- **Action:** row → Operations/Workforce; Heby "why is this blocked?".
- **Drill-down:** `/operations` (executions/failures/timeline), `/workforce` (agents).
- **Empty:** "No active operations." (honest, not zeroed fake).
- **Loading/Blocked/Confidence:** standard; non-authoritative marker.
- **Heby:** explain a blocked/waiting item within boundary.
- **Excluded:** orchestration internals, adapters, permits, dispatch plumbing (no Director value → Platform/internal).

### 7.6 Executive Briefing (Heby-composed; honest-empty today)
- **Purpose:** the synthesized "what you should know" narrative artifact.
- **Shown (when real):** Heby-composed briefing items — title, synthesis, confidence glyph, source chips, "advisory" label, link-to-evidence. **No approve control.**
- **Source:** Heby Core briefing boundary (`heby-briefing-*`) — deterministic composition contract exists; **no live composer/data** → NOT YET AVAILABLE.
- **Why on Command:** IA §7 places Director Briefings in Command (rendered, not owned).
- **Action:** read; open evidence in Heby; drill to owning surface.
- **Drill-down:** `/heby` home for deep session.
- **Empty (today):** explicit "No briefing available yet" — never a fabricated narrative.
- **Confidence:** advisory, non-authoritative, confidence/evidence grammar mandatory.
- **Heby:** this region **is** Heby-rendered advisory content; must wear advisory markers, never authority chrome.

### 7.7 Recent Significant Changes (derivable; below fold)
- **Purpose:** "what changed."
- **Shown:** a short list of material deltas — section health transitions, new pending decisions, freshness/version changes — each with before→after + timestamp.
- **Source:** DERIVABLE from Executive Overview section-state deltas + read-model `sourceVersions`/`projectionVersion` between snapshots (no new semantics invented).
- **Why on Command:** "what changed" is a core Director question; composed from real signals.
- **Action:** item → owning surface; Heby "why did this change?".
- **Empty:** "No significant changes."
- **Confidence:** derived, non-authoritative.
- **Heby:** explain a change.

### 7.8 Strategic Goals summary (Command-owned; mock today)
- **Purpose:** top-level goal posture.
- **Shown (when real):** on-track / at-risk / blocked counts + top goals.
- **Source:** `goal-runtime` contracts + `@/features/director/mock` (PURE MOCK today).
- **Why on Command:** goals are Command cockpit material (IA §7).
- **Action:** → goals surface.
- **Drill-down:** `/director/goals` (later `/command/goals`).
- **Empty (today):** honest-empty or explicit "mock" marker; **no fabricated goal numbers presented as real.**
- **Heby:** explain goal risk (when real).

---

## 8. Director Authority Boundary

The load-bearing rule (design §11, IA §7): **recommendation ≠ briefing ≠ approval request ≠ Director decision ≠ execution.** These must be visually and interactionally unmistakable.

| Concept | Where it appears on Command | Visual grammar | May the Director act here? |
|---|---|---|---|
| **Recommendation** (advisory) | Briefing region / Heby panel | "Recommended" + lightbulb, advisory label, non-authoritative | No — advisory only |
| **Briefing** (synthesis) | Executive Briefing region | advisory markers, confidence/evidence, source chips | No |
| **Approval request** (pending) | Decision Pressure strip / Attention | amber attention band + lock + "Requires your approval" | **Preview only** — routes out |
| **Director decision** (the act) | **Dedicated decision surface, not inline** | authority chrome: solid left-rule + human identity + timestamp | **Yes — only here** |
| **Execution** (governed action) | Not on Command | — | No — behind approval, in Command Console (future) |

Rules:
- The **approve/deny control exists only on the dedicated decision surface** (Command Approvals & Decisions), never inline on Command and never inside Heby.
- Command may **preview** decision pressure (counts, subjects, risk) and **route** to the act.
- After a decision (future, when real): the item leaves the pending strip; the recorded decision wears authority chrome (human identity + timestamp) and is auditable (Governance owns the record).
- **Heby may:** explain why something matters, show evidence/source/assumptions/uncertainty, summarize what changed, prepare an approval item as a visibly-non-authoritative "prepared" artifact.
- **Heby must never:** approve, execute, render advice as authority, fabricate evidence/confidence/recommendation, or expose an approve control.

---

## 9. Heby Interaction Model in Command

Heby is **ambient**, not a boxed dashboard region and not a floating chatbot. It manifests as (Phase 5 shell already provides launcher + panel):

1. **Ambient launcher** — persistent (rail + topbar), indigo accent; opens the contextual panel.
2. **Contextual side panel** — workspace/object-aware; header names context ("On: Command · System Status"); explains why/evidence/source/assumptions/uncertainty/what-changed/consequences.
3. **Inline "why" affordance** — per attention item / section / change: a small Heby trigger that opens the panel scoped to that object.
4. **Briefing rendering** — the Executive Briefing region is Heby-composed advisory content (honest-empty until a live composer exists).
5. **Evidence / source inspector** — source chips on advisory content open provenance within Heby's grounding boundary.

Constraints (Heby Core boundaries, §1.5): grounding validator, governance gate, presentation boundary, approval boundary all apply. **Phase 6B must not:** call a model, connect a live Heby conversation, fabricate AI dialogue, or add an approve control in Heby. Where Heby cannot ground an answer, it must say so (governance-blocked / withheld), never dress ungrounded content as grounded.

---

## 10. Data Provenance / Source Map

Classification: **A REAL** (available in read model/runtime) · **B DERIVABLE** (composed from real outputs, no new semantics) · **C NOT YET AVAILABLE** (needs future read model/runtime) · **D FORBIDDEN** (must not be surfaced here).

| Command region | Source domain | Module / read model | Availability | Required transformation | Drill-down |
|---|---|---|---|---|---|
| Command Header (state, freshness) | System overview | `director-dashboard-executive-overview` | **A REAL** (non-auth) | read `organizationHealth` + `freshness` | — |
| Director Attention (system P0) | System overview | executive-overview sections `critical`/`unavailable` | **A REAL** (non-auth) | filter sections by severity | `/dashboard`→`/operations`/`/platform` |
| Director Attention (governance block) | Heby governance | `heby-core` governance/presentation boundary | **A REAL boundary, C data** | render block notices only | `/governance` |
| Decision Pressure (approvals) | Human approval | `human-approval` (+ decision projection) | **A contract, C real data** (mock/simulated) | count by risk; mark simulated | decision surface |
| System / Operational Status | System overview | executive-overview 8 sections + `director-dashboard-data` | **A REAL** (non-auth) | section health chips + folded state | `/dashboard` sections |
| Operational Pulse | Runtime/agents/workflows | `runtimeOverview`/`agentOverview`/`workflowOverview` | **A REAL states** (data sparse) | summarize counts + states | `/operations`, `/workforce` |
| Executive Briefing | Heby briefing | `heby-core` `heby-briefing-*` | **C NOT YET AVAILABLE** (no composer/data) | honest-empty | `/heby` |
| Recent Significant Changes | System overview deltas | executive-overview section deltas + `sourceVersions` | **B DERIVABLE** | diff between snapshots | owning surface |
| Strategic Goals summary | Goals | `goal-runtime` + `director/mock` | **C NOT YET AVAILABLE** (mock) | honest-empty/mock-marked | `/director/goals` |
| Risks | Governance | governance risk classification | **C / demote** (Governance-owned) | link only | `/governance/risk` |
| Opportunities | OI advisory | OI Runtime candidates | **C NOT YET AVAILABLE** | — (omit until real) | `/intelligence` |
| Recommendations | OI/Heby advisory | OI Runtime + Heby | **C NOT YET AVAILABLE** | briefing-only when real | `/intelligence` |
| Revenue / financial KPIs | — | — | **D FORBIDDEN** | never | — |
| Fabricated health/risk/agent counts | — | — | **D FORBIDDEN** | never | — |

**Counts:** REAL (A): 5 regions/sub-sources (header state, system attention, system status, operational pulse, + derivable-adjacent). DERIVABLE (B): 1 (recent changes). NOT-YET (C): 5 (briefing, goals, opportunities, recommendations, real approvals data / real business health). FORBIDDEN (D): fabricated business metrics, revenue, fake scores/counts.

**Absolute rule:** no fake numbers. No fabricated company health score, risk score, agent count, revenue, or alert. Empty/unavailable renders honestly.

---

## 11. Workspace Ownership Matrix (Command vs the six)

For each Command region: *why is the summary here rather than owned by another workspace?* Command **summarizes/prioritizes**; the workspace **owns investigation/management**.

| Command region | Summarizes | Owned/managed by | Anti-duplication rule |
|---|---|---|---|
| Director Attention | cross-domain P0/P1 | source workspace (Operations/Platform/Governance) | Command shows the item; the workspace shows the full record |
| Decision Pressure | pending approvals | **Command** (the act) / Governance (rules+audit) | act stays Command; rules/record in Governance |
| System / Operational Status | system health | Operations (runtime/exec) / Platform (providers/infra/auth) | Command = folded chips; Operations/Platform = detail |
| Operational Pulse | live work | **Operations** (executions) / **Workforce** (agents) | Command = counts+top rows; Operations/Workforce = management |
| Executive Briefing | advisory synthesis | **Intelligence** (advisory home) / Heby (compose) | Command renders headline; Intelligence owns full advisory |
| Recent Changes | deltas | owning workspace | Command = change line; workspace = full history |
| Strategic Goals | goal posture | **Command** (cockpit) | Command owns goals; no other workspace duplicates |
| Risks | (link only) | **Governance** | Command does not host a risk register |
| Opportunities/Recommendations | (when real) | **Intelligence** | Command renders headline; Intelligence owns |

Command must **not** become a second copy of the product. If a region needs tables, management controls, or per-record CRUD, it belongs in the workspace, not on Command.

---

## 12. Live Operations Model

Minimum Command-level operational summary (from real states, §7.5): **counts + a few rows** for active executions (state), agents (state grammar), workflows (execution status), and a **blocked/human-gate** count (the Director cares about stuck work and human gates). Everything deeper — orchestration, dispatch, permits, adapters, timelines, failure detail — is **Operations-owned** and reached by drill-down. Internal orchestration plumbing has no Director value and must not appear on Command.

---

## 13. Organization Health Decision

**Decision: "Organization Health" as a business/strategic score is NOT YET AVAILABLE and must not be invented.**

- The platform can authoritatively compute only **system/operational health** today (Executive Overview folds 8 system sections into one state; `authoritative: false`). This is surfaced as **"System / Operational Status"**, honestly named.
- A single arbitrary business health number is **forbidden** (no evidence backs it).
- Decomposed business-health dimensions (strategic / operational / workforce / governance / knowledge / system) are **aspirational**: only **system** is real today; **operational** is partially real (execution/agent states); strategic/workforce/governance/knowledge business health are **NOT YET AVAILABLE**.
- When real read models exist, Command can add decomposed dimensions **without restructuring** (the region is a status strip, extensible by dimension).

---

## 14. Responsive Behavior

Attention-first, decision-first — not stacked desktop cards.

**Desktop (≥1280):** priority canvas per §6 — Attention (primary, left) + Decision Pressure (right) above the fold; System Status full-width strip; Operational Pulse near fold; Briefing/Changes/Goals below. Inspectors (Heby panel, item drill-down) open as side slide-overs. Command register density (dense rows) in Attention/Status; calmer below.

**Tablet (~768):** single column, priority order preserved (Attention → Decision → System Status → Pulse → below). Decision Pressure becomes a full-width strip under Attention. Heby panel = side slide-over. Status chips wrap; Pulse collapses to counts with "view in Operations."

**Mobile (~375):** **attention-first, decision-first**. Order: Attention (P0/P1) → Decision Pressure → System Status (collapsed chips) → everything else behind progressive disclosure ("Show operational detail"). Heby = full-screen sheet. Drill-downs = full-screen push. No desktop density; ≥44px targets; no horizontal overflow. Attention/approval count also on the shell attention badge.

---

## 15. Command-Specific Visual Composition

Uses the shipped Phase 4 design foundation (no redesign). Command-only composition rules:

- **Density:** Command register (dense) in Attention + System Status; Workspace register (calm) below the fold. Max ~5 major sections above the fold (design §15).
- **Cards:** used sparingly; Attention and Status are **lists/strips**, not card walls. One nesting level; no card-in-card.
- **Lists vs tables:** discrete items (attention, approvals, changes, agents) are **lists/rows**, never tables on Command (tables live in workspaces).
- **Status strips:** System/Operational Status is a labeled **chip strip** (color + icon + label), not gauges/pies.
- **Charts:** only where trend/distribution genuinely helps (e.g., a small change-over-time sparkline). **No decorative charts, no dashboard wallpaper, no neon/HUD.**
- **Timelines:** Recent Changes may use a compact vertical dot-timeline.
- **Authority surfaces:** authority chrome reserved for recorded human decisions (not present on Command's preview strips).
- **Evidence affordances:** source chips + "why" (Heby) on advisory/derived content; confidence/uncertainty via ink+glyph (never color-only).
- **Empty states:** confident, first-class (a quiet Command is a good Command).

---

## 16. Component Boundaries (no code)

Derived model. Types: **[C]** container/data · **[P]** domain presentation · **[R]** reusable primitive · **[I]** inspector · **[N]** navigation/drill-down. No monolithic `CommandDashboard`.

- `CommandPage` **[C]** — server; loads Executive Overview + Insights (real) and marks non-authoritative/mock regions; composes regions.
- `CommandHeader` **[P]** — org + folded state + freshness + honesty marker.
- `DirectorAttention` **[C→P]** — assembles P0/P1 typed items from overview sections + governance blocks + approvals summary.
  - `AttentionItem` **[P]** — typed row (badge, consequence, source chip, "why").
  - `AttentionEmptyState` **[R]**.
- `DecisionPressure` **[P]** — approvals summary strip (counts by risk, top subjects, "Review decisions" **[N]**). No act.
- `SystemStatusStrip` **[P]** — 8 section chips + folded state.
  - `StatusChip` **[R]** — health chip (color+icon+label).
- `OperationalPulse` **[P]** — executions/agents/workflows summary rows.
  - `AgentStateBadge` / `ExecutionStateRow` **[R]**.
- `ExecutiveBriefing` **[P]** — Heby-composed advisory; honest-empty; advisory markers.
  - `BriefingItem` **[P]** (no approve control).
- `RecentChanges` **[P]** — derived delta list/timeline.
- `StrategicGoalsSummary` **[P]** — counts + top goals; mock-marked/honest-empty.
- `HebyContextTrigger` **[N]** — inline "why" affordance (opens existing Heby panel; reuse Phase 5 `heby-*`).
- `CommandRegion` / `RegionEmptyState` / `NonAuthoritativeMarker` / `WithheldNotice` **[R]** — shared region chrome + honesty primitives.
- Drill-down inspectors reuse the design foundation's inspector pattern **[I]**; Command hosts triggers, not the inspectors' full content.

Reuse existing primitives (`Badge`, `StatCard`, `EmptyState`, status/state components, `ui-metric-card`, Heby panel). Do **not** reuse the mock `DashboardFoundation`/widget-board wholesale as Command; Command composes its own honest regions from the real overview/insights read models.

---

## 17. Empty / Failure / Blocked States (fail honestly)

| Condition | Command behavior |
|---|---|
| Nothing requires attention | Confident empty: "Nothing requires your attention right now." |
| No approvals pending | "No decisions are waiting on you." |
| Runtime has no candidate (OI) | Omit Opportunities/Recommendations; no placeholder narrative. |
| Data source unavailable | Section → `unavailable` (hatch/lock), not "healthy." |
| Source stale | Freshness badge "stale · as of {time}"; content shown with stale marker. |
| Evidence insufficient | Confidence "—"/indeterminate; no invented certainty. |
| Governance blocks presentation | "Withheld" (hatch/lock + reason); never render the blocked content. |
| Director lacks permission | "Restricted" (visibility ≠ authorization; server enforces); show region shell, not data. |
| Organization context unavailable | "Organization context unavailable"; do not fabricate org identity. |
| Heby cannot ground an answer | Heby states it cannot answer / is blocked; never fabricates evidence. |
| Briefing not yet available | "No briefing available yet." |
| Goals mock/empty | Honest-empty or explicit mock marker; no real-looking numbers. |

**Never** fill missing data with plausible-looking UI. Empty ≠ healthy. Non-authoritative ≠ authoritative.

---

## 18. Implementation Sequence for Phase 6B

1. **Command scaffold + header + honesty primitives** — `CommandPage`, `CommandHeader`, `NonAuthoritativeMarker`, `RegionEmptyState`, `WithheldNotice`. Wire the **real** Executive Overview + Insights read models (`director-dashboard-executive-overview` / `-executive-insights`). No mock.
2. **System / Operational Status strip** (REAL) — `SystemStatusStrip` + `StatusChip` from Executive Overview sections; honest empty/unavailable.
3. **Director Attention** (REAL system P0/P1 + governance-block notices; approvals summary marked simulated) — `DirectorAttention` + `AttentionItem` + empty state.
4. **Decision Pressure strip** (approvals summary, marked simulated; routes to decision surface) — no act control.
5. **Operational Pulse** (REAL states) — executions/agents/workflows summary; drill to Operations/Workforce.
6. **Recent Significant Changes** (DERIVABLE) — section/version deltas.
7. **Executive Briefing region** (honest-empty; Heby-rendered scaffold) + inline `HebyContextTrigger` reusing Phase 5 Heby panel.
8. **Strategic Goals summary** (honest-empty/mock-marked).
9. **Responsive pass** (1280/768/375), accessibility, empty/blocked states, no-overflow, console-clean.
10. **Routing:** `/command` becomes the Command Center; keep legacy destinations working; do not migrate routes destructively.

Real-data regions first (1–5); advisory/not-yet regions as honest-empty scaffolds (6–8). Nothing fabricated at any step.

---

## 19. Explicit Exclusions (this phase and Phase 6B guardrails)

This phase did **not**, and Phase 6B must **not**: implement Command UI here; modify application source in this phase; create components/mock business data; connect AI/models; call Heby Core as a live engine or add an approve control in Heby; modify Heby Core; modify Organizational Intelligence Runtime; redesign navigation or the design system; add execution/approval behavior; fabricate metrics/revenue/health/risk/agent counts; introduce new product architecture without flagging it (see §20); commit, tag, or push.

Command Center **business UI is not implemented**. Phase 6B is **not** begun.

---

## 20. Open Director Decisions

1. **Naming:** confirm "System / Operational Status" (honest) vs the Director expecting "Organization Health." (Recommendation: honest name now; add business dimensions when real.)
2. **`/command` vs `/dashboard`:** the real read models render at `/dashboard` today; should Phase 6B move that pipeline under `/command` and redirect `/dashboard`, or compose fresh at `/command` and leave `/dashboard` legacy? (Recommendation: compose fresh at `/command`; keep `/dashboard` as legacy until migrated.)
3. **Approvals surface:** is the pending-approvals **act** the existing `/approvals` (Enterprise Decision Center, currently simulated), or a new `/command/approvals`? (Recommendation: `/command/approvals` as the act surface in a later phase; Command links to current `/approvals` meanwhile.)
4. **Attention badge wiring:** should the shell topbar attention badge count be driven by Command's P0/P1 aggregate now (real system criticals) or wait for real approvals? (Recommendation: wire to real system criticals now; add approvals when real.)
5. **Briefing timing:** leave the Executive Briefing region honest-empty until a live Heby composer exists, or omit it entirely until then? (Recommendation: honest-empty scaffold, clearly labeled.)
6. **Goals/Alerts mock:** keep `/director/goals` & `/director/alerts` mock reachable, or hide from Command until real? (Recommendation: Command shows honest-empty summaries only; deep mock pages remain reachable but unlinked from Command headline.)
7. **Non-authoritative marking:** how prominent should the `authoritative: false` / "simulated" markers be on Command? (Recommendation: visible but calm per design honesty rules.)

---

## 21. Final Report (summary)

- **Repository discovery:** HEAD `b4ba8c8` == origin/main, 0/0, tracked tree clean; Phase 5 App Shell published; Heby Core 1–9 + Runtime untouched.
- **Authority docs read:** capability inventory, information architecture, navigation architecture, design system foundation (all four).
- **Runtime/Heby surfaces inspected:** widget runtime; `director-dashboard-data/-executive-overview/-executive-insights/-ui`; `enterprise-projection-providers` + `enterprise-runtime-composition`; `human-approval`; `director-command`; `enterprise-organizational-intelligence-runtime`; `goal-runtime`; `heby-core` (approval/briefing/grounding/governance/presentation boundaries).
- **Existing Director surfaces inspected:** `/command`, `/dashboard` (real), `/director` (mock projection), `/approvals` (simulated), `/director/goals` & `/director/alerts` (mock), `/director/organization` (mock projection).
- **Command mission:** Director's operating surface — prioritize attention/decisions, summarize state, route to owning workspace; not a BI/monitoring/chatbot/approval-queue dashboard.
- **Final regions:** Header · Director Attention · Decision Pressure · System/Operational Status · Operational Pulse · Executive Briefing · Recent Changes · Strategic Goals summary · ambient Heby.
- **Above-fold:** Attention (primary) + Decision Pressure + System Status + Operational Pulse.
- **Attention hierarchy:** P0 intervention · P1 decision · P2 change/risk/opportunity · P3 operational awareness · P4 background; typed, never one feed.
- **Provenance findings:** only System/Operational Status + Insights + Operational Pulse are genuinely real (non-authoritative, honest-empty); attention/decision/org-domain/intelligence are real-shape/synthetic; briefing/goals/opportunities/recommendations/business-health are NOT YET AVAILABLE; business metrics/revenue FORBIDDEN.
- **REAL vs DERIVABLE vs NOT-YET counts:** REAL ≈ 5 · DERIVABLE ≈ 1 · NOT-YET ≈ 5 · FORBIDDEN (fabricated business data) enforced.
- **Heby placement:** ambient launcher + contextual panel + inline "why" + briefing rendering + evidence inspector; no model call, no chatbot, no approve control.
- **Director authority model:** recommendation ≠ briefing ≠ approval request ≠ decision ≠ execution; act only on the dedicated decision surface; Heby prepares/explains, never approves.
- **Workspace dedup:** Command summarizes/prioritizes; Operations/Workforce/Intelligence/Governance/Platform own investigation/management; no duplicate ownership.
- **Responsive model:** attention-first/decision-first; desktop priority canvas, tablet single-column, mobile progressive disclosure + full-screen Heby.
- **Component model:** `CommandPage` + per-region presentation components + shared honesty/state primitives; reuse Phase 5 Heby panel; no monolith; do not reuse mock widget board as Command.
- **Key risks/contradictions:** "Organization Health" expectation vs system-only reality; `/dashboard` (real) vs `/command` (placeholder) split; approvals data simulated; most business regions not-yet-available — all resolved by honest naming + honest-empty + non-authoritative marking.
- **Open Director decisions:** §20 (naming, `/command` vs `/dashboard`, approvals surface, attention-badge wiring, briefing timing, mock handling, marker prominence).
- **File created:** `docs/product-vision/ui/hebun-command-center-specification.md`. No source code modified. No commit, tag, or push.
- **Git state:** branch `main`, HEAD `b4ba8c8` == origin/main, 0/0; only new untracked file is this document (plus pre-existing untracked docs). Heby Core & Runtime unchanged.

---

**DOCUMENT STATUS: DIRECTOR COMMAND CENTER SPECIFICATION ONLY — NO IMPLEMENTATION**
