/*
 * identity_enrollment_requests — the TWO-KEY identity enrollment ceremony (I1.2).
 *
 * ── WHAT THIS TABLE IS ───────────────────────────────────────────────────────
 *
 * Exactly one fact, and nothing wider:
 *
 *   "At time T a bearer presenting invitation I submitted an enrollment request.
 *    Governance approved it by decision D, or refused it for reason R. It was
 *    completed by establishing auth_identity X."
 *
 * KEY 1 is possession of the invitation capability. KEY 2 is approval by a human who
 * currently holds this tenant's Governance authority, resolved ONLY by
 * `resolveGovernanceAuthority`. Neither key alone establishes anything: this row is
 * what makes "the first key was turned" durable and visible so the second key has
 * something to approve.
 *
 * ── WHY IT IS A TABLE AND NOT A `pending` auth_identity ──────────────────────
 *
 * `auth_identities.status` already has a designed `pending` value, and using it would
 * have needed zero schema. It was measured against the live database and rejected:
 *
 *   users_email_uq                              UNIQUE (email)                     -- NOT partial
 *   auth_identities_provider_issuer_subject_uq  UNIQUE (provider,issuer,subject)   -- NOT partial
 *
 * Both tables use `rootColumns`, whose deletion is SOFT, and `auth_identities`' terminal
 * state is `revoked`, which keeps the row. So a rejected enrollment would permanently
 * occupy the intended human's email address AND their local subject — a stolen
 * invitation would inflict irreversible harm on the very person the second key exists to
 * protect. Creating NO identity row before Governance approval is the mitigation, and it
 * is the design rather than a patch on it.
 *
 * ── WHAT THIS TABLE DELIBERATELY DOES NOT CARRY ──────────────────────────────
 *
 * No email, no intended role, no expiry: `invitations` owns all three, and the composite
 * foreign key below binds this row to exactly one invitation in its own tenant.
 *
 * No credential material of any kind — not the derived key, not its per-row inputs, not the
 * algorithm, not the plaintext. A structural test permits only three files in `src/` to name the
 * stored credential secret at all, and this is deliberately not one of them; the words are avoided
 * here as well as the columns. Under Model C the secret is supplied only AFTER approval and is
 * hashed inside Credential authority, so there is never anything to hold here.
 *
 * No verification-source column, and none on `auth_identities` either: the B-4 necessity
 * proof established that provenance is already answered by this row's existence plus
 * `approval_decision_id`, and that `provider` + `issuer` already name the root of trust.
 *
 * ── THE CONTINUATION SECRET ──────────────────────────────────────────────────
 *
 * `continuation_hash` is the keyed digest of a bearer reference minted at Act 1 and shown
 * once. Act 3 requires it, which is what makes the approval an approval OF THAT SUBMISSION
 * rather than of whoever next turns up holding the invitation. Same primitive as
 * `user_session_contexts.provider_session_reference_hash` and `invitations.token_hash`:
 * HMAC-SHA256 over 32 random bytes, 64 lowercase hex, versioned so the key can rotate.
 * The raw reference is never stored.
 *
 * Uses tenantColumns: an enrollment ceremony belongs to exactly one tenant, even though the
 * identity it eventually produces is global.
 */
