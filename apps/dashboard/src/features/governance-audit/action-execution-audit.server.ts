/*
 * governance-audit/action-execution-audit.server.ts — append-only history for ATTEMPTING an act
 * (R3B), over the EXISTING shared `audit_log` sink.
 *
 * THE SEVENTH SIBLING. `action-authorization-audit` (R3A) owns authorization to act; this owns the
 * spending of it. Separate because the questions are separate: "who said yes" and "what then
 * happened" have different actors, different evidence and different failure modes.
 *
 * NO NEW SINK AND NO MIGRATION. `action` and `entity_type` are free text on `audit_log`.
 *
 * EXACTLY ONE EVENT, AND IT IS WRITTEN ONCE. `governance.action.execution.attempted`, inside the
 * same transaction that spends the permit and creates the attempt row. Not audited:
 *
 *   - the OUTCOME. The attempt row is the durable home of what the provider said, and it is
 *     updated as the answer arrives. Copying a moving value into an append-only ledger would
 *     create two versions of one fact, free to disagree — the same reasoning that keeps the
 *     canonical payload out of the authorization audit.
 *   - the refusal of a pre-spend check. Nothing was spent and no authority moved, so there is no
 *     authority-bearing event to record.
 *
 * WHAT IS STRUCTURALLY ABSENT FROM THE METADATA. No recipient address, no message content, no
 * credential, no provider response body, no endpoint URL. The metadata interface has no field any
 * of them could arrive in, so redaction is not a discipline somebody has to remember.
 *
 * Server-only.
 */
import { and, desc, eq } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import { auditLog } from "@/db/schema/audit-log";
import {
  EXECUTION_ATTEMPT_ENTITY_TYPE,
  EXECUTION_AUDIT_ATTEMPTED,
} from "@/features/action-execution/contracts";
import { resolveActionAuthorizationAuditDbOrNull } from "./action-authorization-audit.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The control-plane database or an open transaction on it. */
export type ActionExecutionAuditWriter = Pick<ControlPlaneDatabase, "insert">;

export interface ActionExecutionAuditActor {
  readonly tenantId: string;
  readonly userId: string;
  readonly requestId?: string;
  readonly sessionContextId?: string;
}

/** Identifiers, digests and classifications. There is no field for content, address or secret. */
export interface ActionExecutionAuditMetadata {
  readonly attemptId: string;
  readonly permitId: string;
  readonly handoffId: string;
  readonly actionRequestId: string;
  readonly actionKind: string;
  readonly adapterId: string;
  /** The binding, carried so history can prove the spent thing was the approved thing. */
  readonly payloadDigest: string;
  /** A reference, never the address. */
  readonly recipientId: string;
  /**
   * Stated because the ledger must record that attempting is not succeeding. Always `false`: at
   * the instant this row is written, no external call has been made and none can have been.
   */
  readonly externalEffectConfirmed: false;
}

export interface ActionExecutionAuditEvent {
  readonly entityId: string;
  readonly metadata: ActionExecutionAuditMetadata;
}

/**
 * Append the one execution event, inside the caller's spend transaction.
 *
 * Joining that transaction is what makes "the permit was spent" and "history says it was spent"
 * the same fact. A failing insert aborts the spend, which is the safe direction.
 */
export async function recordActionExecutionEventWithin(
  writer: ActionExecutionAuditWriter,
  actor: ActionExecutionAuditActor,
  event: ActionExecutionAuditEvent,
  now: Date = new Date(),
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    /* A human clicked Execute. There is no path in which a model or an agent reaches this line. */
    actorType: "human",
    actorId: actor.userId,
    action: EXECUTION_AUDIT_ATTEMPTED,
    entityType: EXECUTION_ATTEMPT_ENTITY_TYPE,
    entityId: event.entityId,
    occurredAt: now,
    metadata: event.metadata,
    /* The attempt is durable and real; only its outcome is still open. */
    result: "committed",
    simulation: false,
    source: "action-execution",
    requestId: actor.requestId,
    sessionContextId:
      actor.sessionContextId && UUID_RE.test(actor.sessionContextId)
        ? actor.sessionContextId
        : undefined,
    authoritySource: "membership",
  });
}

export interface ActionExecutionAuditRecord {
  readonly auditId: string;
  readonly action: string;
  readonly outcome: string;
  readonly entityId: string;
  readonly actorId: string;
  readonly occurredAt: string;
}

export type ActionExecutionAuditHistory =
  | { readonly status: "read"; readonly records: readonly ActionExecutionAuditRecord[] }
  | { readonly status: "unavailable"; readonly reason: string };

/** This tenant's execution history. Tenant-scoped by predicate; no unscoped query exists here. */
export async function readActionExecutionHistory(
  tenant: { readonly tenantId: string } | null,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null; readonly limit?: number } = {},
): Promise<ActionExecutionAuditHistory> {
  if (typeof window !== "undefined") {
    throw new Error("Action execution audit reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = (deps.getDb ?? resolveActionAuthorizationAuditDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };
  if (!UUID_RE.test(tenant.tenantId)) return { status: "read", records: [] };

  try {
    const rows = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.tenantId, tenant.tenantId),
          eq(auditLog.entityType, EXECUTION_ATTEMPT_ENTITY_TYPE),
        ),
      )
      .orderBy(desc(auditLog.occurredAt), desc(auditLog.recordedAt))
      .limit(deps.limit ?? 50);
    return {
      status: "read",
      records: rows.map((row) => ({
        auditId: row.id,
        action: row.action,
        outcome: row.result,
        entityId: row.entityId,
        actorId: row.actorId,
        occurredAt:
          row.occurredAt instanceof Date
            ? row.occurredAt.toISOString()
            : new Date(row.occurredAt).toISOString(),
      })),
    };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}
