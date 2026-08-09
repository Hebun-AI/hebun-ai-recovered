# Hebun UI — Knowledge IA + Contract + Authority Audit (Phase 21A)

**Status:** Phase 21A — Audit + Architecture only. No product code changed. No runtime, nav, route, test, or protected system changed. This document is the single authorized artifact.

**Baseline HEAD:** `1557f5a9a3206b0263dc5ae99f99e40426cbef7a` (== `origin/main`, ahead/behind 0/0)
**Phase 20 tag:** `hebun-ui-phase-20-command-intelligence-surface-completion-complete` (annotated) dereferences exactly to HEAD.
**Phase 21 UI tag:** does **not** exist. Generic `phase-21*`/`phase-21a-complete`/`phase-21b-build-ready` tags are the **Supabase/Prisma migration track** (`phase-21a-supabase-migration-support`), unrelated to Hebun UI Phase 21.

> Locked recommendation is in §21–§26. Everything before it is the evidence.

---

## 1. Fresh baseline (discovery)

| Check | Result |
|---|---|
| pwd | `/Users/senolsevim/Developer/Hebun AI/apps/dashboard` |
| repo toplevel | `/Users/senolsevim/Developer/Hebun AI` |
| branch | `main` |
| HEAD | `1557f5a9a3206b0263dc5ae99f99e40426cbef7a` |
| origin/main | `1557f5a9…` (identical) |
| ahead / behind | `0 / 0` |
| staged | none |
| tracked modified | none |
| untracked | docs only (`docs/product-vision/*`, `docs/architecture/*`) — no product code |
| `next-env.d.ts` | tracked (unchanged) |
| Phase 20 tag → HEAD | ✅ exact |
| `hebun-ui-phase-21*` | ✅ absent |

No unexpected tracked product changes. Baseline clean.

---

## 2. Knowledge mental model (derived from the repository, not labels)

The candidate pipeline in the brief (SOURCE → INGESTION → … → MEMORY) **does not match the repository**. There is **no ingestion, artifact, chunk, embedding, or document substrate anywhere** (`src/features` has no `document|artifact|ingest|embed|chunk|corpus|citation` feature). The real shape is narrower and honest:

```
                       KNOWLEDGE = settled, retrievable, evidence-bearing organizational truth
  ┌───────────────────────────────────────────────────────────────────────────────────┐
  │  ORIGIN            → MemorySource.kind (human-input | document | system-observation │
  │                       | external-source | derived)   — a descriptor, NOT a doc store │
  │  ADMISSION         → enterprise-memory-admission-engine (authority + policy gate)    │
  │  DURABLE MEMORY    → enterprise-memory MemoryRecord (immutable, superseded not edited)│
  │  RELATIONSHIP      → knowledge graph nodes/edges (knowledge-crud + derived graph)     │
  │  RETRIEVAL/QUERY   → enterprise-memory-query / -retrieval / -context / -selection     │
  │  CANONICAL READ    → canonical-read (Postgres knowledge_facts/knowledge_nodes)        │
  │  EVIDENCE/PROVENANCE → minted only at retrieval; carried, never invented              │
  └───────────────────────────────────────────────────────────────────────────────────┘
```

Distinctions the code enforces:
- **source** = where knowledge came from (`MemorySource`). Not the knowledge itself.
- **document** = *not a substrate*. Only a `MemorySourceKind` value. No document store exists.
- **memory** = admitted durable `MemoryRecord`, immutable, authority-gated.
- **graph** = typed relationships between knowledge entities. A *projection*, not the truth.
- **retrieval** = source-specific read; provenance attached at read time.
- **evidence** = a reference back to a resolved source; only the retrieval layer may mint one.
- **truth** = admitted + ratified memory. Nothing becomes truth without explicit admission.

---

## 3. Current Knowledge IA (from `src/config/workspace-nav.ts`)

Knowledge is workspace 3 of the seven stable Level-1 workspaces. Heby is ambient, not a workspace.

| Field | Value |
|---|---|
| workspace id | `knowledge` |
| label | `Knowledge` |
| icon | `BookOpen` |
| href (landing) | `/knowledge` |
| tagline | "Reference the settled truth." |
| roles | director, operator, specialist, admin (visibility only; server enforces authority) |
| legacy `match` prefixes | `/memory`, `/director/memory`, `/director/knowledge-graph`, `/director/registries` |
| active-workspace resolution | longest-prefix match over landing + destination hrefs + `match` (`resolveActiveWorkspace`) |

**Level-2 destinations (4):**

| # | Label | href | Icon | Purpose (nav copy) |
|---|---|---|---|---|
| 1 | Company Memory | `/director/memory` | Brain | "Institutional memory." |
| 2 | Knowledge Graph | `/director/knowledge-graph` | Layers | "Relationships between things." |
| 3 | Knowledge Base | `/knowledge` | BookOpen | "The canonical knowledge foundation." |
| 4 | Registries | `/director/registries` | Layers | "Registry hub — 15 registries as Level-3." |

No destination is `unavailable`, `elevated`, or `restricted`. Route ownership: 3 of 4 destinations point **into the `/director/*` legacy tree**, not under `/knowledge`. The landing `/knowledge` is destination 3 itself.

---

## 4. Current route inventory (Knowledge-relevant)

