/*
 * governance-audit/content-schedule-audit.server.ts — V1-STAGE-2. One audit row per schedule state
 * change, written inside the caller's transaction so the change and its record commit together.
 * `previous_state` / `next_state` carry what moved (state, moment, zone, version, request); never
 * content, captions or media.
 */
import { auditLog } from "@/db/schema/audit-log";
import {
  CONTENT_SCHEDULE_ENTITY_TYPE,
  type ContentScheduleAuditAction,
} from "@/features/content-schedule/contracts";
import type { AuditActor, AuditWriter } from "./knowledge-mutation-audit.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ContentScheduleAuditEvent {
  readonly action: ContentScheduleAuditAction;
  readonly scheduleId: string;
  readonly previousState?: Record<string, unknown>;
  readonly nextState: Record<string, unknown>;
}

export async function recordContentScheduleEventWithin(
  writer: AuditWriter,
  actor: AuditActor,
  event: ContentScheduleAuditEvent,
  now: Date,
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    actorType: "human",
    actorId: actor.userId,
    action: event.action,
    entityType: CONTENT_SCHEDULE_ENTITY_TYPE,
    entityId: event.scheduleId,
    occurredAt: now,
    ...(event.previousState === undefined ? {} : { previousState: event.previousState }),
    nextState: event.nextState,
    metadata: {},
    result: "committed",
    simulation: false,
    source: "content-schedule",
    requestId: actor.requestId,
    sessionContextId:
      actor.sessionContextId && UUID_RE.test(actor.sessionContextId) ? actor.sessionContextId : undefined,
    authoritySource: "membership",
  });
}
