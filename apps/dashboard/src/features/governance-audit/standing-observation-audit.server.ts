/*
 * governance-audit/standing-observation-audit.server.ts — append-only history for what a tenant has
 * standing permission to OBSERVE (TRH-23), over the EXISTING shared `audit_log` sink.
 *
 * THE EIGHTH SIBLING, NOT A SUPERSET. `knowledge-mutation-audit` (G1) owns Knowledge mutation
 * history, `genesis-nomination-audit` (G2.1) pre-Governance entitlement, `governance-decision-audit`
 * (G2) decisions, `human-onboarding-audit` (I2) arrivals, `identity-enrollment-audit` (I1.2)
 * enrolments, `action-authorization-audit` (R3A) authorization to act, `agent-mandate-audit`
 * (AMA-1) what an agent is FOR — and this owns what may be LOOKED AT, repeatedly, without a person
 * asking each time. Eight domains, eight boundary constants, and no module references another's.
 *
 * NO NEW SINK AND NO MIGRATION. `action`, `entity_type` and `source` are free text on `audit_log`.
 *
 * WHAT IS AUDITED. Exactly one authority-bearing event class in two named forms: a scope was
 * authorized (or re-authorized, or narrowed), and a scope was withdrawn. Both are the same write —
 * a new revision under a human Governance decision — which is what makes them authority-bearing.
 *
 * WHAT IS DELIBERATELY NOT AUDITED:
 *
 *   - a refused authorization. Nothing changed anywhere, so there is nothing to file.
 *   - "an authorization became effective" / "stopped being effective". Nothing performs either:
 *     effectiveness is `max(authorization_revision)`, derived on read. An event for a derived
 *     transition would be a fabricated act with no actor.
 *   - an observation. This authority never observes anything, and a row here must never be
 *     mistaken for evidence that a provider was contacted.
 *
 * THE JUSTIFICATION PROSE IS NOT COPIED HERE. `decision_records.justification` is the durable single
 * home of why. A copy in the ledger would be a second version of it, free to disagree.
 *
 * `collected: false` IS STATED ON EVERY ROW, AND STILL MEANS EXACTLY WHAT IT SAID. Authorizing
 * collects nothing: no row this ledger writes is evidence that a provider was contacted, and
 * history says so rather than leaving a reader to assume it.
 *
 * TRH-24 made a machine-caused provider read possible — manually, once, under an authorization —
 * and deliberately did NOT route it here. A performed observation is recorded by Provider
 * Observation History, which is its only owner; this ledger records the GRANT and never the
 * spending of it. `collected` therefore stays `false` on every row, and a phase that ever needed it
 * to be `true` would be writing the wrong record in the wrong place.
 *
 * APPEND-ONLY, ENFORCED BY WHAT IS ABSENT: one write, one read, no update/delete/upsert.
 *
 * Server-only.
 */
