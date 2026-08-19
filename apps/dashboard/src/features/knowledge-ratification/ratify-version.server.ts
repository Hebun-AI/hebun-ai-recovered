/*
 * knowledge-ratification/ratify-version.server.ts — binding a Governance decision to one exact
 * Knowledge version (K4).
 *
 * ONE TRANSACTION, OR NOTHING:
 *
 *   BEGIN
 *     1. resolve the authenticated human                    (server-side, durable session)
 *     2. resolve this tenant's Governance authority         (G2 bootstrap decision)
 *     3. resolve the exact Knowledge version                (tenant-scoped, locked FOR UPDATE)
 *     4. verify it is the fact's CURRENT version
 *     5. verify the operator reviewed THAT version          (observed-version precondition, K3)
 *     6. write the G2 ratify decision + its session         (subject = knowledge_node)
 *     7. bind decision/session/actor/time to that version   (predicated on still being unratified)
 *     8. append the Governance audit event                  (the decision happened)
 *     9. append the Knowledge audit event                   (Knowledge changed)
 *   COMMIT
 *
 * None of these can survive without the others. "Committed decision, failed binding", "ratified
 * Knowledge, missing decision" and "ratified Knowledge, missing audit" are excluded by the
 * transaction, not by hoping — every table involved lives in the same control-plane database, so
 * no distributed-transaction machinery was needed or invented.
 *
 * THE VERSION IS THE SUBJECT. G2's subject vocabulary names `knowledge_node`, so the decision
 * carries the version's own row id. A decision for v2 can never be read as a decision for v3,
 * because they are different rows with different ids — there is no "current version" indirection
 * anywhere in the binding.
 *
 * WHAT THIS MODULE CANNOT DO: it never edits a statement, a version number, an author, or a
 * supersession link; it never deletes anything; it never un-ratifies. Reversal is a Governance
 * decision type with no runtime.
 *
 * Server-only.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { knowledgeFacts } from "@/db/schema/knowledge-fact";
import { knowledgeNodes } from "@/db/schema/knowledge";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import { recordKnowledgeMutationWithin } from "@/features/governance-audit/knowledge-mutation-audit.server";
import { writeGovernanceDecisionWithin } from "@/features/governance-decision/decision-authority.server";
import { resolveGovernanceAuthority, type GovernanceAuthorityResolution } from "@/features/governance-decision/authority-read.server";
import { validateJustification } from "@/features/governance-decision/persistence.server";
import {
  RATIFICATION_SUBJECT_TYPE,
  type RatificationRefusal,
  type RatificationResult,
  type RejectionResult,
} from "./contracts";

export interface RatificationDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

export function resolveRatificationDbOrNull(): ControlPlaneDatabase | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/** Aborts the transaction when a governed rule refuses mid-flight. */
class RatificationAbort extends Error {
  constructor(readonly refusal: RatificationRefusal) {
    super(refusal);
    this.name = "RatificationAbort";
  }
}

interface ResolvedVersion {
  readonly factId: string;
  readonly factKey: string;
  readonly domainKey: string;
  readonly scope: string;
  readonly nodeId: string;
  readonly knowledgeVersion: number;
  readonly alreadyRatified: boolean;
}

/**
 * Resolve the exact version under review, inside the caller's transaction, and refuse anything that
 * is not the fact's CURRENT version.
 *
 * WHY ONLY THE CURRENT VERSION. K3 models correction as supersession: a new version replaces the
 * active one and the old one becomes history. Ratifying history would let an organization bless a
 * statement it has already replaced, and the read model would then show a ratified version nobody
 * is using. So a superseded version is refused — permanently. It was never ratified while it was
 * current, and that is now a historical fact rather than a pending decision.
 *
 * The row is locked FOR UPDATE so a concurrent supersession cannot slip between this read and the
 * binding below.
 */
