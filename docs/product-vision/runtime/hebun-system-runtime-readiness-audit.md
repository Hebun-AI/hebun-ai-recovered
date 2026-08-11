# Hebun System-Wide Runtime Readiness Audit

**Program:** Hebun Runtime & Productization Program — Phase R1A
**Mode:** Discovery / architecture audit only (read-only). No runtime, code, config, migration, or git mutation.
**Audited HEAD:** `ac128e7f510cf4ceca299416e4f95d67594ae676`
**Date:** 2026-08-10
**Method:** Repository evidence only. Every claim below is grounded in a file the auditor read or a search the auditor ran. Where a subsystem self-declares its state in a header banner, that banner is quoted or cited.

> **Truth model used throughout.** A contract is not a connection. An adapter is not a connection. A schema is not persistence. A provider descriptor is not a provider session. A tool definition is not execution. Prepared ≠ authorized ≠ executed ≠ successful. Simulation is not execution. Derived data is not authoritative. A UI surface is not a runtime.

---

## 1. Baseline

| Check | Expected | Observed | Verdict |
|---|---|---|---|
| Branch | main | `main` | ✅ |
| HEAD | ac128e7… | `ac128e7f510cf4ceca299416e4f95d67594ae676` | ✅ |
| origin/main | == HEAD | `ac128e7f510cf4ceca299416e4f95d67594ae676` | ✅ |
| ahead / behind | 0 / 0 | `0 / 0` | ✅ |
| Staged files | empty | empty | ✅ |
| Phase 25 tag | present | `hebun-ui-phase-25-workforce-surface-completion-complete` | ✅ |
| 7/7 workspace program | closed | closed | ✅ |

**Untracked working-tree entries** are pre-existing user documents (`docs/product-vision/*.md`, `docs/architecture/*`, `learnings.md`, etc.). This audit does not touch them.

**Repository shape.** A single application: `apps/dashboard` (Next.js 16.2.10, React 19.2). No monorepo packages, no separate services. There is **no `graphify-out/`** in the repository despite the CLAUDE.md reference; discovery used direct tools.

**Tag topology.** 210 tags. Two families are relevant and remain separate:
- **UI program (closed):** `hebun-ui-phase-6b` … `hebun-ui-phase-25-*`.
- **Runtime substrate (contract phases):** `runtime-foundation-phase-1..8`, and the `phase-4c.*` / `phase-4d.*` / `phase-4e.*` series covering runtime authority, policy model, risk classification, human-approval contract, execution-permit lifecycle, runtime engine, execution session, execution pipeline, command dispatcher, adapter-invocation contract, retry/compensation, error architecture, and observability architecture — all tagged `-architecture-complete` / `-complete`. These are **contract/architecture completions, not connected runtime.**

Repository reality matches the expected baseline. No history normalization was performed.

---

## 2. Seven-Workspace Closure (control-plane baseline)

The seven authoritative workspaces are present as routes under `src/app/(dashboard)/` and as feature/component families. Each has an IA surface, an authority owner concept, a Heby boundary, and an execution boundary expressed as contracts.

| Workspace | Route | Authority surface (evidence) |
|---|---|---|
| Command | `/command`, `/director` | `features/command-*`, `director-workspace`, projection providers |
| Intelligence | `/intelligence` | `features/intelligence*`, `enterprise-intelligence` |
| Knowledge | `/knowledge`, `/memory` | `features/knowledge*`, `enterprise-memory*`, `canonical-*` |
| Operations | `/operations`, `/workflows` | `features/operations*`, `execution*`, `orchestration`, `live-dispatch` |
| Workforce | `/workforce`, `/agents` | `features/workforce`, `agent-*`, `agent-runtime` |
| Governance | `/governance`, `/approvals` | `features/governance*`, `policy`, `human-approval`, `decisions` |
| Platform | `/platform`, `/integrations` | `features/platform*`, `provider-*`, `runtime-*`, `integrations` |

This step is **not re-litigated**. It establishes only that the product control plane exists as a coherent, honestly-classified UI + contract layer. Its data is memory-backed/derived (see §4), which is consistent with the Phase 20–25 honesty classification.

---

## 3. System-Wide Runtime Inventory

The application follows a strict layering: `UI (server components) → feature modules → contracts/services → PersistenceAdapter → storage provider`. There is **no service/API tier** between UI and feature modules (see §19). ~150 feature modules exist under `src/features/`. Major runtimes/substrates:

