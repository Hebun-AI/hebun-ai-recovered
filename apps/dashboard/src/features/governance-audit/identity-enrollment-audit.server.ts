/*
 * governance-audit/identity-enrollment-audit.server.ts — append-only history for the completion of a
 * two-key identity enrollment (I1.2), over the EXISTING shared `audit_log` sink.
 *
 * THE FOURTH SIBLING, NOT A SUPERSET. `knowledge-mutation-audit` (G1) owns Knowledge mutation
 * history; `genesis-nomination-audit` (G2.1) owns pre-Governance entitlement;
 * `governance-decision-audit` (G2/G3/I1/I1.1/I1.2) owns Governance decisions; this owns the moment a
 * human came into existence. Four domains, four boundary constants, four entity types, and no module
 * references another's boundary — so tightening one can never silently move the others.
 *
 * WHY IT IS SEPARATE FROM THE DECISION WRITER. Acts 2 and 3 are different events by different
 * actors. Act 2 is a Governance decision by an authority; Act 3 is not a Governance act at all — it
 * is Identity and Credential authority completing a ceremony, performed by the enrolled human. Filing
 * the second under `governance_decision` would make the ledger claim a decision that nobody made.
 *
 * NO NEW SINK AND NO MIGRATION. `action` and `entity_type` are free text on `audit_log`, so a new
 * domain costs zero schema. A second audit table would be a second authority for one question.
 *
 * NOTHING SECRET, EVER. No password, no salt, no secret hash, no invitation token, no continuation
 * reference, no digest, and no email address — `invitations.normalized_email` owns the address, and
 * one address with one owner cannot drift. Ids and provider band only.
 *
 * APPEND-ONLY, ENFORCED BY WHAT IS ABSENT: one write, no read, no update, no delete, no upsert.
 *
 * Server-only.
 */

import type { ControlPlaneDatabase } from "@/db/client.server";
import { auditLog } from "@/db/schema/audit-log";

/** The control-plane database or an open transaction on it — so audit joins the ceremony. */
export type EnrollmentAuditWriter = Pick<ControlPlaneDatabase, "insert">;

/**
 * WHICH ENROLLMENT EVENTS BECOME HISTORY. A sibling of `KNOWLEDGE_AUDIT_BOUNDARY`,
 * `GENESIS_AUDIT_BOUNDARY` and `GOVERNANCE_AUDIT_BOUNDARY` — never an extension of any of them.
 */
export const IDENTITY_ENROLLMENT_AUDIT_BOUNDARY = Object.freeze({
  /** A completed ceremony: a real human now exists and can prove a password. */
  recordsCompletedEnrollments: true as const,
  /**
   * Act 1 is NOT recorded, and the omission is deliberate rather than an oversight. The submitter is
   * unauthenticated, `audit_log.actor_type` and `actor_id` are both NOT NULL, and naming a system
   * actor would put a claim in a tenant's ledger that no human made. The
   * `identity_enrollment_requests` row, with its `submitted_at`, is the durable evidence instead.
   */
  recordsUnauthenticatedSubmissions: false as const,
  /** Act 2 belongs to the Governance decision ledger, not here. */
  recordsGovernanceDecisions: false as const,
  /** The entity a completion event is about: the ceremony, not the identity. */
  entityType: "identity_enrollment_request" as const,
});

export interface EnrollmentCompletionAuditEvent {
  readonly action: string;
  readonly tenantId: string;
  /** The ceremony this completion finished. */
  readonly enrollmentId: string;
  /** The invitation the ceremony was started against. */
  readonly invitationId: string;
  /**
   * `users.id` of the human who just came into existence — the canonical `actor_id` for
   * `actor_type = 'human'` across the schema. The event is genuinely about them, and their row is
   * real by the time this append runs inside the same transaction.
   */
  readonly enrolledUserId: string;
  readonly enrolledAuthIdentityId: string;
  /** Which authentication root vouched for the subject. Band only, never issuer-specific secrets. */
  readonly identityProvider: string;
}

/**
 * Append one enrollment-completion event.
 *
 * `writer` is the open transaction that is creating the identity and the credential. Passing the
 * transaction is what makes "enrolled" and "history says enrolled" the same fact: "completed but
 * unaudited" and "audited but rolled back" are excluded by the transaction, not by hoping. A failing
 * audit insert therefore aborts the whole ceremony.
 */
export async function recordEnrollmentCompletionWithin(
  writer: EnrollmentAuditWriter,
  event: EnrollmentCompletionAuditEvent,
  now: Date = new Date(),
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: event.tenantId,
    // A human acting through the product. Never accepted from input.
    actorType: "human",
    actorId: event.enrolledUserId,
    action: event.action,
    entityType: IDENTITY_ENROLLMENT_AUDIT_BOUNDARY.entityType,
    entityId: event.enrollmentId,
    occurredAt: now,
    metadata: {
      identityEnrollmentRequestId: event.enrollmentId,
      enrollmentInvitationId: event.invitationId,
      authIdentityId: event.enrolledAuthIdentityId,
      identityProvider: event.identityProvider,
    },
    result: "committed",
    simulation: false,
    source: "identity-enrollment",
    /*
     * The enrolled human acted under the tenant's own enrollment ceremony. `authority_source` is a
     * closed set on the sink; `membership` is the only value that describes acting inside a tenant,
     * and it is what every other in-product act records.
     */
    authoritySource: "membership",
  });
}
