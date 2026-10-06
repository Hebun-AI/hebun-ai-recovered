/*
 * secure-content-admissibility/knowledge-facts.server.ts — the Knowledge → SCI fact composition.
 *
 * It owns no truth. Knowledge answers for the version (active, in force, integrity, the decision id
 * the row claims); Governance answers for the decision. The row's claim counts as ratified only when
 * Governance holds a `ratify` decision with exactly that id for exactly that version in this tenant.
 * Either reader failing makes the whole read UNAVAILABLE — never "not ratified", never "eligible".
 *
 * READ ONLY. Server-only. Nothing consumes this yet (WF-3 is not wired).
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  readKnowledgeVersionStanding,
  type KnowledgeVersionStandingDeps,
} from "@/features/knowledge/version-standing.server";
import {
  readKnowledgeRatificationDecisions,
  type KnowledgeRatificationReadDeps,
} from "@/features/governance-decision/knowledge-ratification-read.server";
import type { AdmissibilityFactsRead } from "./evaluate";

export interface KnowledgeAdmissibilityFactsDeps {
  readonly knowledge?: KnowledgeVersionStandingDeps;
  readonly governance?: KnowledgeRatificationReadDeps;
}

/** The claim counts only if Governance names the same decision. */
export function ratificationVerified(
  claimedDecisionId: string | null,
  governanceRatifyDecisionIds: ReadonlySet<string>,
): boolean {
  return claimedDecisionId !== null && governanceRatifyDecisionIds.has(claimedDecisionId);
}

export async function readKnowledgeAdmissibilityFacts(
  tenant: Pick<TenantContext, "tenantId"> | null,
  knowledgeNodeId: string,
  now: Date,
  deps: KnowledgeAdmissibilityFactsDeps = {},
): Promise<AdmissibilityFactsRead> {
  const read = await readKnowledgeVersionStanding(tenant, knowledgeNodeId, now, deps.knowledge);
  if (read.status !== "read") return { status: "unavailable" };
  const standing = read.standing;
  // Not a version of the trusted tenant (or none at all): the evaluator answers tenant-mismatch.
  if (!standing) {
    return {
      status: "read",
      facts: {
        contentClass: "knowledge",
        versionId: knowledgeNodeId,
        ownerTenantId: "",
        activeAndInForce: false,
        ratified: false,
        integrityFromCreation: false,
      },
    };
  }

  let ratified = false;
  if (standing.claimedRatificationDecisionId !== null) {
    const decisions = await readKnowledgeRatificationDecisions(tenant, standing.knowledgeNodeId, deps.governance);
    if (decisions.status !== "read") return { status: "unavailable" };
    ratified = ratificationVerified(standing.claimedRatificationDecisionId, decisions.ratifyDecisionIds);
  }

  return {
    status: "read",
    facts: {
      contentClass: "knowledge",
      versionId: standing.knowledgeNodeId,
      ownerTenantId: standing.tenantId,
      activeAndInForce: standing.activeAndInForce,
      ratified,
      integrityFromCreation: standing.integrityProtectedAtInsert === true,
    },
  };
}
