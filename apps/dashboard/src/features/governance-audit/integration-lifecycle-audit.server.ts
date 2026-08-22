/*
 * governance-audit/integration-lifecycle-audit.server.ts — append-only history for tenant
 * connection lifecycle (I1), over the EXISTING shared `audit_log` sink.
 *
 * THE NINTH SIBLING, NOT A SUPERSET. `knowledge-mutation-audit` owns Knowledge mutation history,
 * `genesis-nomination-audit` pre-Governance entitlement, `governance-decision-audit` decisions,
 * `human-onboarding-audit` arrivals, `identity-enrollment-audit` enrolments,
 * `action-authorization-audit` authorization to act, `action-execution-audit` attempts — and this
 * owns the lifecycle of a tenant's connection to an external provider. Each module references only
 * its own boundary constants, so tightening one can never silently move the others.
 *
 * NO NEW SINK AND NO MIGRATION. `action` and `entity_type` are free text on `audit_log`, so a new
 * domain costs zero schema. A second audit table would be a second authority for one question.
 *
 * `event_log` IS NOT ACTIVATED. It has no writer and no bus anywhere in this repository, and
 * giving it its first one here would smuggle another phase's work into this diff.
 *
 * ── WHAT IS AUDITED, AND WHAT DELIBERATELY IS NOT ────────────────────────────
 *
 * TWO events, because two are all I1 can honestly produce: a connection was recorded, and a
 * connection was ended by its tenant. Both have a real human actor from `TenantContext`, which is
 * why this domain is not blocked the way the provider-connectivity ceremony is —
 * `audit_log.actor_id` and `actor_type` are NOT NULL and no enum value means "no verified actor".
 *
 * NOT audited, and belonging to I2: credential stored, verification succeeded, verification
 * failed, refresh failed, scopes changed, connection revoked. Every one of them asserts something
 * that requires a credential or a provider response, and I1 has neither. Emitting one would be a
 * recorded act that never happened.
 *
 * NOT audited, and CANCELLED rather than deferred: health transitions (a 503 is not an
 * authority-bearing event, and auditing every transport blip would bury the events that are), and
 * write-capability changes (derived from the granted scope set, so it would be a second record of
 * what `scopes.changed` already says).
 *
 * ── NO SECRET, NO PAYLOAD, NO PROVIDER RESPONSE ──────────────────────────────
 *
 * `metadata` carries identity and shape only. There is no field on `IntegrationLifecycleAuditEvent`
 * capable of holding a credential, a token, a ciphertext or a provider body — not because a caller
 * is trusted to omit them, but because the type has nowhere to put them. `previous_state` and
 * `next_state` are left unwritten for the same reason: they are `jsonb`, and a jsonb column beside
 * a credential domain is where a secret eventually lands by accident.
 *
 * APPEND-ONLY, ENFORCED BY WHAT IS ABSENT: one write, one read, no update/delete/upsert.
 *
 * Server-only.
 */