| Subsystem | Owner (module) | Designed | Impl | Connected | Persisted | Executable | Authoritative | Provenance | Active provider | Ext dep | Main consumers |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Enterprise Memory | `enterprise-memory*` | Y | Y | N | N (memory) | N | N | in-memory/seeded | memory | none | Knowledge, Director |
| Canonical knowledge read | `canonical-read*`, `knowledge-read-facade` | Y | Y | N | N | Read-only | Derived | in-memory | memory | none | Knowledge |
| Knowledge CRUD | `knowledge-crud`, `crud-core` | Y | Y | N | N (memory) | N | N | in-memory | memory | none | Knowledge |
| Agent CRUD | `agent-crud` | Y | Y | N | N (memory) | N | N | in-memory | memory | none | Workforce |
| Agent runtime | `agent-runtime` | Y | Y | N | N | N | N | deterministic | memory | none | Workforce |
| Goal runtime | `goal-runtime` | Y | Y | N | N | N | N | deterministic | memory | none | Command |
| Mission runtime | `mission-runtime` | Y | Y | N | N | N | N | deterministic | memory | none | Command |
| Execution engine | `execution-engine` | Y | Y | N | N | Simulation | N | simulated (`failure-simulator`) | memory | none | Operations |
| Execution / queue | `execution`, `execution-queue` | Y | Y | N | N | Simulation | N | in-memory queue | memory | none | Operations |
| Live dispatch | `live-dispatch` | Y | Y | N (offline) | N | Internal only | N | deterministic offline | memory | none | Operations |
| Offline execution | `offline-execution` | Y | Y | N | N | Simulation | N | offline | memory | none | Operations |
| Workflow runtime | `workflow-runtime`, `workflows` | Y | Y | N | N | N | N | deterministic | memory | none | Operations |
| Orchestration | `orchestration` | Y | Y | N | N | N | N | deterministic | memory | none | Operations |
| Task planning | `task-planning` | Y | Y | N | N | Prepare-only | N | deterministic | memory | none | Operations |
| Runtime observability | `runtime-observability`, `observability`, `monitoring` | Y | Y | N | N (in-memory sink) | N | Derived | in-memory | memory | none | Platform |
| Policy / governance pipeline | `policy`, `governance` | Y | Y | N | N | Eval-only | N | deterministic | memory | none | Governance |
| Decisions / human approval | `decisions`, `human-approval`, `decision-runtime` | Y | Y | N | N | Prepare-only | N | contract vocabulary | memory | none | Governance |
| Heby actions | `heby-actions` | Y | Y | N | N | READ_ONLY only | N | deterministic | memory | none | All workspaces |
| Device runtime / Computer Use | `device-runtime` | Y (contract) | Partial | N | N | Simulation-only | N | empty registry | none | none | Platform, Security |
| Provider framework | `provider-framework` | Y | Y | N | N | Simulation | N | descriptors | none | none | Platform |
| Provider routing | `provider-routing` | Y | Y | N | N | Select-only | N | deterministic | none | none | Platform |
| Provider invocation | `provider-invocation` | Y | Y | N | N | Prepare-to-Ready | N | offline | none | none | Platform |
| Provider descriptors | `providers/claude`, `registries` | Y | Y | N | N | N | N | seeded records | none | none | Platform |
| Runtime activation / boundary | `runtime-activation`, `runtime-boundary` | Y | Y | N | N | Gate-only | N | contract | none | none | Platform |
| Integrations | `integrations`, `platform-integrations` | Y (contract) | Mock | N | N | N | N | mock | none | none | Platform |
| Persistence framework | `persistence`, `enterprise-persistence`, `enterprise-unit-of-work` | Y | Y | N (memory active) | N | N | N | memory adapter | memory | (pg dormant) | All |
| Auth / tenant context | `auth` | Y | Y | **N (unwired)** | N | N | N | contract | none | (supabase dormant) | none wired |
| Audit / receipts | `audit-log` (schema), `governance-audit-explainability` | Y | Partial | N | N (in-memory) | N | N | in-memory | memory | none | Governance |
| Scheduler / background | (none) | N | N | N | N | N | N | — | — | — | — |
| External connectors | (none real) | Contract | Mock | N | N | N | N | mock | none | none | Platform |

**Reading the table:** the system is broad and deep at the **Designed + Implemented (contract/deterministic)** level, and uniformly **Not Connected / Not Persisted / Not Executable** at the runtime level. Nothing in `src/features` performs network I/O (`0` `fetch` calls) or persists to a database (active provider is `memory`).

---

## 4. Persistence Readiness

**Highest-priority audit. The finding is unambiguous: nothing persists. The active storage provider is in-memory.**

### What exists (assets)
- **Schema:** 40 Drizzle tables under `src/db/schema/` — `agent`, `approval`, `audit-log`, `auth-identity`, `command`, `conversation`, `decision`(via governance), `document`, `event-log`, `execution`, `goal`, `governance`, `knowledge`, `knowledge-fact`, `memory`, `mission`, `organization`, `permission`, `plan`, `policy`, `provider`, `reasoning`, `role`, `role-permission`, `task`, `telemetry`, `user`, `user-session-context`, `workflow`, `working_memory`, and more.
- **Migrations:** 15 forward-only, timestamped SQL migrations under `src/db/migrations/` (foundation baseline → auth identity → enterprise projection repository → enterprise memory persistence), plus `BASELINE.md`, `SEQUENCING.md`, and a drizzle `meta/` journal.
- **Connection contracts:** `src/db/config/connection-contract.ts` (async DB primitives), `adapter-contract.ts`, `environment.ts` (typed `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`).
- **Real Postgres adapter code (dormant):** five files instantiate `new Pool({...})` from `pg`:
  - `features/persistence/supabase-postgres-adapter.ts`
  - `features/canonical-read/pg-read-client.ts`
  - `features/enterprise-persistence/postgresql.ts`
  - `features/enterprise-unit-of-work/postgresql.ts`
  - `features/enterprise-memory-persistence/composition.ts`
- **Codecs & repositories:** `persistence/*-postgres-codec.ts` (agent, workflow, registry, memory, knowledge-node), `repository-base.ts`, `storage-manager.ts`, `provider-registry.ts`, UnitOfWork under `enterprise-unit-of-work`.

### What is actually active
- `src/features/persistence/storage-manager.ts`: **`const ACTIVE_PROVIDER: StorageProvider = "memory";`** The `supabase`/`postgres` branches are commented out. Every collection resolves to `createMemoryAdapter`.
- `src/db/index.ts`: *"schema foundation only … for a **future** SupabasePostgresAdapter … No client, no connection, no migrations are created in this phase."*
- `src/db/config/environment.ts`: *"Inert until a real backend is activated … no throwing while the memory adapter is active."* `isDatabaseConfigured()` is the future activation gate; with no env set it returns `false`.
- `src/features/enterprise-runtime-composition/composition-root.ts:31`: default is `createInMemoryMemoryPersistence(eventBus)`. The Postgres variant (`:58`) is reachable only when `options.postgresConnectionString` is supplied — never supplied at runtime.
- **No `.env` file** exists at repo root or in `apps/dashboard`. No credentials are configured.

### Per-domain persistence truth
| Domain | Active provider | Durability | Tenant isolation | Schema | Migration | Read | Write | Tx | Recovery | Prod-ready |
|---|---|---|---|---|---|---|---|---|---|---|
| All domains (agent, knowledge, memory, execution, decision, workflow, audit, auth) | **memory** | none (process-local) | none (no tenant key applied) | exists | authored, not applied | in-memory | in-memory | contract only | none | **NO** |

**Smallest durable seam set required before Hebun is a real multi-tenant product** (dependency order): (1) activate `SupabasePostgresAdapter` for the **auth/identity + organization/membership** collections; (2) then **enterprise-memory + knowledge-fact** (tenant-scoped canonical data); (3) then **decisions/approvals + execution-permit + audit-log** (the durable authorization/audit spine). Everything else can remain memory-backed until its feature is activated.

---

## 5. Tenant + Auth Readiness

**Authentication exists as a well-formed feature module but is wired into nothing.**

