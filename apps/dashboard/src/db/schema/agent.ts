/* Agents — digital employees, owned by a company, optionally a department.
 *
 * S5 adds the minimum canonical Identity boundary ADDITIVELY (all nullable/
 * defaulted). Existing name/role/departmentId are PRESERVED (Agent CRUD
 * compatibility). An agent actor resolves as (actorType="agent", actorId=agents.id).
 *
 * Human owner + manager are canonical actor pairs (S2, no FK). `humanOwnerType`
 * is conceptually "human"; `managerActorType` may be human or a higher agent
 * under a human. NO capability/memory/reasoning/tool implementation, NO authority
 * calculation, NO runtime here — `authorityCeiling` is metadata a resolver reads
 * later. `replacedByAgentId` is a self-ref succession pointer. Dual-column window:
 * `role` (legacy text) kept alongside the new governed lifecycle/type enums. */
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import {
  actorTypeEnum,
  agentHealthEnum,
  agentLifecycleStatusEnum,
  agentRiskLevelEnum,
  agentTypeEnum,
  providerStatusEnum,
} from "./_enums";
import { departments } from "./department";

export const agents = pgTable(
  "agents",
  {
    ...tenantColumns,
    /**
     * WHICH DEPARTMENT THIS AGENT IS PLACED IN. Nullable: NULL is a real state ("unplaced").
     *
     * AP-2: owned by the ORGANIZATION AUTHORITY, written only by
     * `organization-authority/write-agent-placement.server.ts` (column-scoped, Governance-gated,
     * audited). Agent Identity does NOT write it — placement is not an identity lifecycle
     * transition, and Agent Identity keeps its two (register, retire) and no third. A retired
     * agent's value is preserved as historical attribution, never read as a current placement.
     * Placement grants no mandate, capability, authorization or execution authority.
     *
     * The FK is composite ON PURPOSE — see `agents_tenant_department_fk` below.
     */
    departmentId: uuid("department_id"),
    name: text("name").notNull(),
    role: text("role"),

    /* ── S5 canonical Identity boundary (additive) ── */
    /** Human owner (bounds the agent's authority). Canonical pair; no FK. */
    humanOwnerType: actorTypeEnum("human_owner_type"),
    humanOwnerId: uuid("human_owner_id"),
    /** Accountable manager (human, or higher agent under a human). Pair; no FK. */
    managerActorType: actorTypeEnum("manager_actor_type"),
    managerActorId: uuid("manager_actor_id"),

    agentLifecycleStatus: agentLifecycleStatusEnum("agent_lifecycle_status"),
    agentHealth: agentHealthEnum("agent_health"),
    agentType: agentTypeEnum("agent_type"),
    riskLevel: agentRiskLevelEnum("risk_level"),

    /** Authority-ceiling metadata (read by the resolver later; not computed here). */
    authorityCeiling: jsonb("authority_ceiling"),
    /** Material configuration version (distinct from base row version). */
    configVersion: integer("config_version").notNull().default(1),

    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    /** Succession — the agent that replaced this one (self-ref). */
    replacedByAgentId: uuid("replaced_by_agent_id").references(
      (): AnyPgColumn => agents.id,
    ),

    /* ── S8 cognitive/runtime binding metadata (declarative only) ── */
    workingMemoryProfile: jsonb("working_memory_profile"),
    longTermMemoryProfile: jsonb("long_term_memory_profile"),
    knowledgeProfile: jsonb("knowledge_profile"),
    reasoningProfile: jsonb("reasoning_profile"),
    learningProfile: jsonb("learning_profile"),
    providerProfile: jsonb("provider_profile"),
    toolProfile: jsonb("tool_profile"),
    executionDefaults: jsonb("execution_defaults"),
    executionPosture: providerStatusEnum("execution_posture"),
    preferredProviders: jsonb("preferred_providers"),
    preferredModels: jsonb("preferred_models"),
    allowedTools: jsonb("allowed_tools"),
    requiredCapabilities: jsonb("required_capabilities"),
    supportedStrategies: jsonb("supported_strategies"),
    memoryNamespaces: jsonb("memory_namespaces"),
    knowledgeDomains: jsonb("knowledge_domains"),
    reasoningPreferences: jsonb("reasoning_preferences"),
    learningPreferences: jsonb("learning_preferences"),
    costLimits: jsonb("cost_limits"),
    performanceTargets: jsonb("performance_targets"),
    telemetryProfile: jsonb("telemetry_profile"),
    agentProfileVersion: integer("agent_profile_version").notNull().default(1),
  },
  (t) => [
    index("agents_execution_posture_idx").on(t.executionPosture),
    /*
     * THE COMPOSITE-FK ANCHOR (SIA-2.6).
     *
     * `id` is already the primary key, so this index adds no uniqueness the table did not have. It
     * exists so a sibling table can carry `(tenant_id, agent_id)` and have PostgreSQL enforce that
     * the agent named belongs to the SAME tenant as the row naming it — the pattern
     * `heby_action_requests_tenant_id_uq`, `action_permits_tenant_id_uq`,
     * `work_artifacts_tenant_id_uq` and `external_recipients_tenant_id_uq` already establish.
     *
     * R3B added exactly this to `action_permits` for the same reason and recorded why: every
     * sibling in that chain already carried one, and the one that did not was the one that could
     * be pointed at another tenant's row without the database noticing.
     */
    uniqueIndex("agents_tenant_id_uq").on(t.tenantId, t.id),

    /**
     * TENANT-SAFE DEPARTMENT REFERENCE, ENFORCED BY THE DATABASE (OSA-1).
     *
     * This REPLACES a single-column FK to `departments(id)` that shipped in the foundation baseline
     * and was inert only because `departments` was empty. The moment departments exist, that older
     * shape would have let an agent be pointed at ANOTHER TENANT'S department with PostgreSQL
     * raising nothing — the exact defect R3B repaired on `action_permits`, which recorded the rule:
     * every sibling in this chain already carried a composite tenant binding, and the one that did
     * not was the one that could be pointed elsewhere unnoticed.
     *
     * The anchor it needs — `departments_tenant_id_uq` on `(tenant_id, id)` — is added by OSA-1's
     * hardening of that table.
     *
     * MATCH SIMPLE (PostgreSQL's default) means a row with `department_id` NULL satisfies this
     * constraint regardless of `tenant_id`, so every existing agent — all of which carry NULL —
     * stays valid. That is the intended behaviour, not a gap: an unassigned agent is a real state.
     *
     * `restrict` blocks nothing that happens today: OSA-1 ships no assignment writer, and
     * departments are retired in place rather than deleted.
     */
    foreignKey({
      name: "agents_tenant_department_fk",
      columns: [t.tenantId, t.departmentId],
      foreignColumns: [departments.tenantId, departments.id],
    }).onDelete("restrict"),

    /*
     * AP-1 — ONE IN-SERVICE NAME PER TENANT, DECIDED BY POSTGRESQL.
     *
     * The key is the CANONICAL name, not the bytes: NFC-normalized, then lower-cased under the
     * builtin `pg_c_utf8` collation, so `Heby`/`heby`, NFC/NFD `Ayşe` and `ŞAHİN`/`şahin` are one
     * name. The collation is pinned rather than inherited, so the key means the same thing on every
     * database regardless of its default locale (production is builtin C.UTF-8 already).
     *
     * ponytail: simple Unicode case mapping, not Turkish locale folding — `IŞIK` and `Işık` are two
     *   names. A locale-aware fold would make this index depend on a collation that can change.
     *
     * PARTIAL on the in-service predicate the read seam uses, so a retired identity does not keep
     * its name forever (the department precedent). `IS DISTINCT FROM` keeps NULL-lifecycle rows —
     * every identity ever created — inside the index. Historical identity is always the agentId.
     *
     * This index is the concurrency guarantee: two simultaneous creations commit one and raise one
     * `unique_violation`, so the creation authority needs no table lock.
     */
    uniqueIndex("agents_tenant_name_in_service_uq")
      .on(t.tenantId, sql`lower(normalize(${t.name}, NFC) COLLATE "pg_c_utf8")`)
      .where(sql`${t.retiredAt} IS NULL AND ${t.agentLifecycleStatus} IS DISTINCT FROM 'retired'`),

    /*
     * AP-1 — A NAME A HUMAN CAN SEE. Non-blank, and free of control, format, zero-width, bidi and
     * BOM characters, so two names that render identically cannot be two keys. The writer refuses
     * the same set first (`isWellFormedAgentName`); this is the floor if it ever does not.
     */
    check(
      "agents_name_visible_chk",
      sql`char_length(btrim(${t.name})) > 0 AND ${t.name} !~ '[\\x01-\\x1F\\x7F-\\x9F\\u00AD\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\uFEFF]'`,
    ),
  ],
);