import { and, desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { auditLog } from "@/db/schema/audit-log";
import {
  INTEGRATION_AUDIT_CONNECTION_CREATED,
  INTEGRATION_AUDIT_CONNECTION_DISCONNECTED,
  INTEGRATION_AUDIT_SOURCE,
  INTEGRATION_ENTITY_TYPE,
  type ConnectionState,
} from "@/features/integration-authority/contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The control-plane database OR an open transaction on it — so audit can join the write. */
export type IntegrationLifecycleAuditWriter = Pick<ControlPlaneDatabase, "insert">;

/** Server-resolved acting authority. No shape here for a client value to arrive in. */
export interface IntegrationLifecycleAuditActor {
  readonly tenantId: string;
  /** `users.id` — the canonical `actor_id` for `actor_type = 'human'` across the schema. */
  readonly userId: string;
  readonly requestId?: string;
  /** Durable `user_session_contexts` row id. Never the bearer reference. */
  readonly sessionContextId?: string;
}

export type IntegrationLifecycleAuditAction =
  | typeof INTEGRATION_AUDIT_CONNECTION_CREATED
  | typeof INTEGRATION_AUDIT_CONNECTION_DISCONNECTED;

/**
 * Identity and shape only.
 *
 * `providerKey` names a FROZEN CATALOG ENTRY, so it reveals which code path was used and nothing
 * about the tenant's data. The state pair records the transition this event is about. There is no
 * field for a secret, a token, a scope value observed from a provider, or a provider payload.
 */
export interface IntegrationLifecycleAuditMetadata {
  readonly providerKey: string;
  readonly previousState: ConnectionState | null;
  readonly nextState: ConnectionState;
  /**
   * Stated so history records that a connection is not a credential. Always `false` in I1, and a
   * test asserts no code path can set it otherwise.
   */
  readonly credentialStored: false;
  /**
   * Stated for the same reason: recording a connection is not verifying one. Always `false` in I1.
   */
  readonly verified: false;
}

/**
 * `committed` — the transition is durable. `rejected` — a legitimate actor was refused by a
 * governed rule.
 *
 * `rolled-back` is deliberately not produced: this writer joins the caller's transaction, so a
 * rolled-back transition takes its audit row with it and leaves no claim behind.
 */
export type IntegrationLifecycleAuditOutcome = "committed" | "rejected";

export interface IntegrationLifecycleAuditEvent {
  readonly action: IntegrationLifecycleAuditAction;
  readonly outcome: IntegrationLifecycleAuditOutcome;
  /** The `integrations` row this event is about. */
  readonly entityId: string;
  readonly metadata: IntegrationLifecycleAuditMetadata;
}

/** The control-plane database, or an honest `null` when it is not configured. */
export function resolveIntegrationAuditDbOrNull(): ControlPlaneDatabase | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * Append one connection lifecycle event.
 *
 * `writer` is the control-plane database OR the open transaction that is writing the connection.
 * Passing the transaction is what makes "recorded" and "history says recorded" the same fact:
 * "committed but unaudited" and "audited but rolled back" are excluded by the transaction, not by
 * hoping. A failing audit insert therefore aborts the write.
 */
export async function recordIntegrationLifecycleEventWithin(
  writer: IntegrationLifecycleAuditWriter,
  actor: IntegrationLifecycleAuditActor,
  event: IntegrationLifecycleAuditEvent,
  now: Date = new Date(),
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    // A human acting through the product. Never accepted from input.
    actorType: "human",
    actorId: actor.userId,
    action: event.action,
    entityType: INTEGRATION_ENTITY_TYPE,
    entityId: event.entityId,
    occurredAt: now,
    metadata: event.metadata,
    result: event.outcome,
    /*
     * `simulation` marks a non-live posture where no real effect occurred. Recording a connection
     * IS a real, durable act — the things that have not happened are the credential and the
     * verification, and `metadata.credentialStored` / `metadata.verified` say so explicitly.
     * Marking the record itself as simulated would understate a real tenant act.
     */
    simulation: false,
    source: INTEGRATION_AUDIT_SOURCE,
    requestId: actor.requestId,
    sessionContextId:
      actor.sessionContextId && UUID_RE.test(actor.sessionContextId)
        ? actor.sessionContextId
        : undefined,
    // The actor acted under their tenant membership, which is what the session resolves.
    authoritySource: "membership",
  });
}

export interface IntegrationLifecycleAuditRecord {
  readonly auditId: string;
  readonly action: string;
  readonly outcome: string;
  readonly entityId: string;
  readonly actorId: string;
  readonly occurredAt: string;
}

export type IntegrationLifecycleAuditHistory =
  | { readonly status: "read"; readonly records: readonly IntegrationLifecycleAuditRecord[] }
  | { readonly status: "unavailable"; readonly reason: string };

/**
 * Read this tenant's connection history. Tenant-scoped by predicate; there is no unscoped and no
 * cross-tenant query in this module, so a caller can only ever ask about its own tenant.
 */
export async function readIntegrationLifecycleHistory(
  tenant: { readonly tenantId: string } | null,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null; readonly limit?: number } = {},
): Promise<IntegrationLifecycleAuditHistory> {
  if (typeof window !== "undefined") {
    throw new Error("Integration lifecycle audit reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = (deps.getDb ?? resolveIntegrationAuditDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };
  if (!UUID_RE.test(tenant.tenantId)) return { status: "read", records: [] };

  const rows = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.tenantId, tenant.tenantId),
        eq(auditLog.entityType, INTEGRATION_ENTITY_TYPE),
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
        row.occurredAt instanceof Date ? row.occurredAt.toISOString() : String(row.occurredAt),
    })),
  };
}
