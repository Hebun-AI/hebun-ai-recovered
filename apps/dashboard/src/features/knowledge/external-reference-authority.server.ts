/*
 * knowledge/external-reference-authority.server.ts — KR-EXT1. THE ATTACH/WITHDRAW SEAM.
 *
 * ── WHAT IT OWNS ─────────────────────────────────────────────────────────────
 *
 * One sentence, and its withdrawal: "this organization declares that this Knowledge fact concerns
 * this external-system record." Nothing else.
 *
 * ── WHAT IT STRUCTURALLY CANNOT DO ───────────────────────────────────────────
 *
 * IT CONTACTS NO PROVIDER. It imports no transport, no provider read, no credential accessor and no
 * `fetch`. Recording a reference is an organizational declaration, and the Director's decision is
 * explicit that it is not a provider verification — so the write succeeds while GitHub is down, and
 * a reference may name a record that is unreachable or gone. That is honest, and the read seam says
 * so rather than implying currency.
 *
 * IT WRITES NO KNOWLEDGE CONTENT. It imports no Knowledge writer and touches neither
 * `knowledge_nodes` nor `knowledge_facts` — K3's immutability is untouched, and a fact's wording,
 * version, lineage, standing and ratification are all exactly as they were.
 *
 * IT MOVES NO INTEGRATION. No connection is created, verified, held or ended; no capability state
 * changes. Withdrawing a reference removes an organizational declaration and touches nothing on the
 * provider's side, which is why the word is *withdraw* and not *delete*.
 *
 * IT DECIDES NO GOVERNANCE. It mints no permit and records no decision. Governance continues to
 * address `knowledge_node`, and this table does not appear in `GOVERNANCE_SUBJECT_TYPES`.
 *
 * ── AUTHORITY IS BORROWED, NOT INVENTED ──────────────────────────────────────
 *
 * `resolveKnowledgeWriteAuthority` already decides who may establish organizational Knowledge for a
 * tenant, server-side and fail-closed. Declaring what a fact is ABOUT is an act of the same kind, so
 * it reuses that authority unchanged. KR-EXT1 introduces no second authorization model, and adding
 * a band is still a decision made in that module rather than here.
 *
 * ── A HUMAN DECLARED IT, ENFORCED BY THE DATABASE ────────────────────────────
 *
 * `declared_by_type` is written `human` and a CHECK constraint refuses anything else. "The model may
 * never author this relationship" is therefore a property of the schema, not of a code path
 * somebody could edit.
 *
 * Server-only.
 */
import { and, eq, isNull } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { knowledgeExternalReferences } from "@/db/schema/knowledge-external-reference";
import { knowledgeFacts } from "@/db/schema/knowledge-fact";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  validateExternalSystemReference,
  type ExternalReferenceRefusal,
  type RecordedExternalReference,
} from "./external-reference-contracts";
import { resolveKnowledgeWriteAuthority } from "./knowledge-write-authority.server";

export interface ExternalReferenceDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  /** Injected so the whole seam is provable without a role row. Production leaves it unset. */
  readonly resolveAuthority?: (tenant: TenantContext) => Promise<{ readonly authorized: boolean }>;
}

export type AttachExternalReferenceResult =
  | { readonly status: "declared"; readonly reference: RecordedExternalReference }
  | { readonly status: "refused"; readonly reason: ExternalReferenceRefusal };

export type WithdrawExternalReferenceResult =
  | { readonly status: "withdrawn" }
  | { readonly status: "refused"; readonly reason: ExternalReferenceRefusal };

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Knowledge external references are server-only.");
  }
}

