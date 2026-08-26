/*
 * knowledge/external-reference-read.server.ts — INT-5C. THE WRITER-FREE READ SIDE OF KR-EXT1.
 *
 * ── WHY THIS MODULE EXISTS AT ALL ────────────────────────────────────────────
 *
 * `external-reference-authority.server.ts` owns declaring and withdrawing a reference, and it
 * imports `resolveKnowledgeWriteAuthority` to do it. Any consumer that wanted only to ASK whether a
 * declaration exists had to import the module that can also create and withdraw one — so a read
 * seam would have carried Knowledge write authority into whatever graph consumed it.
 *
 * That is the exact shape INT-5B1 removed on the GitHub side. `github-authorized-call` used to take
 * `listConnections` from the module that also exports seven lifecycle writers, and the repair was
 * not a comment — it was a writer-free read module (`integration-authority/integration-read.server.ts`)
 * that the provider-read firewall now positively asserts is in the graph. This module is that same
 * arrangement for Knowledge external references.
 *
 * THE QUERY IS NOT FORKED. `findKnowledgeFactForExternalRecord` moved here whole and the authority
 * re-imports it, so this repository still holds exactly ONE implementation of "which fact concerns
 * this record?". A security predicate that exists twice will eventually disagree with itself.
 *
 * ── WHAT IT STRUCTURALLY CANNOT DO ───────────────────────────────────────────
 *
 * It imports no Knowledge writer, no Governance writer, no integration lifecycle writer, no
 * credential accessor, no provider transport, no action authority and no model client. It performs
 * one `select` and returns. There is no code path here that mutates anything.
 *
 * ── ABSENCE AND FAILURE ARE DIFFERENT ANSWERS ────────────────────────────────
 *
 * The seam this replaces returned `string | null` and swallowed its own errors, so "no human ever
 * declared this" and "the database did not answer" were the SAME value. That is tolerable while
 * nothing reads it. The moment a surface says *"this repository has no recorded Knowledge"* to an
 * operator, collapsing those two makes Hebun claim an organizational absence it never established.
 *
 * So the batched read returns an explicit outcome: `resolved` carries the declarations it found and
 * licenses an absence claim about every id that was asked for; `unavailable` carries a reason and
 * licenses NO claim about any of them.
 *
 * Server-only.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { knowledgeExternalReferences } from "@/db/schema/knowledge-external-reference";
import { knowledgeFacts } from "@/db/schema/knowledge-fact";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { ExternalSystemReference } from "./external-reference-contracts";

/**
 * How many record ids one batched lookup may carry.
 *
 * It is deliberately the same number as the provider page ceiling it serves, and it is stated here
 * rather than imported from the command so this module stays free of the Heby graph. A caller that
 * asks for more is REFUSED rather than silently truncated — truncation would turn "we did not ask"
 * into "no declaration exists", which is the one confusion this module exists to prevent.
 */
export const MAX_EXTERNAL_RECORD_LOOKUP = 50;

export interface ExternalReferenceReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

/** What a single declared relationship says. Identity only — no fact wording is read. */
export interface DeclaredKnowledgeRelationship {
  /** The provider's own record id this declaration was recorded against. */
  readonly recordId: string;
  readonly knowledgeFactId: string;
  /** The fact's stable key, so an operator sees WHICH knowledge rather than a bare uuid. */
  readonly factKey: string;
  readonly domainKey: string;
  /**
   * Whether the fact currently points at an active Knowledge node.
   *
   * A statement about the fact's own registry row, and NOT a judgement about the provider record:
   * it says nothing about whether the repository still exists, is healthy, or has changed.
   */
  readonly hasActiveKnowledgeNode: boolean;
}

export type ExternalReferenceLookupRefusal =
  /** No server-side tenant context. Nothing was read and nothing may be claimed. */
  | "no-tenant"
  /** The control-plane database was not reachable from this process. */
  | "no-database"
  /** More ids than one batched lookup may carry. Nothing was read; nothing was truncated. */
  | "too-many-records"
  /** The query itself failed. The organization's declarations are UNKNOWN, not absent. */
  | "query-failed";

