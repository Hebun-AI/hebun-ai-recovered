/*
 * governance-decision/knowledge-public-use-read.server.ts — whether Governance has cleared each
 * Knowledge version for public factual use (KT-3). Read-only.
 *
 * ── DERIVED FROM THE LEDGER, NEVER MATERIALIZED ──────────────────────────────
 *
 * A use decision writes nothing to Knowledge. The current state of a version is the state its
 * LATEST public-use decision left behind; transitions are validated at write time under the
 * version's row lock (`decide-public-use.server.ts`), so the latest decision is always a valid
 * successor of the one before it and there is one answer per version, never two.
 *
 *     NO ROW != DENIED        A RATIFICATION != AN ALLOWANCE        UNAVAILABLE != ALLOWED
 *
 * A version with no public-use decision is ABSENT from the returned map — the caller reads that as
 * UNKNOWN. Ratification is not consulted, currentness is not consulted, and a superseding version
 * is a different row with no decision of its own.
 *
 * ── ORDER IS DETERMINISTIC ───────────────────────────────────────────────────
 *
 * Latest by `decided_at`, then `created_at`, then id — so two rows with the same instant cannot
 * produce an answer that depends on how the database happened to return them.
 *
 * No insert, update, delete or transaction appears here. Server-only.
 */
import { sql } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  PUBLIC_USE_SUBJECT_TYPE,
  publicUseStateFromDecisionType,
  type PublicUseState,
} from "@/features/knowledge-public-use/contracts";
import { resolveGovernanceDbOrNull } from "./persistence.server";

export interface KnowledgePublicUseReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

export type KnowledgePublicUseRead =
  | {
      readonly status: "read";
      /** Versions with a recorded public-use decision. A version absent from the map is UNKNOWN. */
      readonly states: ReadonlyMap<string, Exclude<PublicUseState, "unknown">>;
    }
  | {
      readonly status: "unavailable";
      readonly reason: "no-authorized-tenant-context" | "persistence-not-configured" | "read-failed";
    };

function latestStatement(tenantId: string, nodeId?: string) {
  return sql`
    select distinct on ("decision_records"."subject_id")
           "decision_records"."subject_id"::text as "nodeId",
           "decision_records"."decision_type"::text as "decisionType"
    from "decision_records"
    where "decision_records"."tenant_id" = ${tenantId}
      and "decision_records"."subject_type" = ${PUBLIC_USE_SUBJECT_TYPE}
      and "decision_records"."subject_id" is not null
      ${nodeId ? sql`and "decision_records"."subject_id" = ${nodeId}` : sql``}
    order by "decision_records"."subject_id",
             "decision_records"."decided_at" desc,
             "decision_records"."created_at" desc,
             "decision_records"."id" desc`;
}

function toStates(rows: readonly Record<string, unknown>[]): Map<string, Exclude<PublicUseState, "unknown">> {
  const states = new Map<string, Exclude<PublicUseState, "unknown">>();
  for (const row of rows) {
    const id = row?.nodeId;
    const state = typeof row?.decisionType === "string" ? publicUseStateFromDecisionType(row.decisionType) : null;
    if (typeof id === "string" && id.trim() !== "" && state) states.set(id, state);
  }
  return states;
}

/** The current public-use state of every decided version in this tenant. */
export async function readKnowledgePublicUse(
  tenant: Pick<TenantContext, "tenantId"> | null,
  deps: KnowledgePublicUseReadDeps = {},
): Promise<KnowledgePublicUseRead> {
  if (typeof window !== "undefined") {
    throw new Error("Governance decision reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };
  try {
    const executed = await db.execute(latestStatement(tenant.tenantId));
    return { status: "read", states: toStates(executed.rows as unknown as readonly Record<string, unknown>[]) };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}

/**
 * The current public-use state of ONE version, inside the caller's transaction — for the decision
 * seam, which holds the version row FOR UPDATE while it validates the transition. A failure throws,
 * so the caller's transaction aborts: the fail-closed outcome for a write.
 */
export async function readKnowledgePublicUseStateWithin(
  tx: Pick<ControlPlaneDatabase, "execute">,
  tenantId: string,
  knowledgeNodeId: string,
): Promise<PublicUseState> {
  const executed = await tx.execute(latestStatement(tenantId, knowledgeNodeId));
  return toStates(executed.rows as unknown as readonly Record<string, unknown>[]).get(knowledgeNodeId) ?? "unknown";
}
