# Hebun UI Phase 24A — Next Workspace Discovery + Authority Audit

Read-only discovery. One artifact. No code, mock, nav, contract, route, commit, tag, or push change.
Purpose: prove from repository reality which remaining workspace is the next completion target after
Command+Intelligence (20), Knowledge (21), Operations (22), Governance (23).

**Verdict: Platform is Phase 24. Workforce is deferred to Phase 25, blocked pending a strategic
department-disposition decision.** Evidence below.

---

## 1. Baseline

- Repo `hebun-ai-recovered`, branch `main`.
- HEAD `39ad6be540cccf37c8c78d0ce7aa125e13135454` == origin/main. ahead/behind 0/0. staged 0. tracked-mods 0.
- Publications intact: `hebun-ui-phase-20/21/22/23-*` tags all present.
- Phase 23 tag `hebun-ui-phase-23-governance-surface-completion-complete` peels to `39ad6be` (HEAD).
- No `hebun-ui-phase-24*` tag. Legacy generic `phase-24-complete` exists (old roadmap track — Scheduling/Observability numbering, same family as `phase-23-complete`); NOT the Hebun UI Phase 24 tag, untouched.
- No unexpected product/runtime changes. Untracked pre-existing docs remain (conscious-intelligence, product-vision drafts, `learnings.md`) — untouched.

## 2. Seven-workspace revalidation (from `workspace-nav.ts`)

Seven Level-1 workspaces + ambient Heby. Completed (carry `Phase 2X` honesty comments): Command (20),
Intelligence (20), Knowledge (21), Operations (22), Governance (23, incl. Security Center L2, Phase 19).
**Uncompleted (no honesty-phase comment, original state): Workforce and Platform.** No third unfinished
authoritative workspace exists. Decisions (`/approvals`) is a cross-workspace authority, not a rail workspace.

## 3. Remaining candidates

Workforce and Platform only. Both landing Overviews are already honesty-compliant (Phase 11 / Phase 13
empty-state, contract-only). Fabrication in both lives in the **child** L2 surfaces.

## 4. Workforce route inventory

L2 (nav): Overview `/workforce`, Agents `/agents`, Finance `/finance`, HR `/hr`, Legal `/legal`, Customer Ops `/tickets`. `match: /agents /finance /hr /legal /tickets`.

Pages (~27): `/workforce` (1) · `/agents` (1) · Finance (7: page, analytics, budgets, expenses, invoices, payments, tax-compliance) · HR (8: page, candidate-screening, employee-support, interviews, learning, offboarding, onboarding, performance) · Legal (9: page, compliance, contract-generation, contract-review, contracts, ip-trademark, policies, regulatory, risk) · Tickets (1).

## 5. Workforce authority audit

Current IA conflates four unrelated authorities under one workspace:
- **Agent definitions** (Agents) — plausibly Workforce.
- **Finance / HR / Legal / Customer Ops** — enterprise **domain applications**, NOT workforce responsibility. "Does Workforce own Finance? No. Legal? No. Support ops? No. HR organizational identity? Partially."

Collisions: agent **runtime/execution** overlaps Operations (Phase 22 owns execution + runtime observation); agent **permissions** overlap Governance; department apps have no owner in the seven-workspace model at all. Distinctions that must hold and currently blur: human ≠ AI agent; agent definition ≠ running agent; role ≠ capability ≠ permission ≠ authority; assignment ≠ execution; team ≠ orchestration runtime; department ≠ independent application.

## 6. Workforce runtime / persistence audit

- Overview `/workforce` → `getWorkforceWorkspaceModel()` (`features/workforce/workspace-model`) — **contract only**; Phase 11 renders honest empty states, explicitly "no seeded agent roster, no mock data, no model call, no authority act."
- Real substrate EXISTS but is unused by the pages: `agent-crud` ("first-class agent registry data layer": agent-service/projections/in-memory adapter) and `agent-runtime` (engine + agent-registry + context/responsibility/health/capability/authority/workload services). Real structure, in-memory, structurally empty.
- Persistence: in-memory adapter (`features/persistence/memory-adapter`), non-durable, empty.

## 7. Workforce mock / seeded audit (page imports)

Overwhelmingly fabricated: `legal/mock` (9), `hr/mock` (8), `finance/mock` (7), `agents/mock` (3), `tickets/mock` (1), plus finance/hr/legal `events` and `workflows/mock`, `approvals/mock`. `agents/mock` roster is fabricated with fake live metrics (`status:"running"`, `tasksToday:32`, `costToday:2.14`, `lastActive:"2m ago"`). Department pages import **no** runtime/persistence feature — pure domain mock.