### What exists
- `features/auth/`: `authentication-service.ts`, `request-authentication-container.ts`, `authorized-authentication-result.server.ts`, `provider/supabase-provider-adapter.ts`, `provider/authentication-provider.ts`, `tenant/tenant-context.ts`, `types/{application-session,canonical-identity,provider-authentication,authentication-result}.ts`, `environment/auth-environment.server.ts`, `errors/authentication-error.ts`.
- Schema support: `auth-identity.ts`, `user.ts`, `user-session-context.ts`, `membership.ts`, `organization.ts`, `role.ts`, `permission.ts`, `role-permission.ts`, `invitation.ts` + migrations `…auth_identity_schema_foundation.sql`, `…auth_session_digest_version.sql`.

### What is real
- `src/app/login/page.tsx` is **`redirect("/dashboard")`** — a stub. There is no sign-in flow.
- **No `middleware.ts`** anywhere → no edge route protection.
- `src/app/(dashboard)/layout.tsx` renders `<HebunShell>` with **no session resolution and no gate.**
- **`features/auth` is not imported by any route or component.** The only importer anywhere is `features/company-memory/read-service.ts` (a feature-to-feature type reference). The authentication service is effectively dead code from the runtime's perspective.

### Answers
| Question | Answer |
|---|---|
| Can Hebun identify the current user? | **No.** No session is resolved at any route. |
| Can Hebun identify the current tenant? | **No.** `tenant-context` exists as a contract; nothing populates it. |
| Server-side tenant context? | **No** (contract only). |
| Can a request fail closed? | **No.** No auth boundary to fail. |
| Can tenant A access tenant B data? | **N/A today** (single in-memory store, no tenants), but **there is no isolation mechanism** to prevent it once data exists. |
| Are dashboard routes protected? | **No.** Any route is publicly reachable. |
| Are authorities enforced server-side? | **No.** Authority is represented in UI/contracts only. |

---

## 6. Provider Connectivity Readiness

**Zero provider connectivity. No AI/model SDK is present; no network call is made anywhere in `src/features` (`0` `fetch`, `0` `@anthropic-ai`/`openai`/`@ai-sdk` imports).**

### Evidence
- `src/features/heby-runtime` banner: *"No model runtime exists in this repository, so generative answers are honestly unavailable and the model boundary reports UNAVAILABLE."*
- `provider-framework/provider-metadata.ts`: provider **types** carry `status: "framework-only"`; execution modes list `"simulation"`, `"sandbox"`, `"live"` but the framework is framework-only.
- `provider-invocation/invocation-lifecycle.ts`: *"Offline invocations are prepared up to 'Ready'; live states (Invoking → Completed / Timed Out …) are defined for future providers but **never entered in this phase**."*
- `features/providers/claude/*` is a full `ProviderAdapter` descriptor (`provider.ts`, `config.ts`, `capabilities.ts`, `health.ts`, `telemetry.ts`, `metrics.ts`, `events.ts`, `queries.ts`) with declared capabilities and health — but no SDK and no network, so it cannot invoke.
- `features/registries/records.ts` lists models (`gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`) with **seeded display telemetry** (`"17m ago"`, `health: 97`). These are registry display records, not sessions.

### Provider matrix
| Provider | Registered | Configured | Connected | Live-eligible | Invokable | Authorized | Executable |
|---|---|---|---|---|---|---|---|
| Claude (`providers/claude`) | YES (descriptor) | NO | NO | NO | NO | NO | NO |
| Claude-live | contract only | NO | NO | NO | NO | NO | NO |
| Codex / GPT (registry records) | SEEDED | NO | NO | NO | NO | NO | NO |
| Browser Provider (`pt-browser`) | descriptor (`framework-only`) | NO | NO | NO | NO | NO | NO |
| Computer Use Provider (`pt-computer`) | descriptor (`framework-only`) | NO | NO | NO | NO | NO | NO |
| Communication / GitHub | contract/mock | NO | NO | NO | NO | NO | NO |

Failure handling, rate limiting, and cost tracking exist as **contract shapes** (`invocation-retry`, `invocation-timeout`, `provider-config`, telemetry types), not as active controls. No cost figure is authoritative.

---

## 7. Execution Substrate Readiness

**The consequential-execution chain is fully modeled and fully offline. It stops the moment a real provider, device, or persistence would be required.**

Chain trace (Director/Heby intent → outcome):
1. **Intent → prepared action** — ✅ `heby-actions` prepares/proposes/routes. *"Prepared ≠ authorized ≠ executed."*
2. **Capability gate** — ✅ Phase-16 SAFE (read-only) tool-use gate (`heby-runtime`).
3. **Governance gate** — ✅ `policy/governance-pipeline`, `policy-evaluator`, `approval-engine` (deterministic, in-memory).
4. **Human authority** — ✅ modeled: `human-approval`, `decisions/workspace-model.ts` over the Heby Core Phase 6 approval **contract vocabulary**. Not persisted.
5. **Execution eligibility** — ✅ `execution-readiness`, `runtime-activation/activation-gates`. Reports unmet/not-connected honestly.
6. **Dispatcher** — ✅ `live-dispatch` exists: *"the real internal execution backbone … Fully offline: no providers, no APIs, no LLM, no timers, no async, no wall clock."*
7. **Provider/device/session** — ⛔ **chain stops here.** No provider session (§6), no device session (§7-CU), no external effect possible.
8. **Receipt** — ✅ shapes exist (`execution-report`, `offline-audit`, `invocation-artifacts`). Created in-memory only.
9. **Persistence** — ⛔ memory only.
10. **Observability** — ✅ in-memory sink, *"Nothing here is persisted."*

| Question | Answer |
|---|---|
| Can Hebun prepare? | **Yes** (deterministic). |
| Can Hebun request approval? | **Yes** (modeled). |
| Can a human decision be persisted? | **No** (memory only). |
| Can authorization be represented durably? | **No** (contract lifecycle, not a persisted object). |
| Can an action become executable? | **Only READ_ONLY**; all mutations honestly non-executable. |
| Is there a dispatcher? | **Yes**, offline (`live-dispatch`). |
| Can anything external run? | **No** (no provider/device/network). |
| Can a receipt be created? | **Yes**, in-memory. |
| Can a receipt be persisted? | **No.** |
| Can failures be correlated? | Partially — request-correlation context exists in `observability`, in-memory. |

