/*
 * governance-audit/knowledge-mutation-audit.server.ts — the append-only writer and reader over the
 * EXISTING `audit_log` sink (G1).
 *
 * THIS SURFACE IS APPEND-ONLY, AND THAT IS ENFORCED BY WHAT IT DOES NOT CONTAIN. There is no update,
 * no delete, no upsert, no "correct an event" helper — the module exports exactly one write
 * (`recordKnowledgeMutationWithin`) and one read (`readKnowledgeMutationHistory`). The underlying
 * Postgres row is of course technically updatable by a superuser; the claim G1 makes is the honest
 * one: no product code path can rewrite an actor, a timestamp, an outcome, or an identity, because
 * no such path is written. A test asserts it over the source.
 *
 * TRANSACTION RELATIONSHIP. `audit_log` lives in the SAME control-plane database as
 * `knowledge_facts` / `knowledge_nodes`, so a COMMITTED mutation writes its audit row inside the
 * SAME transaction as the canonical rows. "Knowledge committed but no audit" and "audit says
 * committed but Knowledge rolled back" are therefore not states this code can produce — they are
 * excluded by the transaction, not by hoping. No distributed-transaction machinery was invented,
 * because none is needed.
 *
 * A `rejected` or `rolled-back` mutation has, by definition, no canonical transaction to join, so
 * those rows are appended on their own. If THAT append fails, the caller is told the truth about the
 * Knowledge outcome and the audit gap is reported — never swallowed into a false success.
 *
 * Server-only.
 */

import { and, desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { auditLog } from "@/db/schema/audit-log";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  KNOWLEDGE_ENTITY_TYPE,
  type KnowledgeMutationEvent,
  type KnowledgeMutationHistory,
  type KnowledgeMutationMetadata,
  type KnowledgeMutationOutcome,
  type KnowledgeMutationReason,
  type KnowledgeMutationRecord,
} from "./contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Any drizzle handle that can insert — the control-plane database, or a transaction opened on it.
 * Typed as the database's own transaction parameter so the writer can join the canonical
 * Knowledge transaction without this module knowing how that transaction was opened.
 */
export type AuditWriter = Pick<ControlPlaneDatabase, "insert">;

/**
 * The acting authority for an audit append. Every field is SERVER-RESOLVED from the authenticated
 * session; the type deliberately mirrors the narrow slice of `TenantContext` and nothing wider, so
 * a client value has no shape to arrive in.
 */
export interface AuditActor {
  readonly tenantId: string;
  readonly userId: string;
  /** Correlates the audit row with the originating request. Never a secret. */
  readonly requestId?: string;
  readonly sessionContextId?: string;
}

/** Project the narrow actor from an authenticated TenantContext. The only supported construction. */
export function auditActorFrom(tenant: TenantContext): AuditActor {
  return {
    tenantId: tenant.tenantId,
    userId: tenant.userId,
    requestId: tenant.requestId,
    sessionContextId: tenant.sessionContextId,
  };
}

function metadataOf(event: KnowledgeMutationEvent): KnowledgeMutationMetadata {
  return event.reason ? { ...event.metadata, reason: event.reason } : event.metadata;
}

/**
 * Append one governed Knowledge mutation to the shared audit sink.
 *
 * `writer` is the control-plane database OR an open transaction on it. Passing the transaction is
 * what makes a committed mutation and its history atomic.
 *
 * Note what the caller cannot supply: the outcome vocabulary is a closed union, the timestamp is
 * taken here, the actor comes from `AuditActor` (server-resolved), and `entityType` is fixed. The
 * only caller-shaped values are the Knowledge identity and its metadata.
 */