| Route | File | Nav-linked? |
|---|---|---|
| `/knowledge` | `src/app/(dashboard)/knowledge/page.tsx` | ✅ Knowledge Base (+ landing) |
| `/director/memory` | `src/app/(dashboard)/director/memory/page.tsx` | ✅ Company Memory |
| `/director/knowledge-graph` | `src/app/(dashboard)/director/knowledge-graph/page.tsx` | ✅ Knowledge Graph |
| `/director/registries` | `src/app/(dashboard)/director/registries/page.tsx` | ✅ Registries hub |
| `/director/registries/{agents,capabilities,entities,events,executions,experience,goals,governance,learning,memory,models,plans,risk,tools,workflows}` | 15 pages | L3 (hub links) |
| `/memory` | `src/app/(dashboard)/memory/page.tsx` | ❌ **orphan** — resolves to Knowledge via `match`, nothing links it |
| `/architecture/registries` | `src/app/(dashboard)/architecture/registries/page.tsx` | Platform workspace (not Knowledge) |
| `/director/goals` | `src/app/(dashboard)/director/goals/page.tsx` | **Command** "Strategic Goals" (Phase 20) |
| `/director/policy`, `/director/governance/policies` | policy pages | **Governance** |
| `/_internal/canonical-read` | `src/app/_internal/canonical-read/page.tsx` | internal DB diagnostics (not L2) |

---

## 5. Knowledge authority map

The single most important finding: **the real authorities are almost entirely headless; the UI reads seeded/mock projections.**

| Concept | Real authority (domain layer) | State | Consumed by Knowledge UI? |
|---|---|---|---|
| Durable admitted memory | `enterprise-memory` (+ `-admission`, `-admission-engine`, `-persistence`, `-query`, `-retrieval`, `-context`, `-selection`, `-reasoning`) | Real contracts **and engines**; in-memory default, Postgres repo available | **No** — zero `enterprise-memory*` imports in `src/app`/`src/components` |
| Knowledge nodes/relationships (CRUD) | `knowledge-crud` | Real in-memory CRUD + Command Bus + audit; **seeded from the mock derived graph** | Yes (via `KnowledgeRegistryWorkspace`) |
| Canonical knowledge read | `canonical-read` (Postgres `knowledge_facts`/`knowledge_nodes`), `knowledge-read-facade`, `knowledge-shadow-read`, `knowledge-silent-dual-read` | Real, availability-gated, honest states; **strangler migration**, authoritative=memory / shadow=postgres | Only `/_internal/canonical-read` diagnostics |
| Knowledge graph projection | `knowledge-graph` (`graph-builder`, `graph-metrics`) | Derived over **mock `registries`** + hand-authored relationship blueprints (fabricated strength/confidence) | Yes |
| "Company Memory" projection | `memory-runtime` → `runtime-projection` registry | **Seeded/simulated** projection | Yes (Company Memory + orphan `/memory`) |
| Memory type stores | `memory`, `memory-engine` | Seeded/mock memory records + engine | Yes (via `MemoryEnginePanel`) |
| Registries (master data) | `registries` | **Fully fabricated** counts/growth/freshness | Yes (hub + 15 L3) |
| Registry CRUD engine | `registry-crud` | Real in-memory CRUD engine | **No** (registry pages use mock `registries`) |
| Goals | `goal-runtime` (derived from knowledge graph) | Real derived projection; **owned by Command** | No (Command `/director/goals`) |
| Policy | `policy` (engine) + `governance/policies` (mock page) | Engine real; Governance page mock; **owned by Governance** | No |

Persistence default: `ACTIVE_PROVIDER = "memory"` (`src/features/persistence/storage-manager.ts:17`). Postgres/Supabase adapters exist but are commented out. `canonical-read` is a *separate* env-gated read-only Postgres layer.

---

## 6. Enterprise Memory audit (protected — read only)

Enterprise Memory is **not** contract-only. It is a full, governed, durable-memory subsystem — and it is **completely headless**.

**Contracts** (`enterprise-memory/contracts.ts`) — technology-neutral types. Header states it plainly: *"NOT a Timeline, NOT an Audit log, NOT an Event Store, NOT a Database … no persistence, retrieval, similarity search, ingestion, or reasoning."* The five metadata dimensions are deliberately separate and none implies another:

| Dimension | Type | Question |
|---|---|---|
| origin | `MemorySource` (kind, reference, originatedAt) | Where did it come from? |
| authority | `MemoryAuthority` (authorityType, admittedBy, grantReference) | Who admitted it? |
| provenance | `MemoryProvenance` (method, derivedFrom[], recordedAt) | How was it derived? |
| confidence | `MemoryConfidence` (level, score?, rationale?) | How strongly trusted? |
| lifecycle | `MemoryLifecycle` (candidate→approved/rejected→archived) | Current standing? |

`MemoryRecord` is immutable; a new record supersedes an old one (no in-place mutation).

**Runtime engines** (real, but consumed only by other domain features, never by UI):
- `enterprise-memory-admission-engine` — `createAdmissionEngine`, `runAdmissionPipeline` (`PIPELINE_STAGES`), `evaluateAuthority`, `evaluatePolicies`, `deriveDecision`. A real admission pipeline: authority check → policy evaluation → assessment → decision.
- `enterprise-memory-persistence` — `MemoryRepository` port, `persistApprovedMemory` gate, versioning + supersession, **`createInMemoryMemoryRepository` and `createPostgresMemoryRepository`**.
- `enterprise-memory-query` / `-retrieval` / `-context` / `-selection` — query engine, retrieval boundary, context assembly (dedup/grouping/ordering), selection (priorities/filters).
- `enterprise-memory-reasoning` — deep layer: confidence, contradiction, explainability, gap, implication, **provenance**, relation, understanding, plus `evidence.ts`.