---

## 8. Computer Use Readiness

`device-runtime` (Phase 18) is **contract-only foundation**. Its banner: *"no real device registry (it is empty), no session runtime, and no Computer Use execution — the only Computer Use surface in the repository is an offline, simulation-only planning provider."* `device-runtime/contracts.ts`: *"OFFLINE, SIMULATION-ONLY planning provider (no OS control…)."*

| Capability | State |
|---|---|
| Device runtime / registry | NOT IMPLEMENTED (empty registry) |
| Session runtime | NOT IMPLEMENTED |
| Capability descriptors | IMPLEMENTED (contract) |
| Browser control | SIMULATION (`pt-browser`, framework-only) |
| Terminal / shell | RESTRICTED / NOT IMPLEMENTED |
| Filesystem read/write | RESTRICTED / NOT IMPLEMENTED |
| Screen read / camera / microphone | RESTRICTED / NOT IMPLEMENTED |
| Provider execution | SIMULATION-ONLY |
| Approval requirements | IMPLEMENTED (routes through Phase 17) |
| Receipts | contract shapes only |
| Session isolation / sandbox / secrets | NOT IMPLEMENTED (credential surfaces always withheld) |

**Minimum architecture before real Computer Use could safely exist:** device/session identity → sandbox/isolation → per-action authorization (permit) → live policy evaluation → credential isolation (secrets vault) → audit + receipts (persisted) → kill switch → rate limits → tenant isolation → mandatory human review for consequential capabilities. None of these are real today.

---

## 9. Integrations Readiness

**No integration is connected. The surface is mock + descriptor.**
- `features/integrations/` contains a single `mock.ts`.
- `features/platform-integrations/` contains `contracts.ts`, `model.ts`, `index.ts` (descriptor shapes).
- Named services (Gmail, Google Calendar, GitHub, Slack) appear only inside mock/contract strings. There is **no OAuth, no adapter, no webhook handler, no polling/sync, no credential store.**

| Integration | Descriptor | Adapter | Auth | Connected | Read | Write | Webhook | Sync | Persistence | Tenant-safe |
|---|---|---|---|---|---|---|---|---|---|---|
| Gmail / Calendar / GitHub / Slack / CRM | mock/contract | NO | NO | NO | NO | NO | NO | NO | NO | NO |

**Missing globally:** a connector framework (OAuth client + token vault + refresh), a webhook ingress + verification layer, a durable sync/event-ingestion pipeline, and per-tenant credential isolation.

---

## 10. Decisions + Authorization Substrate

- `decisions/workspace-model.ts`: a read model whose *"ONLY real, Director-safe material … is the immutable Heby Core Phase 6 approval CONTRACT VOCABULARY."*
- `human-approval` provides status/lifecycle helpers; `decision-runtime` a deterministic service; `policy` provides `policy-evaluator`, `approval-engine`, `governance-pipeline`.
- The runtime tag series confirms the design depth: `phase-4d.5-human-approval-contract`, `phase-4d.6-execution-permit-architecture`, `phase-4d.7-runtime-execution-permit-lifecycle`.

| Question | Answer |
|---|---|
| Is a human decision durable? | **No** (memory). |
| Is authorization a persisted object? | **No** — a lifecycle/contract concept, not a stored record. |
| Can authorization be replayed/audited? | **No** (nothing persisted). |
| Can authorization expire? | Modeled in permit lifecycle contract; not enforced at runtime. |
| Scoped to tenant/action/resource? | Contract supports scoping; no tenant key is applied. |
| Is revocation modeled? | In contract (permit lifecycle); not runtime-enforced. |
| Can governance block execution after approval? | Modeled (post-approval policy gate); deterministic, in-memory. |
| Immutable audit path? | **No** (audit-log schema exists; not written). |

**Consequence:** real execution cannot yet be safely enabled — the durable authorization + immutable audit spine does not exist as stored state.

---

## 11. Observability + Audit Persistence

- `runtime-observability/composition.ts`: *"The sink is in-memory and append-only. **Nothing here is persisted.**"* Provides `observeRuntimeStartup`, `observeProjectionRefresh`, `collectedSignals`, plus test flush/reset hooks.
- `observability`: canonical signals, a collection pipeline, and **request-correlation context** (`createRequestCorrelationContext`, `normalizeProducerObservation`).
- `monitoring`: monitor definitions, evaluation windows, health history, alert candidates — deterministic, in-memory.
- `audit-log` schema + `command-audit`/`event-log` tables exist but are **not written** (memory provider).

| Signal type | State |
|---|---|
| Logs / metrics / traces | STRUCTURAL + IN-MEMORY |
| Audit events | SCHEMA exists, NOT persisted |
| Execution receipts | contract, IN-MEMORY |
| Provider/agent telemetry | DERIVED / SEEDED |
| Request correlation | IMPLEMENTED (in-memory) |
| Tenant / agent / action / decision / execution correlation | contract shapes; not persisted, no tenant key |

**Minimum before production runtime activation:** a persisted, append-only event/audit store keyed by `(tenant, request, actor, action, decision, execution)`, plus a durable sink for the existing in-memory correlation pipeline.

---

## 12. Enterprise Data Ingestion Readiness

**Hebun cannot ingest real organizational data today.** Search results across `src/features`: `upload` = 0 files, `chunk` = 0 files, `ingest` = 1 file, `embedding` = 5 files (contract/type references), `vector` = 4 files. There is no upload endpoint (no API routes at all — §19), no parser→chunker→embedder pipeline, and no vector store.

| Question | Answer |
|---|---|
| Ingest a document today? | **No** (no upload, no parsing pipeline). |
| Ingest email / CRM / Slack-Teams? | **No** (integrations are mock — §9). |
| Ingest databases? | **No** connector. |
| Generate canonical facts? | Contract exists (`knowledge-fact`, `canonical-*`) but only over seeded/in-memory data. |
| Admit memory? | `enterprise-memory-admission*` modules model admission; over in-memory data only. |
| Preserve provenance? | Provenance is a first-class contract concept (canonical read, no-fake-data doctrine) — strong asset. |
| Retrieve tenant-scoped data? | **No** (no tenant key, no persistence). |

