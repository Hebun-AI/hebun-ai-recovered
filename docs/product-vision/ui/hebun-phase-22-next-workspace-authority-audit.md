# Hebun UI — Phase 22 Next-Workspace Authority Audit (Phase 22A)

**Status:** Phase 22A — Discovery / audit only. No product code changed. This is the single authorized artifact.

**Selected next workspace: Operations.**

**Baseline HEAD:** `f7e7b03b902cfef53b987b2d5faf97a0459d0331` (== origin/main, Phase 21 publication).

> Director principle held throughout: *Unknown > invented. Disconnected > simulated. Prepared ≠ authorized ≠ executed ≠ success. A runtime contract is not a connected runtime. A terminal icon is not terminal capability.*

---

## 1. Baseline

| Check | Result |
|---|---|
| branch | `main` |
| HEAD | `f7e7b03b902cfef53b987b2d5faf97a0459d0331` |
| origin/main | `f7e7b03…` (identical) |
| ahead / behind | `0 / 0` |
| staged / tracked-modified | none (only generated `tsbuildinfo` churn) |
| Phase 21 tag | `hebun-ui-phase-21-knowledge-surface-completion-complete` → `f7e7b03` ✅ |
| latest hebun-ui phase tags | 20, 21 |
| `hebun-ui-phase-22*` | absent ✅ |
| generic `phase-22*` | `phase-22-complete`, `phase-22-recovery-complete` — **unrelated recovery/DB track**, not Hebun UI |

Clean. No repair performed.

---

## 2. Phase 20 / 21 revalidation (from disk, `workspace-nav.ts`)

- **Seven workspaces** intact.
- **Command** — 8 destinations: Overview, Inbox, Briefings, Decisions→`/approvals`, Strategic Goals, Organization Health, Reports, Director Intent. No standalone Alerts; no duplicate decision authority. ✅
- **Intelligence** — 6 destinations; no Patterns; candidate/insight/recommendation kept distinct. ✅
- **Knowledge** — 4: Overview, Company Memory, Knowledge Graph, Registries. Company Memory → Enterprise Memory read seam; Knowledge Graph → canonical availability (no mock graph); Registries → structural directory (no fabricated metrics); `/memory` → `/director/memory`; Goal authority = Command, Policy authority = Governance. ✅ (committed `f7e7b03`, 240/240 tests)
- **Security Center** remains a Governance destination (`/director/governance/security`). ✅

No Phase 20/21 system modified in this audit.

---

## 3. Seven-workspace maturity matrix

Classification from traced backing imports (not UI appearance): **A** completed-authoritative · **B** partial · **C** legacy/mock-backed · **D** contract-only · **E** placeholder/unavailable · **F** mixed · **G** runtime-connected.

| Workspace | Class | Evidence |
|---|---|---|
| Command | **A** | Phase 20 authoritative (real goal-runtime, executive read models) |
| Intelligence | **A** | Phase 20 authoritative |
| Knowledge | **A** | Phase 21 authoritative (real Enterprise Memory read, canonical availability, honest directory) |
| **Operations** | **C/F** | Execution Center → `execution/mock` (fabricated health %); Workflows → seeded `runtimeProjectionRegistry`; Orchestration → `agents/mock`; Task Planning → seeded queue. **But** a large real runtime substrate sits underneath (execution engine, runtime-observability, observability, monitoring, heby-actions, device-runtime) |
| Workforce | **F/C** | Agents → `agent-runtime` (real-ish); Finance/HR/Legal/Customer-Ops → domain mocks (`finance`/`hr`/`legal`/`tickets`, all consume `agents`) |
| Governance | **B/F** | Security Center authoritative (Phase 19, `security-center`); Overview/Policies/Compliance/Risk/Audit → single `governance` feature (mock data) |
| Platform | **E/C** | 3 destinations `unavailable`; Providers/Integrations → provider/integration catalogs; external-provider dependent |

---

