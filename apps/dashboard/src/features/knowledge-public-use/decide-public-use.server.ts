/*
 * knowledge-public-use/decide-public-use.server.ts — recording whether ONE EXACT Knowledge version
 * may be used as public factual grounding (KT-3). Server-only.
 *
 * ONE TRANSACTION, OR NOTHING:
 *
 *   BEGIN
 *     1. resolve the authenticated human and this tenant's Governance authority
 *     2. resolve the exact version, tenant-scoped, locked FOR UPDATE — it must be the fact's CURRENT one
 *     3. verify the operator decided about THAT version          (observed-version precondition)
 *     4. refuse a version Governance rejected as untrue
 *     5. read its current use state from Governance's ledger and validate the transition
 *     6. write the decision through the one Governance writer    (subject = knowledge_public_use)
 *     7. append the Governance audit event
 *   COMMIT
 *
 * It writes NOTHING to Knowledge: no column on `knowledge_nodes`, no Knowledge audit event. The state
 * lives in the ledger and is read back by `knowledge-public-use-read.server.ts`. Truth is not touched:
 * a use decision neither requires nor implies ratification.
 *
 * The row lock in step 2 is what makes step 5 safe: a concurrent decision on the same version waits,
 * then sees the decision this one recorded, so the ledger never holds two contradictory successors.
 */
import { sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import { writeGovernanceDecisionWithin } from "@/features/governance-decision/decision-authority.server";
import {
  resolveGovernanceAuthority,
  type GovernanceAuthorityResolution,
} from "@/features/governance-decision/authority-read.server";
import { isKnowledgeVersionRejectedWithin } from "@/features/governance-decision/knowledge-rejection-read.server";
import { readKnowledgePublicUseStateWithin } from "@/features/governance-decision/knowledge-public-use-read.server";
import { validateJustification } from "@/features/governance-decision/persistence.server";
import {
  PUBLIC_USE_ACTIONS,
  PUBLIC_USE_DECISION_TYPE,
  PUBLIC_USE_SUBJECT_TYPE,
  nextPublicUseState,
  type PublicUseAction,
  type PublicUseDecisionResult,
  type PublicUseRefusal,
} from "./contracts";

export interface PublicUseDecisionDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

function resolveDbOrNull(): ControlPlaneDatabase | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

class PublicUseAbort extends Error {
  constructor(readonly refusal: PublicUseRefusal) {
    super(refusal);
    this.name = "PublicUseAbort";
  }
}

async function resolveCurrentVersion(
  tx: ControlPlaneDatabase,
  tenantId: string,
  factId: string,
  knowledgeNodeId: string,
): Promise<{ readonly nodeId: string; readonly factId: string; readonly knowledgeVersion: number }> {
  const rows = await tx.execute(sql`
    select f.id as fact_id,
           f.active_knowledge_node_id as active_node_id,
           n.id as node_id,
           n.knowledge_version as knowledge_version
      from public.knowledge_facts f
      join public.knowledge_nodes n
        on n.id = ${knowledgeNodeId}::uuid
       and n.tenant_id = f.tenant_id
     where f.id = ${factId}::uuid
       and f.tenant_id = ${tenantId}::uuid
     for update of n
  `);
  const row = rows.rows[0] as
    | { fact_id: string; active_node_id: string | null; node_id: string; knowledge_version: number }
    | undefined;
  if (!row) throw new PublicUseAbort("version-unresolvable");
  if (row.active_node_id !== row.node_id) throw new PublicUseAbort("not-the-current-version");
  return { nodeId: row.node_id, factId: row.fact_id, knowledgeVersion: Number(row.knowledge_version) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Allow, deny or revoke public factual use of one exact current version.
 *
 * The client names the fact, the version row and the version number it was shown, the action and a
 * justification. Tenant, actor, decision type, outcome and time are all resolved here.
 */
export async function decideKnowledgePublicUse(
  tenant: TenantContext | null,
  input: {
    readonly factId: string;
    readonly knowledgeNodeId: string;
    readonly observedKnowledgeVersion: number;
    readonly action: PublicUseAction;
    readonly justification: string;
  },
  deps: PublicUseDecisionDeps = {},
): Promise<PublicUseDecisionResult> {
  if (typeof window !== "undefined") throw new Error("Public-use decisions are server-only.");
  if (!tenant?.tenantId || !tenant.userId) return { status: "refused", reason: "unauthenticated" };
  const justification = validateJustification(input?.justification ?? "");
  if (!justification) return { status: "refused", reason: "justification-required" };
  if (!PUBLIC_USE_ACTIONS.includes(input?.action)) return { status: "refused", reason: "invalid-transition" };
  if (!UUID.test(input?.factId ?? "") || !UUID.test(input?.knowledgeNodeId ?? "")) {
    return { status: "refused", reason: "version-unresolvable" };
  }
  const db = (deps.getDb ?? resolveDbOrNull)();
  if (!db) return { status: "refused", reason: "persistence-unavailable" };
  const now = (deps.now ?? (() => new Date()))();

  try {
    const authority: GovernanceAuthorityResolution = await resolveGovernanceAuthority(tenant, deps);
    if (!authority.bootstrapDecisionId) return { status: "refused", reason: "no-governance-authority" };
    if (!authority.authorized) return { status: "refused", reason: "not-the-governance-authority" };

    let result: PublicUseDecisionResult | null = null;
    await db.transaction(async (tx) => {
      const handle = tx as unknown as ControlPlaneDatabase;
      const version = await resolveCurrentVersion(handle, tenant.tenantId, input.factId, input.knowledgeNodeId);
      if (version.knowledgeVersion !== input.observedKnowledgeVersion) throw new PublicUseAbort("stale-review");
      if (await isKnowledgeVersionRejectedWithin(handle, tenant.tenantId, version.nodeId)) {
        throw new PublicUseAbort("truth-rejected");
      }
      const current = await readKnowledgePublicUseStateWithin(handle, tenant.tenantId, version.nodeId);
      const next = nextPublicUseState(current, input.action);
      if (next === null || next === "unknown") throw new PublicUseAbort("invalid-transition");

      const decisionType = PUBLIC_USE_DECISION_TYPE[input.action];
      const decision = await writeGovernanceDecisionWithin(
        handle,
        tenant,
        authority,
        {
          decisionType,
          subjectType: PUBLIC_USE_SUBJECT_TYPE,
          subjectId: version.nodeId,
          justification,
          evidence: {
            knowledgeFactId: version.factId,
            knowledgeVersion: version.knowledgeVersion,
            publicUseFrom: current,
            publicUseTo: next,
          },
        },
        now,
      );
      await recordGovernanceEventWithin(
        tx,
        {
          tenantId: tenant.tenantId,
          userId: tenant.userId,
          requestId: tenant.requestId,
          sessionContextId: tenant.sessionContextId,
        },
        {
          action: "governance.decision.recorded",
          outcome: "committed",
          entityId: decision.decisionId,
          metadata: {
            governanceSessionId: decision.sessionId,
            decisionType,
            subjectType: PUBLIC_USE_SUBJECT_TYPE,
            subjectId: version.nodeId,
            bootstrap: false,
          },
        },
        now,
      );
      result = {
        status: "decided",
        knowledgeNodeId: version.nodeId,
        knowledgeVersion: version.knowledgeVersion,
        state: next,
        decisionId: decision.decisionId,
        decidedAt: now.toISOString(),
      };
    });
    return result ?? { status: "refused", reason: "persistence-unavailable" };
  } catch (error) {
    if (error instanceof PublicUseAbort) return { status: "refused", reason: error.refusal };
    return { status: "refused", reason: "persistence-unavailable" };
  }
}
