/*
 * Shared Postgres enums — centralized so every domain reuses the same values.
 * Mirrors the runtime unions in features/commands, features/persistence, and
 * features/registry-crud. Schema-only: no connection, no migrations.
 *
 * ── Two tiers ──────────────────────────────────────────────────────────────
 * 1. LEGACY / RUNTIME enums (below, unchanged): currently wired into live
 *    tables and consumed by runtime code (Command Bus, CRUD, persistence).
 *    NEVER renamed or removed — that would break running imports.
 * 2. CANONICAL enums (further down, added P0 Foundation): the governed
 *    lifecycle/health/scope/type/priority enums required by Specs 35–50.
 *    They are INERT in this phase — defined but NOT wired into any table yet.
 *    Wiring happens in later staged migrations (S4–S9).
 *
 * Where a legacy runtime enum overlaps a future governed lifecycle enum, the
 * legacy one is KEPT as a coarse RUNTIME PROJECTION and the governed superset
 * is added separately (see per-enum notes). Convention (canonical tier):
 *   <domain>LifecycleStatusEnum · <domain>HealthEnum · <domain>ScopeEnum ·
 *   <domain>TypeEnum · <domain>PriorityEnum
 */

import { pgEnum } from "drizzle-orm/pg-core";

/* ══════════════════════════════════════════════════════════════════════════
 * TIER 1 — LEGACY / RUNTIME ENUMS (unchanged; live-wired; do not rename/remove)
 * ══════════════════════════════════════════════════════════════════════════ */

/** Soft-delete lifecycle shared by every tenant-owned row (row-level, distinct
 *  from the governed per-domain lifecycles in Tier 2). */
export const lifecycleStatusEnum = pgEnum("lifecycle_status", [
  "active",
  "archived",
  "deleted",
]);

/**
 * Canonical actor-reference type (Identity §3.9, Spec 48 §7.9) — wired into the
 * shared base columns (S2). Companion to the existing `created_by`/`updated_by`/
 * `deleted_by` uuid columns to form a polymorphic `(actorType, actorId)` pair
 * WITHOUT a cross-table FK (agents/system/service actors are not in `users`, so
 * a single FK-to-users cannot express them and would create a cycle). Mirrors
 * the TS `ActorType` union in features/platform-core/actor. All companion
 * columns are NULLABLE and NULL-safe — additive, no backfill required.
 */
export const actorTypeEnum = pgEnum("actor_type", [
  "human",
  "agent",
  "system",
  "service",
]);

/** Disposition of an audited action (Spec 48 §7.3) — maps to platform-core
 *  AuditRecord.result. Wired into the shared audit_log table (S3). */
export const auditResultEnum = pgEnum("audit_result", [
  "committed",
  "rejected",
  "rolled-back",
]);

/** Canonical approval primitive — reused across Goal/Plan/Task/Workflow/Command/
 *  Policy/Governance in Tier 2 (no separate approval enum is added). */
export const approvalStateEnum = pgEnum("approval_state", [
  "not-required",
  "pending",
  "approved",
  "rejected",
]);

/** Runtime projection of a command's coarse run state. Governed superset:
 *  commandLifecycleStatusEnum (Tier 2). Kept — Command Bus depends on it. */
export const commandStatusEnum = pgEnum("command_status", [
  "queued",
  "running",
  "completed",
  "cancelled",
  "failed",
  "simulated",
]);

export const commandSourceEnum = pgEnum("command_source", [
  "ui",
  "voice",
  "system",
  "scheduler",
  "api",
]);

export const stageStatusEnum = pgEnum("stage_status", [
  "passed",
  "failed",
  "skipped",
  "done",
]);

/** Runtime projection of an execution's coarse run state. Governed superset:
 *  executionLifecycleStatusEnum (Tier 2). Kept — execution-engine depends on it. */
export const executionStatusEnum = pgEnum("execution_status", [
  "pending",
  "running",
  "completed",
  "cancelled",
  "failed",
  "simulated",
]);

