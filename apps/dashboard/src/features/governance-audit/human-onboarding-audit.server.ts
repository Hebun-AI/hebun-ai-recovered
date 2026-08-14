/*
 * governance-audit/human-onboarding-audit.server.ts — append-only history for the onboarding
 * transition (I2), over the EXISTING shared `audit_log` sink.
 *
 * THE FIFTH SIBLING, NOT A SUPERSET. `knowledge-mutation-audit` (G1) owns Knowledge mutation;
 * `genesis-nomination-audit` (G2.1) owns pre-Governance entitlement; `governance-decision-audit`
 * (G2/G3/I1/I1.1/I1.2) owns Governance decisions; `identity-enrollment-audit` (I1.2) owns the moment
 * a human came into existence; this owns the moment a human joined an organization. Five domains,
 * five boundary constants, five entity types, and no module references another's boundary.
 *
 * WHY IT IS SEPARATE FROM THE DECISION WRITER. Issuing an invitation and creating a membership are
 * not Governance decisions. The decision was made at I1 and is already in `decision_records`;
 * filing these under `governance_decision` would make the ledger claim two decisions where one was
 * made, and would inflate the constitutional history with mechanical steps.
 *
 * NO NEW SINK AND NO MIGRATION. `action` and `entity_type` are free text.
 *
 * NOTHING SECRET, EVER. No bearer capability, no digest, no password, no salt, no credential hash.
 * The invited address is not duplicated either — `invitations.normalized_email` owns it.
 *
 * APPEND-ONLY, ENFORCED BY WHAT IS ABSENT: one write, no read, no update, no delete, no upsert.
 *
 * Server-only.
 */

import type { ControlPlaneDatabase } from "@/db/client.server";
import { auditLog } from "@/db/schema/audit-log";

/** The control-plane database or an open transaction on it — so audit joins the act. */
export type OnboardingAuditWriter = Pick<ControlPlaneDatabase, "insert">;

/**
 * WHICH ONBOARDING EVENTS BECOME HISTORY. A sibling of the other four boundary constants — never an
 * extension of any of them.
 */
export const ONBOARDING_AUDIT_BOUNDARY = Object.freeze({
  /** A capability was minted against a live authorization by an accountable Governance authority. */
  recordsInvitationIssuance: true as const,
  /** A human proved they were the invited human and joined the tenant. */
  recordsMembershipCreation: true as const,
  /**
   * A Governance authority ended an outstanding capability. Recorded for the same reason issuance
   * is: it is a consequential act with a real accountable actor, and the tenant needs to be able to
   * ask later why a capability stopped working.
   */
  recordsInvitationRevocation: true as const,
  /**
   * A failed acceptance attempt is NOT recorded. The caller is unauthenticated by construction, and
   * `audit_log.actor_type` / `actor_id` are both NOT NULL — there is no honest actor to name. Worse,
   * recording attempts would turn the ledger into a probe log for anyone holding a guessed token.
   */
  recordsFailedAcceptance: false as const,
  /** Governance decisions belong to the decision ledger, not here. */
  recordsGovernanceDecisions: false as const,
  entityType: "invitation" as const,
});

export interface InvitationIssuedAuditEvent {
  readonly action: string;
  readonly tenantId: string;
  readonly invitationId: string;
  /** `users.id` of the Governance authority who issued it. Resolved from the session, never input. */
  readonly issuedByUserId: string;
  /** The authorization this invitation spent. */
  readonly membershipAuthorizationId: string;
  /** The role band the membership will carry. Band only. */
  readonly intendedRoleId: string;
  readonly requestId?: string;
  readonly sessionContextId?: string;
}

export interface MembershipCreatedAuditEvent {
  readonly action: string;
  readonly tenantId: string;
  readonly invitationId: string;
  /** `users.id` of the human who joined — the actor, because it is their act. */
  readonly memberUserId: string;
  readonly membershipId: string;
  readonly roleId: string;
  readonly membershipAuthorizationId: string;
}

