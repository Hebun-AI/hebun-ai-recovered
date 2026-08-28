/*
 * heby_action_requests + action_permits — durable authorization to act (R3A).
 *
 * ── THE TWO FACTS, AND WHY THEY ARE TWO TABLES ───────────────────────────────
 *
 *   heby_action_requests: "Heby prepared this exact consequential action, and a human has
 *                          been asked to decide about it."
 *   action_permits:       "Governance decision D authorized this exact action to become
 *                          executable once, before this instant, unless revoked first."
 *
 * They are separate because a request exists BEFORE any decision and a permit must never
 * exist before one. A single table would need a `pending` permit row — and a row in a table
 * called `permit` that nobody authorized is exactly the collapse this phase exists to prevent:
 *
 *   DECISION ≠ APPROVAL ≠ PERMIT ≠ EXECUTION ≠ SUCCESS
 *
 * The pairing is not invented here. `identity_enrollment_requests` → `membership_authorizations`
 * is the same shape, written by the same Governance authority, for the same reason.
 *
 * ── WHAT THIS IS NOT ─────────────────────────────────────────────────────────
 *
 * It is NOT a second Governance authority. Whether the actor may authorize anything is answered
 * ONLY by `resolveGovernanceAuthority` reading `decision_records`; a permit is downstream
 * evidence of that answer and never a substitute for asking it again.
 *
 * It is NOT execution. No row here causes an effect, and R3A ships no executor. Consuming a
 * permit produces an authorization handoff and nothing else — see `single-spend.server.ts`.
 *
 * It is NOT a capability grant. A permit authorizes ONE act with frozen parameters, then dies.
 * It confers no standing privilege, no role, no provider access and no execution authority.
 *
 * It carries NO secret, NO token, NO credential, NO model reasoning, NO confidence and NO
 * execution result. `canonical_payload` holds only the typed scalars the Heby argument schema
 * already validated (string | number | boolean), which is why it can be hashed and shown to a
 * human without redaction.
 *
 * ── THE STAGES, WHICH MAY NEVER COLLAPSE ─────────────────────────────────────
 *
 *   Governance authority     who may decide                     (G2 / G3)
 *          ↓
 *   action request           the frozen proposal                (HERE)
 *          ↓
 *   approve decision         the constitutional act             (decision_records)
 *          ↓
 *   action permit            the consumable authorization       (HERE)
 *          ↓
 *   consumption handoff      authorization spent, once          (R3A — no effect)
 *          ↓
 *   execution                the actual act                     (R3B — does not exist)
 *
 * ── WHY A SECOND DIGEST ──────────────────────────────────────────────────────
 *
 * `action_id` is Heby's own FNV-1a content identity. It is a 32-bit non-cryptographic hash and
 * its own source says so; it is kept because it is what Heby already computes for dedupe. It is
 * NOT the approval binding. `payload_digest` is SHA-256 over a canonical serialization, and it is
 * the only thing consumption re-verifies. Binding an approval to a 32-bit hash would let a second
 * action present the same identity — a collision an attacker can search for in seconds.
 */