async function resolveCurrentVersion(
  tx: ControlPlaneDatabase,
  tenantId: string,
  factId: string,
  knowledgeNodeId: string,
): Promise<ResolvedVersion> {
  const rows = await tx.execute(sql`
    select f.id            as fact_id,
           f.fact_key      as fact_key,
           f.domain_key    as domain_key,
           f.knowledge_scope as scope,
           f.active_knowledge_node_id as active_node_id,
           n.id            as node_id,
           n.knowledge_version as knowledge_version,
           (n.ratification_decision_id is not null) as already_ratified
      from public.knowledge_facts f
      join public.knowledge_nodes n
        on n.id = ${knowledgeNodeId}::uuid
       and n.tenant_id = f.tenant_id
     where f.id = ${factId}::uuid
       and f.tenant_id = ${tenantId}::uuid
     for update of n
  `);
  const row = rows.rows[0] as
    | {
        fact_id: string;
        fact_key: string;
        domain_key: string;
        scope: string;
        active_node_id: string | null;
        node_id: string;
        knowledge_version: number;
        already_ratified: boolean;
      }
    | undefined;

  // A wrong tenant, a wrong fact, or a node belonging to somebody else all land here, and are
  // indistinguishable from a record that never existed.
  if (!row) throw new RatificationAbort("version-unresolvable");
  if (row.active_node_id !== row.node_id) {
    throw new RatificationAbort("not-the-current-version");
  }
  return {
    factId: row.fact_id,
    factKey: row.fact_key,
    domainKey: row.domain_key,
    scope: row.scope,
    nodeId: row.node_id,
    knowledgeVersion: Number(row.knowledge_version),
    alreadyRatified: row.already_ratified,
  };
}