import { and, desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { auditLog } from "@/db/schema/audit-log";
import {
  STANDING_OBSERVATION_AUDIT_SOURCE,
  STANDING_OBSERVATION_ENTITY_TYPE,
  type StandingObservationAuditAction,
  type StandingObservationState,
} from "@/features/standing-observation-authority/contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveStandingObservationAuditDbOrNull(): ControlPlaneDatabase | null {
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/** The control-plane database or an open transaction on it — so audit joins the authorization. */
export type StandingObservationAuditWriter = Pick<ControlPlaneDatabase, "insert">;

/** Server-resolved acting authority. No shape here for a client value to arrive in. */
export interface StandingObservationAuditActor {
  readonly tenantId: string;
  /** `users.id` — the canonical `actor_id` for `actor_type = 'human'` across the schema. */
  readonly userId: string;
  readonly requestId?: string;
  /** Durable `user_session_contexts` row id. Never the bearer reference. */
  readonly sessionContextId?: string;
}

/**
 * Identity and the bound scope — never a secret, never a provider response, never prose.
 *
 * The scope is carried rather than joined because a ceiling is identity-shaped: history must be able
 * to say what was actually authorized without reading a table that may itself have moved on.
 */
export interface StandingObservationAuditMetadata {
  readonly authorizationRevision: number;
  readonly state: StandingObservationState;
  readonly providerKey: string;
  readonly capabilityKey: string;
  readonly subjectKind: string;
  readonly subjectRef: string;
  readonly integrationId: string;
  readonly intervalMinutes: number;
  readonly governanceDecisionId: string;
  readonly governanceSessionId: string;
  readonly supersedesAuthorizationId: string | null;
  /**
   * Authorizing collects nothing, so this is ALWAYS `false` and the type admits no other value. It
   * is a statement about THIS row — the grant — and never about whether the scope was later
   * observed. A performed observation lives in Provider Observation History; since TRH-24 one such
   * observation can exist, and it still leaves every row here `false`.
   */
  readonly collected: false;
}

/**
 * `committed` — the revision is durable.
 *
 * `rejected` and `rolled-back` are deliberately not produced: this writer joins the authorizing
 * transaction, so a rolled-back authorization takes its audit row with it, and a refused one never
 * reaches this module at all.
 */
export type StandingObservationAuditOutcome = "committed";

export interface StandingObservationAuditEvent {
  readonly action: StandingObservationAuditAction;
  readonly outcome: StandingObservationAuditOutcome;
  /** The revision row. Never the connection, never the subject — those are not what was decided. */
  readonly entityId: string;
  readonly metadata: StandingObservationAuditMetadata;
}

/**
 * Append one standing-observation event.
 *
 * `writer` is the control-plane database OR the open transaction that is writing the decision and
 * the revision. Passing the transaction is what makes "authorized" and "history says authorized"
 * the same fact: a failing audit insert aborts the authorization.
 */
export async function recordStandingObservationEventWithin(
  writer: StandingObservationAuditWriter,
  actor: StandingObservationAuditActor,
  event: StandingObservationAuditEvent,
  now: Date = new Date(),
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    /* A human acting through the product. Never accepted from input. */
    actorType: "human",
    actorId: actor.userId,
    action: event.action,
    entityType: STANDING_OBSERVATION_ENTITY_TYPE,
    entityId: event.entityId,
    occurredAt: now,
    metadata: event.metadata,
    result: event.outcome,
    /*
     * `simulation` marks a non-live posture where no real effect occurred. Authorizing a standing
     * observation scope IS a real, durable organizational act. What has NOT happened is the
     * collection, and `metadata.collected` says so explicitly. Marking the act itself as simulated
     * would understate a real constitutional event.
     */
    simulation: false,
    source: STANDING_OBSERVATION_AUDIT_SOURCE,
    requestId: actor.requestId,
    sessionContextId:
      actor.sessionContextId && UUID_RE.test(actor.sessionContextId)
        ? actor.sessionContextId
        : undefined,
    /* The actor acted under their tenant membership, which is what the session resolves. */
    authoritySource: "membership",
  });
}

export interface StandingObservationAuditRecord {
  readonly auditId: string;
  readonly action: string;
  readonly outcome: string;
  readonly entityId: string;
  readonly actorId: string;
  readonly occurredAt: string;
}

export type StandingObservationAuditHistory =
  | { readonly status: "read"; readonly records: readonly StandingObservationAuditRecord[] }
  | { readonly status: "unavailable"; readonly reason: string };

/**
 * Read this tenant's standing-observation history. Tenant-scoped by predicate; there is no unscoped
 * or cross-tenant query in this module, so a caller can only ever ask about its own tenant.
 */
export async function readStandingObservationAuditHistory(
  tenant: { readonly tenantId: string } | null,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null; readonly limit?: number } = {},
): Promise<StandingObservationAuditHistory> {
  if (typeof window !== "undefined") {
    throw new Error("Standing observation audit reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = (deps.getDb ?? resolveStandingObservationAuditDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };
  if (!UUID_RE.test(tenant.tenantId)) return { status: "read", records: [] };

  try {
    const rows = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.tenantId, tenant.tenantId),
          eq(auditLog.entityType, STANDING_OBSERVATION_ENTITY_TYPE),
        ),
      )
      .orderBy(desc(auditLog.occurredAt))
      .limit(Math.min(Math.max(deps.limit ?? 50, 1), 200));

    return {
      status: "read",
      records: rows.map((row) => ({
        auditId: row.id,
        action: row.action,
        outcome: row.result ?? "",
        entityId: row.entityId ?? "",
        actorId: row.actorId,
        occurredAt: row.occurredAt.toISOString(),
      })),
    };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}
