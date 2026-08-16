/*
 * governance-audit/action-authorization-audit.server.ts — append-only history for authorization
 * to act (R3A), over the EXISTING shared `audit_log` sink.
 *
 * THE SIXTH SIBLING, NOT A SUPERSET. `knowledge-mutation-audit` (G1) owns Knowledge mutation
 * history, `genesis-nomination-audit` (G2.1) pre-Governance entitlement, `governance-decision-audit`
 * (G2) decisions, `human-onboarding-audit` (I2) arrivals, `identity-enrollment-audit` (I1.2)
 * enrolments — and this owns authorization to ACT. Six domains, six boundary constants, and no
 * module references another's, so tightening one can never silently move the others.
 *
 * NO NEW SINK AND NO MIGRATION. `action` and `entity_type` are free text on `audit_log`, so a new
 * domain costs zero schema. A second audit table would be a second authority for one question.
 *
 * WHAT IS AUDITED, AND WHAT DELIBERATELY IS NOT. Five authority-bearing events: approved,
 * rejected, permit issued, permit revoked, permit consumed. NOT audited:
 *
 *   - request creation — a proposal moves no authority. The row IS the record; an event saying
 *     "Heby proposed something" would be volume, not history.
 *   - expiry — derived from `expires_at <= now()`, so nothing performs it. An "expired" event
 *     would be a fabricated act with no actor, which is exactly the class of lie this repository
 *     spends its phases removing.
 *
 * THE PAYLOAD IS NOT COPIED HERE. `heby_action_requests.canonical_payload` is NOT NULL and is
 * never rewritten, so it is already the durable single home of what was approved. A copy in the
 * ledger would be a second version of it, free to disagree — the same reasoning that keeps
 * `decision_records.justification` out of the Governance audit.
 *
 * APPEND-ONLY, ENFORCED BY WHAT IS ABSENT: one write, one read, no update/delete/upsert.
 *
 * Server-only.
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { auditLog } from "@/db/schema/audit-log";
import {
  ACTION_AUDIT_APPROVED,
  ACTION_AUDIT_PERMIT_CONSUMED,
  ACTION_AUDIT_PERMIT_ISSUED,
  ACTION_AUDIT_PERMIT_REVOKED,
  ACTION_AUDIT_REJECTED,
  ACTION_PERMIT_ENTITY_TYPE,
  ACTION_REQUEST_ENTITY_TYPE,
} from "@/features/action-authorization/contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The control-plane database or an open transaction on it — so audit can join the decision. */
export type ActionAuthorizationAuditWriter = Pick<ControlPlaneDatabase, "insert">;

/** Server-resolved acting authority. No shape here for a client value to arrive in. */
export interface ActionAuthorizationAuditActor {
  readonly tenantId: string;
  /** `users.id` — the canonical `actor_id` for `actor_type = 'human'` across the schema. */
  readonly userId: string;
  readonly requestId?: string;
  /** Durable `user_session_contexts` row id. Never the bearer reference. */
  readonly sessionContextId?: string;
}

export type ActionAuthorizationAuditAction =
  | typeof ACTION_AUDIT_APPROVED
  | typeof ACTION_AUDIT_REJECTED
  | typeof ACTION_AUDIT_PERMIT_ISSUED
  | typeof ACTION_AUDIT_PERMIT_REVOKED
  | typeof ACTION_AUDIT_PERMIT_CONSUMED;

/**
 * Identity and shape only — never content.
 *
 * The digest IS included, and it is the one value here that is not merely an identifier: it is
 * what makes the ledger able to say the approved thing and the spent thing were the same thing.
 * It reveals nothing, because the payload it covers is already human-readable by design.
 */
export interface ActionAuthorizationAuditMetadata {
  readonly actionRequestId: string;
  readonly permitId?: string;
  readonly governanceDecisionId?: string;
  readonly governanceSessionId?: string;
  readonly actionKind: string;
  readonly toolId: string;
  readonly sideEffect: string;
  readonly reversibility?: string;
  readonly targetKind?: string | null;
  readonly targetRef?: string | null;
  /** SHA-256 of the approved payload — the binding, carried so history can prove continuity. */
  readonly payloadDigest: string;
  readonly expiresAt?: string;
  /** Minted at consumption. Present only on a consumed event. */
  readonly handoffId?: string;
  /**
   * Stated so history records that authorization is not execution. Always `false` in R3A, and a
   * test asserts no code path can set it otherwise.
   */
  readonly executed: false;
  /** Why an authorized attempt was refused. Absent on a committed event. */
  readonly refusalReason?: string;
}