Honesty classification: Overview **CONTRACT_ONLY** (honest). Agents roster **MOCK** (fabricated). Finance/HR/Legal/Tickets **MOCK** (fabricated, ~25 pages, the largest single fabrication surface in the app). Real agent substrate **REAL-STRUCTURE / NOT_CONNECTED** (present, unused, empty).

## 8. Department-app disposition (proposal, not executed)

Finance/HR/Legal/Customer Ops = **domain applications incorrectly nested under Workforce** (category B/C). They are not Workforce responsibility and have no honest home in the seven-workspace model. Correct disposition is a **strategic product decision** (retire to honest stubs / move to a future domain package / redirect), NOT a surface completion. This is Workforce's true blocker.

## 9. Platform route inventory

L2 (nav): Overview `/platform`, Providers & Runtime `/director/provider-matrix`, Integrations `/integrations`, Infrastructure (unavailable), Models & Tools (unavailable), Authentication (unavailable), Architecture Map `/architecture`, Settings `/settings`. `match: /integrations /architecture /settings /director/provider-{matrix,framework,routing,invocation} /director/providers /director/runtime /director/adapters`.

Pages (~18): `/platform` (1) · `/integrations` (1) · `/settings` (1) · Architecture (8) · `/director/provider-{matrix,framework,invocation,routing}` (4) · `/director/runtime`, `/director/runtime-activation`, `/director/adapters` (3).

## 10. Platform authority audit

Platform uniquely owns provider/model/tool **definitions + configuration**, integration configuration, infrastructure/environment configuration, and platform technical state. **No collision**: no other workspace claims provider/model config. One adjacency to enforce: Platform "Providers & Runtime" (provider/model config + invocation **contract** substrate) vs Operations "Runtime & Signals / Execution Substrate" (execution **observation**). Distinct: provider definition ≠ connection ≠ model availability ≠ live invocation ≠ execution authority; Platform config ≠ Operations execution.

## 11. Platform runtime / provider audit

- Overview `/platform` → `getPlatformWorkspaceModel()` + real non-authoritative Executive Overview — Phase 13 honest: "no configured provider/model, credential, or user record surfaced... honest empty states."
- **Real deterministic OFFLINE provider substrate**: `provider-matrix` (catalog by reference, capability matrix, gaps, metrics), `provider-framework`, `provider-routing`, `provider-invocation` (engine explicitly: "Offline only: valid contracts reach Ready; no real [invocation]"; rollback "never executed in this phase", "future live mutations"), `adapters`, `runtime-boundary`, `platform-core` (contracts-only). Provider descriptors registered: browser, claude, claude-live, codex, communication, computer-use, github — **descriptors, not connections** ("claude-live" is a contract; no live SDK exists).
- Persistence: in-memory, empty.

## 12. Platform mock / simulation audit

- `provider-matrix` page renders **fabricated** `Health {overallHealth}%` + network health/scores — misleading.
- `integrations/mock` (fabricated), `architecture/mock` (8 fabricated map pages).
- Provider invocation carries an explicit `simulation` flag throughout — SIMULATION_ONLY / CONTRACT_ONLY, honest by design at the engine layer, mis-presented as health at the page layer.

Classification: Overview **CONTRACT_ONLY** (honest). Provider catalog/matrix/routing/invocation/adapters **REAL-STRUCTURE / SIMULATION / NOT_CONNECTED**. Provider health/metrics **MOCK/DERIVED-fabricated**. Integrations **MOCK**. Architecture map **MOCK**. Live model **NOT_CONNECTED** (no SDK, no credentials, no invocation).

## 13. Heby Workforce boundary

`heby-integration/workspace-registry`: `workforce` → capability `workforce-inspection`, state **contract-only**; note "Organizational workforce identity — not a runtime agent." Heby may inspect/explain; must NOT create/terminate agent, assign work, promote role, change permissions, or execute tasks. Current truth: advisory, no-act. Clean.

## 14. Heby Platform boundary

`platform` → capability `platform-inspection`, state **contract-only**. Heby may inspect/explain; must NOT add provider, modify credentials, enable model, rotate key, connect service, invoke model, or activate Computer Use. Current truth: advisory, no-act. Clean.

## 15. Cross-workspace authority matrix (resolved)

