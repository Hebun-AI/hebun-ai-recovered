/*
 * governance-audit/genesis-nomination-audit.server.ts — the append-only writer for pre-Governance
 * entitlement history (G2.1), over the EXISTING shared `audit_log` sink.
 *
 * A SIBLING OF G1, NOT AN EXTENSION OF IT. `knowledge-mutation-audit.server.ts` owns Knowledge
 * mutation history and `KNOWLEDGE_AUDIT_BOUNDARY` states the rules that were reasoned for Knowledge.
 * Genesis entitlement is a different domain with its own boundary (`GENESIS_AUDIT_BOUNDARY`), its
 * own `entity_type` and its own action vocabulary. Neither constant was widened to cover the other,
 * so tightening one can never silently move the other.
 *
 * NO NEW SINK AND NO MIGRATION. `audit_log.action` and `audit_log.entity_type` are free text by
 * design, so a new domain costs zero schema. A second audit table would have created a second
 * authority for the same question.
 *
 * APPEND-ONLY, ENFORCED BY WHAT IS ABSENT. This module exports one write and one read. There is no
 * update, no delete, no upsert, no "correct an event". A test asserts it over the source.
 *
 * Server-only.
 */

import { and, desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { auditLog } from "@/db/schema/audit-log";
import {
  GENESIS_NOMINATION_ENTITY_TYPE,
  type GenesisNominationAction,
} from "@/features/governance-genesis/contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The control-plane database or an open transaction on it — so audit can join the acceptance. */
export type GenesisAuditWriter = Pick<ControlPlaneDatabase, "insert">;

/**
 * The acting authority for a genesis audit append. Every field is SERVER-RESOLVED from the
 * authenticated session; there is no shape here for a client value to arrive in.
 */
export interface GenesisAuditActor {
  readonly tenantId: string;
  /** `users.id` — the canonical `actor_id` for `actor_type = 'human'` across the schema. */
  readonly userId: string;
  readonly requestId?: string;
  /**
   * The durable `user_session_contexts` row id, matching G1's existing practice. This is NOT the
   * opaque cookie reference — that bearer value is never stored, only its keyed digest is.
   */
  readonly sessionContextId?: string;
}

/**
 * Identity-only metadata. No credential material, no session bearer reference, no email, no name —
 * a genesis event says WHICH identities were involved, never anything about the person.
 */
export interface GenesisNominationAuditMetadata {
  readonly nominatedUserId: string;
  readonly nominatedAuthIdentityId: string;
  /** The external root that produced the nomination. See GENESIS_OPERATOR_ROOT. */
  readonly nominationSource: string;
  /** Recorded honestly so no later phase can narrate a stronger ceremony than happened. */
  readonly assuranceLevel: string;
  readonly mfaVerified: false;
}

export interface GenesisNominationAuditEvent {
  readonly action: GenesisNominationAction;
  readonly nominationId: string;
  readonly metadata: GenesisNominationAuditMetadata;
}

/**
 * Append one pre-Governance entitlement event.
 *
 * `writer` is the control-plane database OR the open transaction that is accepting the nomination.
 * Passing the transaction is what makes "accepted" and "history says accepted" the same fact:
 * neither "entitlement changed but no audit" nor "audit claims acceptance that rolled back" is a
 * state this code can produce.
 *
 * The caller cannot choose the outcome (`committed` is the only one an accepted row can have), the
 * timestamp, the actor, or the entity type.
 */
export async function recordGenesisNominationWithin(
  writer: GenesisAuditWriter,
  actor: GenesisAuditActor,
  event: GenesisNominationAuditEvent,
  now: Date = new Date(),
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    // A human acting through the product. Never accepted from input.
    actorType: "human",
    actorId: actor.userId,
    action: event.action,
    entityType: GENESIS_NOMINATION_ENTITY_TYPE,
    entityId: event.nominationId,
    occurredAt: now,
    metadata: event.metadata,
    // The transaction committed, so the entitlement really changed.
    result: "committed",
    simulation: false,
    source: "governance-genesis",
    requestId: actor.requestId,
    sessionContextId:
      actor.sessionContextId && UUID_RE.test(actor.sessionContextId)
        ? actor.sessionContextId
        : undefined,
    // The actor acted under their tenant membership, which is what the session resolves.
    authoritySource: "membership",
  });
}

export interface GenesisAuditRecord {
  readonly auditId: string;
  readonly action: string;
  readonly nominationId: string;
  readonly actorType: string;
  readonly actorId: string;
  readonly occurredAt: string;
}

export type GenesisAuditHistory =
  | { readonly status: "read"; readonly records: readonly GenesisAuditRecord[] }
  | { readonly status: "unavailable"; readonly reason: string; readonly detail?: string };

/**
 * Read this tenant's pre-Governance entitlement history. Tenant-scoped by predicate; there is no
 * unscoped or cross-tenant query in this module, so a caller can only ever ask about its own tenant.
 */
export async function readGenesisNominationHistory(
  tenant: { readonly tenantId: string } | null,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null; readonly limit?: number } = {},
): Promise<GenesisAuditHistory> {
  if (typeof window !== "undefined") throw new Error("Genesis audit reads are server-only.");
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = (deps.getDb ?? resolveGenesisAuditDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };
  if (!UUID_RE.test(tenant.tenantId)) return { status: "read", records: [] };

  try {
    const rows = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.tenantId, tenant.tenantId),
          eq(auditLog.entityType, GENESIS_NOMINATION_ENTITY_TYPE),
        ),
      )
      .orderBy(desc(auditLog.occurredAt), desc(auditLog.recordedAt))
      .limit(deps.limit ?? 50);
    return {
      status: "read",
      records: rows.map((row) => ({
        auditId: row.id,
        action: row.action,
        nominationId: row.entityId,
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
      detail: error instanceof Error ? error.message : "genesis audit history read failed",
    };
  }
}

/** The control-plane database, or an honest `null` when it is not configured. */
export function resolveGenesisAuditDbOrNull(): ControlPlaneDatabase | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}
