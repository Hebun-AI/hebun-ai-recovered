/*
 * governance-audit/organizational-work-audit.server.ts — the append-only writer over the EXISTING
 * `audit_log` sink, for Organizational Work acts (WORK-1). The twelfth audit sibling.
 *
 * APPEND-ONLY, ENFORCED BY WHAT THIS FILE DOES NOT CONTAIN. There is no update, no delete, no
 * upsert and no "correct an event" helper — one exported write, and nothing else. The claim is the
 * honest one G1 made and OSA-1 repeated: no product code path can rewrite an actor, a timestamp, an
 * outcome or an identity, because no such path is written.
 *
 * TRANSACTION RELATIONSHIP. `audit_log` lives in the SAME control-plane database as `work_items`,
 * so a committed work mutation writes its audit row inside the SAME transaction as the canonical
 * row. "Work committed but no audit" and "audit says committed but the work rolled back" are not
 * states this code can produce — they are excluded by the transaction, not by hoping. No
 * distributed-transaction machinery was needed, because none is.
 *
 * THERE IS NO GOVERNANCE DECISION HERE, AND THAT IS DELIBERATE. Recording that work exists moves no
 * authority and leaves the database no more than it entered it. The released precedents are OSA-1
 * and R6D — Knowledge source retraction — which write audit and NO `decision_records` row for
 * exactly this reason. `authoritySource` is `membership`, the same value both of those use: the act
 * was performed by an authenticated human acting through the product.
 *
 * Server-only.
 */
import { auditLog } from "@/db/schema/audit-log";
import type { ControlPlaneDatabase } from "@/db/client.server";
import {
  WORK_ITEM_ENTITY_TYPE,
  type WorkAuditAction,
  type WorkDeclaredState,
} from "@/features/organizational-work/work-contracts";
import { auditActorFrom, type AuditActor, type AuditWriter } from "./knowledge-mutation-audit.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Re-exported so the WORK-1 writer names one audit-handle type, not two. */
export type { AuditActor, AuditWriter };

/**
 * WHO PERFORMED a work mutation (GIA-1).
 *
 * Closed at two, and it will stay closed: `agent` is deliberately absent, because no agent performs
 * a mutation in Hebun — an agent PROPOSES, a human AUTHORIZES, and the system EXECUTES. Adding a
 * third value here would be asserting an agent capability that does not exist.
 */
export type WorkAuditExecutor = "human" | "system";

/**
 * Re-exported for the same reason, and it is the SAME function — not a second projection.
 * `auditActorFrom` is owned by the Knowledge mutation audit module and every audit sibling has
 * consumed it since; re-declaring it here would be a second way to build an actor, and two ways to
 * decide who performed an act is exactly what an append-only ledger must not have.
 */
export { auditActorFrom };

/**
 * The bounded metadata one work act carries.
 *
 * Deliberately narrow, and narrower than it is tempting to make it. The TITLE IS NOT RECORDED here:
 * history says THAT a named identity changed, never keeps a copy of what it said, because that
 * would build a shadow store — the rule the Knowledge mutation writer states and OSA-1 follows.
 *
 * `declaredState` is present on a state act only, and `accountableActorId` on an accountability act
 * only, because those two values are the whole content of their acts and an operator reading the
 * ledger cannot otherwise tell one state declaration from another.
 */
export interface WorkAuditEvent {
  readonly action: WorkAuditAction;
  readonly workItemId: string;
  /** Present only on a state act. */
  readonly declaredState?: WorkDeclaredState;
  /** Present only on an accountability act. `null` means accountability was cleared. */
  readonly accountableActorId?: string | null;
  /** Present only when the act named a department. `null` means the reference was cleared. */
  readonly departmentId?: string | null;
  /**
   * WEV-1. Present only on a reference act — the declaration row this act is about.
   *
   * The ENTITY stays the work item, because that is what changed: a work item now declares one more
   * thing, or one fewer. Recording the reference id beside it is what lets an operator tell two
   * declarations on the same work item apart, exactly as `declaredState` does for two state acts.
   * The REFERENT's identity is deliberately absent — history says that a named declaration was made
   * or withdrawn, never keeps a copy of what it pointed at.
   */
  readonly referenceId?: string;
}

/**
 * Append one work event INSIDE the caller's transaction — which is what makes a committed mutation
 * and its history atomic.
 *
 * Note what the caller cannot supply: the actor comes from `AuditActor` (server-resolved from the
 * authenticated session), the timestamp is taken by the caller's own clock and passed here, the
 * entity type is fixed, the result is fixed to `committed` because this writer is only ever called
 * from inside a transaction that is about to commit, and `simulation` is fixed to false.
 */
export async function recordWorkEventWithin(
  writer: AuditWriter,
  actor: AuditActor,
  event: WorkAuditEvent,
  now: Date = new Date(),
  /*
   * GIA-1 — WHO PERFORMED THIS MUTATION, which is not always who authorized it.
   *
   * `human` is the default and remains the whole of the released product path: a human acting
   * through the Work surface. `system` is written by ONE caller — the governed internal act, where
   * a human AUTHORIZED the act at the Governance surface and HEBUN performed the mutation.
   *
   *     HUMAN AUTHORIZED != SYSTEM EXECUTED != STATE AUTHORED BY A HUMAN
   *
   * `actorId` stays the authenticated human in both cases, and that is deliberate: it is the
   * correlation to the session the act happened under, never a claim that they performed it. The
   * TYPE is what says who performed it, and the permit chain is what says who authorized it.
   */
  executor: WorkAuditExecutor = "human",
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    actorType: executor,
    actorId: actor.userId,
    action: event.action,
    entityType: WORK_ITEM_ENTITY_TYPE,
    entityId: event.workItemId,
    occurredAt: now,
    metadata: {
      ...(event.declaredState === undefined ? {} : { declaredState: event.declaredState }),
      ...(event.accountableActorId === undefined
        ? {}
        : { accountableActorId: event.accountableActorId }),
      ...(event.departmentId === undefined ? {} : { departmentId: event.departmentId }),
      ...(event.referenceId === undefined ? {} : { referenceId: event.referenceId }),
    },
    result: "committed",
    simulation: false,
    source: "organizational-work",
    requestId: actor.requestId,
    sessionContextId:
      actor.sessionContextId && UUID_RE.test(actor.sessionContextId)
        ? actor.sessionContextId
        : undefined,
    authoritySource: "membership",
  });
}

/** Narrow structural typing so this module can be handed a `ControlPlaneDatabase` or a transaction. */
export type WorkAuditWriter = Pick<ControlPlaneDatabase, "insert">;
