# Hebun — Database Strategy & Schema Architecture

> Phase 61. **Architecture only.** No installs, no migrations, no schema code, no
> behavior change. Target stack: **Supabase Postgres + Drizzle ORM**. Designed to
> reach millions of tenants and billions of audit/telemetry events without a
> redesign.

---

## 1. Grounding: current architecture

Design must fit what exists (phases 58–60), not replace it.

- **Command Bus** (`src/features/commands`): every primary action produces one
  `Command` — `id, traceId, commandType, source, actor, timestamp, context,
  payload, validationResult, policyResult, authorizationResult, approvalState,
  simulationState, auditRecord, telemetry, lifecycle[], status`. Deterministic,
  offline. Registry of self-declaring command types. Dispatcher is generic.
- **Persistence layer** (`src/features/persistence`): `PersistenceAdapter<T>`
  interface (`load/save/create/update/delete/restore/archive/exists/list/find/
  clear/subscribe/getSnapshot/transaction`). Memory adapter today. `storage-manager`
  is the single swap point. Every op audited (`PersistenceOperationRecord`) and
  counted.
- **Registry CRUD** (`src/features/registry-crud`): reference domain built on the
  adapter. Lifecycle status `active | archived | deleted` (soft delete). All
  mutations flow through the Command Bus.

**Invariant the DB must preserve:** UI → Service → Repository → **PersistenceAdapter**
→ Storage Provider. The database becomes a *provider behind the adapter*. Services,
repositories, Command Bus, and UI do not change when Postgres arrives — only a new
`SupabasePostgresAdapter` is added and selected in `storage-manager`.

> **Implementation status (measured at MEDIA-1 against `983c7948`).** Planned, not what shipped:
> `storage-manager` still selects the memory adapter, and the governed runtime reaches PostgreSQL
> through `db/client.server` (Drizzle + `pg`) directly.

---

## 2. Multi-tenant strategy

> **Implementation status (measured at MEDIA-1 against `983c7948`).** This section is the
> Phase 61 PLAN. It is **not implemented.** The migrations contain zero `ENABLE ROW LEVEL SECURITY`
> and zero `CREATE POLICY` statements; authentication is Hebun's own `local` provider, not Supabase
> Auth; the hosted database is Neon, not Supabase Postgres. Tenant isolation today is enforced by the
> application — tenant predicates on every query plus composite `(tenant_id, id)` foreign keys —
> not by RLS.

**Model: single Postgres, shared schema, row-level tenancy.** Chosen over
schema-per-tenant and db-per-tenant because it scales to millions of tenants with
one migration surface and one connection pool; isolation is enforced by RLS, not
by physical separation.

- **Company = tenant.** `tenants` (a.k.a. `companies`) is the root. `tenant_id uuid`
  is a **mandatory column on every domain row**, `NOT NULL`, FK → `tenants.id`.
- No cross-tenant foreign keys. Every FK stays inside one `tenant_id`.
- The `tenant_id` is the leading column of composite indexes and the partition key
  for high-volume tables.

| Question | Answer |
|---|---|
| How is a Company represented? | `tenants` row (the tenant root); `organizations` optional sub-structure under a tenant |
| How are Users linked? | `users` ↔ `tenants` via `memberships(tenant_id, user_id, role_id)` (a user can belong to many tenants) |
| How are Departments linked? | `departments.tenant_id` + `departments.organization_id` |
| How are Agents linked? | `agents.tenant_id` (+ optional `department_id`) |
| How are Commands linked? | `commands.tenant_id` + `actor_user_id` |
| How are Memories linked? | `memories.tenant_id` (+ optional `agent_id`, `scope`) |
| How are Registries linked? | `registries.tenant_id` |

Global/system tables (command-type catalog, provider catalog, plan tiers) live in a
`platform` schema with **no** `tenant_id` — they are shared, read-only to tenants.

---

## 3. Domain model & entity ownership

Each entity has exactly one owning table/domain. Grouped by bounded context.

**Platform (no tenant_id, shared):**
- `command_types` — the command registry catalog (mirrors `features/commands/registry`)
- `providers` — provider catalog (Claude, Codex, GitHub, …)
- `plans` — subscription tiers

