/*
 * knowledge/version-standing.server.ts — ONE KNOWLEDGE VERSION'S STANDING, AS KNOWLEDGE KNOWS IT
 * (SCI-2B).
 *
 * The facts Knowledge owns about one version row, read inside the caller's tenant:
 *
 *   - whether it is its fact's ACTIVE version and in force now — the same rule as KR3 eligibility
 *     and `countFactsByDomain`: not archived/retired, inside any stated effective window, neither
 *     row soft-deleted;
 *   - the ratification decision id the row CLAIMS (Governance verifies it, not this file);
 *   - `integrity_protected_at_insert`, written only by the database (SCI-2B migration).
 *
 * A version of another tenant, or no version at all, reads as `null`: the tenant predicate is in
 * the statement, so this seam cannot be used to learn that another tenant's row exists.
 *
 * READ ONLY. Server-only.
 */
import { sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";

export interface KnowledgeVersionStanding {
  readonly knowledgeNodeId: string;
  readonly tenantId: string;
  readonly activeAndInForce: boolean;
  readonly claimedRatificationDecisionId: string | null;
  /** TRUE only when the database stamped it at insert; NULL is "not established". */
  readonly integrityProtectedAtInsert: boolean | null;
}

export type KnowledgeVersionStandingRead =
  | { readonly status: "read"; readonly standing: KnowledgeVersionStanding | null }
  | { readonly status: "unavailable" };

export interface KnowledgeVersionStandingDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveDbOrNull(): ControlPlaneDatabase | null {
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

export async function readKnowledgeVersionStanding(
  tenant: Pick<TenantContext, "tenantId"> | null,
  knowledgeNodeId: string,
  now: Date,
  deps: KnowledgeVersionStandingDeps = {},
): Promise<KnowledgeVersionStandingRead> {
  if (typeof window !== "undefined") {
    throw new Error("Knowledge reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable" };
  if (!UUID_RE.test(knowledgeNodeId)) return { status: "read", standing: null };
  const db = (deps.getDb ?? resolveDbOrNull)();
  if (!db) return { status: "unavailable" };

  const at = now.toISOString();
  try {
    const executed = await db.execute(sql`
      select n.id::text as "nodeId",
             n.tenant_id::text as "tenantId",
             n.ratification_decision_id::text as "decisionId",
             n.integrity_protected_at_insert as "integrity",
             (f.id is not null
               and f.deleted_at is null
               and n.deleted_at is null
               and n.knowledge_lifecycle_status is distinct from 'archived'
               and n.knowledge_lifecycle_status is distinct from 'retired'
               and (n.effective_from is null or n.effective_from <= ${at}::timestamptz)
               and (n.effective_until is null or n.effective_until >= ${at}::timestamptz)) as "activeAndInForce"
        from knowledge_nodes n
        left join knowledge_facts f
          on f.active_knowledge_node_id = n.id and f.tenant_id = n.tenant_id
       where n.id = ${knowledgeNodeId} and n.tenant_id = ${tenant.tenantId}`);
    const row = (executed.rows as unknown as readonly Record<string, unknown>[])[0];
    if (!row) return { status: "read", standing: null };
    return {
      status: "read",
      standing: {
        knowledgeNodeId: String(row.nodeId),
        tenantId: String(row.tenantId),
        activeAndInForce: row.activeAndInForce === true,
        claimedRatificationDecisionId: typeof row.decisionId === "string" ? row.decisionId : null,
        integrityProtectedAtInsert: row.integrity === true ? true : null,
      },
    };
  } catch {
    return { status: "unavailable" };
  }
}
