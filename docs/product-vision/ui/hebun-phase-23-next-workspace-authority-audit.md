# Hebun UI — Phase 23 Next-Workspace Authority Audit (Phase 23A)

**Status:** Phase 23A — Discovery / audit only. No product code changed. This is the single authorized artifact.

**Selected next workspace: Governance.**

**Baseline HEAD:** `267dd4e390544b908f34e5632ee00646499f5791` (== origin/main, Phase 22 publication).

> Director principle continued: *Adapter existence ≠ active connection. Contract existence ≠ runtime. Seeded data ≠ organizational truth. A real engine over seeded inputs is derived-from-seed, not live authority. Governance ≠ Decisions.*

---

## 1. Baseline

| Check | Result |
|---|---|
| branch | `main` |
| HEAD | `267dd4e39…` |
| origin/main | identical |
| ahead / behind | `0 / 0` |
| staged / tracked-modified | none |
| hebun-ui phase tags | 20, 21, **22** |
| Phase 22 tag → HEAD | ✅ dereferences to `267dd4e` |
| `hebun-ui-phase-23*` | absent |
| generic `phase-23*` | `phase-23-complete` — unrelated track, not touched |
| Phase 23 begun? | no |

Clean.

---

## 2. Seven-workspace revalidation (from `workspace-nav.ts`)

Seven workspaces intact. Completed: **Command** (Phase 20, 8 L2), **Intelligence** (Phase 20, 6 L2), **Knowledge** (Phase 21, 4 L2), **Operations** (Phase 22, 4 L2: Overview / Execution / Runtime & Signals / Execution Substrate). **Security Center** remains a Governance L2 (`/director/governance/security`). Remaining candidates: **Workforce**, **Governance**, **Platform**.

---

## 3. Candidate inventory

| Workspace | L2 count | Routes | First read |
|---|---|---|---|
| Workforce | 6 nav / **27 pages** | `/workforce`, `/agents`, `/finance`(7), `/hr`(8), `/legal`(9), `/tickets` | 4 full department mock-apps + agents |
| Governance | 8 nav / 11 pages | `/governance`, `/director/governance/{policies,compliance,risk,permissions,audit,explainability,approvals,security}`, `/director/policy` | mock authoritative UI + a real headless-ish policy engine |
| Platform | 8 nav / 11 pages | `/platform`, `/integrations`, `/settings`, `/architecture`(8), `/director/provider-*` | provider config + static architecture maps; external-dependent |

---

## 4. Workforce audit

**Backing:** `legal`(10), `hr`(9), `finance`(9) domain features + `agents`(6) + `workflows`(2) + `approvals`(2) + `workforce`(1) + `tickets`(1) + `agent-runtime`(1).

- **Departments (finance/hr/legal/tickets)** = fully fabricated business-domain mocks (`finance/mock.ts` → `financeOverview`, `cashFlow`; hr onboarding/interviews; legal contracts). 24 of the 27 pages are department mock-apps — **not workforce authority**; they are departmental *operations* content.
- **Agents** → `agent-runtime` (imports `approvals/mock` + `runtimeProjectionRegistry` = **seeded projection**) + `agents/mock`.
- **Authority collision risk (severe):** agents overlap `agent-crud`, `orchestration`, and Operations; departments overlap Finance/Legal/HR *domains* that aren't "workforce." `agent definition ≠ running agent`, `department definition ≠ active runtime`, `Workforce ≠ Operations/Orchestration` — currently blurred.
- **Fabrication:** headcount, utilization, department health, agent status, task counts — all mock/seeded.
- **Data classes:** mostly **MOCK / SEEDED**; `workforce` landing minimal; `agent-runtime` seeded.
- **Verdict:** huge scope (27 pages), heaviest mock burden, unclear authority, high duplicate-authority risk, highest implementation risk. **Not next.**

---

## 5. Governance audit

**Two parallel systems — the decisive finding:**

