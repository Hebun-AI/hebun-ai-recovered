/*
 * governance-audit/support-ticket-audit.server.ts — V1-STAGE-5. One audit row per support ticket
 * creation or status change, written inside the caller's transaction so the change and its record
 * commit together. Carries status and version only — never the title or description.
 */
import { auditLog } from "@/db/schema/audit-log";
import { SUPPORT_TICKET_ENTITY_TYPE, type SupportTicketAuditAction, type SupportTicketStatus } from "@/features/support-tickets/contracts";
import type { AuditActor, AuditWriter } from "./knowledge-mutation-audit.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TicketState {
  readonly status: SupportTicketStatus;
  readonly version: number;
}

export async function recordSupportTicketEventWithin(
  writer: AuditWriter,
  actor: AuditActor,
  event: { readonly action: SupportTicketAuditAction; readonly ticketId: string; readonly previous?: TicketState; readonly next: TicketState },
  now: Date,
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    actorType: "human",
    actorId: actor.userId,
    action: event.action,
    entityType: SUPPORT_TICKET_ENTITY_TYPE,
    entityId: event.ticketId,
    occurredAt: now,
    ...(event.previous === undefined ? {} : { previousState: { ...event.previous } }),
    nextState: { ...event.next },
    metadata: {},
    result: "committed",
    simulation: false,
    source: "support-tickets",
    requestId: actor.requestId,
    sessionContextId: actor.sessionContextId && UUID_RE.test(actor.sessionContextId) ? actor.sessionContextId : undefined,
    authoritySource: "membership",
  });
}
