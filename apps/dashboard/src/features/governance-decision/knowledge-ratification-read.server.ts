/*
 * governance-decision/knowledge-ratification-read.server.ts — WHICH GOVERNANCE DECISIONS RATIFIED
 * ONE KNOWLEDGE VERSION (SCI-2B).
 *
 * Knowledge's `ratified` reading is `ratification_decision_id is not null`, and that column is one
 * SCI-2A deliberately leaves writable (K4 binds it after insert). A non-null id is therefore a CLAIM
 * by the Knowledge row; this read is Governance's own answer to it. The caller compares the two —
 * the claim counts only when the id it names is one of the `ratify` decisions Governance holds for
 * that exact version, in the caller's tenant.
 *
 * Sibling of `knowledge-rejection-read.server.ts`, same shape: the projection lives with the facts
 * (G6C), returns identities only, and reports unavailability instead of an empty answer.
 *
 *     NO MATCHING DECISION != READ FAILED
 *
 * READ ONLY. Server-only.
 */
import { sql } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { RATIFICATION_SUBJECT_TYPE } from "@/features/knowledge-ratification/contracts";
import { resolveGovernanceDbOrNull } from "./persistence.server";

export interface KnowledgeRatificationReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

export type KnowledgeRatificationDecisionsRead =
  | { readonly status: "read"; readonly ratifyDecisionIds: ReadonlySet<string> }
  | { readonly status: "unavailable" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readKnowledgeRatificationDecisions(
  tenant: Pick<TenantContext, "tenantId"> | null,
  knowledgeNodeId: string,
  deps: KnowledgeRatificationReadDeps = {},
): Promise<KnowledgeRatificationDecisionsRead> {
  if (typeof window !== "undefined") {
    throw new Error("Governance decision reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable" };
  // A non-uuid can never name a version; that is an authoritative empty answer, not a failure.
  if (!UUID_RE.test(knowledgeNodeId)) return { status: "read", ratifyDecisionIds: new Set() };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable" };

  try {
    const executed = await db.execute(sql`
      select "decision_records"."id"::text as "decisionId"
      from "decision_records"
      where "decision_records"."tenant_id" = ${tenant.tenantId}
        and "decision_records"."subject_type" = ${RATIFICATION_SUBJECT_TYPE}
        and "decision_records"."subject_id" = ${knowledgeNodeId}
        and "decision_records"."decision_type" = 'ratify'`);
    const rows = executed.rows as unknown as readonly Record<string, unknown>[];
    const ids = new Set<string>();
    for (const row of rows) if (typeof row?.decisionId === "string") ids.add(row.decisionId);
    return { status: "read", ratifyDecisionIds: ids };
  } catch {
    return { status: "unavailable" };
  }
}