1. **Authoritative Governance nav** (`/director/governance/*`, 8 pages) → `@/features/governance` (14 imports) = **MOCK**. `governance/policies.ts` hand-authors policies ("Executive Approval Thresholds", "2d ago"); `metrics/compliance/risk` fabricate `complianceScore: 94`, `auditHealth: 96`, `explainabilityCoverage: 89`, risk `score: 90–96`, `health: 92`.
2. **Real `policy` engine** (`features/policy`: `policy-evaluator`, `governance-pipeline`, `compliance-engine`, `risk-engine`, `rule-engine`, `constraint-engine`, `permission-engine`, `approval-engine`, `audit-engine`, `policy-registry`, `policy-queries`) — a real deterministic governance evaluator. It **is** surfaced, but only at the orphan route `/director/policy` (a director-sidebar item, **not** in the Governance workspace nav), via `components/policy/*`.
3. **Security Center** (`/director/governance/security` → `security-center`, Phase 19) — **real, authoritative, protected.**

**Nuance:** the `policy` engine's inputs derive from the seeded `registries` mock (`policy-builder` imports `@/features/registries/types`; `policy-queries` reads `governanceResults` from `governance-pipeline`). So it is a **real engine over seeded inputs → derived-from-seed**, not live authoritative governance — must be surfaced honestly (like the Phase 21 knowledge graph), not as live truth.

**Ownership:** Governance owns **policy / rules / constraints / evaluation / compliance posture / risk register / permissions / audit record / explainability** + **security findings** (Security Center). It must **not** become a second **Decisions** system — the engine's `decision-engine`/`approval-engine` are evaluation, not human authority.

**Cross-workspace leverage (high):** Operations Phase 22 explicitly flagged *"Governance gate — no live policy evaluator connected."* Governance is exactly where that truth is told, and Enterprise Memory admission uses `evaluatePolicies`. Governance gates Operations execution, Command decisions, and Knowledge admission.

**Data classes:** authoritative nav **MOCK**; `policy` engine **DERIVED-from-seed** (real logic, seeded input); Security Center **REAL**; live policy-instance evaluator **NOT CONNECTED** (per Phase 17).

**Verdict:** real engine substrate + real Security Center anchor, most-misleading authoritative UI, clear (Decisions-adjacent) authority, concentrated scope, proven Phase-21 fix pattern, highest cross-workspace leverage. **Selected.**

---

## 6. Platform audit

**Backing:** `architecture`(8, static maps) + `providers`(7) + `provider-matrix` + `integrations` + `platform` + `adapters` + `runtime-boundary`.

- **Providers** → `providers/computer-use` = **simulation-only** (`framework: "Simulation"`); other providers simulation/contract. **External-provider dependent.**
- **3 nav destinations `unavailable`** (Infrastructure, Models & Tools, Authentication).
- **Architecture** pages = static documentation maps (cognitive/execution/governance/intelligence cores, system-flow), not runtime.
- **Fabrication:** provider status/uptime/latency/token/cost would all be fake without connecting providers — which is forbidden.
- **Data classes:** **SIMULATION-ONLY / NOT-CONNECTED / EXTERNAL-DEPENDENCY**; little can improve honestly without connecting external providers or exposing secrets (both prohibited).
- **Verdict:** lowest honest-data availability; the honest story is mostly "not connected." Lower leverage than Governance. **Not next.**

---

## 7. Maturity matrix

| Dimension | Workforce | **Governance** | Platform |
|---|---|---|---|
| Routes / L2 | 27 / 6 | 11 / 8 | 11 / 8 |
| Runtime maturity | seeded + mock | **real engine (seeded input) + real Security Center** | external-dependent, sim |
| Real connected backing | agent-runtime (seeded) | Security Center (real); policy engine (derived) | providers (sim) |
| Mock/seeded burden | very high (departments) | high (governance mock) | high (providers/architecture) |
| Authority clarity | low (agents/departments/execution collide) | **medium-high (policy vs Decisions)** | medium |
| Duplicate-authority risk | severe | **contained (Decisions/Security)** | low |
| Honest surfaceable now | low | **medium (engine structure + honest states + Security)** | low |
| Improve w/o new backend | low | **high** | low (needs providers) |
| Reduce misleading UI | high | **highest (fabricated %)** | medium |
| Cross-workspace leverage | medium | **highest (gates execution/decisions/admission)** | medium |
| Implementation risk (5=low) | 1 (27 pages) | **4 (concentrated)** | 3 |

---

## 8. Authority ownership matrix (all seven workspaces)

