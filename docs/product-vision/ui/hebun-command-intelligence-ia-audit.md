# Hebun — Command & Intelligence: IA + Contract Audit

## Document Status

**DOCUMENT TYPE: PRODUCT VISION — UI PHASE 20A — INFORMATION ARCHITECTURE + CONTRACT AUDIT**

**STATUS: AUDIT + IA DECISION ONLY — NO IMPLEMENTATION**

This document determines the final Level‑2 product architecture for the **Command** and **Intelligence** workspaces before Phase 20B/20C implementation. It writes no components, no routes, no navigation changes, no runtime. It is the contract that 20B and 20C implement against.

Layer separation held: System Architecture → Product Capabilities → Information Architecture → [Navigation Architecture](hebun-navigation-architecture.md) → **IA + Contract Audit (this document)** → UI Implementation (20B/20C).

**Discovery basis:** branch `main`, HEAD `57e3cfb31e0e3b6b65b5cc7c57ac4fc620a53037`, `HEAD == origin/main`, 0 ahead / 0 behind. Working tree clean except pre‑existing untracked docs (`docs/architecture-backlog/`, `docs/architecture/conscious-intelligence/`, `docs/architecture/heby/`, `docs/product-vision/`). HEAD is exactly on tag `hebun-ui-phase-19-security-intelligence-security-center-complete`. No `hebun-ui-phase-20*` tag exists — **Hebun UI Phase 20 has not begun in code.**

> Tag‑track note: a bare `phase-20-complete` tag exists (`930815…`, "Complete Phase 20 — Enterprise Memory", 2026‑07‑29). It belongs to the **backend runtime numbering track** (`phase-N-complete`, `runtime-foundation-phase-N`), which is independent of the **UI track** (`hebun-ui-phase-N`). It does not indicate UI Phase 20 work.

**Read for this audit:** `src/config/workspace-nav.ts`, `src/config/sidebar.config.ts`, every Command/Intelligence route page under `src/app/(dashboard)/`, `src/features/intelligence/workspace-model.ts`, `src/features/decisions/workspace-model.ts`, `src/features/enterprise-organizational-intelligence-runtime/` (index + descriptors), `src/features/heby-integration/workspace-registry.ts` + `contracts.ts`, `src/features/heby-runtime/navigate-tool.ts`, `src/features/director/mock.ts`, `src/features/intelligence/mock.ts`, the catch‑all module page, and the seven per‑workspace `workspace-model.ts` files.

**Protected (read‑only, untouched):** Heby Core/Integration/Runtime/Actions, Phases 15–19, Device Runtime, Enterprise Memory, Organizational Intelligence Runtime, Governance contracts, Auth, `providers/computer-use`, Phase 19 Security Center.

---

## 1. The two navigation layers (ground truth)

Hebun carries **two** navigation models. Both are real; they are not the same thing.

| Layer | File | Role | Authority |
|---|---|---|---|
| **Product IA** | `src/config/workspace-nav.ts` | The seven‑workspace product navigation (UI Phase 3+). Command & Intelligence L2 come from here. | **Authoritative for the product surface.** |
| **Legacy architecture map** | `src/config/sidebar.config.ts` | The older deep "living architecture map" (~110 routes: Director / Architecture / Workforce / Finance / …). | Legacy. Folded into workspaces via each workspace's `match` prefixes. Not the product IA. |

`workspace-nav.ts` never migrated the ~110 legacy routes; it points Level‑2 destinations at real routes where they exist and marks the rest `unavailable`. Consequence: **the Command and Intelligence L2 rows point mostly at legacy `/director/*` pages that predate the honesty doctrine.**

---

## 2. Honesty baseline — three surfaces already correct, the rest are mock

Phases 8 and 14 established the no‑fake‑data doctrine (contract‑only substrate; no fabricated data / model call / execution / persistence; honest empty states; phase‑tagged). Three surfaces honour it:

| Surface | Route | Model | State |
|---|---|---|---|
| Command Overview | `/command` | `getDirectorDashboardUiModel()` (Phase 6B) | **Honest.** Real, non‑authoritative director read model (system/runtime/agent/workflow health). Empty regions render honest states. |
| Intelligence Overview | `/intelligence` | `getIntelligenceWorkspaceModel()` (Phase 8) | **Honest.** Only the frozen Organizational Intelligence Runtime vocabulary; `emerging: []`; every dependency `connected: false`. |
| Decisions | `/approvals` | `getDecisionWorkspaceModel()` (Phase 14) | **Honest.** Heby Core Phase 6 approval contract vocabulary; no Approve/Reject; `decisionRecordingConnected: false`. |

Every **other** Command/Intelligence L2 page is backed by synthetic mock (`features/director/mock.ts` — `companyHealth = 94`; `features/intelligence/mock.ts` — `intelligenceScores = { organizationIntelligence: 91, … }`). These fabricate counts, scores, percentages, confidence, timestamps, and status — the exact outputs the honesty doctrine forbids. **This is the core problem 20B/20C must close.**

---

## 3. Existing Command IA (as shipped)

| # | L2 label | Route | Backing | Honesty | Owns today |
|---|---|---|---|---|---|
| 1 | Overview | `/command` | Phase 6B director UI model | ✅ honest | Executive cockpit composition |
| 2 | Briefings | — (`unavailable`) | none | ✅ honest (empty) | nothing yet |
| 3 | Approvals & Decisions | `/approvals` | Phase 14 decisions model | ✅ honest | *navigates into* Decisions |
| 4 | Strategic Goals | `/director/goals` | `director/mock` | ❌ mock | fabricated goals + counts |
| 5 | Organization Health | `/director/organization-health` | `director/mock` | ❌ mock | **fake `94` health %** |
| 6 | Alerts | `/director/alerts` | `director/mock` | ❌ mock | fabricated alert feed |
| 7 | Reports | `/director/reports` | `director/mock` | ❌ mock (export honestly disabled) | fabricated report list |
| 8 | Command Console | — (`unavailable`) | none | ✅ honest (empty) | nothing yet |
| 9 | Inbox | — (`unavailable`) | none | ✅ honest (empty) | nothing yet |