export async function recordKnowledgeMutationWithin(
  writer: AuditWriter,
  actor: AuditActor,
  event: KnowledgeMutationEvent,
  now: Date = new Date(),
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    // A human acting through the product. Never accepted from input.
    actorType: "human",
    actorId: actor.userId,
    action: event.action,
    entityType: KNOWLEDGE_ENTITY_TYPE,
    entityId: event.identity.factId,
    occurredAt: now,
    // previousState / nextState stay NULL: history records THAT a named identity changed, never a
    // copy of what it said. Duplicating content here would build a shadow Knowledge store.
    metadata: metadataOf(event),
    result: event.outcome,
    // Not a simulation — this is a real governed mutation attempt by a real authorized actor.
    simulation: false,
    source: "knowledge-workspace",
    requestId: actor.requestId,
    sessionContextId:
      actor.sessionContextId && UUID_RE.test(actor.sessionContextId)
        ? actor.sessionContextId
        : undefined,
    authoritySource: "membership",
  });
}

/** Append outside any canonical transaction (rejected / rolled-back outcomes). */
export async function recordKnowledgeMutation(
  actor: AuditActor,
  event: KnowledgeMutationEvent,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null; readonly now?: () => Date } = {},
): Promise<{ readonly recorded: boolean; readonly detail?: string }> {
  const db = (deps.getDb ?? resolveAuditDbOrNull)();
  if (!db) return { recorded: false, detail: "audit persistence is not configured" };
  try {
    await recordKnowledgeMutationWithin(db, actor, event, (deps.now ?? (() => new Date()))());
    return { recorded: true };
  } catch (error) {
    return {
      recorded: false,
      detail: error instanceof Error ? error.message : "audit append failed",
    };
  }
}

function toRecord(row: typeof auditLog.$inferSelect): KnowledgeMutationRecord {
  const metadata = (row.metadata ?? {}) as Partial<KnowledgeMutationMetadata>;
  const iso = (value: Date | string): string =>
    value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  return {
    auditId: row.id,
    action: row.action,
    outcome: row.result as KnowledgeMutationOutcome,
    factId: row.entityId,
    factKey: metadata.factKey ?? "",
    domainKey: metadata.domainKey ?? "",
    scope: metadata.scope ?? "",
    newKnowledgeNodeId: metadata.newKnowledgeNodeId ?? null,
    priorKnowledgeNodeId: metadata.priorKnowledgeNodeId ?? null,
    reason: (metadata.reason as KnowledgeMutationReason | undefined) ?? null,
    actorType: row.actorType,
    actorId: row.actorId,
    occurredAt: iso(row.occurredAt),
    recordedAt: iso(row.recordedAt),
  };
}

export interface KnowledgeHistoryDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  /** Cap the page; history is a ledger, not an export. */
  readonly limit?: number;
}

/**
 * Read the governed mutation history for ONE Knowledge fact, within the authorized tenant.
 *
 * Tenant-scoped by predicate, newest first. There is deliberately no unscoped, cross-tenant, or
 * whole-ledger query in this module: a caller cannot ask for "all mutation history", only for the
 * history of a fact its own tenant owns. A fact id belonging to another tenant simply returns
 * nothing — indistinguishable from a fact that never existed.
 */
export async function readKnowledgeMutationHistory(
  tenant: Pick<TenantContext, "tenantId"> | null,
  factId: string,
  deps: KnowledgeHistoryDeps = {},
): Promise<KnowledgeMutationHistory> {
  if (typeof window !== "undefined") throw new Error("Governance audit reads are server-only.");
  if (!tenant?.tenantId) {
    return { status: "unavailable", reason: "no-authorized-tenant-context" };
  }
  const db = (deps.getDb ?? resolveAuditDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };
  if (!UUID_RE.test(tenant.tenantId) || !UUID_RE.test(factId)) {
    return { status: "read", records: [] };
  }

  try {
    const rows = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.tenantId, tenant.tenantId),
          eq(auditLog.entityType, KNOWLEDGE_ENTITY_TYPE),
          eq(auditLog.entityId, factId),
        ),
      )
      .orderBy(desc(auditLog.occurredAt), desc(auditLog.recordedAt))
      .limit(deps.limit ?? 100);
    return { status: "read", records: rows.map(toRecord) };
  } catch (error) {
    return {
      status: "unavailable",
      reason: "read-failed",
      detail: error instanceof Error ? error.message : "audit history read failed",
    };
  }
}

/** The control-plane database, or an honest `null` when it is not configured. */
export function resolveAuditDbOrNull(): ControlPlaneDatabase | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}