Ingestion must not be inferred from the Knowledge UI: the UI renders derived/seeded projections.

---

## 13. Agent Runtime Readiness

`agent-runtime` exposes `AgentRuntimeEngine`, `agent-registry`, and context/health/capability/authority/workload services — all deterministic and memory-backed. `agent-crud` is *"first-class agent registry data layer"* over the memory adapter.

Lifecycle truth:
| Aspect | State |
|---|---|
| Agent definition | IMPLEMENTED (contract) |
| Agent persistence | memory only |
| Configuration / role / capability | IMPLEMENTED (contract) |
| Provider/model binding | **NONE** (no model runtime) |
| Tool binding | contract (Phase 17 side-effect classes) |
| Permission | contract (`agent-authority-service`) |
| Runtime session | NOT REAL |
| Task assignment | deterministic |
| Execution | NONE (offline) |
| Memory / observation / cost / receipt | contract / in-memory |

**Before an agent can honestly be called "running":** durable agent record → live model/provider binding → a real runtime session → tool binding + enforced permissions → a durable task queue → real execution → persisted memory/context → persisted observability + receipts + cost → a shutdown/kill path. None are real today.

---

## 14. Workflow / Orchestration Readiness

- `workflow-runtime`: engine, registry, context/hierarchy/responsibility/dependency/health/progress services (deterministic).
- `orchestration`: pipeline, queries, metrics.
- `task-planning`: *"Transforms a Decision Package into an Execution Plan via a fixed, traceable pipeline … No LLM, no randomness, no execution, no orchestration. It only prepares execution."*

| Aspect | State |
|---|---|
| Workflow definitions / dependency graphs | STRUCTURAL / real (deterministic) |
| Queues / scheduling | in-memory, deterministic |
| Retries / parallelism / handoffs | contract shapes |
| Agent assignment / approval gates | contract |
| Persistence / receipts | memory / contract |

**Can Hebun execute a workflow end-to-end today? No** — proven: the plan is produced deterministically, but dispatch is offline (`live-dispatch`) and no executor reaches any provider/device (§6–7).

---

## 15. Scheduler / Background Work Readiness

**No real background execution model exists.** Evidence: `setInterval` = 0 files, `cron` appears only as a redaction keyword in a security scrub list, no durable job/worker/consumer. The `queue`/`scheduler` name hits (44 / 14 files) are the **deterministic in-memory execution scheduler/queue** concepts (`execution-scheduler`, `execution-queue`, `live-dispatch`), which by their own banners run with *"no timers, no async, no wall clock."*

Consequence: monitoring, integrations sync, inbox, social, scheduled reports, autonomous agents, reminders, and recurring workflows have **no substrate to run on**. A durable job runtime (queue + workers + retries + schedule) is a net-new build.

---

## 16. Production Security Readiness

`security-center` (Phase 19) is a **Governance Level-2 surface**, contract-only + honest UI: *"no live security feed exists, so there is no fabricated incident, finding, signal … every populated collection is empty and every source is derived or not-connected."* It enforces category discipline (*"a degraded runtime is not an attack, unavailable auth is not identity compromise"*).

**Security Center UI ≠ production security controls.** Actual controls:
| Control | State |
|---|---|
| Secrets management | NONE (no `.env`, no vault) |
| Auth / session | UNWIRED (§5) |
| Tenant isolation | NONE |
| RBAC / ABAC | contract (`role`, `permission`, `policy`) — not enforced server-side |
| Execution authorization | contract (permit) — not persisted |
| Provider / device credentials | NONE (withheld by design) |
| Encryption / RLS | NONE active (Supabase RLS is future) |
| Audit | schema only |
| Rate limiting | contract only |
| Network boundaries / sandboxing | NONE |
| Backup / recovery / retention / deletion | NONE |
| Incident handling | UI surface only |

---

## 17. Customer / Tenant Productization

| Capability | State |
|---|---|
| Signup | NOT IMPLEMENTED |
| Login | MOCK (`redirect("/dashboard")`) |
| Tenant / organization creation | SCHEMA exists; no flow |
| Admin roles | contract (`role`/`permission`) |
| Member invitation | SCHEMA (`invitation.ts`); no flow |
| Tenant settings | PARTIAL (settings route, memory) |
| Plans / packages / quotas / usage limits | NOT IMPLEMENTED |
| Provider / agent / Heby limits | contract shapes only |
| Billing / subscription / metering | NOT IMPLEMENTED / EXTERNAL |
| Audit access / data export / deletion | NOT IMPLEMENTED |
| Support / admin tooling | NOT IMPLEMENTED |

**Hebun is not ready for real customer onboarding.** The identity/organization schema is a strong starting asset, but no onboarding flow, quota, or billing exists.

---

## 18. Heby Productization

Heby is the most rigorously honest subsystem. Across `heby-core` (Phases 1–9 identity/context/presentation/grounding/intent/approval), `heby-integration` (Phase 15 context/request/response contracts), `heby-runtime` (Phase 16 evidence assembly + SAFE read-only tool gate), and `heby-actions` (Phase 17 prepare/propose/route):

| Heby can… | Reality |
|---|---|
| Explain / present grounded, attributed material | **Yes** (anti-hallucination, provenance-checked). |
| Assemble evidence from settled sources | **Yes** (deterministic, non-authoritative). |
| Interpret natural language | Boundary exists, but treats interpretation as *untrusted model-shaped input*; **no model produces it** (UNAVAILABLE). |
| Generate answers | **No** — *"generative answers are honestly unavailable; the model boundary reports UNAVAILABLE."* |
| Prepare / propose / route actions | **Yes**, without authorizing or executing. |
| Execute | **Only READ_ONLY**; every mutation honestly non-executable. |
| Memory / conversation persistence, quotas, cost, rate limits, fallback | contract only; not connected. |

**Missing for a production Heby:** a live model connection behind `runtime-activation`, response validation + persistence, per-tenant conversation persistence, quotas/rate limits/cost tracking, and error/fallback handling wired to a real provider.

---

## 19. API / Service Boundary

**There is no application/service API layer.** Evidence: `0` files with `"use server"`, `0` `route.ts`/API routes under `src/app`, no `middleware.ts`, no command/query bus.