**Consumers:** `enterprise-organizational-intelligence` reads the memory family (Intelligence↔Memory link). **No `src/app`/`src/components` file imports any `enterprise-memory*` feature.** No UI invokes `persistApprovedMemory`/`createAdmissionEngine`/`runAdmissionPipeline` → surfacing it **read-only** is safe and writes nothing.

**Semantic distinctions — proven from contracts:**

| Claim | Proof |
|---|---|
| Memory ≠ raw document | `document` is only a `MemorySourceKind`; a `MemoryRecord` carries a `statement` + attributes, not a file. No document store exists. |
| Memory ≠ intelligence candidate | `lifecycle.state = "candidate"` is a *memory* candidate; Intelligence candidates live in `intelligence-surfaces` / `enterprise-intelligence`, a different type space. |
| Memory ≠ recommendation | No recommendation field; recommendations are Intelligence (`/director/intelligence/recommendations`). |
| Memory ≠ decision | No decision field; decisions are `decision-runtime`/`decisions`. |
| Memory ≠ policy | No policy field; policy is `policy`/Governance. |
| Memory ≠ temporary model context | Records are immutable, authority-gated, superseded — the opposite of ephemeral context. |

Enterprise Memory was not modified.

---

## 7. Knowledge Graph audit

**Implementation:** `knowledge-graph/graph-builder.ts` + `graph.ts` + `graph-metrics.ts`; UI at `/director/knowledge-graph` renders `KnowledgeRegistryWorkspace` + `MemoryEnginePanel` + `KnowledgeGraphPanel` with a `Graph Health {knowledgeGraphMetrics.graphHealth}` badge.

- **Nodes** built from `registries/records` (mock) via `buildKnowledgeGraphNodes()`.
- **Edges** from a hand-authored `relationshipBlueprints` array with **fabricated `strength`/`confidence`** (e.g. `strength: 89, confidence: 95`) plus dependency/`feeds` inference.
- **Metrics** (`graph-metrics.ts`) compute coverage %, average confidence, node health, connected components, `graphHealth` score — *real math over fabricated inputs*.

**Classification:** the graph is **B. a derived projection** (with fabricated relationship weights), **not** a source of truth. `KnowledgeRegistryWorkspace` adds a **real in-memory CRUD engine** (`knowledge-crud`: create/update/archive/soft-delete nodes + typed relationships, Command Bus, audit trail with a `simulation` flag, persistence telemetry) — but that store is **seeded from the same mock graph** (`node-adapter.ts` `seed()`, `createdBy: "Seed"`, `SEED_AT = "2026-01-01"`).

- Does goal-runtime read it? **Yes** — active Goal nodes are derived from the knowledge graph.
- Does Heby read it? Not yet — Heby's `knowledge` source resolves to honest `unavailable`.
- Does Intelligence read/write it? Reads the memory family, not the graph directly.

Verdict: **real engine, honest process labels ("in-memory", "simulation", "Seed"), fabricated substrate + fabricated confidence/strength.** Postgres canonical path exists but is not wired to this UI.

---

## 8. Knowledge Base / document audit

`/knowledge` renders `KnowledgeWorkspace` from `getKnowledgeWorkspaceModel()` (`features/knowledge/workspace-model.ts`). This is the **honesty gold standard** of the workspace:

- Surfaces **only real Enterprise Memory vocabulary** (source kinds, five metadata dimensions, lifecycle, confidence, sensitivity, relationship + authority types), each `satisfies`-bound to the contract type so a contract change breaks the build.
- Fabricates nothing: `memories: readonly never[]` (always empty), `connected: 0` honest counts.
- Its own header explicitly names the three synthetic sources it **refuses** to import: `knowledge-domain/mock.ts`, the seeded knowledge-graph builder, and the memory-runtime projection registry.

| Concept | State |
|---|---|
| Knowledge Base (as a document store) | **NOT-CONNECTED / does not exist** — no ingestion, artifacts, chunks, embeddings, citations, or retrieval corpus anywhere |
| `/knowledge` page | **CONTRACT-ONLY (honest)** — real Enterprise Memory vocabulary, empty populated state |
| documents / sources / evidence references | **CONTRACT-ONLY** — `MemorySource`, `MemoryProvenance`, canonical `source_attribution`; no populated instances |

There is **no real document/knowledge ingestion substrate.** "Knowledge Base" today is Enterprise-Memory-vocabulary scaffolding, not a corpus. Do not build a document Knowledge Base until an ingestion substrate exists.

---

## 9. Registry audit

`/director/registries` + 15 L3 pages render from `@/features/registries` (`definitions.ts`, `records.ts`, `growth.ts`, `metrics.ts`, `insights.ts`, `intelligence.ts`, `recommendations.ts`, `relationships.ts`, `risk-signals.ts`, `timeline.ts`). Every L3 page is `RegistryDetailView registryId=…` over the same mock.