| Concept | Authoritative owner |
|---|---|
| AI agent **definitions** | Workforce (future; real substrate `agent-crud`/`agent-runtime`, unused today) |
| Agent **runtime / execution** | Operations (Phase 22) — NOT Workforce |
| Provider / model **configuration** | **Platform** |
| Model **invocation** | Platform substrate (contract only; NOT_CONNECTED) — no live owner |
| Team membership / capability declaration | Workforce (future) |
| Permissions | Governance (Phase 23, policy/rule applicability) |
| Assignments / scheduling | Workforce (future) — must not imply execution |
| Human decision authority | Decisions (`/approvals`) |
| Policy / compliance / risk / audit | Governance |
| Security findings | Security Center (Governance L2) |
| Memory / knowledge | Knowledge (Phase 21) |
| Signals / candidates / recommendations | Intelligence (Phase 20) |

No concept has two authoritative owners. Platform's ownership is collision-free today; Workforce's requires arbitration (agent runtime→Operations, permissions→Governance) plus the department decision.

## 16. Mock / legacy dependency matrix

Workforce: `finance/hr/legal/tickets/mock` = **MOCK, UI-ONLY** (pure domain fabrication, no cross-system consumer). `agents/mock` = **MOCK, UI-ONLY**. `agent-crud`, `agent-runtime`, `workforce/workspace-model` = **LOAD_BEARING / STRUCTURAL_REFERENCE** (real, retain).
Platform: `provider-*` framework/matrix/invocation/routing, `adapters`, `platform-core`, `runtime-boundary` = **LOAD_BEARING / STRUCTURAL_REFERENCE / SIMULATION_ONLY** (real deterministic substrate; retain). `integrations/mock`, `architecture/mock` = **MOCK, UI-ONLY**. `providers/*` descriptors = **STRUCTURAL_REFERENCE**. No deletions proposed in 24A.

## 17. Persistence / composition matrix

Both: active provider = in-memory; database adapters may exist but are inactive/unconnected; seeded ≠ live; catalog ≠ availability; definition ≠ runtime instance; simulation ≠ execution. Neither has durable persistence or live connection today. Platform's substrate is contract-complete (invocation/routing/adapter contracts) and honestly not-connected; Workforce's agent substrate is real but empty and its department layer has no substrate at all.

## 18. Route / shadow audit

`/workforce` and `/platform` are real pages but NOT in `staticRoutes` (benign shadow-hygiene note — concrete files serve regardless; flag for 24D). Children `/agents /finance /hr /legal /tickets /integrations /architecture /settings /director/provider-matrix` are in `staticRoutes`. Legacy provider routes (`/director/provider-framework|routing|invocation`, `/director/runtime`, `/director/runtime-activation`, `/director/adapters`) exist as real pages reachable via `match` — candidates for consolidation/redirect in 24D. No duplicate authoritative routes found; several route names imply more capability than exists (fabricated provider health).

## 19. Candidate score table (5 = strongest / lowest risk)

| # | Criterion | Workforce | Platform |
|---|---|---|---|
| A | Enterprise importance | 5 | 4 |
| B | Runtime maturity | 3 | 4 |
| C | Honest data available now | 2 | 3 |
| D | Authority clarity | 2 | 4 |
| E | Improve without fake data | 3 | 4 |
| F | Improve without new backend architecture | 2 | 4 |
| G | Reduction of misleading UI | 5 | 3 |
| H | Cross-workspace leverage | 3 | 4 |
| I | Heby usefulness | 3 | 3 |
| J | Implementation risk (5=low) | 2 | 4 |
| | **Total** | **30** | **37** |

Workforce leads only on A (product core) and G (largest fabrication surface) — both gated behind the unresolved department decision. Platform leads decisively on authority clarity (D), backend-readiness (F), and risk (J).

## 20. Selected Phase 24 workspace

**Platform.**

## 21. Why Platform wins

1. **Ready now.** Its child surfaces (providers, integrations, architecture, settings) all genuinely belong to Platform — no homeless-domain blocker.
2. **Proven pattern.** Its provider stack is a real deterministic OFFLINE contract substrate — the exact class Phase 22 surfaced as Execution Substrate ("a contract is not a connected runtime"). Low-risk, high-honesty.
3. **Clean authority.** Uniquely owns provider/model/integration/infra config; zero two-owner collisions.
4. **High leverage.** Providers/models underpin all future agent execution, Heby, and Operations — foundational.
5. **Bounded fixes.** Strip fabricated provider health/metrics + surface real catalog/routing/invocation structure as NOT_CONNECTED. No new backend, no strategic re-architecture, no Director-gated domain question.

## 22. Why Workforce loses (for now)