- UI (server components) imports **feature modules directly** — e.g. `app/(dashboard)/director/page.tsx` imports `getDirectorWorkspaceProjection`, `getEnterpriseIntelligenceProjection`, `getHebyContextProjection` from `@/features/enterprise-projection-providers` and awaits them.
- Deep runtime modules are consumed directly by pages; there is no tenant-aware command/query surface, no authorization middleware, and no transaction boundary at a service edge.

**Productization needs:** a stable server boundary (route handlers or server actions) that is tenant-aware, carries authorization middleware, and owns transaction boundaries — inserted between UI and feature modules without disturbing the Phase 20–25 UI.

---

## 20. Deployment / Operations Readiness

| Area | State |
|---|---|
| Environments / env vars | none configured (no `.env`, no `.env.example`) |
| Secrets | none |
| Migrations | authored, never applied |
| Startup / health / readiness checks | none (no health route) |
| Logging / alerting | in-memory only |
| Backups / restore | none |
| CI | none (`.github/workflows` absent) |
| Tests | **256 test files** run by `scripts/run-tests.mjs` via `tsx` (strong asset) |
| Release / rollback / feature flags | none (runtime-activation provides a gate concept) |
| Config validation | `isDatabaseConfigured()`, `activation-validator` contracts |
| Vercel config | none (`vercel.json` absent) |

The application is a **buildable, well-typed, heavily-tested Next.js app** with **no deployment, CI, or operational substrate**.

---

## 21. System-Wide Reality Matrix

States: **YES / PARTIAL / NO / SIM (simulation) / MEM (in-memory) / CONTRACT / NC (not-connected)**.

| Subsystem | Designed | Implemented | Connected | Persisted | Authorized | Executable | Observable | Prod-ready |
|---|---|---|---|---|---|---|---|---|
| Persistence framework | YES | YES | NO (memory active) | NO | — | — | PARTIAL | NO |
| Auth / tenant | YES | YES | NO (unwired) | NO | NO | — | NO | NO |
| Provider framework | YES | YES | NO | NO | NO | SIM | PARTIAL | NO |
| Provider invocation | YES | YES | NO | NO | NO | NO | PARTIAL | NO |
| Heby (core→actions) | YES | YES | NO (no model) | NO | CONTRACT | READ_ONLY | PARTIAL | NO |
| Execution engine / dispatch | YES | YES | NO (offline) | NO | CONTRACT | SIM/internal | PARTIAL | NO |
| Decisions / authorization | YES | YES | NO | NO | CONTRACT | NO | PARTIAL | NO |
| Policy / governance | YES | YES | NO | NO | CONTRACT | eval-only | PARTIAL | NO |
| Agent runtime | YES | YES | NO | MEM | CONTRACT | NO | PARTIAL | NO |
| Workflow / orchestration | YES | YES | NO | MEM | CONTRACT | NO | PARTIAL | NO |
| Device runtime / Computer Use | YES | PARTIAL | NO | NO | CONTRACT | SIM | PARTIAL | NO |
| Integrations / connectors | CONTRACT | MOCK | NO | NO | NO | NO | NO | NO |
| Enterprise memory / ingestion | YES | PARTIAL | NO | MEM | — | — | PARTIAL | NO |
| Knowledge (canonical read) | YES | YES | NO | MEM | — | read-only | PARTIAL | NO |
| Observability / audit | YES | YES | NO | NO (in-memory) | — | — | MEM | NO |
| Scheduler / background | NO | NO | NO | NO | — | NO | NO | NO |
| Security (controls) | PARTIAL | CONTRACT | NO | NO | NO | NO | PARTIAL | NO |
| API / service boundary | — | NO | — | — | NO | — | — | NO |
| Customer productization | PARTIAL | NO | NO | NO | NO | NO | NO | NO |
| Deployment / CI / ops | PARTIAL | NO | NO | NO | — | — | NO | NO |

**One-line reading:** uniformly strong on **Designed + Implemented (contract/deterministic)**; uniformly **NO** on **Connected / Persisted / Executable / Production-ready**. This is exactly what the honesty doctrine predicts.

---

## 22. Critical Path to First Real Customer

Goal: *"One real customer can sign in, connect data, use Heby, and trust the result."* Ordered by dependency, not excitement.

1. **Durable persistence for identity** — activate `SupabasePostgresAdapter` for auth-identity, user, organization, membership, role/permission (flip `ACTIVE_PROVIDER` per-collection in `storage-manager.ts`; supply `DATABASE_URL` + Supabase env; apply the 15 authored migrations).
2. **Wire authentication** — real `/login` flow via `supabase-provider-adapter`, `middleware.ts` gating `(dashboard)/*`, session resolution in the dashboard layout, tenant context populated server-side.
3. **Server-side authorization + service boundary** — introduce a tenant-aware command/query edge (server actions or route handlers) with authorization middleware and transaction boundaries (§19).
4. **Tenant-scoped persistence for canonical data** — enterprise-memory + knowledge-fact on Postgres with a `tenant_id` key and RLS.
5. **One real provider for Heby** — connect a single model (Claude) behind `runtime-activation`; validate + persist responses; enforce quota/rate/cost.
6. **Minimal data ingestion** — document upload → parse → chunk → embed → tenant-scoped retrieval (net-new pipeline).
7. **Persisted observability/audit** — durable sink keyed by tenant/request/actor.

Trust is earned at step 4–7: tenant-scoped, provenance-checked, persisted answers over the customer's own data.

---

## 23. Critical Path to Safe Execution

Goal: *"Hebun can execute one consequential action safely."* Derived from the code's own chain (§7) and permit architecture (`phase-4d.6/4d.7`, `phase-4e.4` dispatcher):

1. **Durable tenant/auth** (§22 steps 1–3) — you cannot authorize what you cannot attribute.
2. **Durable decisions/authorization** — persist the human-approval record and the **execution permit** as stored objects (scope, expiry, revocation).
3. **Live governance/policy evaluation** at execution time — `policy-evaluator` + `governance-pipeline` gating on the persisted permit.
4. **Dispatcher wiring** — connect `live-dispatch`/`command-dispatcher` to exactly **one** real adapter (recommended: a **sandboxed browser provider**, lowest blast radius).
5. **Provider/device runtime** — a single, isolated, credential-scoped execution surface with a kill switch.
6. **Receipt persistence** — write `execution-report`/`invocation-artifacts` durably.
7. **Audit/observability persistence** — immutable, correlated trail.
8. **Kill / revoke controls** — enforce permit revocation and a global stop.

