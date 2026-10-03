/*
 * governance-decision/knowledge-rejection-read.server.ts — WHICH KNOWLEDGE VERSIONS GOVERNANCE
 * REJECTED (KT-1).
 *
 * ── WHY THIS IS A SIBLING, NOT A SECOND MEANING ──────────────────────────────
 *
 * `knowledge-decision-read.server.ts` answers "does anybody still owe an answer about this
 * version", and deliberately refuses to tell `ratify` from `reject`: both answer no, and that read
 * serves the attention and horizon compositions, which must not rank one outcome above the other.
 *
 * This file answers a different question for a different consumer: "which versions did Governance
 * decline". A rejection writes NOTHING to Knowledge — that is K4's design and it is unchanged — so
 * in Knowledge's tables a declined version looks exactly like an unseen one, and retrieval kept
 * serving it. The outcome lives here, in Governance's ledger, and this is where it is read.
 *
 *     DECIDED != REJECTED          REJECTED != DELETED          UNAVAILABLE != NOTHING REJECTED
 *
 * ── WHAT IT RETURNS, AND TO WHOM ─────────────────────────────────────────────
 *
 * IDENTITIES of `knowledge_node` subjects carrying a `reject` decision in this tenant. Not
 * justifications, not actors, not instants. Truth is terminal per version (the ratification seam
 * refuses a second truth decision), so a version in this set carries no ratification.
 *
 * The consumer is Knowledge retrieval, which takes the set as an eligibility INPUT. The Knowledge
 * repository still reads no Governance table; the projection belongs to the side that owns the
 * facts and the consumer imports the projection (G6C).
 *
 * READ ONLY. No insert, update, delete or transaction appears here. It creates no authority,
 * decides nothing, and changes nothing in Knowledge.
 *
 * Server-only.
 */
import { sql } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { GovernanceSubjectType } from "./contracts";
import { resolveGovernanceDbOrNull } from "./persistence.server";

/**
 * The subject a Knowledge truth decision names: the version ROW. Taken from Governance's OWN
 * subject vocabulary, so this file imports nothing from the ratification feature — every reader of
 * Knowledge now reaches this projection, and several of them (provider content admission, the
 * cross-source read) are firewalled from the ratification seam. The type binds it to the closed
 * list; K4's `RATIFICATION_SUBJECT_TYPE` is the same word, and a test holds the two together.
 */
const KNOWLEDGE_VERSION_SUBJECT_TYPE: GovernanceSubjectType = "knowledge_node";

/** The Governance decision type that declines a Knowledge version. Already in the released enum. */
const KNOWLEDGE_REJECTION_DECISION_TYPE = "reject" as const;

export interface KnowledgeRejectionReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

export type RejectedKnowledgeVersionsRead =
  | { readonly status: "read"; readonly rejectedNodeIds: ReadonlySet<string> }
  | {
      readonly status: "unavailable";
      readonly reason: "no-authorized-tenant-context" | "persistence-not-configured" | "read-failed";
    };

/**
 * The `knowledge_node` subjects this tenant's Governance has rejected.
 *
 * An empty set is a measured answer: Governance declined nothing. An unavailable read is not, and a
 * caller that treated the two alike would serve a declined statement at exactly the moment it
 * could not tell.
 *
 * Tenant-scoped by predicate, bound from the already-resolved server context. There is no parameter
 * through which a caller could name another organization.
 */
export async function readRejectedKnowledgeVersions(
  tenant: Pick<TenantContext, "tenantId"> | null,
  deps: KnowledgeRejectionReadDeps = {},
): Promise<RejectedKnowledgeVersionsRead> {
  if (typeof window !== "undefined") {
    throw new Error("Governance decision reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };

  const statement = sql`
    select distinct "decision_records"."subject_id"::text as "nodeId"
    from "decision_records"
    where "decision_records"."tenant_id" = ${tenant.tenantId}
      and "decision_records"."subject_type" = ${KNOWLEDGE_VERSION_SUBJECT_TYPE}
      and "decision_records"."decision_type" = ${KNOWLEDGE_REJECTION_DECISION_TYPE}
      and "decision_records"."subject_id" is not null`;

  try {
    const executed = await db.execute(statement);
    const rows = executed.rows as unknown as readonly Record<string, unknown>[];
    const rejected = new Set<string>();
    for (const row of rows) {
      const id = row?.nodeId;
      if (typeof id === "string" && id.trim() !== "") rejected.add(id);
    }
    return { status: "read", rejectedNodeIds: rejected };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}

/**
 * Whether ONE version already carries a rejection, read inside the caller's transaction.
 *
 * For the ratification seam and nothing else: it holds the version row locked FOR UPDATE, so this
 * read and the decision it guards cannot be interleaved with another truth decision on the same
 * version. A failure here THROWS — the caller's transaction aborts, which is the fail-closed
 * outcome for a write.
 */
export async function isKnowledgeVersionRejectedWithin(
  tx: Pick<ControlPlaneDatabase, "execute">,
  tenantId: string,
  knowledgeNodeId: string,
): Promise<boolean> {
  const executed = await tx.execute(sql`
    select 1 as "rejected"
    from "decision_records"
    where "decision_records"."tenant_id" = ${tenantId}
      and "decision_records"."subject_type" = ${KNOWLEDGE_VERSION_SUBJECT_TYPE}
      and "decision_records"."decision_type" = ${KNOWLEDGE_REJECTION_DECISION_TYPE}
      and "decision_records"."subject_id" = ${knowledgeNodeId}
    limit 1`);
  return executed.rows.length > 0;
}