## 4. Selected Phase 22 workspace + reasoning

**Operations** — chosen on evidence against the eight criteria:

1. **Architectural dependency order.** Command → Intelligence → Knowledge → **Operations** (live work / execution) is the runtime backbone. Command already reaches into `/director/execution-center` (its `match`), and Intelligence derives signals from operational runtime.
2. **Runtime maturity.** Operations has the largest real substrate: `execution` engine (pipeline/queue/queries/metrics/monitor/retry/rollback/timeout), `runtime-observability`, `observability`, `monitoring`, `workflow-runtime`, `orchestration`, `execution-queue`, `live-dispatch`, plus the `heby-actions` (Phase 17) and `device-runtime` (Phase 18) execution boundary.
3. **Fabrication exposed.** Operations shows the most fabrication presented as live: Execution Center renders `Execution Health {n}%` and mock executions/failures; Orchestration uses mock agents; Workflows uses seeded projections. Highest honesty-correction value.
4. **Honest read-only readiness.** Real derived seams exist to surface without fabrication — `runtime-observability`/`observability`/`monitoring` observe the runtime's own operation.
5. **Execution / Computer-Use clarification.** Operations is exactly where the execution substrate truth must be told (Director §5). Phase 17/18 already encode it honestly; the UI does not yet.
6. **Command / Intelligence relationship.** Operations underpins both; `operations` is one of only **two** real Heby retrieval sources (the Executive Overview read model).
7. **Duplicate-authority risk.** Manageable if scoped read-only; the audit flags the exact lines Operations must not cross (Workforce agents, Governance policy, Decisions approval).
8. **Progress without inventing runtime.** Achievable — surface real observability + honest empty execution state + the Phase 17/18 truth. No new runtime required.

**Alternatives rejected:** *Governance* — partial (Security Center done), but a boundary/authority workspace with duplicate-authority risk (Decisions, policy) and less architectural centrality. *Platform* — external-provider dependent, 3 `unavailable` destinations, not ready. *Workforce* — large mock departments + agent-authority duplication risk, less foundational.

---

## 5. Current Operations L2 map

| Surface | Route | Backing feature | Backing runtime | Authority owner | State | Mock? | Real data? | Mutation? | Disposition |
|---|---|---|---|---|---|---|---|---|---|
| Executions | `/director/execution-center` | `execution/mock` | none (mock) | Operations | **MOCK** (fake health %) | yes | no | no | rebuild |
| Timeline | `/director/execution-center/timeline` | `execution/mock` | none | Operations | **MOCK** | yes | no | no | rebuild/merge |
| Failures | `/director/execution-center/failures` | `execution/mock` | none | Operations | **MOCK** | yes | no | no | rebuild/merge |
| Workflows | `/workflows` | `workflow-runtime` | seeded `runtimeProjectionRegistry` | Operations | **SEEDED** | seed | no | no | honesty-fix |
| Orchestration | `/director/orchestration` | `orchestration` | `agents/mock` | Operations | **MOCK** | yes | no | no | honesty-fix |
| Task Planning | `/director/task-planning` | `execution-queue` + `live-dispatch` | seeded in-memory queue | Operations | **SEEDED** | seed | no | no | honesty-fix |
| Events | `/events` | `enterprise-projection-providers` | derived projection | Operations | **DERIVED** (empty) | no | derived | no | honesty-fix |
| Landing | `/operations` | `director-dashboard-ui` | Command dashboard reuse | Operations | reuse | — | derived | no | rebuild → Overview |

Heby integration on these surfaces: advisory ambient shell only; no per-surface Heby retrieval wired.

---

## 6. Runtime authority map (traced UI → substrate)

