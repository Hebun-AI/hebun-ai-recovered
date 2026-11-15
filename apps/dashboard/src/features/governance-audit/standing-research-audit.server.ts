/*
 * governance-audit/standing-research-audit.server.ts — P6-2 history over the EXISTING
 * shared `audit_log` sink. No new sink, no migration: `action`, `entity_type` and `source` are free
 * text there.
 *
 * Two kinds of row:
 *   - `standing-research.authorized` / `.withdrawn` — written INSIDE the revision's transaction, so
 *     "authorized" and "history says authorized" are one fact.
 *   - `standing-research.refused` — a person's authorize, withdraw or run attempt that was refused.
 *     Nothing changed; the row exists so a refusal is visible later. Written on its own, best effort:
 *     failing to file a refusal never turns the refusal into anything else.
 *
 * The brief and the justification are NOT copied here. The revision row and `decision_records` are
 * their single homes.
 */
import { auditLog } from "@/db/schema/audit-log";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  STANDING_RESEARCH_AUDIT_REFUSED,
  STANDING_RESEARCH_AUDIT_SOURCE,
  STANDING_RESEARCH_ENTITY_TYPE,
  type StandingResearchAuditAction,
} from "@/features/standing-research-authority/contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function recordStandingResearchEventWithin(
  writer: Pick<ControlPlaneDatabase, "insert">,
  actor: Pick<TenantContext, "tenantId" | "userId" | "requestId" | "sessionContextId">,
  event: {
    readonly action: StandingResearchAuditAction;
    readonly outcome: "committed" | "rejected";
    readonly entityId: string | null;
    readonly metadata: Record<string, unknown>;
  },
  now: Date = new Date(),
): Promise<void> {
  await writer.insert(auditLog).values({
    tenantId: actor.tenantId,
    actorType: "human",
    actorId: actor.userId,
    action: event.action,
    /* A refusal before any revision exists is filed against the tenant itself. */
    entityType: event.entityId ? STANDING_RESEARCH_ENTITY_TYPE : "company",
    entityId: event.entityId ?? actor.tenantId,
    occurredAt: now,
    metadata: event.metadata,
    result: event.outcome,
    simulation: false,
    source: STANDING_RESEARCH_AUDIT_SOURCE,
    requestId: actor.requestId,
    sessionContextId: actor.sessionContextId && UUID_RE.test(actor.sessionContextId) ? actor.sessionContextId : undefined,
    authoritySource: "membership",
  });
}

/** File one refused attempt. Never throws; an unfiled refusal is still a refusal. */
export async function recordStandingResearchRefusal(
  tenant: TenantContext | null,
  attempt: "authorize" | "withdraw" | "run",
  reason: string,
  entityId: string | null,
  getDb?: () => ControlPlaneDatabase | null,
): Promise<void> {
  if (!tenant?.tenantId || !tenant.userId) return;
  try {
    const db = getDb ? getDb() : getControlPlaneDb();
    if (!db) return;
    await recordStandingResearchEventWithin(db, tenant, {
      action: STANDING_RESEARCH_AUDIT_REFUSED,
      outcome: "rejected",
      entityId,
      metadata: { attempt, reason },
    });
  } catch {
    /* best effort by design */
  }
}
