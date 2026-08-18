/*
 * knowledge/retract-source.server.ts — withdrawing one ingestion source from active Knowledge (R6D).
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 *
 * One ingested source produces up to `MAX_CHUNKS_PER_SOURCE` facts. Until now the only way to undo a
 * wrong upload was to supersede them one at a time, each with its own observed-version precondition
 * and its own statement — forty governed acts to reverse one. That is not a missing convenience; it
 * is a capability gap, because no operator will do it and the wrong Knowledge stays in service.
 *
 * ── IT IS A WITHDRAWAL, NOT A DELETION ───────────────────────────────────────
 *
 * Each affected fact's ACTIVE NODE moves to `knowledge_lifecycle_status = 'retired'`, with
 * `retired_at` stamped. Nothing is removed: the statement, the version counter, the provenance, the
 * supersession chain and any ratification linkage all stay exactly as they were, and the fact keeps
 * pointing at the node so its history remains readable.
 *
 * `retired` was not invented for this. It is an existing enum value that every reader ALREADY
 * treats as terminal — KR3 excludes it and reports `lifecycle-retired` rather than hiding it, and
 * R6B counts it as withdrawn rather than as coverage. R6D is simply its first writer, which is why
 * this needs no schema and why Heby and Company Understanding react with no knowledge of retraction
 * whatsoever. A phase that had to teach every reader about a new state would have been the wrong
 * design.
 *
 * ── ONE TRANSACTION, OR NOTHING ──────────────────────────────────────────────
 *
 *   BEGIN
 *     1. lock every live fact/node pair carrying this digest, FOR UPDATE
 *     2. refuse if the set is empty                          (not found / already withdrawn)
 *     3. refuse if ANY of them is ratified                   (the Governance boundary, below)
 *     4. retire each active node, predicated on it still being live
 *     5. append one `knowledge.retract` audit event per fact
 *   COMMIT
 *
 * A partially retracted source is not a state this code can produce, and neither is
 * mutation-without-audit or audit-without-mutation: both live in the same control-plane database and
 * the same transaction, exactly as K3 and K4 already arrange it.
 *
 * ── WHY A RATIFIED SOURCE IS REFUSED ─────────────────────────────────────────
 *
 * Ratification is the tenant's GOVERNANCE authority approving one exact version. This act is gated
 * on the KNOWLEDGE AUTHORING band, and K4 says plainly that the two are different authorities —
 * an owner-band author is refused at the ratify gate. Letting that same band withdraw ratified
 * Knowledge from service would let the weaker authority undo what the stronger one decided, which is
 * a Governance reversal wearing a lifecycle change as a disguise. K4 has no reversal runtime and
 * refuses to invent one; so does this.
 *
 * Server-only.
 */

import { and, eq, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { knowledgeNodes } from "@/db/schema/knowledge";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordKnowledgeMutationWithin, auditActorFrom } from "@/features/governance-audit/knowledge-mutation-audit.server";
import {
  resolveKnowledgeWriteAuthority,
  type KnowledgeWriteAuthority,
} from "./knowledge-write-authority.server";
import {
  isSourceDigest,
  RETRACTION_REFUSAL_DETAIL,
  type RetractionRefusal,
  type RetractionResult,
} from "./retraction-contracts";

export interface RetractSourceDeps {
  readonly resolveAuthority?: (tenant: TenantContext) => Promise<KnowledgeWriteAuthority>;
  /** The control-plane database. Null when persistence is not configured. */
  readonly getDb?: () => ControlPlaneDatabase | null;
  /** Injected clock, so `retired_at` and the audit timestamp are deterministic in tests. */
  readonly now?: () => Date;
  /**
   * Test-only seam: runs after the fact at this index has been retired, inside the transaction. It
   * exists so the all-or-none guarantee can be PROVEN by failing midway rather than asserted.
   * Production never supplies it.
   */
  readonly failAfterFact?: number;
}

/** One live fact/node pair carrying the targeted digest. */
interface TargetRow extends Record<string, unknown> {
  readonly fact_id: string;
  readonly fact_key: string;
  readonly domain_key: string;
  readonly knowledge_scope: string;
  readonly fact_version: number;
  readonly node_id: string;
  readonly knowledge_version: number;
  readonly ratification_decision_id: string | null;
}

/** Thrown inside the transaction to roll every retirement back. Never escapes this module. */
class RetractionAborted extends Error {
  constructor(readonly refusal: RetractionRefusal) {
    super(refusal);
  }
}

function refuse(reason: RetractionRefusal): RetractionResult {
  return { status: "refused", reason, detail: RETRACTION_REFUSAL_DETAIL[reason] };
}