| Concept | Real authority | Class | Instantiated / reachable | Data can exist now? |
|---|---|---|---|---|
| Execution runs | `execution/execution-pipeline` (`executionSessions`) | real engine, **in-memory, structurally empty** | library present; UI does **not** use it | no — nothing runs |
| Execution UI data | `execution/mock` | **mock** | UI-only | fabricated only |
| Workflow runs | `workflow-runtime` → `runtimeProjectionRegistry` | **seeded projection** | registry bootstrapped with seeds | seeded only |
| Orchestration | `orchestration` → `agents/mock` | **mock** | UI-only | mock only |
| Task queue | `execution-queue` + `live-dispatch` | **seeded in-memory** | seeded once from dispatch | seeded only |
| Events | `enterprise-projection-providers` | **derived projection** | projection provider | empty (no source events) |
| Runtime self-observation | `runtime-observability`, `observability` | **REAL derived signals** | instrumented (`observeProjectionRefresh`, `observeRuntimeStartup`) | yes — real but sparse |
| Monitoring / health | `monitoring` | **real engine** | monitor registry/engine | yes — but empty until fed |
| Operational read model | Executive Overview (Command/Platform) | **real derived, non-authoritative** | surfaced already | yes |
| Prepared action | `heby-actions` (Phase 17) | **contract + gates**; read-only invokable | reachable | actions describable; mutations non-executable |
| Device / Computer Use | `device-runtime` (Phase 18) | **contract-only**, empty registry | reachable | none |

**Composition root:** `enterprise-runtime-composition` (in-memory default). **Persistence:** `ACTIVE_PROVIDER = "memory"` — every runtime is process-local and structurally empty in production; there are no persisted executions, workflows, or events.

---

## 7. Execution / Computer-Use findings (core)

The execution substrate is **deliberately, honestly non-executable**. Evidence from the systems' own headers:

**Phase 17 — `heby-actions`:** *"Heby may PREPARE, PROPOSE, and ROUTE… must not silently authorize or execute… Prepared ≠ authorized ≠ executed, and eligible ≠ executed. Only READ_ONLY actions are actually invokable (delegating to the Phase 16 gate); every mutation stays honestly non-executable — its requirements reported as unmet/not-connected, never faked. No model, network, provider, shell, filesystem, device, secret… introduced."* Gates present: capability, governance, authority, execution, eligibility.

**Phase 18 — `device-runtime`:** *"contract-only… there is no real device registry (it is empty), no session runtime, and no Computer Use execution — the only Computer Use surface in the repository is an offline, simulation-only planning provider… camera, microphone, terminal, generic shell, unrestricted filesystem, and external browser control remain restricted/not implemented. Credential surfaces are always withheld."*

**`providers/computer-use`:** `framework: "Simulation"`; config: *"Must remain enabled because this phase supports simulation only."*

The prepared→executed chain, as it actually exists:

```
prepared action (heby-actions) → capability/governance/authority gates → eligibility
   → READ_ONLY: invokable via the Phase 16 gate
   → MUTATION: non-executable; requirements reported unmet/not-connected (never faked)
device action (device-runtime) → composes a Phase 17 prepared action → non-executable, honest failure mode
```

Explicit answers:

| Capability | Status |
|---|---|
| Terminal execution | **Not implemented** (restricted) |
| Shell execution | **Not implemented** (restricted) |
| Browser Computer Use | **Not implemented** — external browser control restricted; only offline simulation planning |
| Device control | **Contract-only** — empty registry, no session runtime |
| Filesystem mutation | **Not implemented** (restricted) |
| Any of these connected? | **None** |
| Contract-only | `heby-actions`, `device-runtime` |
| Intentionally restricted | terminal, shell, filesystem, camera, mic, external browser |

**What must become true before a real action executes:** a *connected* execution substrate + a real device/session runtime + wired authorization infrastructure + a connected provider SDK — none exist, all deliberately gated. This is an architectural decision, not a small adapter.

---

## 8. Operations boundary