- **Fully fabricated:** `totalRecords: 36`, `activeRecords: 28`, `dailyGrowth: 2`, `health: 96`, `synchronization: 98`, `freshness: "updated 4m ago"`; records like `{ name: "Sales Agent", health: 97, updated: "5m ago" }`.
- The real CRUD engine (`registry-crud`) is **not** used by these pages.

| Registry authority question | Answer |
|---|---|
| authority / data source | mock `registries` definitions + records |
| persistence | none (static module data) |
| mutation path | none in UI (real engine `registry-crud` unused) |
| provenance | none |
| tenant boundary | none |

**"Registries" is not one authority** — it is a *hub of 15 heterogeneous reference sets* (agents, goals, policies, risk, models, …), each owned by a different real system (Workforce, Command, Governance, Platform…). It deserves **one Knowledge L2 hub surface** (read-only master-data reference) **only if** it is honest that each registry is reference/derived data whose authority lives elsewhere. It must not become a second authority for goals, policies, or agents.

---

## 10. Goal / Mission relationship

- `/director/goals` (**Command** "Strategic Goals", Phase 20B) → `getStrategicGoalsModel()` reads the **real** `goal-runtime` (active Goal nodes **derived from the knowledge graph**), honest-empty if none, "no fabricated target/percentage/due date/owner/progress."
- `goal-runtime` / `mission-runtime` are **derived projection services**, not owners of a separate goal product.

| Question | Answer |
|---|---|
| Does Knowledge own goals? | **No.** |
| Does Command/Strategy own goals? | **Command** owns executive goal management (Strategic Goals). |
| Is Knowledge the storage/relationship substrate? | Yes — Goal *nodes* live in the knowledge graph; goal-runtime reads them. |
| Should Knowledge expose a Goal Registry? | Only as a **read-only graph/registry projection**, never as goal management. |
| Risk of two authoritative Goal products | Real if Knowledge builds goal management. **Avoid.** |

---

## 11. Evidence + provenance model

Evidence semantics are consistent and strict across the system:

- **Who may mint an evidence reference?** Only the **retrieval layer**. `heby-runtime/evidence-assembler.ts`: *"Evidence identity comes ONLY from the retrieval layer. A model may later summarize evidence, but it can never create an evidence identity"*; the response validator rejects any reference not assembled.
- **Provenance** is attached at retrieval (`source-resolver.ts`) and *survives unchanged* into the response.
- **Enterprise Memory** carries durable provenance/source as first-class metadata (`MemoryProvenance`, `MemorySource`); `enterprise-memory-reasoning` has dedicated `provenance-*` and `evidence.ts` modules.
- **Canonical knowledge nodes** carry `provenance`, `source_attribution`, `ratification_decision_id`, `governance_session_id`, `ratified_by_actor`.
- **Can Intelligence invent evidence?** No — Intelligence reads memory/graph; evidence is minted at retrieval. **Can Heby invent evidence?** No — proven above.

There is **no dedicated Evidence route**, and there should not be one: evidence belongs **inside** each Knowledge surface (memory provenance, graph-node provenance) and is surfaced by Heby's `evidence-tracing` capability. Evidence is a cross-cutting property, not a standalone product.

---

## 12. Heby + Knowledge

From `heby-integration/workspace-registry.ts` (Knowledge profile) and `heby-runtime/*`:

| Property | Value |
|---|---|
| authority mode | `advisory-only` |
| hebyMayAct | **false** — never decides, executes, or mutates |
| capabilities | `knowledge-retrieval` (contract-only), `evidence-tracing` (contract-only) |
| source classes | `knowledge`, `memory` — both `definedButUnconnected` (exists, not connected, not authoritative) |
| current retrieval behavior | honest `unavailable`: "No connected Knowledge/Memory retrieval path" |
| mayExplain | "Where did we learn this?", "What superseded this?", "What evidence supports this?" |

**What Heby MAY do in Knowledge** (supported by existing contracts): search / retrieve / summarize / compare / trace evidence / explain provenance & supersession — **advisory-only**, and only once a real retrieval path is connected (the seam is `canonical-read` → `source-resolver`).

**What Heby MUST NOT do:** fabricate documents, invent evidence/citations, silently write Enterprise Memory, mutate registries, promote temporary context into durable truth, alter policies or goals, decide, or execute. All already enforced structurally.

---

## 13. Current Knowledge UI audit (per page)

Legend for backing: **REAL** / **DERIVED** (real math over other data) / **SEEDED** (real engine, fabricated seed) / **MOCK** (static fabricated) / **HONEST-EMPTY** (contract-only).

### 13.1 `/knowledge` — "Knowledge Base"
- **A** route `/knowledge` · **B** "Knowledge — Hebun AI" · **C** "What is the canonical vocabulary of what we know?"
- **D/E** model `getKnowledgeWorkspaceModel` → **enterprise-memory contracts** (real authority, vocabulary only)
- **F** HONEST-EMPTY · **G** honest empty everywhere; `connected: 0`, `memories: []`
- **H** none · **I** current (Phase 9), the reference honesty pattern
- **J** **KEEP** as the honesty template; **absorb into Overview / Company Memory** (see IA)
- **K** future seam: enterprise-memory-query/-retrieval read APIs
- **L** Heby: retrieval + evidence-tracing (advisory)

