/*
 * governance-audit/membership-lifecycle-audit.server.ts — the append for ending a membership.
 *
 * One more member of the established family (`departmental-placement-audit`,
 * `integration-lifecycle-audit`, `human-onboarding-audit`, …): a typed action, a narrow metadata
 * shape, and an insert that joins the CALLER'S transaction so "revoked" and "history says revoked"
 * commit together or not at all.
 *
 * THE METADATA CARRIES IDENTIFIERS AND A REASON, AND NOTHING ELSE. No email, no display name, no
 * session reference, no credential of any kind. An audit row is long-lived and widely readable; an
 * email placed here would outlive every product decision about where addresses may appear.
 */
import { auditLog } from "@/db/schema/audit-log";
import {
  MEMBERSHIP_ENTITY_TYPE,
  MEMBERSHIP_REVOKED_AUDIT_ACTION,
} from "@/features/membership-lifecycle/contracts";
import type { AuditActor, AuditWriter } from "./knowledge-mutation-audit.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type { AuditActor, AuditWriter };

export interface MembershipRevokedAuditEvent {
  /** The membership row. The subject IS the membership, not the human who held it. */
  readonly membershipId: string;
  /** Who lost the membership. An id — never an address. */
  readonly subjectUserId: string;
  readonly roleId: string | null;
  /** Free text from the caller, already length-checked by the authority. */
  readonly reason: string;
  /** How the caller came to hold Governance authority, as the resolver reported it. */
  readonly authorityVia: string;
}

export async function recordMembershipRevokedWithin(
  writer: AuditWriter,
  actor: AuditActor,
  event: MembershipRevokedAuditEvent,
  now: Date = new Date(),
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    /* A human acting through the product. Never accepted from input. */
    actorType: "human",
    actorId: actor.userId,
    action: MEMBERSHIP_REVOKED_AUDIT_ACTION,
    entityType: MEMBERSHIP_ENTITY_TYPE,
    entityId: event.membershipId,
    occurredAt: now,
    metadata: {
      subjectUserId: event.subjectUserId,
      roleId: event.roleId,
      reason: event.reason,
      authorityVia: event.authorityVia,
    },
    result: "committed",
    simulation: false,
    source: "membership-domain",
    requestId: actor.requestId,
    sessionContextId:
      actor.sessionContextId && UUID_RE.test(actor.sessionContextId)
        ? actor.sessionContextId
        : undefined,
    /*
     * `membership`, not `governance`. This column is a CLOSED CHECK — `membership`,
     * `platform-admin`, `internal-service`, `system` — and it names HOW the actor reached the
     * system, not which authority approved the act. A first version wrote `governance` and the
     * database refused it, correctly: the caller acts through their own membership and session,
     * and the Governance authority that permitted the transition is recorded in the metadata as
     * `authorityVia` where it belongs.
     */
    authoritySource: "membership",
  });
}
