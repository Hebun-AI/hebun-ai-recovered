/*
 * governance-audit/agent-mandate-audit.server.ts — append-only history for the bounded purpose of
 * a durable agent (AMA-1), over the EXISTING shared `audit_log` sink.
 *
 * THE SEVENTH SIBLING, NOT A SUPERSET. `knowledge-mutation-audit` (G1) owns Knowledge mutation
 * history, `genesis-nomination-audit` (G2.1) pre-Governance entitlement, `governance-decision-audit`
 * (G2) decisions, `human-onboarding-audit` (I2) arrivals, `identity-enrollment-audit` (I1.2)
 * enrolments, `action-authorization-audit` (R3A) authorization to act — and this owns what an agent
 * is FOR. Seven domains, seven boundary constants, and no module references another's, so
 * tightening one can never silently move the others.
 *
 * NO NEW SINK AND NO MIGRATION. `action` and `entity_type` are free text on `audit_log`, so a new
 * domain costs zero schema. A second audit table would be a second authority for one question.
 *
 * WHAT IS AUDITED. Exactly one authority-bearing event class, in two named forms: a mandate
 * revision was established (the first), or revised (every later one). Both are the same write and
 * both require a human Governance decision, which is what makes them authority-bearing.
 *
 * WHAT IS DELIBERATELY NOT AUDITED:
 *
 *   - a refused establishment — nothing changed anywhere, so there is nothing to file. This is the
 *     same rule that keeps `knowledge.reject` out of the Knowledge vocabulary.
 *   - "a mandate became effective" / "a mandate stopped being effective" — nothing performs either.
 *     Effectiveness is `max(mandate_revision)`, derived on read. An event for a derived transition
 *     would be a fabricated act with no actor, which is the class of lie this repository spends its
 *     phases removing.
 *   - a proposal being allowed or refused BY a mandate — no such path exists at AMA-1.
 *
 * THE PURPOSE PROSE IS NOT COPIED HERE. `agent_mandates.purpose` is NOT NULL and is never
 * rewritten, so the row is already the durable single home of what was authorized. A copy in the
 * ledger would be a second version of it, free to disagree — the same reasoning that keeps
 * `decision_records.justification` out of the Governance audit. The SCOPE is carried, because a
 * ceiling is identity-shaped rather than prose, and history must be able to say what the bound
 * actually was without joining.
 *
 * APPEND-ONLY, ENFORCED BY WHAT IS ABSENT: one write, one read, no update/delete/upsert.
 *
 * Server-only.
 */