**Identity & tenancy:**
- `tenants` (company) · `organizations` · `departments` · `users` · `memberships`
  · `roles` · `permissions` · `role_permissions`

**Workforce & work:**
- `agents` · `workflows` · `tasks` · `executions` · `approvals`

**Data foundation:**
- `registries` · `registry_records` · `integrations`

**Governance:**
- `policies` · `risks` · `audit_log` (see §12) · `compliance_records`

**AI:**
- `conversations` · `messages` · `memories` · `knowledge_nodes` · `knowledge_edges`
  · `reasoning_traces` · `embeddings`

**Command Bus (event backbone):**
- `commands` · `command_lifecycle` · `command_audit` · `telemetry_events`
  · (future) `event_store`

**Product surface:**
- `documents` · `notifications` · `reports`

Ownership rule: a metric/label/dataset is written by exactly one table; every other
surface **references** it (mirrors the Phase 55–57 single-source-of-truth work).

---

## 4. Relationship map (high level)

```
tenants (1) ─┬─(∞) organizations ──(∞) departments ──(∞) agents
             ├─(∞) memberships ──(1) users        (∞)──ν
             │        └─(1) roles ──(∞) role_permissions ──(1) permissions
             ├─(∞) registries ──(∞) registry_records
             ├─(∞) workflows ──(∞) tasks ──(∞) executions
             ├─(∞) approvals
             ├─(∞) integrations ──(1) providers [platform]
             ├─(∞) policies / risks / compliance_records
             ├─(∞) conversations ──(∞) messages
             ├─(∞) memories ──(0..1) agents
             ├─(∞) knowledge_nodes ──(∞) knowledge_edges (node↔node, M:N)
             ├─(∞) reasoning_traces
             ├─(∞) embeddings ──(polymorphic owner_type/owner_id)
             └─(∞) commands ──(∞) command_lifecycle
                          ├──(∞) command_audit
                          └──(∞) telemetry_events
command_types [platform] (1) ──(∞) commands
```

- **One-to-many:** tenant→everything; workflow→tasks; conversation→messages.
- **Many-to-many:** users↔tenants (`memberships`); roles↔permissions
  (`role_permissions`); knowledge_nodes↔knowledge_nodes (`knowledge_edges`).
- **Polymorphic:** `embeddings.owner_type` + `owner_id` (memory | message |
  knowledge_node | document) — kept in one table so pgvector indexing is uniform.

---

## 5. Table strategy (columns every domain row carries)

Standard column contract (a Drizzle base mixin):

```
id            uuid   pk  default gen_random_uuid()
tenant_id     uuid   not null   fk → tenants(id)
created_at    timestamptz not null default now()
updated_at    timestamptz not null default now()   -- trigger-maintained
created_by    uuid   fk → users(id)       -- actor
lifecycle_status  enum('active','archived','deleted') not null default 'active'  -- soft delete
deleted_at    timestamptz null
version       integer not null default 1   -- optimistic concurrency / versioning
```

- **Soft delete only** — matches Registry CRUD. `lifecycle_status='deleted'` +
  `deleted_at`; rows are never hard-deleted. RLS + default views filter them out.
- **Versioning** — `version` bumps on update (optimistic locking); heavy domains
  (policies, workflows) get a companion `*_versions` history table (append-only).
- **Audit** — mutations mirror into `command_audit` (§12), never edited in place.

Constraints: `tenant_id NOT NULL` everywhere; per-tenant unique keys
(`unique(tenant_id, slug)`), never global unique on business keys; FK
`on delete restrict` (soft delete instead); check constraints on enums/status.

---

## 6. Index strategy

- **Every table:** composite `(tenant_id, id)` pk-adjacent + `(tenant_id, lifecycle_status)`
  partial index `where lifecycle_status='active'` (hot path lists active rows).
- **Lookup:** `unique(tenant_id, slug|name)` per domain.
- **Time-series (commands/audit/telemetry):** `(tenant_id, created_at desc)` +
  `(command_type, created_at desc)`; BRIN on `created_at` for partitioned append-only
  tables (cheap for billions of rows).