| Concept | Authoritative owner |
|---|---|
| Attention / prepared intent | **Command** |
| Interpretation / candidates / recommendations | **Intelligence** |
| Knowledge / memory | **Knowledge** (Enterprise Memory) |
| Goals | **Command** (Strategic Goals) |
| Human decisions / approvals | **Decisions** (`/approvals`) |
| **Policies / rules / constraints / governance evaluation** | **Governance** ← Phase 23 |
| Compliance posture / risk register / audit / explainability | **Governance** |
| Security findings / control posture | **Governance › Security Center** (Phase 19) |
| Workforce definitions / agents / departments / assignments | **Workforce** |
| Execution / runtime observation / execution readiness | **Operations** (Phase 22) |
| Providers / models / devices / Computer Use | **Platform** / Phase 18 |
| Advisory explanation | **Heby** |

Governance must not own: human decisions, execution, agents, providers, goals, memory. These are the collision lines to hold in 23B–D.

---

## 9. Heby boundary (Governance profile, real)

| Property | Value |
|---|---|
| authority | `restricted` |
| capabilities | `governance-inspection` (contract-only), `evidence-tracing` (contract-only) |
| sources | `governance` |
| hebyMayAct | **false** |
| mayExplain | "Why is this blocked?" · "Which policy applies, and what authority does it require?" · "Heby explains policy; it never modifies it or grants authority." |

Heby may explain policy / why-blocked / applicable-rule / evidence; it may **not** create/modify a policy, grant permission, approve, decide, or evaluate authoritatively. The `source-resolver` returns `governance` as honest **unavailable** ("Governance structural vocabulary only; no live policy instances connected"). No new Heby tool. Heby Core untouched.

---

## 10. Mock / legacy dependency matrix (Governance)

| Module | Class | Note |
|---|---|---|
| `features/governance` (policies/compliance/risk/metrics/audit/…) | **MOCK, UI-only** | backs `/director/governance/*` + `governance/workspace-model`; retire from authoritative UI after rebuild (23D, after dependency proof) |
| `features/policy` (engine) | **DERIVED-from-seed** | real engine; inputs from seeded `registries`; keep, surface honestly |
| `components/policy/*` | UI | consumes the real engine at `/director/policy` |
| `registries` mock | **LOAD-BEARING** | seeds the policy engine (+ knowledge/planning/etc.) — do not delete |
| `security-center` | **REAL, PROTECTED** | Phase 19; untouched |
| `enterprise-memory-admission-engine.evaluatePolicies` | REAL (headless) | policy evaluation used by admission |

Nothing deleted in 23A.

---

## 11. Persistence / runtime reality (Governance)

`ACTIVE_PROVIDER = "memory"` — in-memory, no durable governance store. Policy engine is deterministic + in-memory over seeded registry inputs. No live policy-instance evaluator is connected (Phase 17: governance gate `not-connected`). Security Center is the real connected read. No tenant-scoped governance persistence. Adapter/contract existence ≠ live connection.

---

## 12. Route / placeholder audit (Governance)

| Route | Real page | In `staticRoutes` | Sidebar item | Shadow risk |
|---|---|---|---|---|
| `/governance` | ✅ (workspace landing) | ❌ | ❌ (not moduleIndex) | low — **verify in 23B** |
| `/director/governance` (+ policies/compliance/risk/audit/permissions/explainability/approvals) | ✅ | ✅ | ✅ | none |
| `/director/governance/security` | ✅ Security Center | ✅ | ✅ | none (protected) |
| `/director/policy` | ✅ real policy engine | ✅ | ✅ ("Policy & Governance") | none — but **orphan from workspace nav** |

Phase-21 lesson flag: `/governance` is not in `staticRoutes`; confirm it is not a moduleIndex placeholder before 23B rebuild (the `/director/memory` / `/director/knowledge-graph` defect class). `/director/policy` (real engine) is disconnected from the authoritative Governance L2 — the core rebuild opportunity.

---

## 13. Candidate scoring (1–5; risk 5 = low)