/** Shared preamble: authenticate, authorize, validate. Never touches the database. */
function guard(
  tenant: TenantContext | null,
  justification: string,
): { readonly refusal: RatificationRefusal } | { readonly justification: string } {
  if (typeof window !== "undefined") {
    throw new Error("Knowledge ratification is server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return { refusal: "unauthenticated" };
  const valid = validateJustification(justification);
  if (!valid) return { refusal: "justification-required" };
  return { justification: valid };
}

async function requireGovernanceAuthority(
  tenant: TenantContext,
  deps: RatificationDeps,
): Promise<GovernanceAuthorityResolution> {
  const authority = await resolveGovernanceAuthority(tenant, deps);
  if (!authority.bootstrapDecisionId) throw new RatificationAbort("no-governance-authority");
  /*
   * THE AUTHORIZATION LINE THAT MATTERS. Knowledge AUTHORSHIP and Governance AUTHORITY are
   * different things: K2 gates authoring on the owner/director role band, and that band grants
   * nothing here. Only the human established by the tenant's bootstrap decision may ratify — so a
   * prolific owner-band author with no Governance authority is refused, which a test proves.
   */
  if (!authority.authorized) throw new RatificationAbort("not-the-governance-authority");
  return authority;
}

/**
 * Ratify one exact Knowledge version under the tenant's Governance authority.
 *
 * The client names the record and the version it was SHOWN, and writes a justification. It cannot
 * supply the tenant, the actor, the decision, the session, the ratification timestamp, or the
 * ratifying actor — those are all resolved or generated server-side, and the type gives them no
 * parameter to arrive in.
 */
export async function ratifyKnowledgeVersion(
  tenant: TenantContext | null,
  input: {
    readonly factId: string;
    readonly knowledgeNodeId: string;
    /** The version the operator was shown. A precondition that can only cause a refusal. */
    readonly observedKnowledgeVersion: number;
    readonly justification: string;
  },
  deps: RatificationDeps = {},
): Promise<RatificationResult> {
  const guarded = guard(tenant, input?.justification ?? "");
  if ("refusal" in guarded) return { status: "refused", reason: guarded.refusal };
  const authenticated = tenant as TenantContext;

  const db = (deps.getDb ?? resolveRatificationDbOrNull)();
  if (!db) return { status: "refused", reason: "persistence-unavailable" };
  const now = (deps.now ?? (() => new Date()))();

  try {
    const authority = await requireGovernanceAuthority(authenticated, deps);

    let outcome: RatificationResult | null = null;

    await db.transaction(async (tx) => {
      const version = await resolveCurrentVersion(
        tx as unknown as ControlPlaneDatabase,
        authenticated.tenantId,
        input.factId,
        input.knowledgeNodeId,
      );

      /*
       * THE OPERATOR'S PRECONDITION (K3's lesson, applied to ratification). The compare-and-swap
       * below stops two SIMULTANEOUS transactions; it cannot see the slower human case — a review
       * opened against v2 and submitted after someone committed v3. Comparing the version the
       * operator was actually shown catches exactly that, and it can only ever REFUSE.
       */
      if (version.knowledgeVersion !== input.observedKnowledgeVersion) {
        throw new RatificationAbort("stale-review");
      }
      if (version.alreadyRatified) throw new RatificationAbort("already-ratified");

      // 6. The Governance decision, bound to the VERSION row — never to the fact.
      const decision = await writeGovernanceDecisionWithin(
        tx as unknown as ControlPlaneDatabase,
        authenticated,
        authority,
        {
          decisionType: "ratify",
          subjectType: RATIFICATION_SUBJECT_TYPE,
          subjectId: version.nodeId,
          justification: guarded.justification,
          evidence: {
            knowledgeFactId: version.factId,
            knowledgeVersion: version.knowledgeVersion,
          },
        },
        now,
      );

      /*
       * 7. THE BINDING. Predicated on the version still being unratified AND still carrying the
       * version number we read, so a concurrent ratification makes this update zero rows and the
       * abort below unwinds the decision with it.
       */
      const bound = await tx
        .update(knowledgeNodes)
        .set({
          ratificationDecisionId: decision.decisionId,
          governanceSessionId: decision.sessionId,
          ratifiedByActorType: "human",
          ratifiedByActorId: authenticated.userId,
          ratifiedAt: now,
          updatedAt: now,
          updatedBy: authenticated.userId,
          updatedByType: "human",
        })
        .where(
          and(
            eq(knowledgeNodes.id, version.nodeId),
            eq(knowledgeNodes.tenantId, authenticated.tenantId),
            eq(knowledgeNodes.knowledgeVersion, version.knowledgeVersion),
            isNull(knowledgeNodes.ratificationDecisionId),
          ),
        )
        .returning({ id: knowledgeNodes.id });

      if (bound.length === 0) throw new RatificationAbort("already-ratified");

      // 8. The Governance event: a decision was made.
      await recordGovernanceEventWithin(
        tx,
        {
          tenantId: authenticated.tenantId,
          userId: authenticated.userId,
          requestId: authenticated.requestId,
          sessionContextId: authenticated.sessionContextId,
        },
        {
          action: "governance.decision.recorded",
          outcome: "committed",
          entityId: decision.decisionId,
          metadata: {
            governanceSessionId: decision.sessionId,
            decisionType: "ratify",
            subjectType: RATIFICATION_SUBJECT_TYPE,
            subjectId: version.nodeId,
            bootstrap: false,
          },
        },
        now,
      );

      // 9. The Knowledge event: Knowledge changed. Different authority, different entity type.
      await recordKnowledgeMutationWithin(
        tx,
        {
          tenantId: authenticated.tenantId,
          userId: authenticated.userId,
          requestId: authenticated.requestId,
          sessionContextId: authenticated.sessionContextId,
        },
        {
          action: "knowledge.ratify",
          outcome: "committed",
          identity: {
            factId: version.factId,
            factKey: version.factKey,
            domainKey: version.domainKey,
            scope: version.scope,
          },
          metadata: {
            factKey: version.factKey,
            domainKey: version.domainKey,
            scope: version.scope,
            newKnowledgeNodeId: version.nodeId,
            knowledgeVersion: version.knowledgeVersion,
            ratificationDecisionId: decision.decisionId,
            governanceSessionId: decision.sessionId,
            previouslyRatified: false,
          },
        },
        now,
      );

      outcome = {
        status: "ratified",
        knowledgeNodeId: version.nodeId,
        knowledgeVersion: version.knowledgeVersion,
        decisionId: decision.decisionId,
        governanceSessionId: decision.sessionId,
        ratifiedAt: now.toISOString(),
      };
    });

    return outcome ?? { status: "refused", reason: "persistence-unavailable" };
  } catch (error) {
    if (error instanceof RatificationAbort) {
      return { status: "refused", reason: error.refusal };
    }
    return { status: "refused", reason: "persistence-unavailable" };
  }
}

/**
 * Record that Governance did NOT approve one exact version.
 *
 * THIS WRITES NOTHING TO KNOWLEDGE, and that is the design. There is no "rejected" column on
 * `knowledge_nodes`; the version stays exactly as authored, unratified, and fully visible in
 * history. Manufacturing a status mutation because `knowledge_lifecycle_status` happens to have
 * values would be inventing semantics the repository never defined — the same shortcut every
 * earlier phase in this chain refused.
 *
 * Only a Governance decision is created, so only the Governance audit domain records it.
 */
export async function rejectKnowledgeVersion(
  tenant: TenantContext | null,
  input: {
    readonly factId: string;
    readonly knowledgeNodeId: string;
    readonly observedKnowledgeVersion: number;
    readonly justification: string;
  },
  deps: RatificationDeps = {},
): Promise<RejectionResult> {
  const guarded = guard(tenant, input?.justification ?? "");
  if ("refusal" in guarded) return { status: "refused", reason: guarded.refusal };
  const authenticated = tenant as TenantContext;

  const db = (deps.getDb ?? resolveRatificationDbOrNull)();
  if (!db) return { status: "refused", reason: "persistence-unavailable" };
  const now = (deps.now ?? (() => new Date()))();

  try {
    const authority = await requireGovernanceAuthority(authenticated, deps);

    let outcome: RejectionResult | null = null;

    await db.transaction(async (tx) => {
      const version = await resolveCurrentVersion(
        tx as unknown as ControlPlaneDatabase,
        authenticated.tenantId,
        input.factId,
        input.knowledgeNodeId,
      );
      if (version.knowledgeVersion !== input.observedKnowledgeVersion) {
        throw new RatificationAbort("stale-review");
      }
      // A ratified version is settled; rejecting it afterwards would be a reversal, and reversal
      // is a Governance decision type with no runtime.
      if (version.alreadyRatified) throw new RatificationAbort("already-ratified");

      const decision = await writeGovernanceDecisionWithin(
        tx as unknown as ControlPlaneDatabase,
        authenticated,
        authority,
        {
          decisionType: "reject",
          subjectType: RATIFICATION_SUBJECT_TYPE,
          subjectId: version.nodeId,
          justification: guarded.justification,
          evidence: {
            knowledgeFactId: version.factId,
            knowledgeVersion: version.knowledgeVersion,
          },
        },
        now,
      );

      await recordGovernanceEventWithin(
        tx,
        {
          tenantId: authenticated.tenantId,
          userId: authenticated.userId,
          requestId: authenticated.requestId,
          sessionContextId: authenticated.sessionContextId,
        },
        {
          action: "governance.decision.recorded",
          outcome: "committed",
          entityId: decision.decisionId,
          metadata: {
            governanceSessionId: decision.sessionId,
            decisionType: "reject",
            subjectType: RATIFICATION_SUBJECT_TYPE,
            subjectId: version.nodeId,
            bootstrap: false,
          },
        },
        now,
      );

      outcome = {
        status: "rejected",
        knowledgeNodeId: version.nodeId,
        knowledgeVersion: version.knowledgeVersion,
        decisionId: decision.decisionId,
        governanceSessionId: decision.sessionId,
        decidedAt: now.toISOString(),
      };
    });

    return outcome ?? { status: "refused", reason: "persistence-unavailable" };
  } catch (error) {
    if (error instanceof RatificationAbort) {
      return { status: "refused", reason: error.refusal };
    }
    return { status: "refused", reason: "persistence-unavailable" };
  }
}

/** Re-exported so the Knowledge surface can read provenance without importing the schema. */
export { knowledgeFacts as knowledgeFactsTable };