- **Foreign keys:** index every FK column (`department_id`, `workflow_id`, …).
- **JSONB payloads:** GIN index on `commands.payload` / `telemetry_events.data`
  only where queried; otherwise leave unindexed.
- **Vector:** HNSW index on `embeddings.vector` (pgvector) per `owner_type`.
- Avoid over-indexing write-heavy tables (commands/telemetry) — keep 2–3 indexes,
  rely on partition pruning.

---

## 7. Partition strategy

High-volume append-only tables are **declaratively partitioned**:

- `commands`, `command_audit`, `telemetry_events`, `messages`, `audit_log`:
  **range partition by `created_at`** (monthly), with **hash sub-partition by
  `tenant_id`** for the largest (telemetry, audit). Old partitions detach → cold
  storage / drop per retention policy.
- `embeddings`: partition by `owner_type` (memory / message / knowledge).
- Domain tables (agents, workflows, registries) stay unpartitioned until a tenant’s
  row count warrants list-partitioning by `tenant_id` bucket.
- Partition pruning on `tenant_id` + time range keeps queries O(one partition).

---

## 8. RLS strategy (tenant isolation)

> **Implementation status (measured at MEDIA-1 against `983c7948`).** This section is the
> Phase 61 PLAN. It is **not implemented.** The migrations contain zero `ENABLE ROW LEVEL SECURITY`
> and zero `CREATE POLICY` statements; authentication is Hebun's own `local` provider, not Supabase
> Auth; the hosted database is Neon, not Supabase Postgres. Tenant isolation today is enforced by the
> application — tenant predicates on every query plus composite `(tenant_id, id)` foreign keys —
> not by RLS.

Supabase Auth issues a JWT with `auth.uid()`. RLS is the isolation boundary.

- Helper: `current_tenant_ids()` = set of `tenant_id` from `memberships` where
  `user_id = auth.uid()` and membership active. Cached in a `SECURITY DEFINER`
  function.
- **Every tenant table:** `ENABLE ROW LEVEL SECURITY` + policies:
  - `SELECT`: `tenant_id in current_tenant_ids() and lifecycle_status <> 'deleted'`
  - `INSERT/UPDATE`: `tenant_id in current_tenant_ids()` + permission check
  - Hard delete: **no policy** (soft delete only).
- **Permission layer:** policies additionally check `has_permission(auth.uid(),
  tenant_id, 'agent.create')` via `role_permissions` — DB enforces what the
  Command Bus authorization stage decided.
- **Platform tables:** RLS allows read-all, write only to `service_role`.
- **Service role** (Edge Functions / server) bypasses RLS for system writes
  (telemetry ingestion), scoped by explicit `tenant_id`.

Result: a query without a valid tenant context returns zero rows — isolation is not
optional and not app-enforced.

---

## 9. Drizzle folder structure

`src/db/` — new, isolated; imported only by the future `SupabasePostgresAdapter`.

```
src/db/
  client.ts              -- drizzle(postgres) client (Supabase connection)
  schema/
    index.ts             -- re-exports all tables + relations
    _base.ts             -- shared columns mixin (id, tenant_id, timestamps, soft delete, version)
    _enums.ts            -- pg enums (lifecycle_status, command_status, approval_state, source…)
    tenant.ts            -- tenants, organizations, departments
    identity.ts          -- users, memberships, roles, permissions, role_permissions
    agent.ts             -- agents
    workflow.ts          -- workflows, tasks, executions
    registry.ts          -- registries, registry_records
    integration.ts       -- integrations (+ platform providers ref)
    command.ts           -- commands, command_lifecycle
    audit.ts             -- command_audit, audit_log
    telemetry.ts         -- telemetry_events
    governance.ts        -- policies, risks, approvals, compliance_records
    knowledge.ts         -- knowledge_nodes, knowledge_edges
    memory.ts            -- conversations, messages, memories
    reasoning.ts         -- reasoning_traces
    embedding.ts         -- embeddings (pgvector)
    product.ts           -- documents, notifications, reports
    platform.ts          -- command_types, providers, plans (no tenant_id)
  relations.ts           -- drizzle relations() graph
  rls/                   -- policy definitions (SQL, generated to migrations)
  migrations/            -- drizzle-kit output (later)
```