Concept owners (real):
- **task** ≠ **workflow** ≠ **prepared action** ≠ **authorized action** ≠ **execution** ≠ **outcome** — each distinct in code (`task-planning`/`execution-queue`, `workflow-runtime`, `heby-actions` prepared, gates, execution engine, results).
- **failure ≠ incident**, **alert ≠ incident**, **receipt ≠ business result** — `execution` failures vs `monitoring` alert candidates; no incident authority exists (do not invent one).
- No **duplicate execution system**: `execution` (engine, empty) and `execution-queue`/`live-dispatch` (seeded) coexist — Operations must present one honest execution read model, not two.

---

## 9. Workforce boundary

- **Agents** are owned by `agent-runtime` / `agent-crud` (surfaced under **Workforce** `/agents`) and referenced by `orchestration` via `agents/mock`.
- Operations must **not** become a second Workforce: it may reference agent identity/assignment as read-only context, never define, create, or manage agents.

---

## 10. Governance boundary

- **Policy authority** = Governance (`policy` engine / `governance`); **authorization / human review** = Decisions (`/approvals`, `decision-runtime`); **security findings** = Security Center (`security-center`).
- Governance policy ≠ Director decision ≠ execution. Security finding ≠ operational incident. Operations must not duplicate Governance or mint incidents from alerts.

---

## 11. Heby boundary (Operations profile, real)

From `heby-integration/workspace-registry.ts`:

| Property | Value |
|---|---|
| authority | `advisory-only` |
| capabilities | `operational-inspection` (contract-only), `evidence-tracing` (contract-only) |
| sources | `operations`, `governance` |
| hebyMayAct | **false** |
| mayExplain | "Explain this operational state." · "What failed, and where is the human gate?" · "Heby explains operational state; it does not execute." |

The `operations` source is one of only **two** classes `source-resolver` backs with real derived data (the Executive Overview read model). **Heby may:** explain / summarize / investigate operational state, trace evidence, navigate. **Heby may not:** approve, authorize, mutate, execute, or create operational truth. Heby Core is not to be modified.

---

## 12. Persistence / provider map

| Subsystem | configured | connected | instantiated | persisted | tenant-scoped | read | write | prod-capable |
|---|---|---|---|---|---|---|---|---|
| storage-manager | `memory` (hardcoded) | in-memory | yes | no | no | yes | yes (mem) | **no** |
| enterprise-runtime-composition | in-memory default | in-memory | yes | no | n/a | yes | yes (mem) | no |
| canonical-read (Postgres) | env-gated | **no** (`missing_database_url`) | per-request | no | yes | yes | no | when configured |
| providers/computer-use | simulation only | **no** | — | — | — | — | — | **no (by design)** |
| providers/{claude,browser,codex,…} | simulation/contract | no | — | — | — | — | — | no |

An adapter existing (`postgresql`, provider SDKs) does **not** mean the app uses it. Default runtime is in-memory + empty; providers are simulation-only.

---

## 13. Mock / legacy dependency graph (Operations-relevant, real imports)

| Module | Importers | Load-bearing? | Safe to retire? | Disposition |
|---|---|---|---|---|
| `execution/mock` | execution-center pages + execution components only (UI) | **No** | after Execution rebuild | retire in 22D |
| `agents/mock` | orchestration, workforce, finance/hr/legal, planning, many | **Yes** | no | keep |
| `runtimeProjectionRegistry` seeds | workflow-runtime, memory-runtime, agent/goal/mission/org/decision builders | **Yes** | no | keep |
| `execution-queue` / `live-dispatch` seeds | task-planning UI + queue engine | in-app seed | after rebuild | honesty-fix, retire later |
| `director/mock` (Priority etc.) | execution/mock + others | **Yes** | no | keep |

No deletion in 22A. Only `execution/mock` is a clean retirement candidate (UI-only).

---

## 14. Fabrication findings (current Operations UI)

Presented as live but fabricated/seeded:
- **Execution Health %** (`executionMetrics.executionHealth`) — fabricated.
- Active executions, statuses, node states, failures, recovery — `execution/mock`.
- Timeline events — `execution/mock`.
- Orchestration agents/availability — `agents/mock`.
- Workflow runs/counts — seeded projection.
- Task queue items — seeded from dispatch.