Not unimportant — it is the product core and holds the biggest fabrication surface. But it is **not ready**: completing it honestly requires resolving the Finance/HR/Legal/Tickets homeless-domain question (a strategic Director decision), arbitrating agent runtime/execution against Operations and permissions against Governance, and surfacing a real-but-empty agent registry. That is a re-architecture, not a surface completion. Workforce = Phase 25, after its authority is settled.

## 23. Selected workspace truth model — Platform

1. **Exists to**: own the technical substrate — provider/model/tool definitions + configuration, provider routing/invocation **contracts**, adapter registry, integration configuration, infra/environment configuration, platform technical state. Configuration + capability catalog, not execution.
2. **Does NOT own**: execution authorization (Operations), human approval (Decisions), workforce/agent definitions (Workforce), governance policy (Governance), knowledge (Knowledge), recommendations (Intelligence), live model invocation (none — not connected).
3. **Real runtime authority today**: none live. Deterministic offline provider framework + platform-core contracts + real non-authoritative Executive Overview (dependency availability).
4. **Real persistence**: in-memory, empty. No credentials, no connected providers.
5. **Real read seams**: provider-catalog (by reference), provider-matrix, provider-gaps, provider-routing, provider-invocation (offline engine), adapters, runtime-boundary, platform-core contracts, platform/workspace-model.
6. **Mock/seeded/simulation**: provider health/metrics (fabricated %), integrations/mock, architecture/mock, `simulation`-flagged invocations, "claude-live" descriptor (not a connection).
7. **Current misleading UI**: Provider Matrix `Health X%`, any provider uptime/latency/token/cost, mock integrations, mock architecture map.
8. **Honest-empty**: configured providers, credentials, connected integrations, live models, deployment/infra health.
9. **Structural/reference**: provider catalog, capability matrix, routing/invocation contract structure, adapter registry, architecture map (de-fabricated reference).
10. **Authority boundaries**: provider definition ≠ connection ≠ availability ≠ live invocation ≠ execution authority; Platform config ≠ Operations execution.
11. **Heby boundaries**: platform-inspection contract-only; explain only; no add-provider/modify-credential/enable-model/rotate-key/connect/invoke/activate-Computer-Use.
12. **Missing substrate**: real provider connections, credential vault, live health/telemetry, deployment surface.
13. **Safe future seams**: provider connection state, credential presence (never values), integration connection state — all as NOT_CONNECTED today.
14. **Protected systems**: `providers/*` descriptors, `provider-*` engines, `platform-core`, `adapters`, `runtime-boundary`, device-runtime (18), Computer Use simulation boundary, Operations Phase 22 execution contracts, auth, Security Center, policy engine — consume read-only, never modify.

## 24. Proposed minimal authoritative IA (5 surfaces)

| # | Label | Route | User question | Backing | Availability | Mutation | Owner |
|---|---|---|---|---|---|---|---|
| 1 | Overview | `/platform` | What technical substrate exists, and what is connected? | workspace-model + Executive Overview | honest empty/not-connected map | none | Platform |
| 2 | Providers & Models | `/director/provider-matrix` | What providers/models are defined; is any connected? | provider-catalog/matrix/gaps (real, de-fabricated) | structure real; NOT_CONNECTED | none | Platform |
| 3 | Provider Runtime | `/director/provider-invocation` | How would invocation be routed/validated, and why nothing executes? | provider-routing + invocation offline engine | SIMULATION / NOT_CONNECTED | none | Platform |
| 4 | Integrations | `/integrations` | What external integrations are configured? | integrations (mock → honest empty) | NOT_CONNECTED | none | Platform |
| 5 | Infrastructure & Settings | `/settings` | What platform config/technical state is real? | settings + platform-core; secrets boundary | partial real; not-connected infra | none | Platform |

