/*
 * governance-audit/departmental-placement-audit.server.ts — the append-only writer over the
 * EXISTING `audit_log` sink, for departmental placement acts.
 *
 * APPEND-ONLY, ENFORCED BY WHAT THIS FILE DOES NOT CONTAIN. There is no update, no delete, no
 * upsert and no "correct an event" helper — one exported write, and nothing else. The claim is the
 * honest one G1 made and OSA-1 repeated: no product code path can rewrite an actor, a timestamp, an
 * outcome or an identity, because no such path is written.
 *
 * ── WHY A SIBLING MODULE AND NOT A NEW ACTION ON THE STRUCTURE SINK ──────────
 *
 * `organization-structure-audit.server.ts` fixes `entityType` to `department` and shapes its
 * metadata around a department's slug. A placement's subject is not a department — it is the
 * placement itself, and its metadata names a HUMAN. Widening that module would have made one event
 * shape describe two different subjects, and every reader of the department stream would have begun
 * receiving events about people. Two subjects, two sinks, one table.
 *
 * TRANSACTION RELATIONSHIP. `audit_log` lives in the SAME control-plane database as
 * `department_placements`, so a committed placement writes its audit row inside the SAME
 * transaction as the canonical row. "Placement committed but no audit" and "audit says committed
 * but the placement rolled back" are not states this code can produce.
 *
 * THERE IS NO GOVERNANCE DECISION HERE, AND THAT IS DELIBERATE. Recording where somebody works
 * moves no authority and leaves the database no more than it entered it. The released precedents
 * are R6D and OSA-1, which write audit and NO `decision_records` row for exactly this reason.
 * `authoritySource` is `membership`: the act was performed by an authenticated human acting through
 * the product.
 *
 * Server-only.
 */
import { auditLog } from "@/db/schema/audit-log";
import {
  PLACEMENT_ENTITY_TYPE,
  type PlacementAuditAction,
} from "@/features/organization-authority/placement-contracts";
import type { AuditActor, AuditWriter } from "./knowledge-mutation-audit.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Re-exported so the placement writer names one audit-handle type, not two. */
export type { AuditActor, AuditWriter };

/**
 * The bounded metadata one placement act carries.
 *
 * The human and the department, as IDENTIFIERS. No name, no label, no email — an audit row is read
 * by operators and exported, and putting a person's readable name in it would make every export a
 * copy of the identity store. `previous_state`/`next_state` stay NULL for the reason the Knowledge
 * writer records: history says THAT a named identity changed, never keeps a copy of what it said.
 */
export interface PlacementAuditEvent {
  readonly action: PlacementAuditAction;
  /** The placement row. The audit subject IS the placement, not the department. */
  readonly placementId: string;
  readonly userId: string;
  readonly departmentId: string;
}

/**
 * Append one placement event INSIDE the caller's transaction — which is what makes a committed
 * mutation and its history atomic.
 *
 * Note what the caller cannot supply: the actor comes from `AuditActor` (server-resolved from the
 * authenticated session), the timestamp is the caller's own clock passed in, the entity type is
 * fixed, the result is fixed to `committed` because this writer is only ever called from inside a
 * transaction that is about to commit, and `simulation` is fixed to false.
 */
export async function recordPlacementEventWithin(
  writer: AuditWriter,
  actor: AuditActor,
  event: PlacementAuditEvent,
  now: Date = new Date(),
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    /* A human acting through the product. Never accepted from input. */
    actorType: "human",
    actorId: actor.userId,
    action: event.action,
    entityType: PLACEMENT_ENTITY_TYPE,
    entityId: event.placementId,
    occurredAt: now,
    metadata: {
      userId: event.userId,
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
