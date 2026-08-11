/*
 * knowledge/durable-knowledge-writer.server.ts — the ONE write into canonical Knowledge (K2).
 *
 * WHY THIS IS A SEPARATE MODULE FROM THE READ REPOSITORY. `durable-knowledge-repository.server.ts`
 * is provably read-only — a K1 test asserts its source contains no insert/update/delete. That is a
 * property worth keeping, so the write lives here instead of being folded in. One module can write
 * Knowledge; it is this one; it is auditable at a glance.
 *
 * WHAT IT WRITES, AND WHAT IT REFUSES TO CLAIM. Creating a fact is TWO canonical rows that must
 * agree, so it is one transaction:
 *
 *   BEGIN
 *     insert knowledge_nodes   — the content and its governance metadata
 *     insert knowledge_facts   — the identity, selecting that node as active
 *   COMMIT
 *
 * If the fact insert fails — most often because `knowledge_facts_tenant_domain_scope_fact_key_uidx`
 * already holds that identity — the whole transaction rolls back and NO node is left behind. A fact
 * pointing at a missing node, or a node with no fact, is therefore not a state this code can
 * produce. Both rows are written with the SAME server-resolved tenant, so the active-node selection
 * cannot cross a tenant boundary (the FK alone would not prevent that; constructing both rows here
 * does).
 *
 * The node is written `draft` / `provisional` / health `unknown`, with `ratified_at`,
 * `ratification_decision_id` and `governance_session_id` left NULL. That is not a placeholder to be
 * upgraded later by convenience: a person typing a sentence has not ratified it, Hebun has no
 * governance session to point at, and writing `ratified` because a form was submitted would
 * manufacture governance that never happened.
 *
 * CREATE ONLY. There is no update, no upsert, no delete, and no soft-delete here. An existing fact
 * identity is refused, never overwritten — organizational truth does not get silently replaced.
 *
 * Server-only.
 */

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { knowledgeFacts } from "@/db/schema/knowledge-fact";
import { knowledgeNodes } from "@/db/schema/knowledge";
import {
  recordKnowledgeMutationWithin,
  type AuditActor,
} from "@/features/governance-audit/knowledge-mutation-audit.server";
import type { NormalizedKnowledgeInput } from "./create-contracts";

/** Postgres unique-violation. Used so a lost duplicate race is reported, never crashed on. */
const UNIQUE_VIOLATION = "23505";

/**
 * The node `type` every human-authored canonical fact is written with. `knowledge_nodes.type` is
 * free text in the schema; a single honest constant is better than letting a form invent taxonomy.
 */
export const HUMAN_AUTHORED_NODE_TYPE = "knowledge-statement";

/**
 * The authority a K2 write is performed under. Every field is resolved SERVER-SIDE from the
 * authenticated session — none of it is representable in the client input type.
 */
export interface KnowledgeWriteActor extends AuditActor {
  readonly tenantId: string;
  /** The authenticated user id. Recorded as the human who established the fact. */
  readonly userId: string;
}

export interface CreatedKnowledgeIdentity {
  /**
   * The `knowledge_facts` row id. It is MINTED BEFORE the transaction so the governed identity
   * exists whatever the outcome — a rolled-back or refused mutation still has a stable identity for
   * its history entry to point at, which an id assigned by a successful insert could never provide.
   */
  readonly factId: string;
  readonly factKey: string;
  readonly domainKey: string;
  readonly scope: string;
  /** The node selected as active. Present only when one was actually created. */
  readonly newKnowledgeNodeId?: string;
}

export type DurableKnowledgeWriteResult =
  /** The canonical rows AND their audit entry committed together. */
  | { readonly status: "created"; readonly identity: CreatedKnowledgeIdentity }
  /** The identity already exists for this tenant. Nothing was written or changed. */
  | { readonly status: "duplicate"; readonly identity: CreatedKnowledgeIdentity }
  | { readonly status: "failed"; readonly identity: CreatedKnowledgeIdentity; readonly detail: string };

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

/** The identity a committed supersession established, with both sides of the version move. */
export interface SupersededKnowledgeIdentity {
  readonly factId: string;
  readonly factKey: string;
  readonly domainKey: string;
  readonly scope: string;
  readonly priorKnowledgeNodeId: string;
  readonly newKnowledgeNodeId: string;
  readonly priorFactVersion: number;
  readonly factVersion: number;
  readonly priorKnowledgeVersion: number;
  readonly knowledgeVersion: number;
}