### 13.2 `/director/memory` — "Company Memory"
- **A** `/director/memory` · **B** "Memory Registry" · **C** "What does the company durably remember?"
- **D/E** `MemoryRuntimeService` → `runtime-projection("memory-runtime")` + `MemoryEnginePanel` (memory-engine) + `MemoryRegistryWorkspace`
- **F** **SEEDED/SIMULATED** — shows a fake `{active}` count; **semantically wrong**: it is *not* Enterprise Memory
- **G** not honest — presents a seeded projection as institutional memory
- **H** **duplicate** ownership: label implies Enterprise Memory, backing is `memory-runtime`
- **I** legacy (pre-Enterprise-Memory stack) · **J** **REBUILD** on the real `enterprise-memory` authority (read-only)
- **K** seam: enterprise-memory-query/-retrieval/-context · **L** Heby: retrieval + provenance/supersession

### 13.3 `/director/knowledge-graph` — "Knowledge Graph"
- **A** `/director/knowledge-graph` · **B** "Knowledge Graph" · **C** "How is what we know related?"
- **D/E** `knowledge-graph` (mock registries + fabricated blueprints) + `knowledge-crud` (real CRUD, seeded from mock) + `memory-engine`
- **F** **DERIVED + SEEDED** — real graph math + real CRUD over a fabricated substrate; fabricated strength/confidence and `graphHealth`
- **G** partial — engine labels honest ("in-memory", "simulation"); the *health/confidence numbers* read as real but are simulated
- **H** overlaps registries (nodes are registry records) · **I** current, but substrate is mock
- **J** **REBUILD** — keep the real CRUD engine, drop fabricated confidence, label derived/seeded, wire toward `canonical-read`
- **K** seam: `knowledge-read-facade` → `canonical-read` · **L** Heby: relationship + evidence tracing

### 13.4 `/director/registries` (+15 L3) — "Registries"
- **A** `/director/registries` + L3 · **B** "Registry Center" · **C** "What master-data registries exist and how healthy are they?"
- **D/E** `@/features/registries` (mock) via `RegistrySummary`/`RegistryManager`/`RegistryDetailView`
- **F** **MOCK** — fabricated totals, `dailyGrowth`, `health`, `synchronization`, `freshness`
- **G** not honest — fabricated counts/growth/freshness presented as live
- **H** each registry's authority lives elsewhere (Workforce/Command/Governance/Platform)
- **I** current · **J** **REBUILD honesty** (label reference/derived, remove fabricated growth/freshness) or **KEEP** as read-only hub with honest states
- **K** seam: `registry-crud` engine (real) / per-domain authorities · **L** Heby: reference lookup only

### 13.5 `/memory` — orphan
- **A** `/memory` · **B** "Memory" · **C** duplicate of Company Memory, plus a `memory.create` `CommandAction`
- **D/E** same `MemoryRuntimeService` (seeded) · **F** **SEEDED/SIMULATED** + a create action on a mock store
- **H** **duplicate** of `/director/memory` · **I** legacy orphan (not nav-linked)
- **J** **REDIRECT** → `/director/memory` (or its canonical successor) in 21D · **L** n/a

---

## 14. Mock / import dependency graph (precise, from imports)

```
registries (MOCK: definitions, records, growth, metrics, …)
  ├── knowledge-graph/graph-builder ─► knowledge-graph/graph ─► graph-metrics (graphHealth, coverage%, confidence%)
  │        └─► /director/knowledge-graph  (KnowledgeGraphPanel, badge)
  ├── knowledge-crud/node-adapter.seed() ─► knowledge-crud store (real CRUD, SEEDED)
  │        └─► KnowledgeRegistryWorkspace ─► /director/knowledge-graph
  ├── memory/memory-builder, policy/policy-builder, planning/*, reasoning/*, orchestration, agent-crud, workflow-crud
  └── registry components + /director/registries (+15 L3)

memory-runtime ─► runtime-projection("memory-runtime")  (SEEDED projection)
  └─► MemoryRuntimeService ─► /director/memory  AND  /memory (orphan)

enterprise-memory* (REAL authority + engines)  ──►  (NO src/app or src/components import)  [HEADLESS]

canonical-read (REAL Postgres, availability-gated) ──► /_internal/canonical-read only
knowledge-read-facade / knowledge-shadow-read / knowledge-silent-dual-read (migration harness) ──► headless

knowledge/mock.ts ──► (UNUSED — dead)
```

**Blast-radius warning:** `@/features/registries` is imported by knowledge-graph, memory, policy, planning, reasoning, orchestration, agent-crud, workflow-crud, and all registry components. It is the **seed substrate of the entire derived layer.** Deleting `registries` in 21D would cascade far beyond Knowledge. Retire only leaf mocks (`knowledge/mock.ts`) and *re-point* consumers before touching `registries`.

---

## 15. Semantic ownership matrix