Honest state classification: **real** — runtime-observability/observability/monitoring signals, Executive Overview; **derived** — events projection (empty); **seeded** — workflows, task queue; **mock** — execution-center, orchestration; **not-connected** — execution engine (empty), all execution/Computer-Use.

---

## 15. Route / placeholder findings

| Route | sidebar item | in `staticRoutes` | shadowed? |
|---|---|---|---|
| `/operations` | no | no | no (not a moduleIndex item) |
| `/director/execution-center` (+timeline/failures) | yes | yes | no |
| `/workflows` | yes | yes | no |
| `/director/orchestration` | yes | yes | no |
| `/director/task-planning` | yes | yes | no |
| `/events` | yes | yes | no |

**No current catch-all shadow defect in Operations** (unlike `/director/memory` and `/director/knowledge-graph` in Phase 21). Any 22B rebuild that adds a moduleIndex sidebar item must register it in `staticRoutes`; a Knowledge-style guard test should be extended to Operations routes.

---

## 16. Ready-now seams (strict)

**READY NOW** (real substrate, surfaceable read-only without fabrication):
1. **Execution substrate truth** — a pure honesty surface over Phase 17/18 contract state: prepared → gated → read-only invokable → mutations non-executable → device runtime empty → Computer Use simulation-only. No data required; it is the true story.
2. **Runtime self-observation** — `runtime-observability` / `observability` real signals (projection refreshes, runtime startup). Honest, real, possibly sparse/empty per process.
3. **Operational state read model** — the Executive Overview (already real on Command/Platform; the real Heby `operations` source).

**READY AFTER SMALL ADAPTER** (authority exists, UI-safe read view missing):
4. **Execution read model, honest-empty** — a read-only view over `execution-pipeline` sessions showing "no live executions / not-connected" instead of the mock (pattern: Company Memory over Enterprise Memory).
5. **Monitoring health** — `monitoring` engine read view (empty until fed).

**NOT READY** (needs new runtime / provider / architectural decision):
- Live execution monitoring with real runs (nothing runs; in-memory empty).
- Real workflow runs / real orchestration (seeded/mock).
- Any execution, terminal, shell, filesystem, device, or Computer Use (deliberately restricted).

---

## 17. Proposed Operations target IA (evidence-based; prefer few authoritative surfaces)

`OPERATIONS →`

| # | Surface | Purpose | Authority | Backing | Honest initial state | R/W | Heby | Phase |
|---|---|---|---|---|---|---|---|---|
| 1 | **Overview** | Operational state & availability map — what is connected/derived/seeded/not-connected | Operations (read) | availability map + Executive Overview | derived + honest states | R | explain | 22B |
| 2 | **Execution** | What is running — honestly | Operations (read) | `execution-pipeline` read view | **not-connected / no live executions** (no fake health) | R | explain | 22B |
| 3 | **Runtime & Signals** | The runtime observing its own operation + monitoring health | Operations (read) | `runtime-observability`/`observability`/`monitoring` | real, possibly empty | R | trace evidence | 22C |
| 4 | **Execution Substrate** | The prepared→authorized→executed truth; what Hebun can/can't do | `heby-actions` + `device-runtime` (read) | Phase 17/18 contract state | prepared/gated/read-only/non-executable/no Computer Use | R (read-only) | explain gates | 22C |

Legacy **Workflows / Orchestration / Task Planning / Events** → honesty-fixed (labelled seeded/derived/not-connected) or folded into Overview/Execution; not additional fabricated authoritative surfaces. Do not build a surface merely because legacy nav has one.

---

## 18. Phase 22B plan (do not implement)

