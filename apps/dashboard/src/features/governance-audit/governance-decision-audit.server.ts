/*
 * governance-audit/governance-decision-audit.server.ts — append-only history for Governance
 * decision authority (G2), over the EXISTING shared `audit_log` sink.
 *
 * THE THIRD SIBLING, NOT A SUPERSET. `knowledge-mutation-audit` (G1) owns Knowledge mutation
 * history; `genesis-nomination-audit` (G2.1) owns pre-Governance entitlement; this owns Governance
 * decisions. Three domains, three boundary constants, three entity types, and no module references
 * another's boundary — so tightening one can never silently move the others.
 *
 * NO NEW SINK AND NO MIGRATION. `action` and `entity_type` are free text on `audit_log`, so a new
 * domain costs zero schema. A second audit table would be a second authority for one question.
 *
 * JUSTIFICATION IS NOT COPIED HERE. `decision_records.justification` is NOT NULL and is never
 * rewritten by any code path, so it is already the durable, single home of the sentence. A copy in
 * the ledger would be a second version of it, free to disagree.
 *
 * APPEND-ONLY, ENFORCED BY WHAT IS ABSENT: one write, one read, no update/delete/upsert.
 *
 * Server-only.
 */

import { and, desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { auditLog } from "@/db/schema/audit-log";
import {
  GOVERNANCE_DECISION_ENTITY_TYPE,
  type GovernanceAuditAction,
} from "@/features/governance-decision/contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The control-plane database or an open transaction on it — so audit can join the decision. */
export type GovernanceAuditWriter = Pick<ControlPlaneDatabase, "insert">;

/** Server-resolved acting authority. No shape here for a client value to arrive in. */
export interface GovernanceAuditActor {
  readonly tenantId: string;
  /** `users.id` — the canonical `actor_id` for `actor_type = 'human'` across the schema. */
  readonly userId: string;
  readonly requestId?: string;
  /** Durable `user_session_contexts` row id, matching G1/G2.1. Never the bearer reference. */
  readonly sessionContextId?: string;
}

/**
 * Identity and shape only — never content. A Governance event says WHICH decision was made and
 * under what standing, never what the justification said.
 */
export interface GovernanceAuditMetadata {
  readonly governanceSessionId: string | null;
  readonly decisionType: string;
  readonly subjectType: string;
  readonly subjectId: string | null;
  readonly bootstrap: boolean;
  /** Present only for a genesis: the entitlement that was spent. */
  readonly genesisNominationId?: string;
  /** Why an authorized attempt was refused. Absent on a committed event. */
  readonly refusalReason?: string;
}

/**
 * `committed` — the decision is durable. `rejected` — an authorized actor was refused by a
 * governed rule (losing the one-bootstrap race, or spending a spent entitlement).
 *
 * These are `audit_result` enum values, reused rather than duplicated. `rolled-back` is
 * deliberately not produced: this writer joins the decision's own transaction, so a rolled-back
 * decision takes its audit row with it and leaves no claim behind — which is the correct history,
 * not a missing one.
 */
export type GovernanceAuditOutcome = "committed" | "rejected";

export interface GovernanceAuditEvent {
  readonly action: GovernanceAuditAction;
  readonly outcome: GovernanceAuditOutcome;
  /**
   * The decision row this event is about. For a REFUSED attempt there is no decision, so the
   * tenant id stands in as the entity — `audit_log.entity_id` is NOT NULL, and the refusal is
   * genuinely about the tenant's Governance, not about a row that never existed.
   */
  readonly entityId: string;
  readonly metadata: GovernanceAuditMetadata;
}

/**
 * Append one Governance event.
 *
 * `writer` is the control-plane database OR the open transaction that is writing the decision.
 * Passing the transaction is what makes "decided" and "history says decided" the same fact:
 * "committed but unaudited" and "audited but rolled back" are excluded by the transaction, not by
 * hoping. A failing audit insert therefore aborts the decision.
 */
export async function recordGovernanceEventWithin(
  writer: GovernanceAuditWriter,
  actor: GovernanceAuditActor,
  event: GovernanceAuditEvent,
  now: Date = new Date(),
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    // A human acting through the product. Never accepted from input.
    actorType: "human",
    actorId: actor.userId,
    action: event.action,
    entityType: GOVERNANCE_DECISION_ENTITY_TYPE,
    entityId: event.entityId,
    occurredAt: now,
    metadata: event.metadata,
    result: event.outcome,
    simulation: false,
    source: "governance-authority",
    requestId: actor.requestId,
    sessionContextId:
      actor.sessionContextId && UUID_RE.test(actor.sessionContextId)
        ? actor.sessionContextId
        : undefined,
    // The actor acted under their tenant membership, which is what the session resolves.
    authoritySource: "membership",
  });
}

/**
 * Append a REFUSED attempt outside any transaction.
 *
 * A refusal has, by definition, no decision transaction to join — the whole point is that nothing
 * committed. If this append fails the caller is still told the truth about the refusal; an audit
 * gap is never swallowed into a false success.
 */
export async function recordGovernanceRefusal(
  actor: GovernanceAuditActor,
  event: GovernanceAuditEvent,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null; readonly now?: () => Date } = {},
): Promise<{ readonly recorded: boolean; readonly detail?: string }> {
  const db = (deps.getDb ?? resolveGovernanceAuditDbOrNull)();
  if (!db) return { recorded: false, detail: "audit persistence is not configured" };
  try {
    await recordGovernanceEventWithin(db, actor, event, (deps.now ?? (() => new Date()))());
    return { recorded: true };
  } catch (error) {
    return {
      recorded: false,
      detail: error instanceof Error ? error.message : "governance audit append failed",
    };
  }
}

export interface GovernanceAuditRecord {
  readonly auditId: string;
  readonly action: string;
  readonly outcome: string;
  readonly entityId: string;
  readonly actorType: string;
  readonly actorId: string;
  readonly occurredAt: string;
}

export type GovernanceAuditHistory =
  | { readonly status: "read"; readonly records: readonly GovernanceAuditRecord[] }
  | { readonly status: "unavailable"; readonly reason: string; readonly detail?: string };

/**
 * Read this tenant's Governance history. Tenant-scoped by predicate; there is no unscoped or
 * cross-tenant query in this module, so a caller can only ever ask about its own tenant.
 */
export async function readGovernanceHistory(
  tenant: { readonly tenantId: string } | null,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null; readonly limit?: number } = {},
): Promise<GovernanceAuditHistory> {
  if (typeof window !== "undefined") throw new Error("Governance audit reads are server-only.");
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = (deps.getDb ?? resolveGovernanceAuditDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };
  if (!UUID_RE.test(tenant.tenantId)) return { status: "read", records: [] };

  try {
    const rows = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.tenantId, tenant.tenantId),
          eq(auditLog.entityType, GOVERNANCE_DECISION_ENTITY_TYPE),
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
        actorType: row.actorType,
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
      detail: error instanceof Error ? error.message : "governance history read failed",
    };
  }
}

/** The control-plane database, or an honest `null` when it is not configured. */
export function resolveGovernanceAuditDbOrNull(): ControlPlaneDatabase | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}