export type SupersedeOutcome =
  | { readonly status: "superseded"; readonly identity: SupersededKnowledgeIdentity }
  /** The fact does not exist for this tenant, or its active node is unresolvable. */
  | { readonly status: "unresolvable" }
  /** The active version moved first. Nothing was overwritten. */
  | { readonly status: "stale" }
  | { readonly status: "failed"; readonly detail: string };

/** Thrown to roll the transaction back for a decided, non-exceptional outcome. */
class SupersedeAbort extends Error {
  constructor() {
    super("supersede-abort");
    this.name = "SupersedeAbort";
  }
}

export interface DurableKnowledgeWriter {
  createFact(
    actor: KnowledgeWriteActor,
    input: NormalizedKnowledgeInput,
    now?: Date,
  ): Promise<DurableKnowledgeWriteResult>;
  /**
   * Correct an existing fact by creating a NEW version that supersedes the active one. There is no
   * variant of this that edits the prior node — that is the whole point of the operation.
   */
  supersedeFact(
    actor: KnowledgeWriteActor,
    factId: string,
    input: {
      readonly title: string;
      readonly statement: string;
      /** The version the operator saw. A precondition only — it authorizes nothing. */
      readonly observedKnowledgeVersion: number;
    },
    now?: Date,
  ): Promise<SupersedeOutcome>;
}