One domain per file, mirroring §3 bounded contexts. `_base.ts` guarantees every
tenant table carries the standard contract from §5.

---

## 10. Supabase usage — where each feature belongs

| Supabase feature | Use for |
|---|---|
| **Postgres** | All structured data — the tables above. Source of truth. |
| **Auth** | User identity, JWT with `auth.uid()`. Backs `users` + RLS. Future SSO/SAML via Auth providers. |
| **Storage** | Binary assets — documents, report exports, uploaded knowledge files. `documents.storage_path` points here; metadata stays in Postgres. |
| **Realtime** | Live UI updates — replaces the in-memory emitter. Subscribe to `commands`, `registry_records`, `notifications` filtered by `tenant_id`. Feeds `useSyncExternalStore`. |
| **RLS** | Tenant isolation + permission enforcement (§8). |
| **Edge Functions** | System writes that bypass UI: telemetry ingestion, scheduled reports, webhook receivers, Command Bus server-side execution when it goes online. Run as `service_role`. |
| **pgvector** | `embeddings.vector`; HNSW indexes for memory / knowledge / message semantic search. |

---

## 11. AI data (architect only — do not implement)

- **Conversation history:** `conversations` (tenant, agent, subject) → `messages`
  (role, content, token_count, created_at) — partitioned by time.
- **Memory:** `memories` (tenant, agent?, scope, kind: episodic|semantic|procedural,
  content, importance, source_command_id) — the persistent org memory layer already
  surfaced in `/director/memory`.
- **Knowledge Graph:** `knowledge_nodes` (tenant, type, ref) + `knowledge_edges`
  (from_node, to_node, relation, weight) — the `/director/knowledge-graph` surface.
- **Reasoning Graph:** `reasoning_traces` (tenant, command_id, stages jsonb,
  evidence[], confidence) — persists what the Reasoning Engine produces.
- **Embeddings / vector search:** single `embeddings` table, `vector(1536)` column,
  `owner_type/owner_id` polymorphic, HNSW index. Semantic retrieval over memory,
  knowledge, messages, documents.

All AI writes originate from commands, so they inherit tenant, actor, audit.

---

## 12. Command Bus → database mapping

The Command Bus is the write backbone. Nothing bypasses it.

```
Command (app)                         Postgres
──────────────                        ─────────
id, traceId, commandType, source,  →  commands (partitioned by created_at)
  actor(created_by), timestamp,
  context(jsonb), payload(jsonb),
  approvalState, status
lifecycle[]                        →  command_lifecycle (stage, status, detail, at)
auditRecord + validation/policy/   →  command_audit  (partitioned; append-only)
  authorization results
telemetry                          →  telemetry_events (partitioned; append-only)
(future) domain event              →  event_store  (append-only, replayable)
```

- `commands` is the intent + lifecycle record; the **domain mutation** (e.g. insert
  into `registries`) happens in the same DB transaction as the command insert, so a
  command and its effect commit or roll back together (the `transaction()` method
  already on the adapter interface).
- `command_audit` and `telemetry_events` are **append-only**, never updated — the
  immutable trail.
- `event_store` (future) enables full event-sourcing / replay without changing the
  dispatcher.

Persistence op audit (`PersistenceOperationRecord`) maps to a lightweight
`telemetry_events` sub-stream (`category='persistence'`).

---

## 13. Security

- **Tenant isolation:** RLS on `tenant_id` (§8) — the hard boundary.
- **Roles:** `roles` per tenant (Director, Operator, Auditor, …); `permissions`
  are command-type-scoped (`agent.create`, `approval.approve`, `registry.delete`).
- **Ownership:** `created_by` + department/agent ownership columns; row visibility
  can narrow below tenant via additional policies (e.g. Auditor read-only).
- **Future SSO:** Supabase Auth SAML/OIDC → maps external identity to `users`;
  membership/role assignment stays in `memberships`.
- **Secrets:** integration credentials never in Postgres columns — Supabase Vault /
  Edge Function env; tables store only references + status (matches current
  "no credentials stored" stance).

---

## 14. Scalability

- **Millions of companies:** shared schema + `tenant_id` partition key; connection
  pooling via Supabase/pgbouncer.