Every L2 answers one distinct enterprise question. Architecture Map folds into Overview-as-reference or a de-fabricated L3; "Models & Tools" folds into Providers & Models; "Authentication" stays external (auth-owned), unavailable. (Director decision D2 may fold #3 into #2 → 4 surfaces.)

## 25. Route disposition proposal (execute in 24D, not now)

- `/director/provider-framework`, `/director/provider-routing`, `/director/runtime`, `/director/runtime-activation`, `/director/adapters` → consolidate/redirect into the surviving Providers/Provider-Runtime surfaces (single hop, loop/chain-free).
- `/architecture/*` map → de-fabricate to reference or fold into Overview.
- Add `/platform` (and `/workforce`) to `staticRoutes` hygiene if needed to close the shadow note.
- No standalone provider-health route survives.

## 26. Mock disposition proposal (24D, with proof)

- `integrations/mock`, `architecture/mock` → retire/replace with honest empty once no live importer (proof required).
- `provider-*` real engines, `platform-core`, `adapters`, `providers/*` descriptors → **retain** (load-bearing structural substrate).
- Do not delete anything in 24A/24B; deletion only in 24D with zero-importer proof.

## 27. Protected systems (unchanged throughout 24)

`providers/*`, `provider-framework/matrix/invocation/routing`, `platform-core`, `adapters`, `runtime-boundary`, device-runtime (18), Computer Use simulation, Operations Phase 22 execution/runtime contracts, auth, Security Center (19), policy engine (23), Enterprise Memory (21), Decisions/`approvals`, Heby Core. Read-only consumption allowed; modification is not.

## 28. Phase 24B plan

- Scope: **Overview** (refine honest not-connected map) + **Providers & Models** (primary authority surface: real catalog/matrix/gaps; strip fabricated `Health %`/metrics; all providers NOT_CONNECTED; distinguish definition/connection/availability/invocation/execution).
- Read seams: `provider-matrix` (catalog/gaps), `platform/workspace-model`, Executive Overview.
- Models/components: new `features/platform-overview` + `features/platform-providers` (read-only) + surface components; no engine change.
- Protected: providers/provider-framework consumed read-only.
- Tests: overview honesty, providers structure + NOT_CONNECTED + no fabricated health/%/count, 5-surface nav intent, no mutation controls.
- Browser: `/platform`, `/director/provider-matrix` at 1280/375 — 200, one h1, no fake %, no controls, no console error, no overflow.
- Deletion rules: none. Non-goals: no provider connection, no live invocation, no Workforce work. Git gate: no commit/tag/push.

## 29. Phase 24C plan

- Scope: **Provider Runtime** (routing + invocation offline contract substrate, SIMULATION/NOT_CONNECTED — the "contract is not a connected runtime" showcase) + **Integrations** (mock → honest empty) + **Infrastructure & Settings** (real settings + honest infra + secrets boundary, never expose values). Legacy honesty fixes: architecture map de-fabrication; remove provider health across pages.
- Read seams: `provider-invocation`, `provider-routing`, `adapters`, `runtime-boundary`, `integrations`, `settings`, `platform-core`.
- Protected: provider engines read-only; secrets never read/exposed.
- Tests: invocation-substrate honesty (simulation/not-connected), integrations empty-honest, settings real vs not-connected, no fabricated latency/uptime/token/cost.
- Browser: the three routes at 1280/375, same honesty gates.
- Non-goals: no live connection, no credential handling. Git gate: no commit/tag/push.

## 30. Phase 24D plan

- Scope: dependency proof + mock retirement where safe (integrations/mock, architecture/mock) + legacy provider-route redirects/consolidation + `staticRoutes` shadow closure + Platform-vs-Operations runtime boundary closure + publication-ready.
- Deletion rules: only zero-importer-proven DEAD; retain all load-bearing provider substrate.
- Tests: legacy redirects (308, single-hop), mock retention/retirement proof, final IA, shadow guard.
- Browser: redirects + final surfaces. Git gate: implementation only, no commit/tag/push (publication is a separate gate).

## 31. Risks

- Platform is largely NOT_CONNECTED — surface value comes from honest structure + gaps (mitigant: proven Phase 22 Execution-Substrate precedent).
- Platform/Operations runtime-language adjacency could re-blur (mitigant: explicit boundary — config vs execution-observation).
- Secrets boundary: never read or render credential values (hard rule).
- Provider descriptors imply capability ("claude-live") that isn't connected — must render NOT_CONNECTED, never "available".

## 32. Director decisions genuinely required

1. **Confirm Platform** as Phase 24 (evidence-recommended) over Workforce.
2. **Provider Runtime**: separate L2 (#3) or folded into Providers & Models → 4 vs 5 surfaces.
3. **Architecture Map** disposition: Platform reference L2, fold into Overview, or move out.
4. **Settings** scope: platform configuration vs user preferences (shapes surface #5).
5. **Workforce department strategy** (Finance/HR/Legal/Tickets homeless domains): retire / future domain package / redirect — must be decided before Phase 25 Workforce.
6. **"claude-live"** and provider descriptors: confirm contract-only / not-connected for this phase (no live connection intended).

## 33. Deferred future architecture

Real provider connections + credential vault; live model invocation; real health/telemetry; deployment surface; Computer Use activation; Workforce completion (post department decision) with the real `agent-crud`/`agent-runtime` registry.

---

Phase 24A discovery complete. Selected next target: **Platform**. No implementation follows. Phase 24B NOT begun.
