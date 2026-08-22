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

/**
 * R3A — the state of a proposed consequential action awaiting human authority.
 *
 * Deliberately NOT `approval_state` above. That enum carries `not-required`, which is a
 * meaningful answer for a Tier-2 approval primitive and a meaningless one here: a request only
 * exists because human review IS required. Reusing it would make "no approval needed" a
 * representable state for an act whose entire reason for being persisted is that it needs one.
 */
export const hebyActionRequestStatusEnum = pgEnum("heby_action_request_status", [
  "pending",
  "approved",
  "rejected",
  "withdrawn",
]);

/**
 * R3A — the state of a durable authorization to act.
 *
 * There is deliberately NO `expired` value. Expiry is derived from `expires_at <= now()`, because
 * Hebun has no scheduler: a stored `expired` status would be a state with no writer, and this
 * repository has already paid twice for declaring a state nothing transitions rows into.
 *
 * There is also no `pending`. A permit exists only once a Governance decision approved it; a
 * pending permit would collapse APPROVAL and PERMIT into one row.
 */
export const actionPermitStatusEnum = pgEnum("action_permit_status", [
  "active",
  "consumed",
  "revoked",
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

/*
 * I1 — THE TENANT CONNECTION LIFECYCLE.
 *
 * `integration_status` above is KEPT and is deliberately not extended, corrected or dropped. It
 * predates any connection runtime, it conflates lifecycle with health (`syncing`, `error`), and
 * manually-created rows may already carry one of its values. Widening it would have made the
 * conflation permanent; dropping values is not something PostgreSQL can do at all.
 *
 * So this is a SECOND, NARROWER vocabulary on its own column, and the old one is left inert.
 *
 * Each value exists to make one specific false claim unrepresentable:
 *
 *   draft          a connection record exists. Nothing has been supplied for it.
 *   unverified     a credential has been supplied and has NEVER been verified.
 *                  => "credential exists" can never be read as "connected".
 *   connected      a full verification succeeded: the provider was reached, an external account
 *                  resolved, and the granted scopes covered the definition's minimum.
 *                  => "configured" can never be read as "verified".
 *   expired        the credential's validity ended and no refresh could restore it.
 *   revoked        the grant ended AT THE PROVIDER. Hebun did not end it.
 *   disconnected   the tenant ended it IN HEBUN. Terminal.
 *
 * `revoked` and `disconnected` are two facts, not one: a surface that cannot tell them apart tells
 * a tenant they disconnected something a provider took away, or the reverse.
 *
 * DELIBERATELY ABSENT: `connecting`, `reauthorizing`, `pending_authorization` (transient
 * in-request conditions - no row should exist mid-handshake) and `scope_reduced` (derivable from
 * the granted scope set, and reported by the availability seam as `degraded` with a reason).
 *
 * WHAT THIS ENUM IS NOT. It is not health (see `integration_health` below - a provider outage must
 * never overwrite the fact that a grant exists). It is not read/write capability (derived from
 * granted scopes, never stored). It is not authorization: Governance owns that, and no value here
 * permits anything.
 */
export const integrationConnectionStateEnum = pgEnum("integration_connection_state", [
  "draft",
  "unverified",
  "connected",
  "expired",
  "revoked",
  "disconnected",
]);

/*
 * I1 — CONNECTION HEALTH. The SECOND dimension, and the reason there are two.
 *
 * Lifecycle answers "does Hebun hold a live grant?" and changes only on grant events. Health
 * answers "did the last attempt work?" and changes on every attempt.
 *
 * With a single dimension, a provider 503 has nowhere to be written except the lifecycle column,
 * which would overwrite the fact that a valid grant exists - the exact `provider outage is not a
 * user disconnect` conflation. Two dimensions make that unrepresentable rather than discouraged.
 *
 *   unknown      never attempted, or the last attempt predates the current credential.
 *   healthy      the last attempt succeeded.
 *   degraded     succeeded partially, was rate-limited, or the grant covers the minimum but not
 *                every capability the definition maps.
 *   unreachable  transport failure, timeout, or a provider 5xx.
 *
 * NO VALUE HERE MOVES THE LIFECYCLE, and no writer in I1 can set anything but `unknown`: nothing
 * in this phase makes a provider call.
 */
export const integrationHealthEnum = pgEnum("integration_health", [
  "unknown",
  "healthy",
  "degraded",
  "unreachable",
]);

/*
 * INT-2 — WHAT KIND OF SECRET A CREDENTIAL ROW HOLDS.
 *
 * Three, because three are all a first credential authority can honestly name:
 *
 *   oauth_access    a short-lived token obtained from an authorization grant.
 *   oauth_refresh   the long-lived token that mints access tokens. A DIFFERENT secret with a
 *                   DIFFERENT lifetime, which is why it is a separate row and not a field beside
 *                   the access token — one expiring must never take the other with it.
 *   api_key         a secret the tenant pasted in. No grant, no refresh, no expiry of its own.
 *
 * DELIBERATELY ABSENT: `client_secret` (that is Hebun's own application secret, deployment
 * configuration and not a tenant's), `webhook_signing_secret` (no webhook runtime exists) and
 * `service_account_key` (no provider requires one yet). Each would be a row nothing could write.
 *
 * The kind is part of the credential's IDENTITY: the partial unique index is scoped by it, so one
 * connection may legitimately hold an access token and a refresh token at once and never two of
 * either.
 */
export const integrationCredentialKindEnum = pgEnum("integration_credential_kind", [
  "oauth_access",
  "oauth_refresh",
  "api_key",
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

/**
 * I1 — the lifecycle of ONE Governance-authorized future onboarding.
 *
 * Three states and no more. `authorized` is the only state I1 writes; `consumed` is written by I2
 * when it spends the authorization to create an invitation; `revoked` is DECLARED AND DELIBERATELY
 * UNWRITTEN — I1 implements no revocation runtime, exactly as G2.1 declared genesis revocation
 * without building it. There is no `expired`: expiry belongs to the invitation I2 issues, not to
 * the authority that permitted it.
 */
export const membershipAuthorizationStatusEnum = pgEnum("membership_authorization_status", [
  "authorized",
  "consumed",
  "revoked",
]);

/**
 * I1.2 — the lifecycle of ONE two-key identity enrollment ceremony.
 *
 * Four states, each reachable and each meaning something different:
 *
 *   pending    a bearer presented an onboarding capability. NOTHING global exists yet — no user,
 *              no identity, no credential. This state deliberately occupies no identity slot, so
 *              a rejection can never burn `users.email` or `auth_identities(provider,issuer,subject)`.
 *   approved   a Governance authority (KEY 2) approved the submission. Still no identity.
 *   rejected   TERMINAL. The ceremony is over and nothing global was ever created.
 *   completed  TERMINAL. The identity and its first credential exist, and this row names the
 *              identity it produced.
 *
 * `approved` and `completed` are separate for the same reason `membership_authorization_status`
 * separates `authorized` from `consumed`: "approved but not yet enrolled" and "approved and
 * enrolled" are different facts, and collapsing them would make retry unsafe.
 *
 * There is deliberately NO `expired`. Expiry belongs to the invitation (`invitations.expires_at`),
 * and a status value nothing writes is the trap `invitation_status.expired` already is.
 */
export const identityEnrollmentStatusEnum = pgEnum("identity_enrollment_status", [
  "pending",
  "approved",
  "rejected",
  "completed",
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
  /**
   * I1 — Governance authorizing the organization-changing act of admitting a human into a tenant.
   *
   * Its OWN concern, deliberately not folded into `authority-delegation`. Admitting a human is not
   * moving Governance authority: an authorized membership grants no Governance authority, no
   * provider access, no ratification right and no execution right. Reusing the delegation domain
   * would have asserted the opposite in the one place the ledger is queried by domain.
   */
  "membership-authorization",
  /**
   * I1.1 — Governance authorizing a change to the tenant's organizational role structure.
   *
   * Its OWN concern again. Provisioning the ordinary `member` role is not admitting a human
   * (`membership-authorization`), not moving authority (`authority-delegation`), and not about an
   * agent (`agent-registration`). Reusing any of those would make the ledger unable to say what
   * kind of change a decision actually was.
   */
  "organizational-role",
  /**
   * I1.2 — Governance approving (or refusing) that a prospective human may become a Hebun identity.
   *
   * Its OWN concern, and the narrowest one yet. It is not admitting a human into a tenant
   * (`membership-authorization` — after this decision the human still has no membership), not
   * moving authority (`authority-delegation` — it grants none), and not about an agent
   * (`agent-registration`). This is the only domain whose decisions change WHO MAY EXIST as an
   * authenticable human, which is a global effect no tenant-scoped domain could honestly carry.
   */
  "identity-enrollment",
  /**
   * R3A — Governance authorizing ONE specific consequential action to become executable later.
   *
   * Its OWN concern, and the first domain whose decisions are about DOING rather than about who
   * may do. It is not registering a tool or provider (`provider-tool` — that says a capability
   * exists, not that one use of it is permitted), not the command bus (`command` — a Tier-2
   * canonical domain with no writer, describing dispatch rather than legitimacy), not moving
   * authority (`authority-delegation` — a permit grants none and expires), and not admitting a
   * human (`membership-authorization`). Folding it into any of those would make the ledger unable
   * to answer "what consequential acts has this tenant authorized?" — the one question an
   * execution runtime must be able to ask before it runs anything.
   */
  "action-authorization",
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

/*
 * R3W — durable work artifacts.
 *
 * The type vocabulary is CLOSED and deliberately tiny: one value per action tool that already
 * declares a `record-ref` argument for it today. `operational-plan` is what
 * `heby.operations.prepare-plan` prepares; `message-draft` is what
 * `heby.operations.send-communication` names as `draftRef`. Nothing speculative is registered —
 * a new type arrives with the consumer that needs it, through its own migration.
 */
export const workArtifactTypeEnum = pgEnum("work_artifact_type", [
  "operational-plan",
  "message-draft",
]);

/*
 * Two states, not three. Gate A proposed draft/superseded/retired; `superseded` was dropped
 * under stress-test because supersession is a REVISION relationship, not an artifact one:
 * revision N is superseded by N+1 under ONE stable artifact identity, which is derivable from
 * `current_revision` and needs no stored state. An artifact-level `superseded` would require a
 * forked identity and a `supersedes_artifact_id` pointer, and no consumer needs either today.
 *
 * NO `approved`, `published`, `executed`, `verified` or `authoritative`. Approval is a Governance
 * decision about an ACTION that references a revision — never a column on the work itself.
 */
export const workArtifactLifecycleStatusEnum = pgEnum("work_artifact_lifecycle_status", [
  "draft",
  "retired",
]);

/*
 * R3R — how an external recipient can be reached.
 *
 * EXACTLY ONE VALUE, and that is the finding rather than a placeholder. The whole canonical
 * schema carries three address columns and all three are email (`users.email`,
 * `invitations.normalized_email`, `membership_authorizations.normalized_email`); there is not one
 * phone or social-handle column anywhere. `heby.operations.send-communication` is the only
 * consumer, and the communication provider surface is an explicit simulation with "no directory
 * access". So email is the only channel with any evidence behind it.
 *
 * The enum exists rather than the column being implied because a second channel must arrive as an
 * ALTER TYPE with its own migration and its own validator — not as a silent reinterpretation of a
 * `text` column everything already assumed was an address. Same discipline as
 * `work_artifact_type`: the vocabulary is closed, and a new value arrives with the consumer that
 * needs it.
 */
export const externalRecipientEndpointKindEnum = pgEnum("external_recipient_endpoint_kind", [
  "email",
]);

/*
 * Two states. `invalid` was proposed at Gate A and dropped under stress-test: NO WRITER COULD
 * ESTABLISH IT. There is no bounce handling, no delivery receipt and no verification system
 * anywhere in the repository, so an `invalid` column could only ever be set by a guess.
 *
 * NO `verified`, `qualified`, `customer`, `lead`, `converted` or `engaged`. Storing an address is
 * not proof that it works, that anyone owns it, or that a relationship exists. Retirement is the
 * only transition, it is human-initiated, and it never rewrites the address.
 */
export const externalRecipientStatusEnum = pgEnum("external_recipient_status", [
  "active",
  "retired",
]);

/*
 * ── R3B — FIRST EXECUTED ACTION ──────────────────────────────────────────────
 *
 * THE STATUS OF ONE EXECUTION ATTEMPT. Five values, and the vocabulary is closed on purpose.
 *
 *   pending   the attempt row exists and the authorization is already spent; the outcome is not
 *             yet known. A row left here after a crash is not a failure — it is an UNKNOWN that
 *             has not been classified yet.
 *   accepted  the provider returned success AND a message id. A CHECK enforces the second half,
 *             because "it returned 200" is not evidence that anything was queued.
 *   refused   Hebun declined before any external call. No bytes left the process.
 *   failed    the act was attempted and provably did not take effect.
 *   unknown   the request left the process and the answer was lost. The external world MAY have
 *             changed. This is the state that must exist for the ledger to stay honest.
 *
 * ABSENT, DELIBERATELY: `delivered`, `successful`, `completed`, `verified`, `read`, `bounced`.
 * Every one of them asserts something no provider response in this generation can prove. There is
 * no webhook, no delivery receipt and no reconciliation feed anywhere in this repository, so a
 * `delivered` value could only ever be set by a guess — the same test that removed `invalid` from
 * `external_recipient_status`.
 */
export const actionExecutionAttemptStatusEnum = pgEnum("action_execution_attempt_status", [
  "pending",
  "accepted",
  "refused",
  "failed",
  "unknown",
]);

/*
 * WHAT THE TRANSPORT OBSERVED — and the whole reason this is separate from `status`.
 *
 * The distinction that matters is not "did it work" but "COULD IT HAVE WORKED": whether the
 * request bytes reached the provider before the answer was lost.
 *
 *   accepted     a success response carrying a provider message id.
 *   rejected     the provider answered and declined. Reached it; it said no; nothing was sent.
 *   unreachable  PROVABLY pre-write — DNS failure, connection refused, TLS failure. The request
 *                body was never transmitted, so no external effect is possible.
 *   ambiguous    post-write and unresolved — a timeout after dispatch, a reset mid-flight, a 5xx,
 *                or a success with no message id. The provider MAY have accepted it.
 *
 * NULL means the adapter was never invoked at all, which a CHECK ties to `refused`.
 *
 * The existing live Claude transport collapses every non-abort throw into `provider-unavailable`.
 * That is safe for a model read and WRONG for a send: it would report a possible external effect
 * as a clean failure and invite a retry that double-sends.
 */
export const actionExecutionProviderResponseClassEnum = pgEnum(
  "action_execution_provider_response_class",
  ["accepted", "rejected", "unreachable", "ambiguous"],
);

/*
 * WHY A NON-ACCEPTED ATTEMPT ENDED. One column instead of fifteen statuses.
 *
 * Every value has a consumer: a surface that renders it and a test that asserts it. There is no
 * `other`, no `unclassified` and no free text, because a class nobody can act on is decoration.
 *
 * `unknown-outcome` is NOT here. Ambiguity is a STATUS, not a failure — calling it a failure is
 * exactly the claim R3B exists to refuse to make.
 */
export const actionExecutionFailureClassEnum = pgEnum("action_execution_failure_class", [
  /* Refusals — Hebun declined; no bytes left the process. */
  "authorization-invalid",
  "recipient-retired",
  "artifact-retired",
  "artifact-unresolvable",
  "digest-mismatch",
  "execution-disabled",
  "credential-unavailable",
  "adapter-unavailable",
  /* Failures — the act was attempted and provably did not take effect. */
  "provider-rejected",
  "provider-unreachable",
  "internal-persistence-failure",
]);