/** Canonical environment posture / simulation-mode — reused as the posture that
 *  propagates Mission→Command→Execution (no separate posture enum is added). */
export const providerStatusEnum = pgEnum("provider_status", [
  "simulation",
  "dry-run",
  "read-only",
  "blocked",
  "live",
]);

export const roleTypeEnum = pgEnum("role_type", [
  "owner",
  "director",
  "operator",
  "auditor",
  "member",
]);

export const permissionScopeEnum = pgEnum("permission_scope", [
  "command",
  "registry",
  "governance",
  "finance",
  "hr",
  "legal",
  "platform",
]);

/** Canonical memory-kind — reused by the Tier 2 Long-term Memory model. */
export const memoryKindEnum = pgEnum("memory_kind", [
  "episodic",
  "semantic",
  "procedural",
]);

export const integrationStatusEnum = pgEnum("integration_status", [
  "connected",
  "pending",
  "syncing",
  "error",
]);

/** Runtime projection of a task's coarse state. Governed superset:
 *  taskLifecycleStatusEnum (Tier 2). Kept — tasks table + UI depend on it. */
export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "running",
  "blocked",
  "completed",
  "failed",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "unread",
  "read",
  "archived",
]);

/* Authentication foundation enums. Schema-only until the authentication
 * runtime is introduced; none of these values grants authority by itself. */
export const authIdentityStatusEnum = pgEnum("auth_identity_status", [
  "pending",
  "active",
  "suspended",
  "revoked",
]);

/* D1 credential authority. A credential is the thing a human PROVES; it is not
 * an identity and it grants no authorization by itself. `type` is a closed set
 * so a new credential class is a deliberate schema decision, never an implicit
 * one. The hashing ALGORITHM deliberately is NOT an enum — see auth-credential.ts. */
export const authCredentialTypeEnum = pgEnum("auth_credential_type", [
  "password",
]);

export const authCredentialStatusEnum = pgEnum("auth_credential_status", [
  "active",
  "revoked",
]);

/* G2.1 pre-Governance genesis nomination lifecycle.
 *
 *   pending   an operator ceremony nominated a human; nothing is entitled yet.
 *   accepted  that human accepted it under a verified D1 session. This is the
 *             entitlement a later G2 phase consumes; it is NOT authority itself.
 *   revoked   the nomination no longer stands and can never be accepted.
 *
 * `revoked` is DECLARED BUT UNWRITTEN in G2.1: no code path produces it, because
 * replacement/recovery semantics are not owned by this phase. It exists so that
 * (a) the acceptance path is written against a closed set rather than a boolean,
 * and (b) freeing a tenant's genesis slot later is a write, not a migration. A
 * test asserts no G2.1 code path can produce it. */
export const genesisNominationStatusEnum = pgEnum("genesis_nomination_status", [
  "pending",
  "accepted",
  "revoked",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "pending",
  "active",
  "suspended",
  "revoked",
  "expired",
]);