Order is strict: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Do not skip 2–3; execution without a persisted, revocable permit and immutable audit is unsafe.

---

## 24. Critical Path to Real Agents

Before Hebun may truthfully display *"Agent X is running":*
1. Durable agent definition (persist `agent` + `agent_cognitive_binding`).
2. Live model/provider binding (§22 step 5) bound to the agent.
3. A real runtime session (net-new; today `agent-runtime` is deterministic, sessionless).
4. Tool binding + enforced permissions (`agent-authority-service` → real Phase 17 side-effect gating).
5. Durable task queue (net-new; §15).
6. Real execution (§23 chain).
7. Persisted memory/context (enterprise-memory on Postgres).
8. Observability + receipts + cost tracking (persisted).
9. Shutdown/kill path.

Steps 3, 5, and 9 are the true net-new builds; the rest reuse the §22–23 foundations.

---

## 25. Proposed Runtime & Productization Program

A new naming system (do not continue "Phase 26/27"). Five phases, ordered by repository dependency.

### R1 — Durable Foundations
- **Goal:** Real identity + durable tenant-scoped persistence + a server boundary.
- **Why now:** everything else (providers, execution, agents, ingestion) depends on knowing *who* and *which tenant*, and on data surviving a restart.
- **Dependencies:** none (schema + adapters already authored).
- **Systems touched:** `persistence/storage-manager`, `db/*`, `auth/*`, new `middleware.ts`, new service edge.
- **Protected authorities:** Phase 20–25 UI unchanged; Director boundary preserved.
- **Becomes available:** sign-in, tenant context, durable core data, server-side authorization.
- **Remains unavailable:** providers, execution, ingestion, agents.
- **Exit:** a real user signs in; tenant-scoped data persists across restart; routes fail closed.

### R2 — Connectivity
- **Goal:** One real provider live for Heby (read/answer), validated and persisted.
- **Why now:** trust requires real, attributed answers over real data.
- **Dependencies:** R1.
- **Systems touched:** `runtime-activation`, `provider-framework`, `providers/claude`, `heby-runtime`, observability persistence.
- **Becomes available:** grounded Heby answers with real model output (still validated, non-authoritative), per-tenant conversation persistence, cost/rate tracking.
- **Remains unavailable:** consequential execution, Computer Use, integrations.
- **Exit:** Heby answers from a real, validated, attributed, tenant-scoped model response that is persisted.

### R3 — Execution
- **Goal:** Execute one consequential action safely (§23).
- **Dependencies:** R1, R2.
- **Systems touched:** decisions/human-approval persistence, execution-permit, policy/governance eval, `live-dispatch`/dispatcher, one sandboxed adapter, receipts + audit persistence, kill switch.
- **Becomes available:** a single, revocable, audited consequential action.
- **Remains unavailable:** general Computer Use, multi-provider, autonomous agents.
- **Exit:** one action runs end-to-end with a durable receipt and working revoke.

### R4 — Customer Productization
- **Goal:** A customer can onboard, connect their data, and use Heby on it.
- **Dependencies:** R1–R3.
- **Systems touched:** signup/onboarding, org/member/roles, quotas/limits, ingestion pipeline (upload→chunk→embed→retrieve), export/delete, admin tooling.
- **Becomes available:** self-serve onboarding + real enterprise data + tenant-scoped retrieval.
- **Exit:** a customer onboards and gets trustworthy answers over their own connected data.

### R5 — Production Hardening
- **Goal:** Operate safely at SLO.
- **Dependencies:** R1–R4.
- **Systems touched:** secrets/vault, RLS, rate limits, backups/restore, CI, health/readiness, alerting, incident, retention/deletion, feature flags.
- **Exit:** production-grade reliability, security, and recoverability.

---

## 26. Enterprise Domains Disposition

Finance, HR, Legal, Customer Ops exist today as **legacy mock surfaces** (`features/{finance,hr,legal}` = `events.ts` + `mock.ts`; Legal has route sub-surfaces). Do not implement them now, and do not create an eighth workspace.

**Where they belong:** an **Enterprise Domains layer** rendered *on top of* the seven core workspaces — configurable, tenant-installed business modules (vertical packs) that consume the same runtime substrate (persistence, providers, execution, governance, memory). This implies a future **module/marketplace** model: domains are installable applications, not new fixed navigation. Strategy only — build after R4, when the substrate can actually back a domain.

---

## 27. Social / Marketing / Communications Ownership

No substrate exists today (integrations are mock; no scheduler; no ingestion). Clean ownership for the future product model:

- **Connectivity → Integrations layer:** Gmail, Slack/Teams, social accounts, CRM = connectors (OAuth + webhook + sync), owned by Platform/Integrations.
- **Execution → Operations + Scheduler:** publishing, sequences, monitoring inboxes require the durable background runtime (§15).
- **Product packaging → Enterprise Domains (§26):** "Marketing", "Support/Comms", "Social" are **domain modules/vertical packs**, not core workspaces.
- **Oversight → Command/Governance:** approvals, brand/risk policy, and Director boundary remain in the core.

This keeps the seven core workspaces clean while giving social/marketing/comms a real home later.

---

## 28. Top 10 Blockers

1. **No durable persistence** — `ACTIVE_PROVIDER = "memory"`; nothing survives a restart.
2. **No authentication wiring** — login stubs to `/dashboard`; no middleware; routes unprotected.
3. **No tenant isolation** — no tenant key applied anywhere; no RLS.
4. **No provider connectivity** — 0 SDKs, 0 network calls; Heby generative output is UNAVAILABLE.
5. **No service/API boundary** — UI imports runtime modules directly; no authz/transaction edge.
6. **No durable authorization/audit** — approvals/permits and audit-log are contracts/memory, not stored.
7. **No data ingestion** — no upload/parse/chunk/embed/retrieve pipeline.
8. **No background/job runtime** — no scheduler/worker/queue that actually runs over time.
9. **No secrets/deployment/CI** — no `.env`, no vault, no `.github`, no health route, no `vercel.json`.
10. **No customer productization** — no signup/onboarding/quota/billing/export/delete.