**Theme:** kill the fabrication; establish the honest operational core.
- **CREATE** Overview (operational availability map, Executive Overview read, honest states).
- **REBUILD** Execution (`/director/execution-center`) off `execution/mock` → honest `execution-pipeline` read view: "no live executions / not-connected", no fabricated health/counts. Merge Timeline/Failures as honest empty sections.
- Authorities reused (read-only): `execution` engine read, Executive Overview, availability model.
- Untouched: heby-actions, device-runtime, Command/Intelligence/Knowledge, Enterprise Memory, canonical-read, Governance, Security Center, agent-runtime.
- Mock retirement candidates: none yet (retire `execution/mock` in 22D after rebuild proves it unused).
- Tests: execution read view honest-empty; no `execution/mock` import in the authoritative pages; Operations routes in `staticRoutes` (shadow guard); nav unchanged.
- Browser: `/operations`, `/director/execution-center` — no fake health %, honest empty, 200, one h1, no console errors.

## 19. Phase 22C plan (do not implement)

**Theme:** the real derived seam + the execution-substrate truth.
- **CREATE** Runtime & Signals (`runtime-observability`/`observability`/`monitoring` read views, honest empty).
- **CREATE** Execution Substrate (Phase 17/18 read-only truth: prepared/gated/read-only/non-executable/no Computer Use; provider simulation-only).
- **HONESTY-FIX** Workflows / Orchestration / Task Planning / Events (label seeded/derived/not-connected; no fabricated agents/metrics/runs).
- Authorities reused (read-only): heby-actions, device-runtime, monitoring, observability. Untouched: same protected set.
- Tests: no fabricated signals/metrics; Phase 17/18 state read-only; no mutation controls; Heby advisory.
- Browser: honest states across all Operations surfaces; no fake data.

## 20. Phase 22D closure plan (do not implement)

- Retire `execution/mock` (UI-only) after dependency proof; **keep** `agents/mock`, `runtimeProjectionRegistry`, `director/mock` (load-bearing).
- Legacy route disposition/redirects (e.g. duplicate execution routes); catch-all shadow guard extended to Operations.
- Cross-workspace validation (Command/Intelligence/Knowledge/Workforce/Governance boundaries intact; no duplicate agent/policy/decision authority).
- Heby boundary validation (advisory-only, no execution). Honesty + protected-system audit. Publication readiness.

---

## 21. Risks

1. **Duplicate authority.** Operations must stay read-only and not become a second Workforce (agents), Governance (policy), or Decisions (approval) system.
2. **Empty-but-honest UX.** Most real seams are structurally empty; the surfaces must feel intentional (like Company Memory), not broken.
3. **Load-bearing mocks.** `agents/mock` and `runtimeProjectionRegistry` power many systems — must not be deleted while honesty-fixing Operations.
4. **Execution temptation.** No shell/terminal/Computer-Use may be connected; the gates must not be weakened to make Operations "look" live.

## 22. Explicit non-goals

No execution, terminal, shell, filesystem mutation, device control, or Computer Use. No new runtime/persistence/provider. No gate weakening. No incident system invention. No Workforce/Governance/Decisions duplication. No 22B implementation in 22A.

## 23. Director decisions genuinely required

1. **Confirm Operations as Phase 22** (evidence strongly supports it; alternative was Governance).
2. **Execution Substrate surface** — build the explicit Phase 17/18 truth surface in Operations (recommended), or keep that truth only inside Heby explanations?
3. **Legacy Operations surfaces** (Workflows/Orchestration/Task Planning/Events) — honesty-fix in place (recommended) vs fold into Overview/Execution.

---

## 24. Validation & git state

Audit-only: no src/app/component/config/test modified, no deletion. Working tree shows only this new doc (`docs/product-vision/ui/hebun-phase-22-next-workspace-authority-audit.md`) plus pre-existing unrelated untracked docs. No commit, no tag, no push. Phase 22B not begun.

**HEBUN UI PHASE 22A — NEXT-WORKSPACE DISCOVERY + AUTHORITY AUDIT COMPLETE**