| Concept | Create authority | Validation authority | Persistence authority | Read consumers | Mutation authority | UI owner | Heby role |
|---|---|---|---|---|---|---|---|
| Document | *none (no substrate)* | — | — | — | — | — | none |
| Source | `enterprise-memory` (`MemorySource`) | admission-engine | enterprise-memory-persistence | memory reasoning/retrieval | none (immutable) | Knowledge (Company Memory) | trace provenance |
| Artifact | *none* | — | — | — | — | — | none |
| Chunk / Embedding | *none* | — | — | — | — | — | none |
| Evidence reference | retrieval layer (`evidence-assembler`, source-resolver) | response-validator | not persisted (runtime) | Heby, Intelligence | none | inside each surface | trace evidence |
| Provenance | producing system at record time | contracts | with the record (memory/canonical) | all readers | none (carried) | inside each surface | explain provenance |
| Knowledge node | `knowledge-crud` (→ canonical) | node-validator | persistence adapter (memory; PG capable) | graph, goal-runtime | `knowledge-crud` | Knowledge (Graph) | retrieve/relate |
| Knowledge edge | `knowledge-crud` | relationship-validator | persistence adapter | graph | `knowledge-crud` | Knowledge (Graph) | relate |
| Memory (durable) | `enterprise-memory-admission-engine` | authority + policy eval | enterprise-memory-persistence | org-intelligence; (future UI) | admission only (authority-gated) | Knowledge (Company Memory) | retrieve/explain |
| Goal | `goal-runtime` (derived from graph) | goal-runtime | knowledge graph | Command Strategic Goals | Command | **Command** | explain (read) |
| Mission | `mission-runtime` | mission-runtime | runtime projection | Command/Ops | Command | Command/Operations | explain (read) |
| Policy | `policy` engine / Governance | policy-evaluator | policy-registry | Governance, admission | **Governance** | **Governance** | explain (read) |
| Intelligence candidate | `intelligence-surfaces` / `enterprise-intelligence` | intelligence | — | Command/Intelligence | Intelligence | **Intelligence** | explain (read) |
| Insight | Intelligence | intelligence | — | Command | Intelligence | **Intelligence** | explain |
| Recommendation | Intelligence | intelligence | — | Command | Intelligence | **Intelligence** | explain |
| Decision | `decision-runtime` / `decisions` | governance/human | decision runtime | Command/Approvals | **human authority** | **Command/Decisions** | prepare only |
| Prepared action | `heby-actions` | authority/capability/execution gates | — | Approvals | human approval | Heby (prepare) | prepare, not execute |
| Security finding | `security-center` (Phase 19) | security | security runtime | Governance/Security | Security | **Governance › Security Center** | explain (read) |

No genuinely ambiguous ownership was found that requires inventing a new system. The only *mislabeling* is "Company Memory" → `memory-runtime` instead of `enterprise-memory`.

---

## 16. Knowledge vs Memory / Intelligence / Governance / Command

- **Knowledge vs Memory** — **Knowledge** is the broad operating surface for settled, retrievable, evidence-bearing organizational knowledge. **Enterprise Memory** is the governed durable-memory *subsystem* (admission → persistence → reasoning). Knowledge may **display** and **search/read** memory (contracts permit read-only query/retrieval); Knowledge must **not** become a second memory authority and must **not** silently persist anything. Today the UI violates the *labeling* (Company Memory shows `memory-runtime`, not Enterprise Memory) — the fix is to rebuild on the real authority, read-only.
- **Knowledge vs Intelligence** (Phase 20 boundary preserved) — Knowledge = evidence/context provider (settled). Intelligence = interpretation/candidate generation (emerging). No automatic promotion: candidate → memory truth, recommendation → memory, insight → policy, signal → evidence — each requires explicit authority/admission. Enforced: admission-engine gates memory; evidence minted only at retrieval.
- **Knowledge vs Governance** — Governance owns policy authority. Knowledge may expose **read-only** policy *references/knowledge* (e.g. a policy node in the graph, or a read-only policy registry projection) but must never mutate policy. Recommended: Policy Registry = **B. Knowledge read-only projection** of the Governance-owned authority (not a Knowledge-owned registry).
- **Knowledge vs Command** — Command already owns Strategic Goals (real `goal-runtime`). Knowledge must not create a second Strategic Goals product. Knowledge may expose goal **relationships/provenance** in the graph and a read-only Goal registry projection — never executive goal management.

---

## 17. Honesty / data-state rules (reused doctrine + Knowledge-specific)

Render honest states, never fabricate. Allowed states: `0 / None`, `Not connected`, `Not available`, `Unknown`, `Derived`, `Simulated`, `Prepared`, `Requires review`, `Restricted`. Knowledge-specific (from existing contracts): `Contract-only`, `Exists but not connected`, `Seeded (non-authoritative)`, `Superseded`, `Retired`, `Tenant-mismatch`, `Partial`, `Ratified`.

Never render fabricated: document, source, graph node/edge, memory, citation, evidence, ingestion job, embedding, retrieval result, freshness timestamp, knowledge score, completeness %, confidence %, registry count. Where a real *derived* record exists (e.g. graph metrics), it must be attributed as **Derived** with its provenance, never presented as measured truth.

Current violations to fix: fabricated `graphHealth`/confidence/strength (Knowledge Graph); fabricated `totalRecords`/`dailyGrowth`/`health`/`freshness` (Registries); a fake `{active}` memory count (Company Memory / orphan `/memory`).

---

## 18. Proposed final Knowledge IA (locked recommendation)

Smallest coherent set; every destination answers one distinct Director question. **Four** L2 surfaces (same count as today, semantically corrected).