export interface InvitationRevokedAuditEvent {
  readonly action: string;
  readonly tenantId: string;
  readonly invitationId: string;
  /** `users.id` of the Governance authority who revoked it. Resolved from the session, never input. */
  readonly revokedByUserId: string;
  /** The authorization this invitation spent. It is NOT un-consumed; this is provenance only. */
  readonly membershipAuthorizationId: string | null;
  /** Whether the capability had already lapsed by the clock. Shape, not content. */
  readonly wasAlreadyExpiredByClock: boolean;
  readonly requestId?: string;
  readonly sessionContextId?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Append the issuance event, inside the issuing transaction.
 *
 * Passing the transaction is what makes "issued" and "history says issued" the same fact: a rolled
 * back issuance takes its audit row with it, and a failing audit insert aborts the issuance.
 */
export async function recordInvitationIssuedWithin(
  writer: OnboardingAuditWriter,
  event: InvitationIssuedAuditEvent,
  now: Date = new Date(),
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: event.tenantId,
    // A human acting through the product. Never accepted from input.
    actorType: "human",
    actorId: event.issuedByUserId,
    action: event.action,
    entityType: ONBOARDING_AUDIT_BOUNDARY.entityType,
    entityId: event.invitationId,
    occurredAt: now,
    metadata: {
      invitationId: event.invitationId,
      membershipAuthorizationId: event.membershipAuthorizationId,
      intendedRoleId: event.intendedRoleId,
      /* Stated so history cannot later be read as "we emailed them". */
      delivered: false,
    },
    result: "committed",
    simulation: false,
    source: "human-onboarding",
    requestId: event.requestId,
    sessionContextId:
      event.sessionContextId && UUID_RE.test(event.sessionContextId)
        ? event.sessionContextId
        : undefined,
    authoritySource: "membership",
  });
}

/**
 * Append the revocation event, inside the revoking transaction.
 *
 * THE REASON IS NOT DUPLICATED HERE. `invitations.revocation_reason` owns it, exactly as
 * `invitations.normalized_email` owns the address; copying it would put the same human-authored
 * sentence in two places that can drift. History records THAT a revocation happened, who did it, and
 * which invitation it ended.
 */
export async function recordInvitationRevokedWithin(
  writer: OnboardingAuditWriter,
  event: InvitationRevokedAuditEvent,
  now: Date = new Date(),
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: event.tenantId,
    actorType: "human",
    actorId: event.revokedByUserId,
    action: event.action,
    entityType: ONBOARDING_AUDIT_BOUNDARY.entityType,
    entityId: event.invitationId,
    occurredAt: now,
    metadata: {
      invitationId: event.invitationId,
      membershipAuthorizationId: event.membershipAuthorizationId,
      /* Stated so history cannot later be read as "the authorization was returned". */
      authorizationRemainsConsumed: true,
      wasAlreadyExpiredByClock: event.wasAlreadyExpiredByClock,
    },
    result: "committed",
    simulation: false,
    source: "human-onboarding",
    requestId: event.requestId,
    sessionContextId:
      event.sessionContextId && UUID_RE.test(event.sessionContextId)
        ? event.sessionContextId
        : undefined,
    authoritySource: "membership",
  });
}

/**
 * Append the membership-creation event, inside the acceptance transaction.
 *
 * The actor is the human who joined. They are not yet a member when the transaction opens, but they
 * are by the time it commits, and the event is unambiguously about them.
 */
export async function recordMembershipCreatedWithin(
  writer: OnboardingAuditWriter,
  event: MembershipCreatedAuditEvent,
  now: Date = new Date(),
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: event.tenantId,
    actorType: "human",
    actorId: event.memberUserId,
    action: event.action,
    entityType: ONBOARDING_AUDIT_BOUNDARY.entityType,
    entityId: event.invitationId,
    occurredAt: now,
    metadata: {
      invitationId: event.invitationId,
      membershipId: event.membershipId,
      roleId: event.roleId,
      membershipAuthorizationId: event.membershipAuthorizationId,
    },
    result: "committed",
    simulation: false,
    source: "human-onboarding",
    authoritySource: "membership",
  });
}