function resolveDbOrNull(deps: ExternalReferenceDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

const iso = (value: Date | null): string => (value ? value.toISOString() : "");

/**
 * DECLARE that a Knowledge fact concerns an external-system record.
 *
 * The tenant comes from an already-resolved server-side context. There is no parameter for a tenant
 * id, an actor, a provider account or a credential — a caller cannot name another organization,
 * because no field exists through which to name one.
 */
export async function attachExternalReference(
  tenant: TenantContext | null,
  input: { readonly knowledgeFactId: string; readonly reference: unknown },
  deps: ExternalReferenceDeps = {},
): Promise<AttachExternalReferenceResult> {
  assertServerOnly();

  if (!tenant?.tenantId || !tenant.userId) {
    return { status: "refused", reason: "no-authorized-tenant-context" };
  }

  /* 1 · THE EXISTING KNOWLEDGE AUTHORITY DECIDES. Fail-closed, before anything is read or written. */
  const authority = await (deps.resolveAuthority ?? resolveKnowledgeWriteAuthority)(tenant);
  if (!authority.authorized) return { status: "refused", reason: "not-authorized" };

  /* 2 · A CLOSED, VALIDATED IDENTITY. Whitespace and over-long values are refused, never trimmed. */
  const validated = validateExternalSystemReference(input.reference);
  if (!validated.ok) return { status: "refused", reason: "malformed-reference" };
  const reference = validated.reference;

  const db = resolveDbOrNull(deps);
  if (!db) return { status: "refused", reason: "authority-unavailable" };

  try {
    /*
     * 3 · THE FACT MUST BE THIS TENANT'S. The composite foreign key would refuse a foreign fact on
     * its own, and this read is what turns that refusal into an answer a person can act on rather
     * than a constraint violation. The predicate carries the tenant, so a fact belonging to another
     * organization is NOT FOUND rather than forbidden — the two are indistinguishable to a caller,
     * which is what stops this seam being used to discover that a fact exists elsewhere.
     */
    const owned = await db
      .select({ id: knowledgeFacts.id })
      .from(knowledgeFacts)
      .where(and(eq(knowledgeFacts.id, input.knowledgeFactId), eq(knowledgeFacts.tenantId, tenant.tenantId)))
      .limit(1);
    if (owned.length === 0) return { status: "refused", reason: "knowledge-fact-not-found" };

    /*
     * 4 · DECLARE IT. `declared_by_type` is 'human' and the database refuses anything else, so the
     * model cannot be the author of this row even through a hand-crafted insert.
     *
     * `onConflictDoNothing` targets the PARTIAL unique index, so a repeat declaration of a live
     * association writes nothing and is reported as already declared — with no check-then-insert
     * race, and without consuming the earlier record.
     */
    const inserted = await db
      .insert(knowledgeExternalReferences)
      .values({
        tenantId: tenant.tenantId,
        knowledgeFactId: input.knowledgeFactId,
        providerKey: reference.providerKey,
        capability: reference.capability,
        recordType: reference.recordType,
        recordId: reference.recordId,
        declaredBy: tenant.userId,
        declaredByType: "human",
      })
      .onConflictDoNothing()
      .returning({
        referenceId: knowledgeExternalReferences.id,
        declaredAt: knowledgeExternalReferences.declaredAt,
      });

    if (inserted.length === 0) return { status: "refused", reason: "already-declared" };

    return {
      status: "declared",
      reference: {
        referenceId: inserted[0]!.referenceId,
        declaredAt: iso(inserted[0]!.declaredAt),
        ...reference,
      },
    };
  } catch {
    return { status: "refused", reason: "authority-unavailable" };
  }
}

/**
 * WITHDRAW a declaration.
 *
 * It means exactly one thing: the organization no longer declares this association. It deletes no
 * provider data, disconnects no integration, moves no provider lifecycle, retracts no Knowledge and
 * changes no Governance decision — this module imports nothing that could do any of those.
 *
 * The row is not deleted. Somebody declared this on a date and somebody ended it on another, and
 * this repository does not tidy such records away; the partial unique index is what lets the same
 * association be declared again later without destroying the record that it once ended.
 */
export async function withdrawExternalReference(
  tenant: TenantContext | null,
  input: { readonly referenceId: string },
  deps: ExternalReferenceDeps = {},
): Promise<WithdrawExternalReferenceResult> {
  assertServerOnly();

  if (!tenant?.tenantId || !tenant.userId) {
    return { status: "refused", reason: "no-authorized-tenant-context" };
  }

  const authority = await (deps.resolveAuthority ?? resolveKnowledgeWriteAuthority)(tenant);
  if (!authority.authorized) return { status: "refused", reason: "not-authorized" };

  const db = resolveDbOrNull(deps);
  if (!db) return { status: "refused", reason: "authority-unavailable" };

  try {
    /*
     * TENANT-SCOPED AND LIVE-ONLY. The tenant predicate makes another organization's reference
     * unreachable, and `withdrawnAt is null` makes withdrawing an already-withdrawn one a no-op
     * rather than a second, contradictory record of the same ending.
     */
    const updated = await db
      .update(knowledgeExternalReferences)
      .set({
        withdrawnAt: new Date(),
        withdrawnBy: tenant.userId,
        withdrawnByType: "human",
      })
      .where(
        and(
          eq(knowledgeExternalReferences.id, input.referenceId),
          eq(knowledgeExternalReferences.tenantId, tenant.tenantId),
          isNull(knowledgeExternalReferences.withdrawnAt),
        ),
      )
      .returning({ id: knowledgeExternalReferences.id });

    if (updated.length === 0) return { status: "refused", reason: "reference-not-found" };
    return { status: "withdrawn" };
  } catch {
    return { status: "refused", reason: "authority-unavailable" };
  }
}

/**
 * READ the live declarations for one Knowledge fact.
 *
 * NO PROVIDER IS CONTACTED. What comes back is what somebody recorded, not what the provider holds
 * now — a reference may name a record that has been renamed, transferred, or removed, and this read
 * cannot and does not tell the difference.
 */
export async function listExternalReferences(
  tenant: TenantContext | null,
  knowledgeFactId: string,
  deps: ExternalReferenceDeps = {},
): Promise<readonly RecordedExternalReference[]> {
  assertServerOnly();
  if (!tenant?.tenantId) return [];

  const db = resolveDbOrNull(deps);
  if (!db) return [];

  try {
    const rows = await db
      .select({
        referenceId: knowledgeExternalReferences.id,
        providerKey: knowledgeExternalReferences.providerKey,
        capability: knowledgeExternalReferences.capability,
        recordType: knowledgeExternalReferences.recordType,
        recordId: knowledgeExternalReferences.recordId,
        declaredAt: knowledgeExternalReferences.declaredAt,
      })
      .from(knowledgeExternalReferences)
      .where(
        and(
          eq(knowledgeExternalReferences.knowledgeFactId, knowledgeFactId),
          eq(knowledgeExternalReferences.tenantId, tenant.tenantId),
          isNull(knowledgeExternalReferences.withdrawnAt),
        ),
      );

    return rows.map((row) =>
      Object.freeze({
        referenceId: row.referenceId,
        providerKey: row.providerKey,
        capability: row.capability,
        recordType: row.recordType,
        recordId: row.recordId,
        declaredAt: iso(row.declaredAt),
      }),
    );
  } catch {
    return [];
  }
}

/*
 * THE REVERSE LOOKUP MOVED, AND IS RE-EXPORTED RATHER THAN REIMPLEMENTED (INT-5C).
 *
 * `findKnowledgeFactForExternalRecord` now lives in `external-reference-read.server.ts`, a module
 * with no write authority in it, so a consumer that only wants to ASK whether a declaration exists
 * no longer has to import the module that can also create and withdraw one.
 *
 * It is re-exported here because this module is where KR-EXT1's callers already look, and because
 * forking the query would leave two definitions of one security-relevant predicate. There is still
 * exactly ONE implementation in this repository — this line names it, it does not copy it.
 */
export { findKnowledgeFactForExternalRecord } from "./external-reference-read.server";
