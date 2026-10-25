/*
 * governance-activity/governed-work-link-read.server.ts — HEBY-VERIFIED-WORK-OUTCOMES.
 *
 * The FIFTH declared reader of the shared audit sink, and the narrowest: for a set of permit spends
 * (`handoff_id`s) in ONE tenant, the `work.recorded` rows a SYSTEM-performed governed act wrote naming
 * them — which is how Organizational Work declares, in the permit's own transaction, the work item a
 * spend produced (`organizational-work-audit.server.ts`, `handoffId`).
 *
 * OPERATIONAL-RELIABILITY-1 — and, asked for by name, the `work.state-declared` rows a governed state
 * change wrote naming its spend (`declareWorkStateUnderPermit`, same transaction). Still one action per
 * read, chosen from a closed pair, never a free string.
 *
 * It selects and writes nothing else: two columns, one tenant, one entity type, one action, one
 * actor type, exactly the handoffs asked about. No payload, actor or session travels. A separate file
 * for the reason the other four are separate: each keeps its own scope a single, absolute expression.
 *
 * Server-only.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { auditLog } from "@/db/schema/audit-log";
import { resolveGovernanceActivityDbOrNull, type GovernanceActivityReadDeps } from "./read.server";
import {
  WORK_AUDIT_RECORDED,
  WORK_AUDIT_STATE_DECLARED,
  WORK_ITEM_ENTITY_TYPE,
} from "@/features/organizational-work/work-contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The two links a governed work act declares. */
export type GovernedWorkLinkAction = typeof WORK_AUDIT_RECORDED | typeof WORK_AUDIT_STATE_DECLARED;

export interface GovernedWorkLink {
  readonly handoffId: string;
  readonly workItemId: string;
}

/** `null` when the sink cannot be read; every row found otherwise, duplicates included, for the caller to judge. */
export async function readGovernedWorkLinks(
  tenantId: string,
  handoffIds: readonly string[],
  deps: GovernanceActivityReadDeps = {},
  action: GovernedWorkLinkAction = WORK_AUDIT_RECORDED,
): Promise<readonly GovernedWorkLink[] | null> {
  if (typeof window !== "undefined") throw new Error("Governance activity reads are server-only.");
  if (!UUID_RE.test(tenantId)) return null;
  /* A closed pair at runtime too: a caller outside the type system gets nothing, never another action. */
  if (action !== WORK_AUDIT_RECORDED && action !== WORK_AUDIT_STATE_DECLARED) return null;
  const wanted = handoffIds.filter((id) => UUID_RE.test(id));
  if (wanted.length === 0) return [];
  const db = (deps.getDb ?? resolveGovernanceActivityDbOrNull)();
  if (!db) return null;

  /* ponytail: jsonb predicate with no index; bounded by tenant + action + the caller's few handoffs. Add an expression index if the ledger grows large. */
  const handoff = sql<string>`${auditLog.metadata} ->> 'handoffId'`;
  try {
    return await db
      .select({ handoffId: handoff, workItemId: auditLog.entityId })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.tenantId, tenantId),
          eq(auditLog.entityType, WORK_ITEM_ENTITY_TYPE),
          eq(auditLog.action, action),
          eq(auditLog.actorType, "system"),
          inArray(handoff, wanted),
        ),
      );
  } catch {
    return null;
  }
}