---

## 29. Top 10 Assets Already Built

1. **Honesty doctrine, enforced in code** — pervasive banners; empty-not-fake collections; `status: "framework-only"`; UNAVAILABLE boundaries. This is the single most valuable asset for safe productization.
2. **Complete, coherent 40-table schema + 15 forward-only migrations** ready to apply.
3. **Storage abstraction with a single swap point** (`storage-manager.ts`) and **already-written Postgres/Supabase adapters + codecs + UnitOfWork** (dormant).
4. **Full auth/identity module** (Supabase provider adapter, tenant context, session/identity types) awaiting wiring.
5. **Rigorous Heby stack** (Core Phases 1–9 + integration + runtime + actions) with grounding/anti-hallucination and a SAFE read-only tool gate.
6. **Deep, honest execution architecture** — prepared/eligible/authorized/executed separation, offline dispatcher, permit lifecycle contracts.
7. **Policy/governance engine** (evaluator, approval engine, post-approval gate) as deterministic code.
8. **Provider framework + routing + invocation contracts** (capability match, health filter, fallback, retry/timeout/cancellation) ready for a real adapter.
9. **Observability with request-correlation** and a clean in-memory sink to point at a durable store.
10. **256 tests + typed build** (`npm run verify`: lint + typecheck + test + build) — a strong safety net for activation work.

---

## 30. Director Decisions Required

1. **Persistence backend:** confirm **Supabase Postgres** as the R1 target (env is already shaped for it). Gate: schema/migration application.
2. **First real provider:** confirm **Claude** as the single R2 provider, and the model + budget/rate ceilings.
3. **First executable adapter (R3):** confirm the **sandboxed browser provider** as the lowest-risk first consequential surface (vs. deferring execution entirely).
4. **Tenancy model:** single-tenant pilot first, or multi-tenant + RLS from R1? (Recommendation: build the tenant key from R1 even for a single pilot tenant.)
5. **Enterprise Domains:** approve the "installable module on top of seven workspaces" direction (no eighth workspace).
6. **Scope discipline:** approve building R1 **only**, and explicitly **not** building providers/execution/ingestion until R1 exits.

---

## 31. Exact Recommended Next Phase

**R1 — Durable Foundations.** Concretely, in dependency order:
1. Provision Supabase; set `DATABASE_URL` + Supabase env (Director-gated secret step).
2. Apply the 15 authored migrations to a real database (Director-gated).
3. Flip `storage-manager.ts` to route **identity/org/membership/role/permission** collections to the Supabase adapter (keep everything else memory).
4. Wire `/login` to the real provider adapter; add `middleware.ts`; resolve session + tenant in the dashboard layout; make routes fail closed.
5. Introduce a thin tenant-aware server boundary (server actions/route handlers) with authorization middleware and a transaction boundary.
6. Add a health route + config validation + first CI workflow running `npm run verify`.

**Exit criteria:** a real user signs in; a tenant is resolved server-side; core identity/org data persists across restarts; unauthenticated requests to `(dashboard)/*` are rejected; `npm run verify` is green in CI.

Each connection step (secrets, migration apply, provider connect) is a **🚦 Director gate** — do not perform it inside a discovery task.

---

## 32. What NOT to Build Yet

- ❌ Live provider/model calls, Computer Use, shell/terminal/browser/device execution.
- ❌ Real integrations/OAuth/webhooks (keep mock until R4 connectivity is scoped).
- ❌ Autonomous agents / "Agent X is running" (requires R1–R3 first).
- ❌ Billing/metering/quota engines beyond contract shapes.
- ❌ An eighth workspace or any Enterprise Domain implementation.
- ❌ A background/scheduler runtime before there is durable state to schedule over.
- ❌ Any change to the Phase 20–25 authoritative UI except where R1 wiring strictly requires it.
- ❌ Migrating non-identity collections to Postgres before their features need durability.

---

## 33. Final Recommendation

Hebun today is a **broad, deep, and unusually honest contract system**: a complete product control plane (7 workspaces), a rigorous Heby stack, a full execution/authorization/provider **architecture**, a ready-to-apply schema, and dormant real adapters — all running on an **in-memory, offline, provider-less, auth-less substrate** that never fakes what it cannot do. That honesty is the asset that makes safe productization possible.

The correct next move is **not** more surface or more contracts. It is to make the **narrowest vertical slice real**, bottom-up: **R1 — Durable Foundations** (persistence + auth + tenant + service boundary). Everything valuable that follows — real Heby answers, safe execution, real agents, customer onboarding — is blocked on R1 and unlocked by it, in that order.

Proceed to R1 planning on Director approval. Do not begin implementation from this audit.

---

### Appendix A — Key evidence index
- Baseline: `git rev-parse HEAD` = `ac128e7…`, `main`, `0/0`, Phase 25 tag present.
- Persistence: `src/features/persistence/storage-manager.ts` (`ACTIVE_PROVIDER="memory"`), `src/db/index.ts`, `src/db/config/environment.ts`, `src/features/enterprise-runtime-composition/composition-root.ts:31`.
- Providers: `0` SDK imports / `0` `fetch` in `src/features`; `provider-framework/provider-metadata.ts` (`framework-only`); `provider-invocation/invocation-lifecycle.ts`; `registries/records.ts` (seeded); `providers/claude/provider.ts`.
- Auth: `src/app/login/page.tsx` (`redirect`), no `middleware.ts`, `src/app/(dashboard)/layout.tsx` (no gate), `features/auth` unimported by routes.
- Heby: `features/heby-{core,integration,runtime,actions}` banners.
- Execution/CU: `features/live-dispatch`, `execution-engine/failure-simulator`, `features/device-runtime` banner + `contracts.ts`.
- Observability: `features/runtime-observability/composition.ts` (*"Nothing here is persisted"*).
- Ingestion/scheduler: `upload=0`, `chunk=0` files; `setInterval=0`, no `cron` scheduler.
- Ops: no `.env`, no `.github/workflows`, no `vercel.json`, no health route; 256 test files via `scripts/run-tests.mjs`.

### Appendix B — Scope statement
This artifact is the sole working-tree change produced by the R1A audit. No source, component, config, migration, env, nav, or test was modified; nothing was staged, committed, tagged, or pushed.