import { sql } from "drizzle-orm";
import {
  char,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import { actorTypeEnum, identityEnrollmentStatusEnum } from "./_enums";
import { authIdentities } from "./auth-identity";
import { decisionRecords } from "./governance";
import { invitations } from "./invitation";

export const identityEnrollmentRequests = pgTable(
  "identity_enrollment_requests",
  {
    ...tenantColumns,

    /**
     * The invitation this ceremony is against. Declared WITHOUT a single-column reference so the
     * only foreign key is the tenant-bound composite one below — the same shape I1 uses for
     * `intended_role_id`. Binding by id alone would let a Tenant A row cite a Tenant B invitation.
     */
    invitationId: uuid("invitation_id").notNull(),

    /** Keyed digest of the Act 1 continuation reference. See the header: never the raw value. */
    continuationHash: char("continuation_hash", { length: 64 }).notNull(),
    /** Which digest key produced `continuation_hash`, so the key can rotate. */
    continuationVersion: integer("continuation_version").notNull().default(1),

    status: identityEnrollmentStatusEnum("status").notNull().default("pending"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),

    /* ── KEY 2: approval. All NULL until a Governance authority acts. ── */
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    /** The `approve` decision that authorized this enrollment. RESTRICT: history is not deletable. */
    approvalDecisionId: uuid("approval_decision_id"),
    /**
     * The accountable approver, as the canonical polymorphic pair. Constrained to `human` by CHECK
     * below — an agent may never vouch for a human's identity, and that is a database fact here
     * rather than a server-side hope.
     */
    approvedByActorType: actorTypeEnum("approved_by_actor_type"),
    approvedByActorId: uuid("approved_by_actor_id"),

    /* ── Refusal. A terminal state that leaves nothing global behind. ── */
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectionReason: varchar("rejection_reason", { length: 128 }),

    /* ── Completion. Written by Act 3, in the same transaction as the identity it names. ── */
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** The identity this ceremony produced. RESTRICT: an enrolled identity is not deletable. */
    enrolledAuthIdentityId: uuid("enrolled_auth_identity_id"),
  },
  (t) => [
    /*
     * THE ONE-CEREMONY-PER-INVITATION INVARIANT. Partial, so a refused attempt accumulates as
     * history and does NOT free the slot — a rejection must not be retryable by the same bearer.
     * A new attempt needs a new invitation, which is a Governance act. Two concurrent Act 1
     * submissions both pass an application read; this index is the actual defense.
     */
    uniqueIndex("identity_enrollment_requests_one_live_per_invitation_uq")
      .on(t.invitationId)
      .where(sql`${t.status} <> 'rejected'`),

    /** A continuation reference identifies at most one ceremony, globally. */
    uniqueIndex("identity_enrollment_requests_continuation_uq").on(t.continuationHash),

    /** One Governance decision approves at most one enrollment. */
    uniqueIndex("identity_enrollment_requests_decision_uq")
      .on(t.approvalDecisionId)
      .where(sql`${t.approvalDecisionId} is not null`),

    /** One ceremony produces at most one identity, and one identity comes from at most one ceremony. */
    uniqueIndex("identity_enrollment_requests_identity_uq")
      .on(t.enrolledAuthIdentityId)
      .where(sql`${t.enrolledAuthIdentityId} is not null`),

    /*
     * STRUCTURAL TENANT BINDING (B-5). Reuses `invitations_tenant_id_id_uq` — "enrolling against
     * another tenant's invitation" is a database error, not a check somebody can forget. Same
     * pattern as `membership_authorizations_tenant_role_fk`.
     */
    foreignKey({
      name: "identity_enrollment_requests_tenant_invitation_fk",
      columns: [t.tenantId, t.invitationId],
      foreignColumns: [invitations.tenantId, invitations.id],
    }).onDelete("restrict"),

    /* Named explicitly: the drizzle-generated name would exceed Postgres' 63-character limit. */
    foreignKey({
      name: "identity_enrollment_requests_decision_fk",
      columns: [t.approvalDecisionId],
      foreignColumns: [decisionRecords.id],
    }).onDelete("restrict"),

    foreignKey({
      name: "identity_enrollment_requests_identity_fk",
      columns: [t.enrolledAuthIdentityId],
      foreignColumns: [authIdentities.id],
    }).onDelete("restrict"),

    index("identity_enrollment_requests_tenant_status_idx").on(t.tenantId, t.status),

    check(
      "identity_enrollment_requests_continuation_hash_chk",
      sql`${t.continuationHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "identity_enrollment_requests_continuation_version_chk",
      sql`${t.continuationVersion} > 0`,
    ),

    /*
     * APPROVAL IS ALL-OR-NOTHING, IN BOTH DIRECTIONS. "approved, but we do not know by which
     * decision or by whom" is not a state this table can hold, and neither is "we have an approval
     * decision but the status says pending". `completed` is included because a completed ceremony
     * was necessarily approved first — approval evidence is never erased by completion.
     */
    check(
      "identity_enrollment_requests_approved_chk",
      sql`(${t.status} in ('approved', 'completed')) = (${t.approvedAt} is not null and ${t.approvalDecisionId} is not null and ${t.approvedByActorType} is not null and ${t.approvedByActorId} is not null)`,
    ),

    /* A refused ceremony must say when and why. */
    check(
      "identity_enrollment_requests_rejected_chk",
      sql`(${t.status} = 'rejected') = (${t.rejectedAt} is not null and ${t.rejectionReason} is not null and char_length(btrim(${t.rejectionReason})) > 0)`,
    ),

    /* A completed ceremony must name the identity it produced. */
    check(
      "identity_enrollment_requests_completed_chk",
      sql`(${t.status} = 'completed') = (${t.completedAt} is not null and ${t.enrolledAuthIdentityId} is not null)`,
    ),

    /* HUMAN SUPREMACY at the storage layer, matching membership_authorizations. */
    check(
      "identity_enrollment_requests_human_approver_chk",
      sql`${t.approvedByActorType} is null or ${t.approvedByActorType} = 'human'`,
    ),
  ],
);
