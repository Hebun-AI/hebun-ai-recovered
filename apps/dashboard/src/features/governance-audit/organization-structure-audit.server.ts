/*
 * governance-audit/organization-structure-audit.server.ts — the append-only writer over the
 * EXISTING `audit_log` sink, for Organization Structure acts (OSA-1).
 *
 * APPEND-ONLY, ENFORCED BY WHAT THIS FILE DOES NOT CONTAIN. There is no update, no delete, no
 * upsert and no "correct an event" helper — one exported write, and nothing else. The claim is the
 * honest one G1 made: no product code path can rewrite an actor, a timestamp, an outcome or an
 * identity, because no such path is written.
 *
 * TRANSACTION RELATIONSHIP. `audit_log` lives in the SAME control-plane database as `departments`,
 * so a committed structural mutation writes its audit row inside the SAME transaction as the
 * canonical row. "Department committed but no audit" and "audit says committed but the department
 * rolled back" are not states this code can produce — they are excluded by the transaction, not by
 * hoping. No distributed-transaction machinery was needed, because none is.
 *
 * THERE IS NO GOVERNANCE DECISION HERE, AND THAT IS DELIBERATE. Recording that a department exists
 * moves no authority and leaves the database no more than it entered it. The released precedent is
 * R6D — Knowledge source retraction — which writes audit and NO `decision_records` row for exactly
 * this reason. `authoritySource` is `membership`, the same value the Knowledge mutation writer
 * uses: the act was performed by an authenticated human acting through the product.
 *
 * Server-only.
 */
import { auditLog } from "@/db/schema/audit-log";
import type { ControlPlaneDatabase } from "@/db/client.server";
import {
  DEPARTMENT_ENTITY_TYPE,
  type DepartmentAuditAction,
} from "@/features/organization-authority/structure-contracts";
import type { AuditActor, AuditWriter } from "./knowledge-mutation-audit.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Re-exported so the OSA writer names one audit-handle type, not two. */
export type { AuditActor, AuditWriter };

/**
 * The bounded metadata one structural act carries.
 *
 * Deliberately narrow: the slug so an operator can recognise the department without a join, and —
 * for an ownership change only — the actor id recorded. Nothing else. `previous_state` and
 * `next_state` stay NULL for the reason the Knowledge writer records: history says THAT a named
 * identity changed, never keeps a copy of what it said, because that would build a shadow store.
 */
export interface DepartmentAuditEvent {
  readonly action: DepartmentAuditAction;
  readonly departmentId: string;
  readonly slug: string;
  /** Present only on an ownership act. `null` means ownership was cleared. */
  readonly ownerActorId?: string | null;
}

/**
 * Append one structural event INSIDE the caller's transaction — which is what makes a committed
 * mutation and its history atomic.
 *
 * Note what the caller cannot supply: the actor comes from `AuditActor` (server-resolved from the
 * authenticated session), the timestamp is taken by the caller's own clock and passed here, the
 * entity type is fixed, the result is fixed to `committed` because this writer is only ever called
 * from inside a transaction that is about to commit, and `simulation` is fixed to false.
 */
export async function recordDepartmentEventWithin(
  writer: AuditWriter,
  actor: AuditActor,
  event: DepartmentAuditEvent,
  now: Date = new Date(),
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    /* A human acting through the product. Never accepted from input. */
    actorType: "human",
    actorId: actor.userId,
    action: event.action,
    entityType: DEPARTMENT_ENTITY_TYPE,
    entityId: event.departmentId,
    occurredAt: now,
    metadata: {
      slug: event.slug,
      ...(event.ownerActorId === undefined ? {} : { ownerActorId: event.ownerActorId }),
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

/** Narrow structural typing so this module can be handed a `ControlPlaneDatabase` or a transaction. */
export type StructureAuditWriter = Pick<ControlPlaneDatabase, "insert">;