| # | Label | Director question | Route (in-place) | Owner / backing authority | Connected state now | Honest empty state | Heby role | Build phase |
|---|---|---|---|---|---|---|---|---|
| 1 | **Overview** | "What is our knowledge, and what is actually connected?" | `/knowledge` | Knowledge / `enterprise-memory` vocabulary + honest connection map | Contract-only (honest) | vocabulary + "0 connected", mental model | explain the model | 21B |
| 2 | **Company Memory** | "What does the organization durably know, and under whose authority?" | `/director/memory` (rebuild) | **Enterprise Memory** (`enterprise-memory` + `-query`/`-retrieval`/`-context`, read-only) | Real authority, headless → surface read-only | honest-empty until records admitted | retrieve, explain provenance/supersession | 21B |
| 3 | **Knowledge Graph** | "How is what we know related?" | `/director/knowledge-graph` (rebuild) | Knowledge / `knowledge-crud` (→ `canonical-read`) | Real engine, seeded substrate | empty graph honest; derived labels | relate, trace evidence | 21C |
| 4 | **Registries** | "What master-data reference sets exist (authority elsewhere)?" | `/director/registries` (+15 L3, honesty-fix) | Knowledge hub / per-domain authorities; `registries`→`registry-crud` | Mock | honest "reference/derived; authority in X" | reference lookup | 21C |

**Removed / merged:** "Knowledge Base" as a separate destination is **removed** — it implies a document corpus that does not exist. Its honest Enterprise-Memory-vocabulary content becomes the **Overview** empty-state scaffolding and the shell of **Company Memory**. **Evidence, Goals, Policies, Sources, Documents, Retrieval** are **not** standalone Knowledge destinations (evidence lives inside surfaces; goals→Command; policies→Governance; no document/retrieval substrate to justify a surface yet).

---

## 19. Current → proposed changes

| Current L2 | Change | Proposed |
|---|---|---|
| Company Memory → `/director/memory` (memory-runtime, seeded) | **Rebuild backing** to real Enterprise Memory (read-only); drop fake count | Company Memory (real authority, honest-empty) |
| Knowledge Graph → `/director/knowledge-graph` (mock+seeded) | **Rebuild**: keep real CRUD, drop fabricated confidence/health, label derived, wire toward canonical-read | Knowledge Graph (honest derived) |
| Knowledge Base → `/knowledge` | **Repurpose** to Overview (mental model + connection map); merge vocabulary | Overview |
| Registries → `/director/registries` | **Honesty-fix** (reference/derived states; remove fabricated growth/freshness) | Registries (honest hub) |
| *(none)* | **Add** Overview | Overview |
| `/memory` (orphan) | **Redirect** → `/director/memory` | — |

Nav delta is small: replace destination "Knowledge Base" with "Overview" at the same `/knowledge` landing; the other three keep their hrefs. No workspace count change; Heby unaffected.

---

## 20. Route strategy / future map

| Current route | Current backing | Problem | Disposition | Future canonical route | Migration phase |
|---|---|---|---|---|---|
| `/knowledge` | enterprise-memory vocab (honest) | labeled "Knowledge Base" (implies corpus) | **Repurpose in place** → Overview | `/knowledge` | 21B |
| `/director/memory` | memory-runtime (seeded) | wrong authority; fake count | **Rebuild in place** on Enterprise Memory | `/knowledge/memory` (later) | 21B rebuild; route move optional 21D |
| `/director/knowledge-graph` | mock + seeded | fabricated confidence/health | **Rebuild in place** | `/knowledge/graph` (later) | 21C |
| `/director/registries` (+15) | mock | fabricated metrics | **Honesty-fix in place** | `/knowledge/registries` (later) | 21C; route move optional 21D |
| `/memory` (orphan) | memory-runtime | duplicate + stray create action | **Framework redirect** | → `/director/memory` | 21D |
| `knowledge/mock.ts` | — | dead code | **Delete** (leaf, unused) | — | 21D |

Prefer in-place rebuild (deep links + Phase-20 precedent of keeping `/director/*` with `match`). No `/knowledge/*` route moves and **no redirects implemented in 21A**. Canonical `/knowledge/*` routes are a *later, optional* consolidation, gated on deep-link analysis.

---

## 21. Phase 21B — exact scope (do NOT implement here)

**Theme:** the authority-critical core — surface the real Enterprise Memory read-only, and turn the landing into an honest Overview.

| Surface | Action |
|---|---|
| Overview (`/knowledge`) | **REBUILD** (repurpose) — Enterprise Memory mental model + honest connection map |
| Company Memory (`/director/memory`) | **REBUILD** on `enterprise-memory` + `enterprise-memory-query`/`-retrieval`/`-context`, **read-only** |
| Knowledge Graph, Registries | **NAV-ONLY** (untouched in 21B) |

- **Models:** a read-only Company Memory read model over `enterprise-memory-query`/`-retrieval` returning admitted `MemoryRecord`s (empty today) + the five-dimension views; an Overview model extending `getKnowledgeWorkspaceModel` with a connection-status map.
- **Components:** rebuild `MemoryRegistryWorkspace`/memory page to render real memory (honest-empty); Overview panel. **Do not** import `memory-runtime`.
- **Routes:** `/knowledge` (repurpose), `/director/memory` (rebuild). No new routes; nav label "Knowledge Base"→"Overview".
- **Reused authorities:** `enterprise-memory` (+ query/retrieval/context) — **read-only**.
- **Protected systems:** Enterprise Memory read-only; **no** `persistApprovedMemory`/admission-engine calls from UI.
- **Tests:** unit tests for the read models (empty-state honesty; no fabrication); nav resolution test.
- **Browser validation:** `/knowledge` + `/director/memory` render honest-empty; no fake counts.
- **Non-goals:** no admission/writes, no Postgres wiring, no graph/registry changes, no route moves, no redirects.

