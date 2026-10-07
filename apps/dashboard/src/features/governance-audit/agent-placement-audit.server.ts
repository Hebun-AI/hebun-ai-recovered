/*
 * AP-2 — the audit row for an agent placement act.
 *
 * One row per committed placement change, written INSIDE the writer's transaction, so the change
 * and its record commit together or neither does. The subject is the AGENT, and the metadata
 * carries both sides of the change — a move is legible without reading any other row.
 *
 * Mirrors `departmental-placement-audit.server.ts`: a human acting through the product, never an
 * actor taken from input.
 */
import { auditLog } from "@/db/schema/audit-log";
import {
  AGENT_PLACEMENT_ENTITY_TYPE,
  type AgentPlacementAuditAction,
} from "@/features/organization-authority/agent-placement-contracts";
import type { AuditActor, AuditWriter } from "./knowledge-mutation-audit.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AgentPlacementAuditEvent {
  readonly action: AgentPlacementAuditAction;
  readonly agentId: string;
  readonly previousDepartmentId: string | null;
  readonly departmentId: string | null;
}

export async function recordAgentPlacementEventWithin(
  writer: AuditWriter,
  actor: AuditActor,
  event: AgentPlacementAuditEvent,
  now: Date = new Date(),
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    actorType: "human",
    actorId: actor.userId,
    action: event.action,
    entityType: AGENT_PLACEMENT_ENTITY_TYPE,
    entityId: event.agentId,
    occurredAt: now,
    metadata: {
      previousDepartmentId: event.previousDepartmentId,
      departmentId: event.departmentId,
    },
    result: "committed",
    simulation: false,
    source: "organization-domain",
    requestId: actor.requestId,
    sessionContextId:
      actor.sessionContextId && UUID_RE.test(actor.sessionContextId)
        ? actor.sessionContextId
        : undefined,
    authoritySource: "membership",
  });
}
