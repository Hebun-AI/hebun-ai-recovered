/*
 * governance-decision/knowledge-decision-read.server.ts — WHICH KNOWLEDGE VERSIONS GOVERNANCE HAS
 * ALREADY DECIDED (KGA).
 *
 * ── WHY THIS SEAM HAD TO EXIST ───────────────────────────────────────────────
 *
 * K4 binds a RATIFY decision to a version by writing `knowledge_nodes.ratification_decision_id`.
 * It writes NOTHING to Knowledge for a REJECT — deliberately, and the reason is recorded in three
 * places: `ratify-version.server.ts` ("THIS WRITES NOTHING TO KNOWLEDGE, and that is the design"),
 * the ratification contracts ("the version stays exactly as authored… and simply remains
 * unratified"), and the audit vocabulary, where `knowledge.reject` is absent because "a rejection
 * records a Governance decision and changes NOTHING in Knowledge".
 *
 * The consequence is exact and it is the whole reason for this file:
 *
 *     IN KNOWLEDGE'S TABLES, A REJECTED VERSION IS INDISTINGUISHABLE FROM AN UNSEEN ONE.
 *
 * So an observation built on `ratification_decision_id is null` would report a version as still
 * waiting for a decision that a human already took. That is not a smaller truth than the right
 * one; it is a false statement about whether somebody still owes an answer.
 *
 * ── WHAT IT ANSWERS, AND WHAT IT REFUSES TO ──────────────────────────────────
 *
 * One question, about Governance's own table only: which `knowledge_node` subjects in this tenant
 * carry a Governance decision. It returns IDENTITIES — not outcomes, not justifications, not
 * actors, not instants, not decision types.
 *
 *     DECIDED != APPROVED        A SET OF SUBJECTS != A DECISION HISTORY
 *
 * `ratify` and `reject` are not distinguished, and that is correct rather than lossy: the consumer
 * asks "does anybody still owe an answer about this version", and both outcomes answer no. A caller
 * that could tell them apart could rank one above the other, which is a judgement this repository
 * gives no subsystem outside Governance.
 *
 * ── WHY IT LIVES HERE ────────────────────────────────────────────────────────
 *
 * `decision_records` is Governance's table. G6C settled that the projection belongs to the side
 * that owns the facts and the consumer imports the projection — so the attention composition never
 * holds a handle to this table, constructs no statement over it, and cannot widen what it sees.
 *
 * READ ONLY, and unbounded. No insert, update, delete, transaction, `.limit(` or `.offset(`
 * appears here. It creates no authority, decides nothing, and cannot cause a decision to exist.
 *
 * Server-only.
 */
import { sql } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { RATIFICATION_SUBJECT_TYPE } from "@/features/knowledge-ratification/contracts";
import { resolveGovernanceDbOrNull } from "./persistence.server";

export interface KnowledgeDecisionReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

export type DecidedKnowledgeVersionsRead =
  | { readonly status: "read"; readonly decidedNodeIds: ReadonlySet<string> }
  | { readonly status: "unavailable"; readonly reason: string };

/**
 * The `knowledge_node` subjects this tenant's Governance has decided about, in any direction.
 *
 * ── AN EMPTY SET IS A MEASURED ANSWER; AN UNAVAILABLE READ IS NOT ────────────
 *
 * A tenant whose Governance has never decided anything gets `status: "read"` with an empty set —
 * every current version is then genuinely undecided. A failed read gets `status: "unavailable"`,
 * and a caller that treated the two the same would announce that everything is waiting at exactly
 * the moment it could not tell.
 *
 *     UNAVAILABLE != NOTHING DECIDED
 *
 * Tenant-scoped by predicate, bound from the already-resolved server context. There is no parameter
 * through which a caller could name another organization, and the subject type is a constant read
 * from K4's own contract rather than a string this file invents.
 */
export async function readDecidedKnowledgeVersions(
  tenant: TenantContext | null,
  deps: KnowledgeDecisionReadDeps = {},
): Promise<DecidedKnowledgeVersionsRead> {
  if (typeof window !== "undefined") {
    throw new Error("Governance decision reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };

  /*
   * `subject_id` is nullable on `decision_records` — the genesis certify decision names a tenant,
   * not a row — so the null is excluded here rather than allowed to become the string "null" in a
   * set that is about to be tested for membership.
   */
  const statement = sql`
    select distinct "decision_records"."subject_id"::text as "nodeId"
    from "decision_records"
    where "decision_records"."tenant_id" = ${tenant.tenantId}
      and "decision_records"."subject_type" = ${RATIFICATION_SUBJECT_TYPE}
      and "decision_records"."subject_id" is not null`;

  try {
    const executed = await db.execute(statement);
    const rows = executed.rows as unknown as readonly Record<string, unknown>[];
    const decided = new Set<string>();
    for (const row of rows) {
      const id = row?.nodeId;
      if (typeof id === "string" && id.trim() !== "") decided.add(id);
    }
    return { status: "read", decidedNodeIds: decided };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}