---

## 22. Phase 21C — exact scope (do NOT implement here)

**Theme:** relationships + reference data, made honest; begin wiring toward canonical read.

| Surface | Action |
|---|---|
| Knowledge Graph (`/director/knowledge-graph`) | **REBUILD** — keep real `knowledge-crud`; remove fabricated confidence/strength/`graphHealth`; label nodes/edges Derived/Seeded; add `canonical-read` (availability-gated) read path behind honest states |
| Registries (`/director/registries` + 15 L3) | **REBUILD honesty** — mark reference/derived; remove fabricated growth/freshness or relabel Simulated; each L3 states "authority: X" |
| Overview, Company Memory | **KEEP** (from 21B) |

- **Models/components:** graph read model attributing provenance (`blueprint`/`dependency`/canonical); registry views with honest states; optional `canonical-read` availability surface reuse from `/_internal/canonical-read`.
- **Reused authorities:** `knowledge-crud`, `knowledge-read-facade` → `canonical-read` (read-only, gated), `registry-crud` (real) or honest `registries`.
- **Protected systems:** canonical-read read-only; migration harness untouched.
- **Tests:** graph metrics no longer assert fabricated confidence; registry honesty tests; canonical availability honest-unavailable path.
- **Browser validation:** no fabricated %/counts/freshness; derived labels visible.
- **Non-goals:** no writes to canonical; no cutover of the silent-dual-read rollout; no route moves.

---

## 23. Phase 21D — exact scope (do NOT implement here)

Closure: **redirect** `/memory` → `/director/memory`; **delete** dead `knowledge/mock.ts`; re-point any residual mock consumers **before** touching `registries` (do not delete `registries` — blast radius); dedupe Company Memory vs orphan; cross-workspace validation (Command goals, Governance policies, Intelligence candidates unaffected); Heby boundary validation (advisory-only, evidence not invented); full honesty audit; protected-system audit; publication readiness (tag `hebun-ui-phase-21-knowledge-*`). Optional: move `/director/*` Knowledge routes to `/knowledge/*` with framework redirects if deep-link analysis approves.

---

## 24. Protected-system audit

All READ ONLY; none modified in 21A: Enterprise Memory (+ family), Organizational Intelligence Runtime, Heby Core/Integration/Runtime/Actions, Decisions (`decision-runtime`/`decisions`), Governance (`policy`/`governance`), Security Center, Device Runtime, Phases 17–20 surfaces, `goal-runtime`, `mission-runtime`, `auth`, `providers/computer-use`. No product code, runtime, nav, route, or test changed.

---

## 25. Files created / modified · validation · git state

- **Created (docs only, untracked, not staged/committed):** `docs/product-vision/ui/hebun-knowledge-ia-contract-audit.md` (this file).
- **Modified:** none. **Product code touched:** none. **Tests run:** none needed — all claims read directly from source; no code changed.
- **Validation:** tracked product code unchanged; no runtime/nav/route/test/protected-system change; exactly one new authorized audit artifact under the already-untracked `docs/product-vision/ui/`.
- **Git state at completion:** branch `main`, HEAD `1557f5a9…` == origin/main, ahead/behind 0/0, staged none, tracked-modified none; new file appears only as untracked docs.

---

## 26. Risks / unresolved questions

1. **Registries mock is load-bearing.** `registries` seeds knowledge-graph, memory, policy, planning, reasoning, orchestration, agent-crud, workflow-crud. Any honesty-fix must relabel, not delete; deletion is out of scope until consumers are re-pointed.
2. **Enterprise Memory is headless and real.** Surfacing it read-only is high value but must stay read-only — admission is authority-gated and elevated; no UI writes in 21B/21C.
3. **Canonical Postgres is availability-gated.** With `ACTIVE_PROVIDER="memory"` and no DB env, `canonical-read` is honestly `unavailable`; 21C must render that state, not hide it. (The Supabase migration lives on a *separate* git track, not this HEAD.)
4. **Route-move vs in-place.** Moving `/director/*` Knowledge routes to `/knowledge/*` risks deep links; recommendation is in-place rebuild now, optional redirected move in 21D.

## 27. Director decisions genuinely required

The repository objectively answers ownership, authority, and honesty. Only two decisions are genuine taste/strategy calls:

1. **Route consolidation:** keep Knowledge L2 on `/director/*` (in-place, Phase-20 precedent) — or move to canonical `/knowledge/*` with redirects in 21D? (Recommendation: in-place now.)
2. **Company Memory depth in 21B:** read-only surface of admitted memory only — or also expose the admission *pipeline view* (read-only, showing candidates/authority/policy checks) as a second panel? (Recommendation: memory read-only first; admission view in 21C.)

Everything else (drop Knowledge Base, add Overview, rebuild Company Memory on Enterprise Memory, honesty-fix Graph + Registries, goals→Command, policies→Governance, evidence-in-surface, Heby advisory-only) is determined by the architecture and locked above.

---

**HEBUN UI PHASE 21A — KNOWLEDGE IA + CONTRACT + AUTHORITY AUDIT COMPLETE**