export function createDurableKnowledgeWriter(db: ControlPlaneDatabase): DurableKnowledgeWriter {
  return {
    async createFact(actor, input, now = new Date()) {
      // Minted up front so the governed identity is stable across ALL outcomes — see the field doc.
      const factId = randomUUID();
      let identity: CreatedKnowledgeIdentity = {
        factId,
        factKey: input.factKey,
        domainKey: input.domainKey,
        scope: input.scope,
      };

      // A pre-check gives the operator a clean refusal instead of a database error. It is NOT the
      // safety mechanism — the unique index is, and the catch below handles a lost race.
      try {
        const existing = await db
          .select({ id: knowledgeFacts.id })
          .from(knowledgeFacts)
          .where(
            and(
              eq(knowledgeFacts.tenantId, actor.tenantId),
              eq(knowledgeFacts.factKey, input.factKey),
              eq(knowledgeFacts.domainKey, input.domainKey),
              eq(knowledgeFacts.knowledgeScope, input.scope),
            ),
          )
          .limit(1);
        // A refusal points at the EXISTING identity — that is the fact whose history this belongs to.
        if (existing[0]) return { status: "duplicate", identity: { ...identity, factId: existing[0].id } };
      } catch (error) {
        return {
          status: "failed",
          identity,
          detail: error instanceof Error ? error.message : "Knowledge duplicate check failed.",
        };
      }

      try {
        await db.transaction(async (tx) => {
          const inserted = await tx
            .insert(knowledgeNodes)
            .values({
              tenantId: actor.tenantId,
              type: HUMAN_AUTHORED_NODE_TYPE,
              label: input.title,
              statement: input.statement,
              domainKey: input.domainKey,
              knowledgeScope: input.scope,
              // A human authoring a statement does not ratify it. These are the honest values, and
              // K2 has no path that writes anything stronger.
              knowledgeLifecycleStatus: "draft",
              knowledgeAuthority: "provisional",
              knowledgeHealth: "unknown",
              /*
               * Truthful provenance. Note what is NOT claimed: Hebun records that an authenticated
               * human submitted this text, and it genuinely does not know whether they drafted it
               * themselves or pasted something a model produced. `textOriginUnverified` says so
               * rather than asserting a purely human origin Hebun cannot verify.
               */
              provenance: {
                origin: "human-authored",
                authoredThrough: "hebun-knowledge-workspace",
                submittedAt: now.toISOString(),
                textOriginUnverified: true,
              },
              createdBy: actor.userId,
              createdByType: "human",
              updatedBy: actor.userId,
              updatedByType: "human",
            })
            .returning({ id: knowledgeNodes.id });

          const nodeId = inserted[0]?.id;
          if (!nodeId) throw new Error("Knowledge node insert returned no id.");
          identity = { ...identity, newKnowledgeNodeId: nodeId };

          await tx.insert(knowledgeFacts).values({
            id: factId,
            // The SAME server-resolved tenant as the node — the active selection cannot cross a
            // tenant boundary, because both rows are constructed here from one authority.
            tenantId: actor.tenantId,
            factKey: input.factKey,
            domainKey: input.domainKey,
            knowledgeScope: input.scope,
            activeKnowledgeNodeId: nodeId,
            selectedAt: now,
            selectedByActorType: "human",
            selectedByActorId: actor.userId,
            createdBy: actor.userId,
            createdByType: "human",
            updatedBy: actor.userId,
            updatedByType: "human",
          });

          /*
           * G1 — the committed mutation's history is appended INSIDE this transaction, over the
           * pre-existing shared `audit_log` sink. Knowledge and its history therefore commit
           * together or not at all: "Knowledge changed but no audit" and "audit claims a change that
           * rolled back" are excluded by the transaction, not by discipline.
           */
          await recordKnowledgeMutationWithin(
            tx,
            actor,
            {
              action: "knowledge.create",
              identity: { factId, factKey: input.factKey, domainKey: input.domainKey, scope: input.scope },
              outcome: "committed",
              metadata: {
                factKey: input.factKey,
                domainKey: input.domainKey,
                scope: input.scope,
                newKnowledgeNodeId: nodeId,
                factVersion: 1,
                knowledgeVersion: 1,
              },
            },
            now,
          );
        });
      } catch (error) {
        // A duplicate that slipped past the pre-check surfaces here. The transaction has already
        // rolled back, so no orphaned node and no audit row exist.
        if (isUniqueViolation(error)) return { status: "duplicate", identity };
        return {
          status: "failed",
          identity,
          detail: error instanceof Error ? error.message : "Knowledge creation failed.",
        };
      }

      return { status: "created", identity };
    },

    async supersedeFact(actor, factId, input, now = new Date()) {
      /*
       * K3 — CORRECTION BY SUPERSESSION, NEVER BY EDIT.
       *
       * The prior node is read, never written. A correction INSERTS a new node that points back at
       * the old one and moves the fact's active selection to it. The old statement is untouched
       * history, and this method contains no update of any node row — only the fact's selection.
       *
       * CONCURRENCY. The fact's current `fact_version` is read inside the transaction and then used
       * as a COMPARE-AND-SWAP token on the selection update: the WHERE clause requires both that
       * version and the observed active node. If another operator's correction landed in between,
       * the update matches zero rows, this throws, the whole transaction rolls back — including the
       * node it had already inserted — and the caller is told the version is stale. Two operators
       * can never both believe they superseded the same version.
       *
       * The token is SERVER-READ, never client-supplied: a browser's idea of the current version
       * must not decide whose correction survives.
       */
      let outcome: SupersedeOutcome | undefined;

      try {
        await db.transaction(async (tx) => {
          const current = await tx
            .select({
              factVersion: knowledgeFacts.factVersion,
              activeNodeId: knowledgeFacts.activeKnowledgeNodeId,
              factKey: knowledgeFacts.factKey,
              domainKey: knowledgeFacts.domainKey,
              scope: knowledgeFacts.knowledgeScope,
            })
            .from(knowledgeFacts)
            .where(and(eq(knowledgeFacts.id, factId), eq(knowledgeFacts.tenantId, actor.tenantId)))
            .limit(1);

          const fact = current[0];
          // Unknown, or another tenant's — indistinguishable, by design.
          if (!fact || !fact.activeNodeId) {
            outcome = { status: "unresolvable" };
            throw new SupersedeAbort();
          }

          // The active node must belong to the SAME tenant. A fact pointing across a tenant
          // boundary is corrupt, not a correction opportunity — fail closed rather than repair it.
          const priorRows = await tx
            .select({
              id: knowledgeNodes.id,
              knowledgeVersion: knowledgeNodes.knowledgeVersion,
              type: knowledgeNodes.type,
            })
            .from(knowledgeNodes)
            .where(
              and(eq(knowledgeNodes.id, fact.activeNodeId), eq(knowledgeNodes.tenantId, actor.tenantId)),
            )
            .limit(1);
          const prior = priorRows[0];
          if (!prior) {
            outcome = { status: "unresolvable" };
            throw new SupersedeAbort();
          }

          /*
           * THE OPERATOR'S PRECONDITION. The compare-and-swap below stops two SIMULTANEOUS
           * transactions; it cannot see the slower human case — a form opened against v2 and
           * submitted after someone else committed v3 would otherwise bury v3 under a correction
           * that never read it. Comparing the version the operator was shown catches exactly that,
           * and it can only ever REFUSE: the swap itself still uses the server-read version.
           */
          if (prior.knowledgeVersion !== input.observedKnowledgeVersion) {
            outcome = { status: "stale" };
            throw new SupersedeAbort();
          }

          const nextKnowledgeVersion = prior.knowledgeVersion + 1;
          const nextFactVersion = fact.factVersion + 1;

          const insertedRows = await tx
            .insert(knowledgeNodes)
            .values({
              tenantId: actor.tenantId,
              type: prior.type,
              label: input.title,
              statement: input.statement,
              domainKey: fact.domainKey,
              knowledgeScope: fact.scope,
              // A correction is not a ratification. Same honest standing as a creation.
              knowledgeLifecycleStatus: "draft",
              knowledgeAuthority: "provisional",
              knowledgeHealth: "unknown",
              knowledgeVersion: nextKnowledgeVersion,
              supersedesKnowledgeNodeId: prior.id,
              provenance: {
                origin: "human-authored",
                authoredThrough: "hebun-knowledge-workspace",
                submittedAt: now.toISOString(),
                textOriginUnverified: true,
                supersedes: prior.id,
              },
              createdBy: actor.userId,
              createdByType: "human",
              updatedBy: actor.userId,
              updatedByType: "human",
            })
            .returning({ id: knowledgeNodes.id });

          const newNodeId = insertedRows[0]?.id;
          if (!newNodeId) throw new Error("Knowledge node insert returned no id.");

          // THE COMPARE-AND-SWAP. Zero rows means someone else moved the selection first.
          const swapped = await tx
            .update(knowledgeFacts)
            .set({
              activeKnowledgeNodeId: newNodeId,
              previousKnowledgeNodeId: prior.id,
              factVersion: nextFactVersion,
              selectedAt: now,
              selectedByActorType: "human",
              selectedByActorId: actor.userId,
              updatedAt: now,
              updatedBy: actor.userId,
              updatedByType: "human",
            })
            .where(
              and(
                eq(knowledgeFacts.id, factId),
                eq(knowledgeFacts.tenantId, actor.tenantId),
                eq(knowledgeFacts.factVersion, fact.factVersion),
                eq(knowledgeFacts.activeKnowledgeNodeId, prior.id),
              ),
            )
            .returning({ id: knowledgeFacts.id });

          if (swapped.length !== 1) {
            outcome = { status: "stale" };
            throw new SupersedeAbort();
          }

          const identity: SupersededKnowledgeIdentity = {
            factId,
            factKey: fact.factKey,
            domainKey: fact.domainKey,
            scope: fact.scope,
            priorKnowledgeNodeId: prior.id,
            newKnowledgeNodeId: newNodeId,
            priorFactVersion: fact.factVersion,
            factVersion: nextFactVersion,
            priorKnowledgeVersion: prior.knowledgeVersion,
            knowledgeVersion: nextKnowledgeVersion,
          };

          // History joins the same transaction: committed-but-unaudited stays unrepresentable.
          await recordKnowledgeMutationWithin(
            tx,
            actor,
            {
              action: "knowledge.supersede",
              identity: { factId, factKey: fact.factKey, domainKey: fact.domainKey, scope: fact.scope },
              outcome: "committed",
              metadata: {
                factKey: fact.factKey,
                domainKey: fact.domainKey,
                scope: fact.scope,
                newKnowledgeNodeId: newNodeId,
                priorKnowledgeNodeId: prior.id,
                factVersion: nextFactVersion,
                knowledgeVersion: nextKnowledgeVersion,
                priorFactVersion: fact.factVersion,
                priorKnowledgeVersion: prior.knowledgeVersion,
              },
            },
            now,
          );

          outcome = { status: "superseded", identity };
        });
      } catch (error) {
        if (error instanceof SupersedeAbort) {
          // A deliberate abort. The transaction rolled back, so the node it inserted is gone.
          return outcome ?? { status: "failed", detail: "Knowledge supersession aborted." };
        }
        return {
          status: "failed",
          detail: error instanceof Error ? error.message : "Knowledge supersession failed.",
        };
      }

      return outcome ?? { status: "failed", detail: "Knowledge supersession produced no outcome." };
    },
  };
}

let singleton: DurableKnowledgeWriter | undefined;

export function getDurableKnowledgeWriter(): DurableKnowledgeWriter {
  if (!singleton) singleton = createDurableKnowledgeWriter(getControlPlaneDb());
  return singleton;
}

/** The production resolver: the durable writer when configured, or an honest `null` when not. */
export function resolveKnowledgeWriterOrNull(): DurableKnowledgeWriter | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getDurableKnowledgeWriter();
  } catch {
    return null;
  }
}