/**
 * `committed` — the transition is durable. `rejected` — an authorized actor was refused by a
 * governed rule (losing a single-spend race, or spending an expired permit).
 *
 * `rolled-back` is deliberately not produced: this writer joins the caller's transaction, so a
 * rolled-back transition takes its audit row with it and leaves no claim behind.
 */
export type ActionAuthorizationAuditOutcome = "committed" | "rejected";

export interface ActionAuthorizationAuditEvent {
  readonly action: ActionAuthorizationAuditAction;
  readonly outcome: ActionAuthorizationAuditOutcome;
  /** The request row for request events; the permit row for permit events. */
  readonly entityId: string;
  readonly metadata: ActionAuthorizationAuditMetadata;
}

/** Permit events are about the permit; approval and rejection are about the request. */
function entityTypeFor(action: ActionAuthorizationAuditAction): string {
  return action === ACTION_AUDIT_APPROVED || action === ACTION_AUDIT_REJECTED
    ? ACTION_REQUEST_ENTITY_TYPE
    : ACTION_PERMIT_ENTITY_TYPE;
}

/**
 * Append one authorization event.
 *
 * `writer` is the control-plane database OR the open transaction that is writing the decision and
 * the permit. Passing the transaction is what makes "authorized" and "history says authorized" the
 * same fact: "committed but unaudited" and "audited but rolled back" are excluded by the
 * transaction, not by hoping. A failing audit insert therefore aborts the authorization.
 */
export async function recordActionAuthorizationEventWithin(
  writer: ActionAuthorizationAuditWriter,
  actor: ActionAuthorizationAuditActor,
  event: ActionAuthorizationAuditEvent,
  now: Date = new Date(),
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    // A human acting through the product. Never accepted from input.
    actorType: "human",
    actorId: actor.userId,
    action: event.action,
    entityType: entityTypeFor(event.action),
    entityId: event.entityId,
    occurredAt: now,
    metadata: event.metadata,
    result: event.outcome,
    /*
     * `simulation` marks a non-live posture where no real effect occurred. An authorization IS a
     * real, durable act — the thing that has not happened is the EXECUTION, and `metadata.executed`
     * says so explicitly. Marking the authorization itself as simulated would understate a real
     * constitutional event.
     */
    simulation: false,
    source: "action-authorization",
    requestId: actor.requestId,
    sessionContextId:
      actor.sessionContextId && UUID_RE.test(actor.sessionContextId)
        ? actor.sessionContextId
        : undefined,
    // The actor acted under their tenant membership, which is what the session resolves.
    authoritySource: "membership",
  });
}

export interface ActionAuthorizationAuditRecord {
  readonly auditId: string;
  readonly action: string;
  readonly outcome: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly actorId: string;
  readonly occurredAt: string;
}

export type ActionAuthorizationAuditHistory =
  | { readonly status: "read"; readonly records: readonly ActionAuthorizationAuditRecord[] }
  | { readonly status: "unavailable"; readonly reason: string; readonly detail?: string };

/**
 * Read this tenant's authorization history. Tenant-scoped by predicate; there is no unscoped or
 * cross-tenant query in this module, so a caller can only ever ask about its own tenant.
 */
export async function readActionAuthorizationHistory(
  tenant: { readonly tenantId: string } | null,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null; readonly limit?: number } = {},
): Promise<ActionAuthorizationAuditHistory> {
  if (typeof window !== "undefined") {
    throw new Error("Action authorization audit reads are server-only.");
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
          inArray(auditLog.entityType, [ACTION_REQUEST_ENTITY_TYPE, ACTION_PERMIT_ENTITY_TYPE]),
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
        entityType: row.entityType,
        entityId: row.entityId,
        actorId: row.actorId,
        occurredAt:
          row.occurredAt instanceof Date
            ? row.occurredAt.toISOString()
            : new Date(row.occurredAt).toISOString(),
      })),
    };
  } catch (error) {
    return {
      status: "unavailable",
      reason: "read-failed",
      detail: error instanceof Error ? error.message : "authorization history read failed",
    };
  }
}

/** The control-plane database, or an honest `null` when it is not configured. */
export function resolveActionAuthorizationAuditDbOrNull(): ControlPlaneDatabase | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}