/**
 * The outcome of asking about a whole set of provider records at once.
 *
 * `resolved` is the ONLY value that licenses saying "no declaration was recorded" about an id that
 * is missing from `declarations` — because it means the query ran, over exactly those ids, and the
 * answer came back.
 */
export type ExternalReferenceLookup =
  | {
      readonly status: "resolved";
      /** Only the ids that HAVE a live declaration appear. Absence here is a real absence. */
      readonly declarations: readonly DeclaredKnowledgeRelationship[];
      /** Exactly the ids that were asked about, so a caller cannot claim beyond what it queried. */
      readonly queried: readonly string[];
    }
  | { readonly status: "unavailable"; readonly reason: ExternalReferenceLookupRefusal };

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Knowledge external references are server-only.");
  }
}

function resolveDbOrNull(deps: ExternalReferenceReadDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * THE JOIN KR-EXT1 EXISTS FOR: which Knowledge fact concerns this external record?
 *
 * Exact, deterministic, and computed entirely in SQL over the provider's own immutable identifier.
 * No model is involved, no free text is compared, and no association is guessed — the answer is a
 * declaration a human recorded, or nothing at all.
 *
 * The tenant predicate is what makes two organizations able to reference the SAME external record
 * without either one seeing the other's declaration.
 *
 * KEPT AS IT WAS, INCLUDING ITS NULL. This is the single-record seam KR-EXT1 released; it is moved
 * here unchanged so the module boundary is the only thing that shifted. New callers that must tell
 * absence from failure use `findKnowledgeRelationshipsForExternalRecords` below.
 */
export async function findKnowledgeFactForExternalRecord(
  tenant: TenantContext | null,
  reference: ExternalSystemReference,
  deps: ExternalReferenceReadDeps = {},
): Promise<string | null> {
  assertServerOnly();
  if (!tenant?.tenantId) return null;

  const db = resolveDbOrNull(deps);
  if (!db) return null;

  try {
    const rows = await db
      .select({ knowledgeFactId: knowledgeExternalReferences.knowledgeFactId })
      .from(knowledgeExternalReferences)
      .where(
        and(
          eq(knowledgeExternalReferences.tenantId, tenant.tenantId),
          eq(knowledgeExternalReferences.providerKey, reference.providerKey),
          eq(knowledgeExternalReferences.capability, reference.capability),
          eq(knowledgeExternalReferences.recordType, reference.recordType),
          eq(knowledgeExternalReferences.recordId, reference.recordId),
          isNull(knowledgeExternalReferences.withdrawnAt),
        ),
      )
      .limit(1);

    return rows.length > 0 ? rows[0]!.knowledgeFactId : null;
  } catch {
    return null;
  }
}

/**
 * THE BATCHED JOIN — one round trip for a whole provider page.
 *
 * ── WHY BATCHED, AND NOT ONE QUERY PER RECORD ────────────────────────────────
 *
 * A provider page carries up to fifty repositories. Fifty sequential lookups would make the cost of
 * answering one question scale with a number the provider chooses, and would give a slow database
 * fifty chances to turn a complete answer into a partial one. The predicate is identical for every
 * id apart from `record_id`, so one `IN` list answers all of them under the same tenant clause and
 * the same live-declaration clause.
 *
 * `knowledge_external_references_record_fact_uidx` — `(tenant_id, provider_key, capability,
 * record_type, record_id, knowledge_fact_id) WHERE withdrawn_at IS NULL` — is exactly this access
 * path. KR-EXT1 authored it for this direction; INT-5C is the first reader to use it.
 *
 * ── THE TENANT PREDICATE IS NOT OPTIONAL ─────────────────────────────────────
 *
 * `tenant` is a resolved server context, never a client field. Two organizations may both declare
 * against repository `1300480452`, and neither can see the other's declaration, because the tenant
 * equality is part of the same `and(...)` as the record identity rather than a filter applied after.
 *
 * IT IS ASSERTED TWICE, AND THAT IS DEFENCE IN DEPTH RATHER THAN A REDUNDANT LINE. The `where`
 * clause scopes the declarations, and the join to `knowledge_facts` scopes the facts. INT-5C's
 * bite-proof measured this: removing EITHER predicate alone leaves the query correctly tenant-scoped,
 * and only removing BOTH makes it cross-tenant. A reader tempted to delete one as duplication should
 * know it is load-bearing the moment the other is ever refactored.
 *
 * ── THE FACT JOIN READS IDENTITY, NEVER CONTENT ──────────────────────────────
 *
 * `knowledge_facts` contributes `fact_key`, `domain_key` and whether an active node is set. No node
 * is read, so no Knowledge WORDING crosses this seam — the caller learns that a relationship exists
 * and which fact holds it, never what the fact says. K3 immutability is untouched: this is a
 * `select`.
 */
export async function findKnowledgeRelationshipsForExternalRecords(
  tenant: TenantContext | null,
  reference: Omit<ExternalSystemReference, "recordId">,
  recordIds: readonly string[],
  deps: ExternalReferenceReadDeps = {},
): Promise<ExternalReferenceLookup> {
  assertServerOnly();

  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-tenant" };

  /*
   * ASKING ABOUT NOTHING IS A RESOLVED ANSWER ABOUT NOTHING. It is not a failure, and it licenses
   * no absence claim either, because `queried` is empty.
   */
  const queried = Object.freeze([...new Set(recordIds)]);
  if (queried.length === 0) {
    return { status: "resolved", declarations: Object.freeze([]), queried };
  }
  if (queried.length > MAX_EXTERNAL_RECORD_LOOKUP) {
    return { status: "unavailable", reason: "too-many-records" };
  }

  const db = resolveDbOrNull(deps);
  if (!db) return { status: "unavailable", reason: "no-database" };

  try {
    const rows = await db
      .select({
        recordId: knowledgeExternalReferences.recordId,
        knowledgeFactId: knowledgeExternalReferences.knowledgeFactId,
        factKey: knowledgeFacts.factKey,
        domainKey: knowledgeFacts.domainKey,
        activeKnowledgeNodeId: knowledgeFacts.activeKnowledgeNodeId,
      })
      .from(knowledgeExternalReferences)
      .innerJoin(
        knowledgeFacts,
        and(
          eq(knowledgeFacts.id, knowledgeExternalReferences.knowledgeFactId),
          /*
           * THE FACT MUST BELONG TO THE SAME TENANT AS THE DECLARATION. The composite foreign key
           * `(knowledge_fact_id, tenant_id)` already guarantees it, and this restates the guarantee
           * in the join so the query cannot become cross-tenant if that key is ever relaxed.
           */
          eq(knowledgeFacts.tenantId, tenant.tenantId),
        ),
      )
      .where(
        and(
          eq(knowledgeExternalReferences.tenantId, tenant.tenantId),
          eq(knowledgeExternalReferences.providerKey, reference.providerKey),
          eq(knowledgeExternalReferences.capability, reference.capability),
          eq(knowledgeExternalReferences.recordType, reference.recordType),
          inArray(knowledgeExternalReferences.recordId, [...queried]),
          isNull(knowledgeExternalReferences.withdrawnAt),
        ),
      );

    const declarations = rows.map((row) =>
      Object.freeze({
        recordId: row.recordId,
        knowledgeFactId: row.knowledgeFactId,
        factKey: row.factKey,
        domainKey: row.domainKey,
        hasActiveKnowledgeNode: row.activeKnowledgeNodeId !== null,
      }),
    );

    return { status: "resolved", declarations: Object.freeze(declarations), queried };
  } catch {
    /*
     * THE ERROR IS NOT SWALLOWED INTO AN EMPTY RESULT. Returning `[]` here would let a caller print
     * "no declaration recorded" for every repository in the page on the strength of a failed query.
     */
    return { status: "unavailable", reason: "query-failed" };
  }
}