- **Write optimization:** append-only + partitioned commands/audit/telemetry; batch
  telemetry inserts via Edge Function; few indexes on write-hot tables.
- **Read optimization:** partial indexes on `active` rows; materialized views for
  dashboard rollups (company health, registry counts) refreshed on a schedule;
  Realtime for deltas instead of polling.
- **Future sharding:** shared-nothing by `tenant_id` — Citus (Supabase-compatible
  direction) distributes tenant tables by `tenant_id`, co-locating a tenant’s rows.
  The `tenant_id`-first design means no schema change to shard later.
- **Retention:** detach/drop old time-partitions; cold data → Storage/parquet.

---

## 15. Future migration strategy (in-memory → Postgres)

Zero application rewrite — the adapter contract is the seam.

1. Add `src/db/` schema (Drizzle) — no runtime change.
2. Implement `SupabasePostgresAdapter` satisfying `PersistenceAdapter<T>`
   (`list/find/create/update/archive/restore/delete/…` → SQL).
3. `storage-manager.getAdapter` selects provider by env
   (`ACTIVE_PROVIDER = 'supabase'`) per collection — one line.
4. Registry CRUD, Command Bus, services, UI **unchanged** (verified seam in P60).
5. Swap the in-memory emitter for Supabase Realtime inside the adapter's
   `subscribe`.
6. Migrate seed data via a one-time script; keep memory adapter for tests.

---

## 16. Recommended implementation order

1. `tenants`, `users`, `memberships`, `roles`, `permissions` + RLS helpers.
2. `commands`, `command_lifecycle`, `command_audit`, `telemetry_events` (the
   backbone — everything else writes through it).
3. `registries` + `registry_records` (port the reference domain first).
4. `SupabasePostgresAdapter` + `storage-manager` switch → cut Registry CRUD over.
5. `agents`, `workflows`, `tasks`, `executions`, `approvals`.
6. `integrations`, `policies`, `risks`, `compliance_records`.
7. AI: `conversations`, `messages`, `memories`, `knowledge_*`, `reasoning_traces`.
8. `embeddings` + pgvector + semantic search.
9. Partitioning + materialized rollups once volume grows.

---

## 17. Risks

- **RLS gaps** — a table shipped without `ENABLE ROW LEVEL SECURITY` leaks across
  tenants. Mitigation: `_base.ts` + a CI check asserting RLS on every tenant table.
- **JSONB sprawl** — `payload`/`context` as unqueryable dumping grounds. Mitigation:
  promote frequently-queried fields to columns; GIN only where needed.
- **Partition mis-key** — partitioning by time but querying by tenant (or vice
  versa) kills pruning. Mitigation: composite time+tenant on the hottest tables.
- **pgvector cost** — HNSW builds are memory-heavy; embeddings volume explodes.
  Mitigation: partition by `owner_type`, cap dimensions, lazy-embed.
- **Migration drift** — in-memory and Postgres adapters diverging in semantics
  (e.g. soft-delete visibility). Mitigation: one shared adapter conformance test
  suite run against both.
- **Connection limits** — serverless + Postgres = pool exhaustion. Mitigation:
  Supabase pooler / pgbouncer, short-lived queries, Edge Functions for batch writes.
- **Over-partitioning early** — operational overhead before volume justifies it.
  Mitigation: start unpartitioned except commands/audit/telemetry; partition on
  measured growth.

---

_No code, migrations, installs, or behavior changed in this phase. This document is
the blueprint for the Supabase Postgres + Drizzle implementation._

---

## 18. Additive authentication schema foundation (S12)

S12 adds provider-neutral identity, invitation, server-side session-context, and
coarse role-permission storage. Existing company and membership rows receive only
nullable lifecycle/eligibility fields; no legacy identity or status backfill has
run. Authentication remains disabled and no session resolver or canonical identity
runtime read exists.

The migration intentionally does not configure Supabase Auth, enable RLS, provision
tenants, activate PostgreSQL, hydrate Runtime Projection, or change Dashboard,
Director AI, or Organizational Intelligence behavior. Restrictive constraints on
existing identity/membership data remain gated by inventory and deterministic
backfill. Security rollback is forward-fix after the first production identity or
session record is used for access.