export const tenantStatusEnum = pgEnum("tenant_status", [
  "provisioning",
  "active",
  "suspended",
  "deleting",
  "deleted",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

/* ══════════════════════════════════════════════════════════════════════════
 * TIER 2 — CANONICAL GOVERNED ENUMS (Specs 35–50) — INERT in this phase.
 * Defined here so the catalog is complete and typecheck-stable; NOT wired into
 * any table until staged migrations S4–S9. Adding these is behavior-neutral.
 * ══════════════════════════════════════════════════════════════════════════ */

/* ── Mission (Spec 35) ── naming conflict resolved: missionState → missionLifecycleStatusEnum */
export const missionLifecycleStatusEnum = pgEnum("mission_lifecycle_status", [
  "draft",
  "proposed",
  "ratified",
  "superseded",
  "archived",
]);

/* ── Goal (Spec 36) ── */
export const goalLifecycleStatusEnum = pgEnum("goal_lifecycle_status", [
  "draft",
  "proposed",
  "approved",
  "active",
  "achieved",
  "superseded",
  "archived",
]);
export const goalHealthEnum = pgEnum("goal_health", [
  "unknown",
  "on-track",
  "at-risk",
  "blocked",
]);
export const goalScopeEnum = pgEnum("goal_scope", [
  "strategic",
  "department",
  "team",
  "operational",
]);
export const goalPriorityEnum = pgEnum("goal_priority", [
  "critical",
  "high",
  "medium",
  "low",
]);

/* ── Plan (Spec 37) ── */
export const planLifecycleStatusEnum = pgEnum("plan_lifecycle_status", [
  "draft",
  "proposed",
  "approved",
  "active",
  "completed",
  "superseded",
  "archived",
]);
export const planHealthEnum = pgEnum("plan_health", [
  "unknown",
  "on-track",
  "at-risk",
  "blocked",
]);
export const planScopeEnum = pgEnum("plan_scope", [
  "strategic",
  "department",
  "team",
  "operational",
]);
export const planPriorityEnum = pgEnum("plan_priority", [
  "critical",
  "high",
  "medium",
  "low",
]);

/* ── Task (Spec 38) ── governed superset of legacy taskStatusEnum ── */
export const taskLifecycleStatusEnum = pgEnum("task_lifecycle_status", [
  "draft",
  "planned",
  "ready",
  "assigned",
  "waiting",
  "running",
  "completed",
  "cancelled",
  "failed",
  "superseded",
  "archived",
]);
export const taskHealthEnum = pgEnum("task_health", [
  "unknown",
  "healthy",
  "at-risk",
  "blocked",
]);
export const taskExecutionTypeEnum = pgEnum("task_execution_type", [
  "human",
  "agent",
  "hybrid",
  "external-system",
  "scheduled",
  "event-driven",
  "manual",
]);
export const taskPriorityEnum = pgEnum("task_priority", [
  "critical",
  "high",
  "medium",
  "low",
]);
export const taskRiskLevelEnum = pgEnum("task_risk_level", [
  "low",
  "medium",
  "high",
  "critical",
]);

/* ── Workflow (Spec 39) ── */
export const workflowLifecycleStatusEnum = pgEnum("workflow_lifecycle_status", [
  "draft",
  "planned",
  "approved",
  "released",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
  "superseded",
  "archived",
]);
export const workflowHealthEnum = pgEnum("workflow_health", [
  "unknown",
  "healthy",
  "degraded",
  "blocked",
]);
export const workflowExecutionStrategyEnum = pgEnum("workflow_execution_strategy", [
  "sequential",
  "parallel",
  "conditional",
  "event-driven",
  "scheduled",
  "human-in-loop",
  "multi-agent",
  "hybrid",
]);
export const workflowPriorityEnum = pgEnum("workflow_priority", [
  "critical",
  "high",
  "medium",
  "low",
]);

/* ── Command (Spec 40) ── governed superset of legacy commandStatusEnum ── */
export const commandLifecycleStatusEnum = pgEnum("command_lifecycle_status", [
  "created",
  "validated",
  "queued",
  "released",
  "accepted",
  "executing",
  "completed",
  "failed",
  "cancelled",
  "expired",
  "superseded",
  "archived",
]);
export const commandHealthEnum = pgEnum("command_health", [
  "unknown",
  "healthy",
  "degraded",
  "blocked",
]);
export const commandTargetTypeEnum = pgEnum("command_target_type", [
  "agent",
  "human",
  "llm",
  "mcp-server",
  "browser",
  "api",
  "database",
  "queue",
  "webhook",
  "email",
  "file-system",
  "operating-system",
  "scheduler",
  "external-saas",
  "robot",
]);
export const commandExecutionTypeEnum = pgEnum("command_execution_type", [
  "local",
  "remote",
  "async",
  "sync",
  "event",
  "scheduled",
  "interactive",
  "human",
]);
export const commandPriorityEnum = pgEnum("command_priority", [
  "critical",
  "high",
  "medium",
  "low",
]);

/* ── Execution (Spec 41) ── governed superset of legacy executionStatusEnum ── */
export const executionLifecycleStatusEnum = pgEnum("execution_lifecycle_status", [
  "pending",
  "accepted",
  "preparing",
  "executing",
  "validating",
  "committing",
  "completed",
  "failed",
  "cancelled",
  "timed-out",
  "compensated",
  "archived",
]);
export const executionHealthEnum = pgEnum("execution_health", [
  "unknown",
  "healthy",
  "degraded",
  "blocked",
]);

/* ── Agent (Spec 42) ── */
export const agentLifecycleStatusEnum = pgEnum("agent_lifecycle_status", [
  "created",
  "configured",
  "training",
  "active",
  "busy",
  "idle",
  "paused",
  "suspended",
  "replaced",
  "retired",
  "archived",
]);
export const agentHealthEnum = pgEnum("agent_health", [
  "unknown",
  "healthy",
  "degraded",
  "blocked",
]);
export const agentTypeEnum = pgEnum("agent_type", [
  "executive",
  "director",
  "department",
  "specialist",
  "operator",
  "research",
  "creative",
  "coding",
  "support",
  "finance",
  "hr",
  "legal",
  "sales",
  "marketing",
  "custom",
]);
export const agentCapabilityEnum = pgEnum("agent_capability", [
  "reasoning",
  "planning",
  "memory",
  "knowledge-retrieval",
  "tool-usage",
  "browser-usage",
  "mcp-usage",
  "llm-usage",
  "document-analysis",
  "code-generation",
  "research",
  "communication",
  "scheduling",
  "monitoring",
]);
export const agentRiskLevelEnum = pgEnum("agent_risk_level", [
  "low",
  "medium",
  "high",
  "critical",
]);

/* ── Working Memory (Spec 43) ── health has module-specific failure modes ── */
export const workingMemoryLifecycleStatusEnum = pgEnum(
  "working_memory_lifecycle_status",
  [
    "created",
    "hydrated",
    "active",
    "updated",
    "compressed",
    "expired",
    "disposed",
    "archived",
  ],
);
export const workingMemoryHealthEnum = pgEnum("working_memory_health", [
  "unknown",
  "healthy",
  "degraded",
  "overflow",
  "corrupted",
]);

/* ── Long-term Memory (Spec 44) ── reuses memoryKindEnum (Tier 1) ── */
export const memoryLifecycleStatusEnum = pgEnum("memory_lifecycle_status", [
  "proposed",
  "active",
  "corrected",
  "superseded",
  "aged",
  "archived",
  "soft-deleted",
  "purged",
]);
export const memoryHealthEnum = pgEnum("memory_health", [
  "unknown",
  "trusted",
  "degraded",
  "conflicted",
]);
export const memoryScopeEnum = pgEnum("memory_scope", [
  "personal",
  "shared",
  "organizational",
]);

/* ── Knowledge (Spec 45) ── canonical-truth model (distinct from graph tables) ── */
export const knowledgeLifecycleStatusEnum = pgEnum("knowledge_lifecycle_status", [
  "draft",
  "proposed",
  "under-review",
  "ratified",
  "superseded",
  "deprecated",
  "retired",
  "archived",
]);
export const knowledgeHealthEnum = pgEnum("knowledge_health", [
  "unknown",
  "current",
  "stale",
  "contested",
]);
export const knowledgeScopeEnum = pgEnum("knowledge_scope", [
  "company-wide",
  "department",
  "domain",
]);
export const knowledgeAuthorityEnum = pgEnum("knowledge_authority", [
  "authoritative",
  "provisional",
]);

/* ── Reasoning (Spec 46) ── */
export const reasoningLifecycleStatusEnum = pgEnum("reasoning_lifecycle_status", [
  "created",
  "hydrated",
  "reasoning",
  "deliberating",
  "verifying",
  "concluded",
  "escalated",
  "failed",
  "disposed",
  "archived",
]);
export const reasoningHealthEnum = pgEnum("reasoning_health", [
  "unknown",
  "healthy",
  "degraded",
  "stalled",
]);
export const reasoningStrategyEnum = pgEnum("reasoning_strategy", [
  "deliberative",
  "deterministic",
  "non-deterministic",
  "multi-model",
  "parallel",
  "reflective",
  "simulation",
  "counterfactual",
]);

/* ── Learning (Spec 47) ── */
export const learningLifecycleStatusEnum = pgEnum("learning_lifecycle_status", [
  "created",
  "collecting",
  "analyzing",
  "proposing",
  "under-review",
  "approved",
  "applied",
  "rolled-back",
  "rejected",
  "archived",
]);
export const learningHealthEnum = pgEnum("learning_health", [
  "unknown",
  "healthy",
  "degraded",
  "diverging",
]);
export const learningTypeEnum = pgEnum("learning_type", [
  "personal",
  "organizational",
  "cross-agent",
]);
export const improvementProposalTypeEnum = pgEnum("improvement_proposal_type", [
  "skill",
  "procedure",
  "workflow",
  "prompt",
  "calibration",
  "optimization",
]);

/* ── Governance (Spec 49) ── */
export const governanceLifecycleStatusEnum = pgEnum("governance_lifecycle_status", [
  "created",
  "intake",
  "classified",
  "under-review",
  "deliberating",
  "decided",
  "recorded",
  "appealed",
  "superseded",
  "archived",
]);
export const governanceHealthEnum = pgEnum("governance_health", [
  "unknown",
  "healthy",
  "degraded",
  "stalled",
]);
export const governanceDomainEnum = pgEnum("governance_domain", [
  "mission",
  "goal",
  "plan",
  "workflow",
  "command",
  "memory-promotion",
  "knowledge-ratification",
  "learning",
  "agent-registration",
  "provider-tool",
  "emergency",
  "authority-delegation",
]);
export const governanceDecisionTypeEnum = pgEnum("governance_decision_type", [
  "approve",
  "ratify",
  "promote",
  "certify",
  "suspend",
  "revoke",
  "delegate-authority",
  "escalate-authority",
  "reject",
  "appeal",
]);
export const riskClassEnum = pgEnum("risk_class", [
  "low",
  "medium",
  "high",
  "critical",
]);
export const votingModeEnum = pgEnum("voting_mode", [
  "single",
  "multi-stage",
  "vote",
  "consensus",
  "quorum",
]);
export const governanceGateTypeEnum = pgEnum("governance_gate_type", [
  "compliance",
  "security",
  "audit",
  "legal",
  "financial",
  "operational",
  "ai-safety",
]);

/* ── Policy (Spec 50) ── governed superset of the legacy policies.status text ── */
export const policyLifecycleStatusEnum = pgEnum("policy_lifecycle_status", [
  "draft",
  "proposed",
  "under-review",
  "ratified",
  "superseded",
  "deprecated",
  "expired",
  "retired",
  "archived",
]);
export const policyHealthEnum = pgEnum("policy_health", [
  "unknown",
  "current",
  "stale",
  "conflicted",
]);
export const policyDomainEnum = pgEnum("policy_domain", [
  "security",
  "compliance",
  "financial",
  "operational",
  "legal",
  "hr",
  "data-governance",
  "privacy",
  "ai-safety",
  "risk-control",
]);
export const ruleTypeEnum = pgEnum("rule_type", [
  "allow",
  "require",
  "forbid",
  "constrain",
  "obligation",
]);
export const policyScopeEnum = pgEnum("policy_scope", [
  "company-wide",
  "department",
  "domain",
]);
export const policyAuthorityEnum = pgEnum("policy_authority", [
  "authoritative",
  "provisional",
]);