Legacy duplicates outside the workspace nav but reachable: `/director/insights` (Executive Insights, mock) and `/director/recommendations` (AI Recommendations, mock) — these are the canonical targets that the Intelligence nested stubs defer to.

---

## 4. Existing Intelligence IA (as shipped)

| # | L2 label | Route | Page title (actual) | Backing | Honesty |
|---|---|---|---|---|---|
| 1 | Overview | `/intelligence` | Intelligence Workspace | Phase 8 runtime vocab | ✅ honest |
| 2 | Insights | `/director/intelligence/insights` | **"Strategic Forecasts"** | `intelligence/mock` | ❌ mock + name mismatch |
| 3 | Signals & Assessments | — (`unavailable`) | — | none | ✅ honest (empty) |
| 4 | Candidates | — (`unavailable`) | — | none | ✅ honest (empty) |
| 5 | Readiness & Pathways | — (`unavailable`) | — | none | ✅ honest (empty) |
| 6 | Patterns | `/director/intelligence/patterns` | "Pattern Discovery" | `intelligence/mock` | ❌ mock |
| 7 | Recommendations | `/director/intelligence/recommendations` | "AI Recommendations" (nav‑stub → `/director/recommendations`) | `director/mock` | ❌ mock |

Not in the workspace nav but present in the subtree: `/director/intelligence/organization-health` (duplicates Command's Organization Health) and `/director/intelligence/learning` (mock "Learning Center").

> **Naming correction (Step 0 discipline).** The row is **"Readiness & Pathways"**, not "Readiness & Patterns". The suspected "Readiness & Patterns vs Patterns" duplication does not exist as stated: `Readiness & Pathways` maps to real taxonomy; `Patterns` is a separate, unrelated orphan (§8.6).

---

## 5. Problems found

1. **P1 — Mock L2 under an honesty‑compliant shell.** Command rows 4–7 and Intelligence rows 2/6/7 render fabricated data while Overview/Decisions are contract‑only. The workspace looks honest at the landing and lies one click in.
2. **P2 — Fake organizational health score.** `/director/organization-health` renders `companyHealth = 94` in a gauge and computes fake efficiency/AI‑utilization averages — the precise anti‑pattern the mission forbids.
3. **P3 — Duplicated Organization Health.** Present at both `/director/organization-health` (Command) and `/director/intelligence/organization-health` (Intelligence).
4. **P4 — Duplicated Insights / Recommendations.** Legacy `/director/insights` + `/director/recommendations` and nested `/director/intelligence/{insights,recommendations}` cover the same concepts; the nested pages are `DomainReference` stubs deferring to the legacy pages.
5. **P5 — Name mismatch.** Nav "Insights" → page titled "Strategic Forecasts".
6. **P6 — Semantic orphan "Patterns".** No `pattern` candidate kind exists in the Organizational Intelligence Runtime taxonomy (§7). "Pattern Discovery" is a mock surface with no contract basis.
7. **P7 — "Command Console" is an undefined, risky name.** As a label it invites a shell/terminal/execution reading. No route, no contract, no defined mental model.
8. **P8 — "Approvals & Decisions" conflates two things** and risks implying Command owns a decision system. It already (correctly) points at the authoritative Decisions surface, but the label and framing must make it navigation, not ownership.
9. **P9 — Alerts vs Inbox undefined.** Both exist; Inbox is unavailable; their distinction is unstated.
10. **P10 — Unwired engines.** `features/organizational-intelligence/` (health/risk/capacity/score engines) is imported by **zero** app/component files. It is neither the honest runtime nor the mock; it is dead relative to the product surface.

---

## 6. Command — final mental model

**Command is the Director's executive operating surface.** It observes and it routes attention to the human. It owns no truth of its own.

```
OBSERVE → SURFACE ATTENTION → UNDERSTAND → PREPARE → HUMAN DECISION
        → AUTHORIZED ACTION → EXECUTION ELSEWHERE → RECEIPT / OUTCOME
```

Command **owns** exactly two things:
- the **executive attention composition** (what needs the Director now), and
- the **prepared‑intent entrypoint** (Director states intent → Heby prepares → authority gate).

Command **does not own** organizational truth, intelligence generation, execution, governance authority, platform config, security detection, workforce identity, or knowledge storage. For each, Command is a **read consumer** and a **navigator** into the authority surface. Command must never become a god‑object: every consequential act terminates at another surface's authority.

---

## 7. Intelligence — final mental model

**Intelligence owns emerging organizational understanding** — the candidate lifecycle of the Organizational Intelligence Runtime. It does not own settled truth (Knowledge), decisions (Decisions), execution (Operations), governance policy (Governance), security incidents (Security Center), or operational runtime state (Operations).

The real, frozen spine is the Runtime's **six ordered candidate kinds** and its **ten lifecycle stages** (from `enterprise-organizational-intelligence-runtime`, surfaced by `intelligence/workspace-model.ts`):

**Candidate kinds (ordered):** `learning → optimization → awareness-signal → awareness-assessment → evolution-readiness → evolution-pathway`

**Lifecycle stages (ordered):** `input → context → analysis → candidate-generation → validation → explanation → confidence → governance → director-approval → output`

**Confidence:** ordinal only — `indeterminate | low | moderate | high` (never a computed score/%). **Restrictions:** `restrict | defer | escalate`. **Dependencies (all `connected:false`):** memory‑context, reasoning‑understanding, organization‑assembly.

The Director's hypothesised lifecycle maps cleanly onto the real taxonomy:

| Hypothesis term | Real runtime term |
|---|---|
| Observation / Signal | `awareness-signal` |
| Assessment | `awareness-assessment` |
| Candidate | any kind at `candidate-generation` |
| Validated intelligence / Insight | a `learning`/`optimization` candidate past `validation` |
| Readiness | `evolution-readiness` |
| Pathway | `evolution-pathway` |
| Recommendation | advisory `optimization`/`evolution-pathway` output |

**A candidate becomes an Insight** when it passes the `validation` stage carrying an evidence basis and an ordinal confidence — not before. That transition is the dividing line between the *Candidates* surface and the *Insights* surface.

---

## 8. Command — destination‑by‑destination audit

Each answers: **A** user question · **B** owns · **C** does not own · **D** data authority · **E** duplicate elsewhere · **F** verdict · **G** why · **H** future route · **I** Heby role · **J** authority boundary · **K** honest empty state · **L** future seam.

### 8.1 Overview — **KEEP**
- **A** "What is the state of my organization right now?" **B** Executive cockpit composition. **C** No truth generation, no execution. **D** Phase 6B director UI model (real). **E** No. **F** KEEP. **G** Only honest executive landing; the model already exists. **H** `/command`. **I** advisory‑only: "what needs attention", "why is this critical", "trace evidence". **J** read‑only. **K** already honest (regions with no data render empty). **L** more real reads as Operations/Intelligence connect.

### 8.2 Briefings — **KEEP (build in 20B, honest‑empty)**
- **A** "Give me the synthesis I should read." **B** Presentation of a Heby‑assembled advisory briefing. **C** Does not generate the briefing; does not decide. **D** Heby + Runtime `director-briefing-*` contract. **E** No. **F** KEEP / BUILD. **G** Distinct from Overview (synthesis vs cockpit) and from Insights (executive digest vs intelligence item). **H** `/command/briefings`. **I** Heby *assembles*, advisory‑only; never asserts truth. **J** read‑only. **K** "No briefing prepared — Heby briefing assembly not connected." **L** `director-briefing-boundary/rules/validation` in the runtime + Heby runtime.

### 8.3 Approvals & Decisions — **RENAME → "Decisions" + NAVIGATION‑ONLY**
- **A** "What needs my authority?" **B** *Decision pressure* only (that some exist, how many, how urgent) + a link. **C** Must **not** own a decision system, records, or Approve/Reject. **D** The authoritative Decisions surface (Phase 14, `getDecisionWorkspaceModel`). **E** Yes — Decisions is authoritative; Governance has an Approval Center; legacy `/approvals` is that surface. **F** RENAME + NAVIGATION‑ONLY. **G** The route already points at the authoritative model; Command must surface pressure and navigate, never fork a second decision authority. **H** label "Decisions" → `/approvals` (canonical Decisions route). **I** advisory‑only from Command; on the Decisions surface Heby is `human-review-required` and prepares only. **J** Command surfaces a count; **the decision act lives on Decisions**. **K** "No decisions pending" — and this is **not** "nothing is happening". **L** persisted decision queue when `decisionRecordingConnected` becomes true.

### 8.4 Strategic Goals — **KEEP concept, REBUILD honest (read over a Goal authority)**
- **A** "What are we trying to achieve, and where do we stand?" **B** Executive presentation of goal state. **C** Not the goal store; not OKR authoring truth. **D** A Goal authority (`goal-runtime` / `mission-runtime` features; Goal Registry lives in Knowledge). **E** Partly — Goal Registry (Knowledge) is the master data. **F** KEEP + REBUILD. **G** Goals are organizational truth Command *reads*; the mock fabricates them. **H** keep `/director/goals` as the real route (rebuilt) or canonical `/command/goals` (route consolidation deferred, §15). **I** advisory‑only: explain a goal, trace its basis. **J** read‑only; goal mutation is not a Command act. **K** "No goals connected — Goal runtime not wired." Never fabricated OKRs/KPIs. **L** `goal-runtime`/`mission-runtime` read model + Knowledge Goal Registry.

### 8.5 Organization Health — **KEEP concept, REBUILD as operating state (no score)**
- **A** "How is the organization operating?" **B** Executive presentation of **operating state**. **C** Not CPU/RAM; **not a fabricated health %**; not Intelligence's health reasoning. **D** Operations runtime state + Intelligence health reads. **E** Yes — duplicated at `/director/intelligence/organization-health` (remove that one, §9.5). **F** KEEP + REBUILD. **G** P2/P3: the current gauge invents `94`. **H** keep `/director/organization-health` (rebuilt) / canonical `/command/health`. **I** advisory‑only: explain a state, trace its basis. **J** read‑only. **K** state = **Unknown / Not connected** per §11 — never a number. `Unknown ≠ unhealthy`, `No alert ≠ healthy`. **L** Operations runtime health + Intelligence assessment reads.

### 8.6 Alerts — **MERGE into Inbox (unified attention)**
- **A** "What just demanded my attention?" **B** System‑generated attention signals. **C** Not incidents (Security Center owns findings), not decisions. **D** System / Operations / Security signal sources. **E** Overlaps Inbox (the attention queue). **F** MERGE → Inbox. **G** P9: Alert = a *signal class*; Inbox = the *aggregated attention queue*. One attention surface prevents two homes for "what needs me". **H** folds into `/command/inbox` (legacy `/director/alerts` becomes a filtered lens/alias, deferred). **I** advisory‑only. **J** read‑only. **K** "No attention items — signal sources not connected." `Signal ≠ incident`. **L** Operations/Security/Runtime signal streams. *(This is the one genuine taste call — see §24.)*

### 8.7 Reports — **KEEP, REBUILD honest‑empty (no reporting engine)**
- **A** "Give me the executive read‑out to share." **B** Presentation + export trigger. **C** **Not** a reporting engine; does not compute business analytics. **D** A future report‑generation seam (Command Bus — the page already labels export "mock … once the Command Bus is live"). **E** No. **F** KEEP + REBUILD. **G** Reports belong to the executive surface; the engine does not. **H** keep `/director/reports` (rebuilt) / canonical `/command/reports`. **I** advisory‑only; Heby may summarise a real report, never fabricate one. **J** read‑only; export is a governed command, not a Command mutation. **K** "No reports — report generation not connected." **L** Command Bus `report.export` / report generation service.

### 8.8 Command Console — **RENAME → "Director Intent" (prepared‑intent surface)**
- **A** "I want to express intent and have it safely prepared." **B** Natural‑language organizational intent → Heby understanding → **prepared** plan/action → authority gate. **C** **Not** a shell, terminal, arbitrary‑execution, or direct‑mutation surface. Execution happens elsewhere (Operations / Device Runtime). **D** Phase 17 action‑preparation boundary (`heby-actions`) + Heby runtime. **E** No. **F** RENAME + BUILD (20B). **G** P7: "Console" reads as a shell; the honest concept is *prepared intent under authority*. **H** `/command/intent`. **I** Heby **prepares** (`decision-preparation`, contract‑only); `hebyMayAct:false` in every mode — never authorizes or executes. **J** hard gate: prepared ≠ authorized ≠ executed; the human authorizes, Operations executes. **K** "Intent preparation not connected — Phase 17 action boundary is contract‑only." **L** Phase 17 `heby-actions` prepared‑action contract → Phase 18 device/execution runtime.

### 8.9 Inbox — **KEEP as the unified attention queue (absorbs Alerts)**
- **A** "What, across everything, needs me?" **B** The aggregated Director attention queue: system alerts + decision pressure + briefings‑awaiting‑review. **C** Does not own any source; aggregates references. **D** Alerts (8.6) + Decisions pressure (8.3) + Briefings (8.2). **E** Overlaps Alerts — resolved by merge. **F** KEEP + BUILD (20B). **G** One "what needs me" surface; the executive front door to attention. **H** `/command/inbox`. **I** advisory‑only: triage/explain, never act. **J** read‑only; each item deep‑links to its authority surface. **K** "Nothing needs you right now — sources not fully connected." `No intelligence ≠ nothing happening`. **L** the three upstream seams above.

---

## 9. Intelligence — destination‑by‑destination audit

### 9.1 Overview — **KEEP**
- **A** "What is the organization learning, and how does intelligence flow?" **B** Runtime lifecycle + taxonomy at a glance. **D** Phase 8 runtime vocab (real). **F** KEEP. **H** `/intelligence`. **I** advisory‑only: explain a candidate, compare hypotheses, trace evidence + uncertainty. **K** already honest; `emerging: []`, dependencies `connected:false`. **L** connect memory‑context / reasoning‑understanding / organization‑assembly.

### 9.2 Insights — **KEEP concept, RENAME page, REBUILD honest**
- **A** "What have we actually validated?" **B** Validated intelligence items (`learning` + `optimization` past `validation`). **C** Not raw candidates; not recommendations; not decisions. **D** Runtime output stage. **E** Overlaps legacy `/director/insights` (Executive Insights) and the nested "Strategic Forecasts" page. **F** REBUILD (retire mock; fix P5 name). **G** Insight = validated candidate with evidence + confidence. **H** `/intelligence/insights`. **I** advisory‑only. **J** read‑only; promotion to settled truth is Knowledge's, not Intelligence's. **K** "No validated intelligence — Runtime inputs not connected." **L** Runtime `output` stage once dependencies connect.

### 9.3 Signals & Assessments — **KEEP + BUILD**
- **A** "What single observations, and what do they mean together?" **B** `awareness-signal` (observation) + `awareness-assessment` (reading of a signal set). **C** Not incidents; not validated insight. **D** Runtime awareness‑candidate contracts. **E** No. **F** KEEP + BUILD. **G** Two adjacent real kinds; the observation→interpretation pair belongs together (one surface, two sections). **H** `/intelligence/signals`. **I** advisory‑only. **K** "No signals — awareness inputs not connected." `Signal ≠ incident`. **L** `awareness-candidate-*` in the runtime.

### 9.4 Candidates — **KEEP + BUILD**
- **A** "What is being formed but not yet validated?" **B** The generic candidate queue at `candidate-generation`/`validation`, with restriction outcomes (`restrict|defer|escalate`). **C** Not validated insight; not recommendation. **D** Runtime candidate/validation contracts. **F** KEEP + BUILD. **G** Makes the candidate→insight boundary (§7) visible; where uncertainty and restrictions live. **H** `/intelligence/candidates`. **I** advisory‑only; **must not promote a candidate into truth**. **K** "No candidates — Runtime not connected." **L** runtime `candidate-generation`/`validation` stages.

### 9.5 Readiness & Pathways — **KEEP + BUILD** (real taxonomy)
- **A** "Is the organization ready to change, and along what route?" **B** `evolution-readiness` + `evolution-pathway`. **C** Not a decision; a pathway is not a plan authorized for execution. **D** Runtime evolution‑candidate contracts. **E** No (name corrected from "Readiness & Patterns"). **F** KEEP + BUILD. **G** Maps to two real ordered kinds. **H** `/intelligence/evolution`. **I** advisory‑only. **K** "No readiness/pathway candidates — Runtime not connected." **L** `evolution-candidate-*`. *Also remove the stray `/director/intelligence/organization-health` duplicate here (P3).*

### 9.6 Patterns — **REMOVE** (semantic orphan)
- **A** (as built) "What recurs?" **B** nothing with a contract basis. **D** none — **no `pattern` candidate kind exists** in the Runtime taxonomy. **E** A recurring `learning` is already a learning candidate → Insights/Candidates. **F** REMOVE. **G** P6: "Pattern Discovery" is mock with no contract; keeping it reintroduces fake data and a fake axis. **H** none (route retired/redirected, deferred). **I** n/a. **K** n/a. **L** none. *If a pattern concept is later wanted, it is a lens over `learning` candidates, not an L2 surface.*

### 9.7 Recommendations — **KEEP (distinct), REBUILD honest**
- **A** "What is advised — clearly not yet decided?" **B** Advisory recommendations (`optimization`/`evolution-pathway` output). **C** **Not** a decision, approval, prepared action, authorized action, or execution. **D** Runtime output. **E** Overlaps legacy `/director/recommendations`; nested page is a stub. **F** KEEP + REBUILD. **G** Recommendation must stay distinct across the whole chain. **H** `/intelligence/recommendations`. **I** advisory‑only; explain + trace uncertainty. **J** the consequential path leaves Intelligence: → Command attention → Decisions (if consequential) → Phase 17 prepared action → human authority → execution runtime. **K** "No recommendations — Runtime not connected." `Recommendation ≠ decision`. **L** runtime output stage.

**Removed/retired from Intelligence:** Patterns (9.6), the `/director/intelligence/organization-health` duplicate (P3), the mock `/director/intelligence/learning` Learning Center (learning is a candidate kind, not a standalone surface).

---

## 10. Cross‑workspace semantic ownership matrix

Grounded in the Phase 14 authority chain (`decisions/workspace-model.ts`), the Heby workspace registry, and the Runtime taxonomy. "Mutate/Execute" blank means no surface may — the concept is read‑only or terminates at human authority.

| Concept | Authoritative owner | Read‑only consumers | May create | May validate | May mutate | May execute |
|---|---|---|---|---|---|---|
| observation / signal | **Intelligence** (Runtime) | Command | Runtime | Runtime | — | — |
| assessment | **Intelligence** | Command | Runtime | Runtime | — | — |
| candidate | **Intelligence** | Command, Decisions | Runtime | Runtime | — | — |
| insight (validated) | **Intelligence** | Command; Knowledge (on settle) | Runtime | Runtime | — | — |
| pattern | **none** (orphan → fold into learning) | — | — | — | — | — |
| recommendation | **Intelligence** | Command, Decisions | Runtime | — | — | — |
| alert | **Command** (attention) | — | System/Operations/Security signals | — | — | — |
| briefing | **Heby** (assembles) / **Command** (surfaces) | Director | Heby + Runtime `director-briefing` | — | — | — |
| report | **Command** | Director | Command Bus (future) | — | — | — |
| goal | **Goal authority** (`goal-runtime`) / Knowledge Goal Registry | Command | Director | — | Director | — |
| organizational operating state | **Operations** (+ Intelligence reads) | Command | Operations runtime | — | — | — |
| decision | **Decisions** (Phase 14) | Command (pressure), Governance | Director (human) | Director | Director | — |
| approval | **Decisions** / Governance Approval Center | Command | Director | Director | Director | — |
| prepared action | **Phase 17 action boundary** (`heby-actions`) | Command (Director Intent) | Heby (prepares) | Human authority | — | Operations/Device |
| execution | **Operations / Device Runtime** (Phase 18) | Command, Intelligence (read) | — | — | — | Runtime (post‑authority) |
| evidence | owning surface via `evidence-tracing` | all | source subsystem | — | — | — |
| provenance | source subsystem (`sourcePhase`) | all | — | — | — | — |
| uncertainty | **Intelligence** (ordinal confidence) | Command, Decisions | Runtime | — | — | — |
| memory | **Enterprise Memory** (Knowledge) | Intelligence, all | Memory admission | Memory | Memory | — |
| policy | **Governance** | all | Governance | Governance | Governance | — |
| security finding | **Security Center** (Governance L2, Phase 19) | Command (as alert), Governance | Security intelligence | — | — | — |

**No concept has two authoritative owners.** Command and Intelligence appear only as read‑only consumers or attention/observation owners — never as owners of decisions, execution, policy, memory, or security.

---

## 11. Heby role matrix (already encoded — surface it, don't build it)

From `heby-integration/workspace-registry.ts` + `contracts.ts`. **Every authority mode has `hebyMayAct: false`. Heby never acts, in any mode.** All capability families are `contract-only`; all sources "exist but not connected". Navigation (`heby-runtime/navigate-tool.ts`) is READ‑ONLY route resolution: it resolves to real routes only, skips `unavailable` destinations, never invents a route, never auto‑navigates, returns not‑found rather than fabricating.

| Surface | Authority mode | Heby MAY | Heby MUST NOT |
|---|---|---|---|
| Command (Overview, Inbox, Briefings, Goals, Health, Reports) | `advisory-only` | explain, summarize, trace evidence, assess uncertainty, compare, investigate, navigate | decide, approve, authorize, execute, mutate, fabricate, assert state without evidence |
| Command · Director Intent | `advisory-only` (prepares) | understand intent, **prepare** a plan/action, state consequences | authorize, execute, mutate policy |
| Intelligence (all) | `advisory-only` | explain a candidate/assessment, compare hypotheses, trace evidence + summarize uncertainty | **promote a candidate into truth**, fabricate evidence, decide |
| Decisions (`/approvals`) | `human-review-required` | summarize evidence + consequences, explain the recommendation + what is uncertain | **approve, reject, or authorize** |

**Heby Core, Integration, Runtime, and Actions are protected — this audit surfaces the existing boundary; it does not change it.**

---

## 12. Honesty / data‑state vocabulary (binding on 20B/20C)

Ten distinct states — never collapsed. Grounded in existing contract fields (`HebySourceStatus`: `exists/connected/populated/authoritative/unavailable`; runtime `connected:false`; `decisionRecordingConnected:false`).

| State | Means | Not |
|---|---|---|
| **0 / None** | a connected source returned zero items | not "disconnected" |
| **Not connected** | no data path wired (exists in architecture, `connected:false`) | not "empty", not "zero" |
| **Not available** | capability/tool/device not built (`unavailable`) | not "failed" |
| **Unknown** | connected but state indeterminate | **not "unhealthy"** |
| **Derived** | computed from real inputs | not a raw fact |
| **Simulated** | from a simulation, labelled as such | never shown as real |
| **Prepared** | Heby‑prepared, awaiting review | **not "authorized"** |
| **Requires review** | pending human attention | not "resolved" |
| **Human authority** | the point only a human may act | not automatable |
| **Restricted** | exists but withheld behind an authority requirement | not "missing" |

**Rules 20B/20C must follow:**
- `0 items ≠ data source not connected` — distinguish in copy and visually.
- `Unknown ≠ unhealthy`; `No alert ≠ healthy`; `No intelligence ≠ nothing is happening`.
- `Recommendation ≠ decision`; `Prepared ≠ authorized`; `Authorized ≠ executed`.
- `Signal ≠ incident`; `Finding ≠ breach`; `Pattern ≠ causal relationship`.
- **Never render a fabricated count, score, %, confidence, timestamp, or status.** (Retires every `director/mock` + `intelligence/mock` value from these surfaces.)

---

## 13. Final proposed Command navigation

```
COMMAND  (/command)
├ Overview            /command              KEEP        executive cockpit (Phase 6B model)
├ Inbox               /command/inbox        BUILD 20B   unified attention: alerts + decision pressure + briefings-to-review
├ Briefings           /command/briefings    BUILD 20B   Heby-assembled advisory synthesis (honest-empty)
├ Decisions         → /approvals            NAV-ONLY    navigates into authoritative Decisions (Phase 14); shows pressure
├ Strategic Goals     /director/goals*      REBUILD 20B read over Goal authority (honest-empty)
├ Organization Health /director/organization-health*  REBUILD 20B operating state, no fabricated score
├ Reports             /director/reports*    REBUILD 20B executive read-outs (honest-empty, no engine)
└ Director Intent     /command/intent       BUILD 20B   NL intent → Heby prepares → authority gate  (was "Command Console")
```
`*` existing route kept as the real href and rebuilt in place (no destructive migration); canonical `/command/*` consolidation deferred (§15). **Alerts** merges into **Inbox** (§8.6). **8 rows** (was 9).

---

## 14. Final proposed Intelligence navigation

```
INTELLIGENCE  (/intelligence)
├ Overview               /intelligence                  KEEP        lifecycle + taxonomy (Phase 8 model)
├ Signals & Assessments  /intelligence/signals          BUILD 20C   awareness-signal + awareness-assessment
├ Candidates             /intelligence/candidates       BUILD 20C   candidate queue pre-validation (+ restrictions)
├ Insights               /intelligence/insights         REBUILD 20C validated intelligence (learning + optimization)
├ Readiness & Pathways   /intelligence/evolution        BUILD 20C   evolution-readiness + evolution-pathway
└ Recommendations        /intelligence/recommendations  REBUILD 20C advisory output, distinct from decision
```
Order follows the lifecycle. **Patterns removed** (orphan); **org‑health & learning duplicates removed**. **6 rows** (was 7). Canonical `/intelligence/*` routes replace the `/director/intelligence/*` legacy subtree; redirects deferred (§15).

---

## 15. Current → proposed changes + future route map

| Current | Proposed | Reason |
|---|---|---|
| Command "Approvals & Decisions" `/approvals` | **"Decisions"**, navigation‑only → `/approvals` | Don't imply a second decision authority (P8) |
| Command "Alerts" `/director/alerts` | **merge → Inbox** | Alert = signal class; Inbox = attention queue (P9) |
| Command "Inbox" (unavailable) | **Inbox** `/command/inbox`, unified attention | The "what needs me" front door |
| Command "Command Console" (unavailable) | **"Director Intent"** `/command/intent` | "Console" reads as a shell (P7); honest concept is prepared intent |
| Command "Strategic Goals" mock | rebuild honest over Goal authority | Retire fabricated goals |
| Command "Organization Health" fake `94` | rebuild as operating state, no score | P2 |
| Command "Reports" mock | rebuild honest‑empty, no engine | Retire fabricated reports |
| Intelligence "Insights" → "Strategic Forecasts" mock | rebuild honest; fix name | P5 |
| Intelligence "Patterns" mock | **remove** | Orphan, no contract (P6) |
| Intelligence "Recommendations" stub | rebuild honest, keep distinct | Retire mock |
| `/director/intelligence/organization-health` | **remove** | Duplicate of Command Health (P3) |
| `/director/intelligence/learning` mock | **remove** | Learning is a candidate kind, not a surface |

**Future route map (seven‑workspace preserved, no eighth workspace):**

| Surface | Canonical (future) | 20B/20C real href | Redirect/alias (deferred to 20D+) |
|---|---|---|---|
| Command Overview | `/command` | `/command` | — |
| Inbox | `/command/inbox` | `/command/inbox` | `/director/alerts`, `/director/inbox` → Inbox |
| Briefings | `/command/briefings` | `/command/briefings` | — |
| Decisions | `/approvals` | `/approvals` | keep (established) |
| Strategic Goals | `/command/goals` | `/director/goals` | `/command/goals` → real |
| Organization Health | `/command/health` | `/director/organization-health` | `/command/health` → real |
| Reports | `/command/reports` | `/director/reports` | `/command/reports` → real |
| Director Intent | `/command/intent` | `/command/intent` | `/director/command-center` → Director Intent |
| Intelligence Overview | `/intelligence` | `/intelligence` | — |
| Signals & Assessments | `/intelligence/signals` | `/intelligence/signals` | — |
| Candidates | `/intelligence/candidates` | `/intelligence/candidates` | — |
| Insights | `/intelligence/insights` | `/intelligence/insights` | `/director/intelligence/insights`, `/director/insights` → Insights |
| Readiness & Pathways | `/intelligence/evolution` | `/intelligence/evolution` | — |
| Recommendations | `/intelligence/recommendations` | `/intelligence/recommendations` | `/director/intelligence/recommendations`, `/director/recommendations` → Recommendations |

Redirects and legacy retirement are **not** implemented in 20A and should not be implemented in 20B/20C beyond what each surface needs; the destructive‑migration decision is 20D's.

---

## 16. Phase 20B — Command L2 completion (exact scope)

**Create/refine:** Inbox (new), Briefings (new), Director Intent (new); rebuild Strategic Goals, Organization Health, Reports as honest surfaces; convert Decisions to navigation‑only (pressure + link); Overview unchanged.

**Reuse (do not re‑implement):** `director-dashboard-ui/adapter.server` (Overview), `decisions/workspace-model` (Decisions pressure read), `heby-integration/workspace-registry` (Heby context/authority), `heby-actions` Phase 17 contract (Director Intent preparation), `goal-runtime`/`mission-runtime` (goals read), the `director-briefing-*` runtime contracts (Briefings).

**New view models genuinely required:** a Command **attention/inbox** read model (aggregates decision‑pressure count + alert‑signal references + briefings‑to‑review, all honest‑state); a **Director Intent** view model over the Phase 17 prepared‑action contract; honest **goal**, **operating‑state**, and **report** read models (contract‑only until seams connect).

**Must remain untouched:** Phase 14 decisions model, Organizational Intelligence Runtime, Enterprise Memory, Heby Core/Runtime/Actions, Phase 17/18 boundaries, Governance contracts, Security Center.

**Expected empty states:** every new/rebuilt surface renders §12 states — never a fabricated number. Organization Health = Unknown/Not‑connected. Goals/Reports/Briefings/Intent = Not‑connected.

**Heby integration points:** advisory‑only across all; Director Intent uses Heby *preparation* (`hebyMayAct:false`).

**Authority boundaries:** Command owns attention + prepared‑intent entry only; decisions terminate at Decisions; actions terminate at Phase 17 → human → execution runtime.

**Tests required:** extend `director-command` tests; assert (a) no `director/mock` import on any Command surface, (b) honest‑state rendering for each surface, (c) Decisions is navigation‑only (no Approve/Reject affordance), (d) Director Intent exposes no execution/mutation path, (e) workspace‑nav rows resolve to real routes.

**Browser validation required:** each Command L2 renders its honest empty/not‑connected state; Decisions link navigates to `/approvals`; no fabricated count/score/% visible anywhere.

**Non‑goals:** no reporting engine; no goal authoring; no decision system; no shell/terminal; no execution; no route redirects; no legacy‑route deletion.

---

## 17. Phase 20C — Intelligence L2 completion (exact scope)

**Create/refine:** Signals & Assessments (new), Candidates (new), Readiness & Pathways (new); rebuild Insights and Recommendations honest; remove Patterns and the org‑health/learning duplicates; Overview unchanged.

**Reuse (do not re‑implement):** `enterprise-organizational-intelligence-runtime` (all candidate/stage/evolution/awareness contracts), `intelligence/workspace-model` (extend the same honest pattern per surface).

**New view models genuinely required:** per‑kind honest read models — awareness (signal+assessment), generic candidate (+ restriction outcomes), evolution (readiness+pathway), validated‑insight, recommendation — each surfacing frozen vocabulary + `connected:false`, zero instances.

**Must remain untouched:** the Runtime contracts and validators; Enterprise Memory; Knowledge (settled truth); Decisions.

**Expected empty states:** every surface = "Runtime inputs not connected" / "No candidates" per §12; dependencies shown as `connected:false`.

**Heby integration points:** advisory‑only; explain/compare/trace/summarize‑uncertainty; **never promote a candidate into truth**, never fabricate evidence.

**Authority boundaries:** Intelligence owns emerging understanding only; validated → settle in Knowledge; consequential recommendation → Command → Decisions → Phase 17 → human → execution.

**Tests required:** extend `enterprise-organizational-intelligence(-runtime)` + `organizational-intelligence-canonical`; assert (a) every L2 maps to a real candidate kind (Patterns has none → absent), (b) no `intelligence/mock`/`director/mock` import, (c) candidate→insight boundary honoured (validation stage), (d) recommendation is not decision/approval/action, (e) confidence rendered ordinally, never as %.

**Browser validation required:** each Intelligence L2 renders honest empty state; taxonomy labels match runtime terms; no fabricated score/%/count.

**Non‑goals:** no second intelligence architecture; no pattern surface; no scores; no promotion of candidates to truth; no route redirects.

---

## 18. Phase 20D — Cross‑workspace integration + validation closure (recommended)

**Yes — 20D should be integration + validation closure.** It validates, across the whole product:

1. **No duplicated authority** — every concept in §10 has exactly one owner; Command/Intelligence remain read/attention only.
2. **The authority chain renders consistently** end‑to‑end: Intelligence (advisory + recommendation) → Heby (prepared item) → Director (review + decision) → Decisions (record) → Operations (handoff).
3. **Heby advisory boundary holds** on every surface (`hebyMayAct:false`; navigate read‑only).
4. **Honesty vocabulary (§12) applied uniformly**; no fabricated value survives anywhere in Command/Intelligence.
5. **Legacy retirement**: `/director/*` and `/director/intelligence/*` mock pages redirected or retired; `director/mock` + `intelligence/mock` no longer imported by any product surface; unwired `organizational-intelligence` engines dispositioned.
6. **Seven‑workspace architecture preserved**; no eighth workspace; Security Center still at `/director/governance/security` (Governance L2), untouched.
7. **Cross‑links resolve**: Recommendation→Command→Decisions→Intent paths navigate to real routes via the read‑only navigate tool.

---

## 19. Protected‑system audit

| System | Touched? | Evidence |
|---|---|---|
| Heby Core / Integration / Runtime / Actions | **No** | read `workspace-registry.ts`, `contracts.ts`, `navigate-tool.ts` only |
| Phases 15–19 | **No** | read‑only inspection |
| Phase 19 Security Center | **No** | confirmed at `/director/governance/security` (Governance L2); not in scope |
| Device Runtime (Phase 18) | **No** | referenced as future execution seam only |
| Enterprise Memory | **No** | referenced as concept owner only |
| Organizational Intelligence Runtime | **No** | read descriptors via `intelligence/workspace-model.ts` |
| Governance contracts | **No** | read `governance/workspace-model.ts` only |
| Auth / providers/computer-use | **No** | not inspected/modified |

No product/runtime/component/route/nav file was modified.

---

## 20. Files created / modified

- **Created:** `docs/product-vision/ui/hebun-command-intelligence-ia-audit.md` (this document) — the single authorized Phase 20A audit artifact, placed in the existing UI product‑vision docs directory per convention.
- **Modified:** none.
- **Product/runtime code:** unchanged.

---

## 21. Validation results

| # | Check | Result |
|---|---|---|
| 1 | Repository baseline verified | ✅ HEAD `57e3cfb` == Phase 19 tag == origin/main, 0/0 |
| 2 | No unexpected code changes | ✅ only this doc added |
| 3 | Seven‑workspace architecture preserved | ✅ no new/removed workspace; no eighth |
| 4 | No duplicated authority ownership | ✅ §10 — one owner per concept |
| 5 | No duplicate Intelligence runtime invented | ✅ reuse `enterprise-organizational-intelligence-runtime` |
| 6 | No duplicate Decisions system invented | ✅ Command "Decisions" is navigation‑only into Phase 14 |
| 7 | No duplicate Memory system invented | ✅ memory owner = Enterprise Memory (Knowledge) |
| 8 | No execution bypass proposed | ✅ prepared ≠ authorized ≠ executed; Director Intent prepares only |
| 9 | Heby remains advisory | ✅ `hebyMayAct:false` all modes; navigate read‑only |
| 10 | Honesty semantics preserved | ✅ §12 ten‑state vocabulary, binding |
| 11 | Every retained L2 has one user question | ✅ §8/§9 field A |
| 12 | Every retained L2 has one ownership boundary | ✅ §8/§9 fields B/C/J |
| 13 | Every retained L2 has an honest empty state | ✅ §8/§9 field K |
| 14 | Every future data source maps to a real/future seam | ✅ §8/§9 field L; §10 |
| 15 | No fake enterprise data proposed as content | ✅ all rebuilds honest‑empty; mocks retired |
| 16 | Doc internally consistent, no product files changed | ✅ §19/§20 |

---

## 22. Risks / unresolved questions

- **R1 — Route consolidation vs no‑destructive‑migration.** Canonical `/command/*` and `/intelligence/*` are cleaner, but the nav‑architecture principle forbids destructive migration of ~110 routes. Resolution: 20B/20C rebuild existing routes in place; consolidation + redirects are a 20D decision.
- **R2 — Goal authority location.** `goal-runtime` and `mission-runtime` both exist plus a Knowledge Goal Registry. Which is the read authority for Command's Strategic Goals must be pinned in 20B discovery (objective, from the repo — not a Director call).
- **R3 — Operating‑state source.** Organization Health's honest source (Operations runtime state vs Intelligence health reads) needs a concrete seam in 20B; until then it renders Unknown/Not‑connected.
- **R4 — Unwired engines.** `features/organizational-intelligence/` engines are imported nowhere. 20D should dispose (wire honestly, or mark deprecated) — do not let them silently back a "real" surface with computed‑but‑ungrounded numbers.
- **R5 — Legacy `/director/*` reachability.** Even after rebuild, legacy pages remain reachable directly until 20D redirects them; interim exposure of mock pages should be flagged.

---

## 23. Director decisions required

Only genuine product/taste calls (everything else is resolved objectively above):

- **D1 — "Command Console" → "Director Intent".** Rename + reframe as a prepared‑intent surface (NL intent → Heby prepares → authority gate), explicitly not a shell/console. *Recommended.* Alternative names: "Director Console", "Intent". The **concept** is architecturally fixed; only the **name** is a Director call.
- **D2 — Alerts + Inbox → one "Inbox" attention surface.** Merge system alerts into the unified attention queue (Alert = signal class; Inbox = the queue). *Recommended.* Alternative: keep both as separate L2 (an Alerts feed + an Inbox aggregator) — accepted only with a crisp, stated distinction. This is the one real duplication‑vs‑separation taste call.
- **D3 — Patterns removal.** Remove the orphan "Patterns" surface (no runtime candidate kind). *Recommended, objectively grounded* — flagged only because it deletes a currently‑visible (mock) surface.

Everything else (mock retirement, honest empty states, taxonomy mapping, Decisions navigation‑only, duplicate removal, route map, 20B/20C/20D scopes) is resolved by the repository and architecture and needs no Director decision.

---

*End of Phase 20A — IA + Contract Audit. No product surface implemented. No commit, tag, or push.*