import { and, desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { auditLog } from "@/db/schema/audit-log";
import {
  AGENT_MANDATE_ENTITY_TYPE,
  type AgentMandateAuditAction,
  type MandateScopeKind,
} from "@/features/agent-mandate/contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The control-plane database or an open transaction on it — so audit can join the establishment. */
export type AgentMandateAuditWriter = Pick<ControlPlaneDatabase, "insert">;

/** Server-resolved acting authority. No shape here for a client value to arrive in. */
export interface AgentMandateAuditActor {
  readonly tenantId: string;
  /** `users.id` — the canonical `actor_id` for `actor_type = 'human'` across the schema. */
  readonly userId: string;
  readonly requestId?: string;
  /** Durable `user_session_contexts` row id. Never the bearer reference. */
  readonly sessionContextId?: string;
}

/**
 * Identity, shape and the bound itself — never the organization's prose.
 *
 * `enforced: false` is stated rather than assumed, and it is the AMA-1 truth requirement written
 * into every row this writer produces: a mandate exists and NOTHING reads it to constrain a
 * proposal. A test asserts no code path can set it otherwise, exactly as R3A did for `executed`.
 */
export interface AgentMandateAuditMetadata {
  readonly agentId: string;
  readonly mandateRevision: number;
  readonly proposalScope: readonly MandateScopeKind[];
  readonly governanceDecisionId: string;
  readonly governanceSessionId: string;
  readonly supersedesMandateId: string | null;
  /**
   * AMA-1 records a mandate; it does not enforce one. Always `false` in this phase.
   * `MANDATE RECORDED != PROPOSAL-ENFORCED`, and history says so on every row.
   */
  readonly enforced: false;
}

/**
 * `committed` — the revision is durable.
 *
 * `rejected` and `rolled-back` are deliberately not produced: this writer joins the establishing
 * transaction, so a rolled-back establishment takes its audit row with it and leaves no claim
 * behind, and a refused establishment never reaches this module at all.
 */
export type AgentMandateAuditOutcome = "committed";

export interface AgentMandateAuditEvent {
  readonly action: AgentMandateAuditAction;
  readonly outcome: AgentMandateAuditOutcome;
  /** The mandate revision row. Never the agent — a mandate is not an agent. */
  readonly entityId: string;
  readonly metadata: AgentMandateAuditMetadata;
}

/**
 * Append one mandate event.
 *
 * `writer` is the control-plane database OR the open transaction that is writing the decision and
 * the mandate. Passing the transaction is what makes "bounded" and "history says bounded" the same
 * fact: "established but unaudited" and "audited but rolled back" are excluded by the transaction,
 * not by hoping. A failing audit insert therefore aborts the establishment.
 */
export async function recordAgentMandateEventWithin(
  writer: AgentMandateAuditWriter,
  actor: AgentMandateAuditActor,
  event: AgentMandateAuditEvent,
  now: Date = new Date(),
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    // A human acting through the product. Never accepted from input.
    actorType: "human",
    actorId: actor.userId,
    action: event.action,
    entityType: AGENT_MANDATE_ENTITY_TYPE,
    entityId: event.entityId,
    occurredAt: now,
    metadata: event.metadata,
    result: event.outcome,
    /*
     * `simulation` marks a non-live posture where no real effect occurred. Bounding an agent's
     * purpose IS a real, durable organizational act — what has not happened is the ENFORCEMENT,
     * and `metadata.enforced` says so explicitly. Marking the act itself as simulated would
     * understate a real constitutional event.
     */
    simulation: false,
    source: "agent-mandate",
    requestId: actor.requestId,
    sessionContextId:
      actor.sessionContextId && UUID_RE.test(actor.sessionContextId)
        ? actor.sessionContextId
        : undefined,
    // The actor acted under their tenant membership, which is what the session resolves.
    authoritySource: "membership",
  });
}

export interface AgentMandateAuditRecord {
  readonly auditId: string;
  readonly action: string;
  readonly outcome: string;
  readonly entityId: string;
  readonly actorId: string;
  readonly occurredAt: string;
}

export type AgentMandateAuditHistory =
  | { readonly status: "read"; readonly records: readonly AgentMandateAuditRecord[] }
  | { readonly status: "unavailable"; readonly reason: string; readonly detail?: string };

/**
 * Read this tenant's mandate history. Tenant-scoped by predicate; there is no unscoped or
 * cross-tenant query in this module, so a caller can only ever ask about its own tenant.
 */
export async function readAgentMandateAuditHistory(
  tenant: { readonly tenantId: string } | null,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null; readonly limit?: number } = {},
): Promise<AgentMandateAuditHistory> {
  if (typeof window !== "undefined") {
    throw new Error("Agent mandate audit reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = (deps.getDb ?? resolveAgentMandateAuditDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };
  if (!UUID_RE.test(tenant.tenantId)) return { status: "read", records: [] };

  try {
    const rows = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.tenantId, tenant.tenantId),
          eq(auditLog.entityType, AGENT_MANDATE_ENTITY_TYPE),
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
  } catch (error) {
    return {
      status: "unavailable",
      reason: "read-failed",
      detail: error instanceof Error ? error.message : "mandate history read failed",
    };
  }
}

/** The control-plane database, or an honest `null` when it is not configured. */
export function resolveAgentMandateAuditDbOrNull(): ControlPlaneDatabase | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}