import { sql } from "drizzle-orm";
import {
  char,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import {
  actionPermitStatusEnum,
  actorTypeEnum,
  hebyActionRequestStatusEnum,
} from "./_enums";
import { decisionRecords, governanceSessions } from "./governance";

/**
 * The proposal, frozen at preparation time.
 *
 * Every column here is copied from a `HebyPreparedAction` the deterministic Heby lifecycle already
 * produced and validated. Nothing is re-derived at write time and nothing is accepted from a
 * client: the tenant comes from the session, the actor pair from the resolved principal, and the
 * payload from arguments that already passed the tool's typed schema.
 */
export const hebyActionRequests = pgTable(
  "heby_action_requests",
  {
    ...tenantColumns,

    /* ── Action identity (see the header on why there are two) ── */
    /** Heby's FNV-1a content identity. Dedupe and correlation only — never the approval binding. */
    actionId: varchar("action_id", { length: 64 }).notNull(),
    /**
     * SHA-256 (lowercase hex) over the canonical serialization of what is being approved. THE
     * approval binding: consumption re-verifies against this and refuses on mismatch.
     */
    payloadDigest: char("payload_digest", { length: 64 }).notNull(),

    /** The declared action kind from the Heby action registry. Text, as KR5 stored its vocabularies. */
    actionKind: text("action_kind").notNull(),
    toolId: text("tool_id").notNull(),
    /** `READ_ONLY` | `PREPARATION_ONLY` | `REVERSIBLE_MUTATION` | `CONSEQUENTIAL_MUTATION` | `DEVICE_ACTION`. */
    sideEffect: text("side_effect").notNull(),
    /** `none` | `deterministic-inverse` | `irreversible`. A real property, never a hope. */
    reversibility: text("reversibility").notNull(),

    /* ── Target: the concrete thing the action would affect. Naming it grants nothing. ── */
    targetKind: text("target_kind"),
    targetRef: text("target_ref"),
    targetLabel: text("target_label"),

    /** The workspace that OWNS the capability, and the one that asked. Both recorded; both checked. */
    ownerWorkspace: text("owner_workspace").notNull(),
    requestingWorkspace: text("requesting_workspace").notNull(),

    /**
     * The validated typed arguments, exactly as approved. Scalars only — the Heby argument schema
     * admits `string | number | boolean` and rejects unknown keys, so this is hashable, reviewable
     * and structurally incapable of carrying a credential.
     */
    canonicalPayload: jsonb("canonical_payload").notNull(),
    /** What a human is told would happen. Never a claim that it happened. */
    expectedEffect: text("expected_effect").notNull(),
    /** Consequences stated before confirmation — the Heby Core Phase 6 requirement. */
    consequences: jsonb("consequences").notNull(),
    /** The evidence references the proposal rested on, for review. Identity from retrieval only. */
    evidence: jsonb("evidence"),

    /* ── Who proposed. An agent MAY propose; the CHECK below is deliberately absent here. ── */
    proposedByActorType: actorTypeEnum("proposed_by_actor_type").notNull(),
    proposedByActorId: uuid("proposed_by_actor_id").notNull(),

    /*
     * AGENT-PROPOSAL-4B — WHICH MODEL INVOCATION CAUSED THIS PROPOSAL.
     *
     * A recorded reference, of exactly the same kind as `proposed_by_actor_id` above: a value
     * written at creation, naming something this table does not own. It adds NO authority here —
     * nothing reads it to decide anything, and no behaviour keys off it.
     *
     * NULL FOR EVERY HUMAN-TYPED PROPOSAL, and that is the honest reading: a human dictated the
     * act, so no model invocation caused it. Null on an agent proposal means the cause was not
     * recorded, never that none existed.
     *
     * DELIBERATELY NO FOREIGN KEY. An FK would make the existence of a provenance row a
     * database-level precondition for a proposal insert — provenance would acquire a veto over
     * proposal existence through referential integrity, which is precisely the authority this
     * design refuses it. The same veto must not be recreated in code either: the proposal writer
     * never looks the id up, and a firewall test asserts it cannot. The cost is stated plainly —
     * referential integrity is unenforced, so a dangling value is possible in principle, and the
     * diagnostic reader must join on tenant equality rather than trust the id alone.
     *
     * `heby_origination_invocations` carries no `action_request_id` back: one fact, one place.
     */
    originationInvocationId: uuid("origination_invocation_id"),

    status: hebyActionRequestStatusEnum("status").notNull().default("pending"),

    /* ── Approval. All four move together or none do (CHECK below). ── */
    /** The `approve` decision. RESTRICT: an approved request's legitimacy is not deletable. */
    approvalDecisionId: uuid("approval_decision_id").references(() => decisionRecords.id, {
      onDelete: "restrict",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedByActorType: actorTypeEnum("approved_by_actor_type"),
    approvedByActorId: uuid("approved_by_actor_id"),

    /* ── Rejection. A refusal is a decision too, and it must say why. ── */
    rejectionDecisionId: uuid("rejection_decision_id").references(() => decisionRecords.id, {
      onDelete: "restrict",
    }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectionReason: varchar("rejection_reason", { length: 256 }),
  },
  (t) => [
    /*
     * THE DUPLICATE-PROPOSAL INVARIANT. At most one LIVE request may exist per exact action per
     * tenant. Partial, so decided requests accumulate as history and free the slot — the same
     * shape as `membership_authorizations_one_active_per_email_uq`. Keyed on the SHA-256 digest,
     * not on `action_id`, because the digest is what "the same action" actually means here.
     */
    uniqueIndex("heby_action_requests_one_pending_per_digest_uq")
      .on(t.tenantId, t.payloadDigest)
      .where(sql`${t.status} = 'pending'`),

    /** One Governance decision approves at most one request. */
    uniqueIndex("heby_action_requests_approval_decision_uq")
      .on(t.approvalDecisionId)
      .where(sql`${t.approvalDecisionId} is not null`),
    /** One Governance decision rejects at most one request. */
    uniqueIndex("heby_action_requests_rejection_decision_uq")
      .on(t.rejectionDecisionId)
      .where(sql`${t.rejectionDecisionId} is not null`),

    /**
     * Tenant-safe parent key. `action_permits` binds with a COMPOSITE foreign key, so a permit
     * built on another tenant's request is a database error rather than a check somebody forgot.
     */
    uniqueIndex("heby_action_requests_tenant_id_uq").on(t.tenantId, t.id),

    index("heby_action_requests_tenant_status_idx").on(t.tenantId, t.status),
    index("heby_action_requests_digest_idx").on(t.tenantId, t.payloadDigest),

    /*
     * APPROVAL IS ALL-OR-NOTHING, IN BOTH DIRECTIONS. "approved, but we do not know by which
     * decision" and "has a decision but the status still says pending" are both unrepresentable.
     */
    check(
      "heby_action_requests_approved_chk",
      sql`(${t.status} = 'approved') = (${t.approvedAt} is not null and ${t.approvalDecisionId} is not null and ${t.approvedByActorType} is not null and ${t.approvedByActorId} is not null)`,
    ),
    /* A rejected request must say when, by which decision, and why. */
    check(
      "heby_action_requests_rejected_chk",
      sql`(${t.status} = 'rejected') = (${t.rejectedAt} is not null and ${t.rejectionDecisionId} is not null and ${t.rejectionReason} is not null and char_length(btrim(${t.rejectionReason})) > 0)`,
    ),

    /*
     * HUMAN SUPREMACY AT THE APPROVAL BOUNDARY. An agent may PROPOSE — that is the whole point of
     * Heby preparing work — but the approver is constrained to `human` here, at the storage layer,
     * so a model approving its own proposal is a database error and not a code review finding.
     */
    check(
      "heby_action_requests_human_approver_chk",
      sql`${t.approvedByActorType} is null or ${t.approvedByActorType} = 'human'`,
    ),

    /* A SHA-256 hex digest, lowercase, exactly 64 characters. */
    check(
      "heby_action_requests_payload_digest_chk",
      sql`${t.payloadDigest} ~ '^[0-9a-f]{64}$'`,
    ),

    /*
     * DEVICE ACTIONS ARE NOT AUTHORIZABLE HERE. Computer Use is Platform-owned and stays
     * RESTRICTED in the Heby lifecycle; R3A must not become the back door that authorizes it.
     */
    check(
      "heby_action_requests_no_device_action_chk",
      sql`${t.sideEffect} <> 'DEVICE_ACTION'`,
    ),

    /* A target is all-or-nothing: a ref without a kind is not a resolvable thing. */
    check(
      "heby_action_requests_target_chk",
      sql`(${t.targetKind} is null) = (${t.targetRef} is null)`,
    ),
  ],
);

/**
 * The authorization itself. A row exists here ONLY because a Governance decision approved it.
 *
 * Both governance columns are NOT NULL: a permit with no decision behind it is not a state this
 * table can hold. That single constraint is the whole "no permit without legitimacy" invariant,
 * and it is enforced by PostgreSQL rather than remembered by a caller.
 */
export const actionPermits = pgTable(
  "action_permits",
  {
    ...tenantColumns,

    /** The frozen proposal this authorizes. RESTRICT: what was approved is not deletable. */
    actionRequestId: uuid("action_request_id").notNull(),

    /* ── Governance provenance. Both NOT NULL. ── */
    /** The `approve` decision that authorized this action. */
    governanceDecisionId: uuid("governance_decision_id")
      .notNull()
      .references(() => decisionRecords.id, { onDelete: "restrict" }),
    /** The session that decision was recorded in. */
    governanceSessionId: uuid("governance_session_id")
      .notNull()
      .references(() => governanceSessions.id, { onDelete: "restrict" }),

    /**
     * The accountable authorizing human, as the canonical polymorphic pair. Constrained to
     * `human` by CHECK below — an agent may never authorize a consequential act, and that is a
     * database fact here rather than a server-side hope.
     */
    authorizedByActorType: actorTypeEnum("authorized_by_actor_type").notNull(),
    authorizedByActorId: uuid("authorized_by_actor_id").notNull(),

    /**
     * The digest copied from the request at issuance. Consumption re-verifies BOTH this and the
     * request's own digest, so a permit whose request was somehow altered cannot be spent.
     */
    boundPayloadDigest: char("bound_payload_digest", { length: 64 }).notNull(),

    status: actionPermitStatusEnum("status").notNull().default("active"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * Mandatory, server-bounded. There is no such thing as a permit that authorizes forever;
     * `expires_at <= now()` is the entire expiry mechanism and needs no scheduler.
     */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** The bounded lifetime actually granted, recorded so a review can see what was chosen. */
    ttlSeconds: integer("ttl_seconds").notNull(),

    /* ── Consumption. Written by R3A's handoff seam; the EFFECT belongs to R3B. ── */
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    /**
     * The durable handoff identity minted at the instant the permit was spent. Deliberately NOT a
     * foreign key: the execution attempt it will belong to is R3B's table and does not exist. R3B
     * references this id; R3A never invents a row in a table it does not own.
     */
    handoffId: uuid("handoff_id"),

    /* ── Revocation. WRITTEN in R3A, not declared and left empty. ── */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    /** The `revoke` decision. Revocation is a Governance act, not a field somebody flipped. */
    revocationDecisionId: uuid("revocation_decision_id").references(() => decisionRecords.id, {
      onDelete: "restrict",
    }),
    revocationReason: varchar("revocation_reason", { length: 256 }),
  },
  (t) => [
    /** One Governance decision authorizes at most one permit. */
    uniqueIndex("action_permits_decision_uq").on(t.governanceDecisionId),
    /** One approved request yields at most one permit. */
    uniqueIndex("action_permits_request_uq").on(t.actionRequestId),

    /**
     * THE COMPOSITE-FK ANCHOR (added at R3B).
     *
     * Every sibling in this chain already carried one — `heby_action_requests_tenant_id_uq`,
     * `work_artifacts_tenant_id_uq`, `external_recipients_tenant_id_uq`. `action_permits` did not,
     * because until R3B nothing pointed AT a permit. `action_execution_attempts` does, and it must
     * bind by `(tenant_id, permit_id)` rather than by `permit_id` alone: an attempt that could name
     * another tenant's permit would make tenant safety an application `where` clause somebody can
     * forget, instead of a fact the database refuses to violate.
     *
     * Additive and non-breaking: `id` is already the primary key, so no existing row can conflict.
     */
    uniqueIndex("action_permits_tenant_id_uq").on(t.tenantId, t.id),

    /**
     * THE SINGLE-SPEND INVARIANT. One handoff may spend at most one permit. Partial because the
     * column is null until the permit is consumed — the same shape as
     * `membership_authorizations_consumed_invitation_uq`.
     */
    uniqueIndex("action_permits_handoff_uq")
      .on(t.handoffId)
      .where(sql`${t.handoffId} is not null`),

    /**
     * Structural tenant binding to the approved proposal. Reuses
     * `heby_action_requests_tenant_id_uq` — "a permit for another tenant's action" is a database
     * error. Same pattern as `membership_authorizations_tenant_role_fk`.
     */
    foreignKey({
      name: "action_permits_tenant_request_fk",
      columns: [t.tenantId, t.actionRequestId],
      foreignColumns: [hebyActionRequests.tenantId, hebyActionRequests.id],
    }).onDelete("restrict"),

    index("action_permits_tenant_status_idx").on(t.tenantId, t.status),
    index("action_permits_expiry_idx").on(t.tenantId, t.expiresAt),

    /* HUMAN SUPREMACY. Spec 49 §4 — an agent may never authorize a consequential act. */
    check("action_permits_human_authorizer_chk", sql`${t.authorizedByActorType} = 'human'`),

    /*
     * CONSUMPTION IS ALL-OR-NOTHING. "consumed, but we do not know under which handoff" is not a
     * representable state, and the status cannot drift from the evidence in either direction.
     */
    check(
      "action_permits_consumed_chk",
      sql`(${t.consumedAt} is null) = (${t.handoffId} is null)`,
    ),
    check(
      "action_permits_consumed_status_chk",
      sql`(${t.status} = 'consumed') = (${t.consumedAt} is not null)`,
    ),

    /* A revoked permit must say when, by which decision, and why. */
    check(
      "action_permits_revoked_chk",
      sql`(${t.status} = 'revoked') = (${t.revokedAt} is not null and ${t.revocationDecisionId} is not null and ${t.revocationReason} is not null and char_length(btrim(${t.revocationReason})) > 0)`,
    ),

    /* A permit can never be both spent and cancelled. */
    check(
      "action_permits_terminal_exclusive_chk",
      sql`${t.consumedAt} is null or ${t.revokedAt} is null`,
    ),

    /* Expiry is mandatory and must be in the future at issuance. */
    check("action_permits_expiry_after_issue_chk", sql`${t.expiresAt} > ${t.issuedAt}`),
    /* The granted lifetime is bounded on both sides; the server clamps, the row proves it. */
    check(
      "action_permits_ttl_bounds_chk",
      sql`${t.ttlSeconds} > 0 and ${t.ttlSeconds} <= 86400`,
    ),

    /* The bound digest is a SHA-256 hex digest, lowercase, exactly 64 characters. */
    check(
      "action_permits_bound_digest_chk",
      sql`${t.boundPayloadDigest} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);
