/*
 * work-artifact-review/change-request.server.ts — CONTENT-AGENT-2. The Governance review standing on
 * a draft's CURRENT revision, read for one purpose: letting a human ask Heby to revise from it.
 *
 * A SEPARATE FILE FROM THE REVIEW WRITER ON PURPOSE. This read needs the draft's current-revision
 * pointer; the writer must never touch it (TRH-10 pins that), so the two do not share a file.
 *
 * ONE DERIVATION. "The latest decision on this revision" is answered by the released
 * `readArtifactRevisionReviewStates` and nothing else — this module adds only the pointer check and,
 * for a standing change request, the reason text of that exact decision.
 *
 * It writes nothing and authorizes nothing. Server-only.
 */
import { and, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { decisionRecords } from "@/db/schema/governance";
import { workArtifacts } from "@/db/schema/work-artifact";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { ARTIFACT_REVIEW_SUBJECT_TYPE, type CurrentRevisionChangeRequest } from "./contracts";
import { readArtifactRevisionReviewStates, resolveReviewDbOrNull, type ArtifactReviewDeps } from "./review-revision.server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Standing =
  | { readonly status: "requested"; readonly revisionId: string; readonly decisionId: string; readonly decidedAt: string | null }
  | { readonly status: "superseded" | "accepted" | "none" | "unavailable" };

/** The pointer and the latest decision, tenant-predicated. Shared by the read and the stale check. */
async function standingChangeRequest(
  db: ControlPlaneDatabase,
  tenant: TenantContext,
  artifactId: string,
  revisionNo: number,
): Promise<Standing> {
  let pointer: { currentRevision: number } | undefined;
  try {
    pointer = (
      await db
        .select({ currentRevision: workArtifacts.currentRevision })
        .from(workArtifacts)
        .where(and(eq(workArtifacts.tenantId, tenant.tenantId!), eq(workArtifacts.id, artifactId)))
        .limit(1)
    )[0];
  } catch {
    return { status: "unavailable" };
  }
  /* A foreign or unknown draft is "none" — the answer confirms nothing about another tenant. */
  if (!pointer) return { status: "none" };
  if (pointer.currentRevision !== revisionNo) return { status: "superseded" };
  const states = await readArtifactRevisionReviewStates(tenant, artifactId, { getDb: () => db });
  /* The reader answers [] on failure; a current revision always exists, so [] is unknown, not none. */
  if (states.length === 0) return { status: "unavailable" };
  const state = states.find((s) => s.revisionNo === revisionNo);
  if (!state || state.decision === null || !state.decisionId) return { status: "none" };
  if (state.decision === "accepted") return { status: "accepted" };
  return { status: "requested", revisionId: state.revisionId, decisionId: state.decisionId, decidedAt: state.decidedAt };
}

/** The standing change request on the CURRENT revision, with its reason — or why there is none. */
export async function readCurrentRevisionChangeRequest(
  tenant: TenantContext | null,
  input: { readonly artifactId: string; readonly revisionNo: number } | null,
  deps: ArtifactReviewDeps = {},
): Promise<CurrentRevisionChangeRequest> {
  if (!tenant?.tenantId) return { status: "none" };
  if (!input || !UUID.test(input.artifactId) || !Number.isSafeInteger(input.revisionNo) || input.revisionNo < 1) {
    return { status: "none" };
  }
  const db = (deps.getDb ?? resolveReviewDbOrNull)();
  if (!db) return { status: "unavailable" };
  /*
   * WHO MAY READ A REVIEW REASON. The reason is a Governance decision's own words, so it is shown
   * to the people who hold Governance in this tenant — the authority that decides reviews
   * (`resolveGovernanceAuthority`: the bootstrap human or an ACTIVE delegation), and no one else.
   * Asked before the draft is read at all. A role, a membership, or reaching /operations is not it.
   * The resolver fails closed: an unreadable ledger is "no authority".
   */
  const authority = await resolveGovernanceAuthority(tenant, { getDb: () => db });
  if (!authority.authorized) return { status: "not-authorized" };
  const standing = await standingChangeRequest(db, tenant, input.artifactId, input.revisionNo);
  if (standing.status !== "requested") return standing;
  try {
    const row = (
      await db
        .select({ justification: decisionRecords.justification })
        .from(decisionRecords)
        .where(
          and(
            eq(decisionRecords.tenantId, tenant.tenantId),
            eq(decisionRecords.id, standing.decisionId),
            eq(decisionRecords.subjectType, ARTIFACT_REVIEW_SUBJECT_TYPE),
          ),
        )
        .limit(1)
    )[0];
    if (!row?.justification) return { status: "unavailable" };
    return {
      status: "requested",
      artifactId: input.artifactId,
      revisionId: standing.revisionId,
      revisionNo: input.revisionNo,
      decisionId: standing.decisionId,
      decidedAt: standing.decidedAt,
      justification: row.justification,
    };
  } catch {
    return { status: "unavailable" };
  }
}

/**
 * May this reader revise FROM a review? Exactly the people who may READ its reason: a Governance
 * authority of this tenant (bootstrap or active delegation). Owned HERE, beside the read it mirrors,
 * so the preparation seam asks one yes/no question and never consults Governance itself (R3W).
 * Fails closed: an unreadable ledger is no authority.
 */
export async function mayReviseFromReview(db: ControlPlaneDatabase, tenant: TenantContext): Promise<boolean> {
  return (await resolveGovernanceAuthority(tenant, { getDb: () => db })).authorized;
}

/**
 * Is `decisionId` still the standing change request on revision `revisionNo` of this draft? Answers
 * only yes/no and never reads the reason text, so the preparation seam cannot turn it into input.
 * Called before the model (preflight) and again INSIDE the revision writer's artifact lock.
 * Anything it cannot establish is "no" — fail closed.
 */
export async function isReviewBasisCurrent(
  db: ControlPlaneDatabase,
  tenant: TenantContext,
  basis: { readonly artifactId: string; readonly revisionNo: number; readonly decisionId: string },
): Promise<boolean> {
  if (!tenant.tenantId || !UUID.test(basis.decisionId)) return false;
  const standing = await standingChangeRequest(db, tenant, basis.artifactId, basis.revisionNo);
  return standing.status === "requested" && standing.decisionId === basis.decisionId;
}