| | A imp | B mat | C honest | D auth | E no-fake | F no-backend | G de-mislead | H leverage | I Heby | J risk | Total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Workforce | 4 | 3 | 2 | 2 | 2 | 3 | 4 | 3 | 3 | 1 | **27** |
| **Governance** | 5 | 4 | 3 | 4 | 4 | 4 | 5 | 5 | 4 | 4 | **42** |
| Platform | 3 | 2 | 2 | 3 | 3 | 2 | 3 | 3 | 2 | 3 | **26** |

**Governance wins decisively (42).**

---

## 14–16. Selected workspace + why it wins / others lose

**Phase 23 = Governance.** It has a real engine substrate (policy/rules/evaluation) plus a real anchor (Security Center, Phase 19); its authoritative nav is the most misleading (fabricated compliance/risk/audit scores); it holds the highest cross-workspace leverage (it is the governance gate Operations, Command, and Knowledge admission all reference); its scope is concentrated (11 routes); and it follows the proven Phase-21 pattern (a real substrate the authoritative UI ignores in favour of mock). **Workforce loses** on scope (27 pages), mock burden, and severe authority collision. **Platform loses** on external-provider dependence and near-zero honest surfaceable data.

---

## 17. Governance truth model

1. **Exists to:** hold the rules — policy, constraints, evaluation, compliance posture, risk, permissions, the audit record, explainability — and the security posture.
2. **Does NOT own:** human decisions (Decisions), execution (Operations), agents (Workforce), providers (Platform), goals (Command), memory (Knowledge).
3. **Real runtime today:** `policy` engine (deterministic, derived-from-seed); `security-center` (real, protected); `admission-engine.evaluatePolicies` (headless).
4. **Real persistence today:** none (in-memory); no live policy-instance evaluator connected.
5. **Safe to surface:** policy/rule/constraint vocabulary + structure; the evaluation pipeline shape; derived governance results honestly labelled derived-from-seed; real Security Center; honest connection states.
6. **Fabricated now:** complianceScore/auditHealth/risk scores/explainabilityCoverage/policy counts (`features/governance`).
7. **Honest-empty:** live policy instances, live evaluation results, compliance/risk metrics without a connected source.
8. **Reference/contract-only:** policy engine structure, rule model.
9. **Legacy redirect (later):** `/director/policy` → the rebuilt Governance Policies surface.
10. **Mocks that may retire (23D, after proof):** `features/governance` UI mock.
11. **Mocks that must remain:** `registries` (load-bearing seed), `agents/mock`.
12. **Protected — do not touch:** `security-center`, `policy` **contracts**, `enterprise-memory-admission-engine`, Decisions, Phase 17/18, Heby Core, Command/Intelligence/Knowledge/Operations, `auth`.
13. **Heby may:** explain policy / why-blocked / applicable rule / trace evidence.
14. **Heby may NOT:** create/modify policy, grant permission, approve, decide, evaluate authoritatively, act.
15. **Missing substrate:** a live, tenant-scoped policy-instance store + a connected policy evaluator (future, separately authorized).

---

## 18. Proposed minimal authoritative Governance IA

| # | Label | Route | Purpose | Backing | Initial state | Mutation | Owner |
|---|---|---|---|---|---|---|---|
| 1 | **Overview** | `/governance` | Governance state & availability map | governance vocabulary + honest states | derived/honest | read | Governance |
| 2 | **Policies & Rules** | `/director/governance/policies` (rebuild) | The real policy/rule/constraint set + evaluation pipeline | `policy` engine (derived-from-seed) | derived-labelled | read-only | Governance |
| 3 | **Compliance & Risk** | `/director/governance/compliance` (+risk merged) | Compliance posture + risk register — honest, no fabricated % | `policy` compliance/risk engines or honest-empty | derived / empty | read | Governance |
| 4 | **Audit & Explainability** | `/director/governance/audit` | The record + why the system acted | audit/explainability (honest) | honest-empty | read | Governance |
| 5 | **Security Center** | `/director/governance/security` | Security findings & response boundary | `security-center` (Phase 19) | **real** | read | Governance (protected) |

Permissions folds into Policies & Rules (or a 6th surface — **Director decision**). `/director/policy` and `/director/governance/{explainability,approvals}` disposition → 23C/23D. Prefer 5 authoritative surfaces.

---

## 19–20. Route & mock disposition proposal

