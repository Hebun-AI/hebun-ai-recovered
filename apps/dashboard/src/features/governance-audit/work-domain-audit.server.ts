/*
 * governance-audit/work-domain-audit.server.ts — the Work Domain Authority's audit sibling (AP-4A).
 *
 * Appends one row per work-domain transition to the SHARED sink, inside the writer's transaction, so
 * a committed transition and its history are atomic. It records the slug and the name AS THEY WERE at
 * the event, which is what keeps a rename from rewriting what the past said a domain was called.
 */
import { auditLog } from "@/db/schema/audit-log";
import {
  WORK_DOMAIN_ENTITY_TYPE,
  type WorkDomainAuditAction,
} from "@/features/work-domain/contracts";
import type { AuditActor, AuditWriter } from "./knowledge-mutation-audit.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface WorkDomainAuditEvent {
  readonly action: WorkDomainAuditAction;
  readonly workDomainId: string;
  readonly slug: string;
  readonly name: string;
  readonly previousName?: string;
}

export async function recordWorkDomainEventWithin(
  writer: AuditWriter,
  actor: AuditActor,
  event: WorkDomainAuditEvent,
  now: Date,
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    actorType: "human",
    actorId: actor.userId,
    action: event.action,
    entityType: WORK_DOMAIN_ENTITY_TYPE,
    entityId: event.workDomainId,
    occurredAt: now,
    metadata: {
      slug: event.slug,
      name: event.name,
      ...(event.previousName === undefined ? {} : { previousName: event.previousName }),
    },
    result: "committed",
    simulation: false,
    source: "work-domain",
    requestId: actor.requestId,
    sessionContextId:
      actor.sessionContextId && UUID_RE.test(actor.sessionContextId) ? actor.sessionContextId : undefined,
    authoritySource: "membership",
  });
}