export function resolveRetractionDbOrNull(): ControlPlaneDatabase | null {
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * Withdraw every fact produced by one ingestion source.
 *
 * The gate order is K2's, and for K2's reason — authorization before the identity is even looked at,
 * so an unauthorized caller cannot use the refusals as an oracle for which sources a tenant holds.
 */
export async function retractKnowledgeSource(
  tenant: TenantContext | null,
  input: { readonly sourceDigest: string },
  deps: RetractSourceDeps = {},
): Promise<RetractionResult> {
  if (typeof window !== "undefined") {
    throw new Error("Knowledge retraction is server-only.");
  }

  if (!tenant?.tenantId || !tenant.userId) return refuse("unauthorized");

  const authority = await (deps.resolveAuthority ?? resolveKnowledgeWriteAuthority)(tenant);
  if (!authority.authorized) return refuse("forbidden");

  const db = (deps.getDb ?? resolveRetractionDbOrNull)();
  if (!db) return refuse("persistence-unavailable");

  const sourceDigest = (input?.sourceDigest ?? "").trim();
  if (!isSourceDigest(sourceDigest)) return refuse("invalid-source-identity");

  const now = (deps.now ?? (() => new Date()))();
  const actor = auditActorFrom(tenant);
  let retractedFactCount = 0;

  try {
    await db.transaction(async (tx) => {
      /*
       * THE TARGET SET, LOCKED. `for update of n` locks the node rows this transaction is about to
       * move; a concurrent retraction of the same source blocks here and, when it proceeds, finds
       * every row already retired and refuses `source-not-found`. A concurrent supersession of one
       * of these facts is serialized the same way.
       *
       * Both sides of the join are tenant-scoped, exactly as the read repository does it: a fact
       * must never resolve its content through another tenant's node.
       */
      const targets = await tx.execute<TargetRow>(sql`
        select f.id                          as fact_id,
               f.fact_key                    as fact_key,
               f.domain_key                  as domain_key,
               f.knowledge_scope::text       as knowledge_scope,
               f.fact_version                as fact_version,
               n.id                          as node_id,
               n.knowledge_version           as knowledge_version,
               n.ratification_decision_id    as ratification_decision_id
          from knowledge_facts f
          join knowledge_nodes n
            on n.id = f.active_knowledge_node_id
           and n.tenant_id = f.tenant_id
           and n.tenant_id = ${tenant.tenantId}
         where f.tenant_id = ${tenant.tenantId}
           and n.provenance->>'sourceDigest' = ${sourceDigest}
           and n.knowledge_lifecycle_status is distinct from 'retired'
           and n.knowledge_lifecycle_status is distinct from 'archived'
         order by f.fact_key
           for update of n
      `);

      const rows = targets.rows as readonly TargetRow[];

      /* Nothing live carries this digest here: unknown, another tenant's, or already withdrawn. */
      if (rows.length === 0) throw new RetractionAborted("source-not-found");

      /*
       * ALL OR NOTHING, INCLUDING THE REFUSAL. One ratified fact refuses the WHOLE source rather
       * than retracting the rest — a "partial retraction" would leave the operator believing the
       * source was withdrawn while some of it stayed in service, which is the worse outcome.
       */
      if (rows.some((row) => row.ratification_decision_id !== null)) {
        throw new RetractionAborted("source-contains-ratified-knowledge");
      }

      for (const [index, row] of rows.entries()) {
        /*
         * Predicated on the node still being live. The FOR UPDATE lock above already serializes the
         * concurrent case; this is the same compare-and-swap shape the rest of the repository uses,
         * so a zero-row update is a refusal rather than a silent success.
         */
        const moved = await tx
          .update(knowledgeNodes)
          .set({
            knowledgeLifecycleStatus: "retired",
            retiredAt: now,
            updatedAt: now,
            updatedBy: tenant.userId,
            updatedByType: "human",
          })
          .where(
            and(
              eq(knowledgeNodes.id, row.node_id),
              eq(knowledgeNodes.tenantId, tenant.tenantId),
              sql`${knowledgeNodes.knowledgeLifecycleStatus} is distinct from 'retired'`,
            ),
          )
          .returning({ id: knowledgeNodes.id });

        if (moved.length !== 1) throw new RetractionAborted("write-failed");

        /*
         * ONE AUDIT EVENT PER FACT, in the SAME transaction. `retractedSourceDigest` is what ties
         * the N rows back into one act; `retractedFactCount` states how large that act was, so a
         * single row read on its own is still truthful about what happened around it.
         */
        await recordKnowledgeMutationWithin(
          tx,
          actor,
          {
            action: "knowledge.retract",
            identity: {
              factId: row.fact_id,
              factKey: row.fact_key,
              domainKey: row.domain_key,
              scope: row.knowledge_scope,
            },
            outcome: "committed",
            metadata: {
              factKey: row.fact_key,
              domainKey: row.domain_key,
              scope: row.knowledge_scope,
              priorKnowledgeNodeId: row.node_id,
              factVersion: row.fact_version,
              knowledgeVersion: row.knowledge_version,
              retractedSourceDigest: sourceDigest,
              retractedFactCount: rows.length,
            },
          },
          now,
        );

        if (deps.failAfterFact === index) throw new RetractionAborted("write-failed");
      }

      retractedFactCount = rows.length;
    });
  } catch (error) {
    if (error instanceof RetractionAborted) return refuse(error.refusal);
    return refuse("write-failed");
  }

  return { status: "retracted", source: { sourceDigest, retractedFactCount } };
}