- **Rebuild in place:** `/director/governance/policies` → real `policy` engine (retire `governance` mock authority); `/governance` → Overview.
- **Honesty-fix:** compliance/risk/audit/explainability/permissions pages (drop fabricated scores; derived/empty states).
- **Redirect (23D):** `/director/policy` → `/director/governance/policies`; `/director/governance/approvals` → Decisions (`/approvals`) if no independent authority.
- **Retire (23D, after proof):** `features/governance` UI mock — only if zero live importer post-rebuild.
- **Keep:** `registries` seed, `policy` engine, Security Center.

---

## 21. Protected systems

Security Center (Phase 19); `policy` contracts; `enterprise-memory-admission-engine`; Decisions/`approvals`; Phase 17 heby-actions; Phase 18 device-runtime; Heby Core/Runtime/Integration; Enterprise Memory; canonical-read; Command/Intelligence (Phase 20); Knowledge (Phase 21); Operations (Phase 22); goal-runtime; mission-runtime; auth; providers/computer-use; `registries` seed (load-bearing). Read-only consumption allowed; no modification.

---

## 22. Phase 23B plan (do not implement)

**Theme:** the authority core — surface the real policy engine, stop the mock.
- **Overview** (`/governance`): governance availability map (policy/rules/compliance/risk/audit/permissions/security connection states), honest, no fabricated scores. Verify no catch-all shadow.
- **Policies & Rules** (`/director/governance/policies`, rebuild): read the real `policy` engine (policy set + rules + evaluation pipeline), labelled **derived-from-seed / non-authoritative**; no fabricated counts. Absorb the `/director/policy` real surface.
- Reused (read-only): `policy` engine, governance vocabulary. Untouched: Security Center, Decisions, `policy` contracts, registries.
- Tests: no `governance` mock in the rebuilt authoritative pages; no fabricated %; derived labels; Heby advisory; nav intact; routes in staticRoutes (shadow guard).
- Browser: `/governance`, `/director/governance/policies` — honest, no fake scores, 200, one h1, no console errors.

## 23. Phase 23C plan (do not implement)

**Theme:** the rest of the record, made honest.
- **Compliance & Risk** + **Audit & Explainability**: honest posture (derived/empty), no fabricated compliance/audit/risk %.
- Honesty-fix Permissions.
- Security Center untouched (Phase 19).
- Tests + browser: no fabricated metrics; distinctions (policy ≠ decision; finding ≠ incident; compliance ≠ health).

## 24. Phase 23D plan (do not implement)

- `/director/policy` → `/director/governance/policies` redirect; `/director/governance/approvals` → `/approvals` if no independent authority (prove first).
- Retire `features/governance` UI mock **only** with zero-importer proof; keep registries/policy/Security Center.
- Route consolidation, catch-all shadow guard for Governance routes, cross-workspace validation (Decisions/Operations/Command boundaries), publication readiness.

---

## 25. Risks

1. **Decisions collision** — the `policy` engine has `decision-engine`/`approval-engine`; Governance must present evaluation, never a second human-approval system.
2. **Derived-from-seed honesty** — the policy engine reads seeded `registries`; outputs must be labelled derived, never live authoritative governance.
3. **governance mock load-bearing?** — `governance/workspace-model` + others may consume it; prove before any 23D retirement.
4. **Route shadow** — verify `/governance` is not a catch-all placeholder (Phase-21 defect class).

## 26. Director decisions genuinely required

1. **Confirm Governance as Phase 23** (evidence: score 42 vs 27/26).
2. **Policy engine surfacing** — present the real engine read-only labelled *derived-from-seed* (recommended), or honest-empty until a live evaluator connects?
3. **IA count** — 5 surfaces (Permissions folded) vs 6 (Permissions separate)?
4. **`/director/governance/approvals`** — redirect to Decisions (`/approvals`), or keep as a Governance read-only reference?

## 27. Deferred future architecture

A live, tenant-scoped policy-instance store + a connected policy evaluator + durable governance/audit persistence — none exist; all gated behind a separately authorized future phase. Governance in Phase 23 exposes the rules and their evaluation honestly; it does not connect a live evaluator.

---

**HEBUN UI PHASE 23A — NEXT WORKSPACE DISCOVERY + AUTHORITY AUDIT COMPLETE**
