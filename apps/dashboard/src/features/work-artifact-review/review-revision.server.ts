/*
 * work-artifact-review/review-revision.server.ts — binding a Governance decision to one exact,
 * immutable work-artifact revision (TRH-10).
 *
 * ONE TRANSACTION, OR NOTHING:
 *
 *   BEGIN
 *     1. resolve the authenticated human                 (server-side, durable session)
 *     2. resolve this tenant's Governance authority      (G2 bootstrap decision)
 *     3. resolve the exact revision                      (tenant-scoped AND artifact-scoped)
 *     4. write the G2 approve/reject decision + session  (subject = work_artifact_revision)
 *     5. append the Governance audit event               (the decision happened)
 *   COMMIT
 *
 * ── WHAT THIS MODULE DOES NOT DO, AND CANNOT ─────────────────────────────────
 *
 * It never writes to `work_artifacts` or `work_artifact_revisions`. It imports the revision schema
 * to READ, and imports no artifact writer at all, so "review edited the bytes" and "review moved
 * current_revision" are unavailable rather than merely unwritten. It creates no revision, no work
 * item, no action request, no permit and no execution attempt; it touches no provider and no
 * Knowledge. There is no update, no delete, and no un-review: reversal is a NEW decision.
 *
 * ── WHY THERE IS NO `already-reviewed` REFUSAL ───────────────────────────────
 *
 * K4 refuses a second ratification because ratification BINDS to a column that can only be set
 * once. Review binds to nothing, so a second decision is not a conflict — it is an organization
 * changing its mind, and the ledger is the right place for that. Both decisions persist; the
 * derived state is the latest. Refusing here would have destroyed the evidence rather than
 * protecting anything.
 *
 * Server-only.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { decisionRecords } from "@/db/schema/governance";
import { workArtifactRevisions } from "@/db/schema/work-artifact";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import { writeGovernanceDecisionWithin } from "@/features/governance-decision/decision-authority.server";
import {
  resolveGovernanceAuthority,
  type GovernanceAuthorityResolution,
} from "@/features/governance-decision/authority-read.server";
import { validateJustification } from "@/features/governance-decision/persistence.server";
import {
  ARTIFACT_REVIEW_ACCEPTED_OUTCOME,
  ARTIFACT_REVIEW_ACCEPT_TYPE,
  ARTIFACT_REVIEW_REJECTED_OUTCOME,
  ARTIFACT_REVIEW_REJECT_TYPE,
  ARTIFACT_REVIEW_SUBJECT_TYPE,
  type ArtifactRevisionReviewState,
  type ArtifactReviewDecision,
  type ArtifactReviewRefusal,
  type ArtifactReviewResult,
} from "./contracts";

export interface ArtifactReviewDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

export function resolveReviewDbOrNull(): ControlPlaneDatabase | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/** Aborts the transaction when a governed rule refuses mid-flight. */
class ReviewAbort extends Error {
  constructor(readonly refusal: ArtifactReviewRefusal) {
    super(refusal);
    this.name = "ReviewAbort";
  }
}

/** Shared preamble: authenticate and validate. Never touches the database. */
function guard(
  tenant: TenantContext | null,
  justification: string,
): { readonly refusal: ArtifactReviewRefusal } | { readonly justification: string } {
  if (typeof window !== "undefined") {
    throw new Error("Work artifact review is server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return { refusal: "unauthenticated" };
  const valid = validateJustification(justification);
  if (!valid) return { refusal: "justification-required" };
  return { justification: valid };
}

async function requireGovernanceAuthority(
  tenant: TenantContext,
  deps: ArtifactReviewDeps,
): Promise<GovernanceAuthorityResolution> {
  const authority = await resolveGovernanceAuthority(tenant, deps);
  if (!authority.bootstrapDecisionId) throw new ReviewAbort("no-governance-authority");
  /*
   * THE AUTHORIZATION LINE THAT MATTERS. Preparing an artifact and deciding about it are different
   * authorities: preparation is gated on the Knowledge/work authoring band, and that band grants
   * nothing here. Only the human established by the tenant's bootstrap decision may review — so the
   * author of a draft, if they are not the Governance authority, is refused.
   */
  if (!authority.authorized) throw new ReviewAbort("not-the-governance-authority");
  return authority;
}

interface ResolvedRevision {
  readonly revisionId: string;
  readonly revisionNo: number;
  readonly artifactId: string;
  readonly contentDigest: string;
}

/**
 * THE SECOND SERVER-SIDE EXISTENCE CHECK the Governance subject vocabulary promised.
 *
 * Predicated on tenant AND artifact together. A revision from another tenant, a revision id that
 * belongs to a different artifact, and an id that never existed all return nothing — one
 * indistinguishable refusal, so refusals cannot be used to discover what another organization holds.
 */
async function resolveRevision(
  tx: ControlPlaneDatabase,
  tenantId: string,
  artifactId: string,
  revisionId: string,
): Promise<ResolvedRevision> {
  const rows = await tx
    .select({
      revisionId: workArtifactRevisions.id,
      revisionNo: workArtifactRevisions.revisionNo,
      artifactId: workArtifactRevisions.artifactId,
      contentDigest: workArtifactRevisions.contentDigest,
    })
    .from(workArtifactRevisions)
    .where(
      and(
        eq(workArtifactRevisions.id, revisionId),
        eq(workArtifactRevisions.artifactId, artifactId),
        eq(workArtifactRevisions.tenantId, tenantId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) throw new ReviewAbort("revision-unresolvable");
  return row;
}

async function review(
  tenant: TenantContext | null,
  input: {
    readonly artifactId: string;
    readonly revisionId: string;
    readonly justification: string;
  },
  decision: ArtifactReviewDecision,
  deps: ArtifactReviewDeps,
): Promise<ArtifactReviewResult> {
  const guarded = guard(tenant, input?.justification ?? "");
  if ("refusal" in guarded) return { status: "refused", reason: guarded.refusal };
  const authenticated = tenant as TenantContext;

  const db = (deps.getDb ?? resolveReviewDbOrNull)();
  if (!db) return { status: "refused", reason: "persistence-unavailable" };
  const now = (deps.now ?? (() => new Date()))();

  const accepted = decision === "accepted";
  const decisionType = accepted ? ARTIFACT_REVIEW_ACCEPT_TYPE : ARTIFACT_REVIEW_REJECT_TYPE;

  try {
    const authority = await requireGovernanceAuthority(authenticated, deps);
    let outcome: ArtifactReviewResult | null = null;

    await db.transaction(async (tx) => {
      const revision = await resolveRevision(
        tx as unknown as ControlPlaneDatabase,
        authenticated.tenantId,
        input.artifactId,
        input.revisionId,
      );

      /*
       * The decision, bound to the REVISION row — never to the artifact. `contentDigest` rides in
       * the evidence so the ledger records WHICH BYTES were judged: a reader years later can prove
       * the reviewed text is the text still stored, without trusting the revision ordinal alone.
       */
      const written = await writeGovernanceDecisionWithin(
        tx as unknown as ControlPlaneDatabase,
        authenticated,
        authority,
        {
          decisionType,
          subjectType: ARTIFACT_REVIEW_SUBJECT_TYPE,
          subjectId: revision.revisionId,
          justification: guarded.justification,
          evidence: {
            workArtifactId: revision.artifactId,
            revisionNo: revision.revisionNo,
            contentDigest: revision.contentDigest,
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
          entityId: written.decisionId,
          metadata: {
            governanceSessionId: written.sessionId,
            decisionType,
            subjectType: ARTIFACT_REVIEW_SUBJECT_TYPE,
            subjectId: revision.revisionId,
            bootstrap: false,
          },
        },
        now,
      );

      outcome = {
        status: "reviewed",
        decision,
        artifactId: revision.artifactId,
        revisionId: revision.revisionId,
        revisionNo: revision.revisionNo,
        decisionId: written.decisionId,
        governanceSessionId: written.sessionId,
        decidedAt: now.toISOString(),
      };
    });

    return outcome ?? { status: "refused", reason: "persistence-unavailable" };
  } catch (error) {
    if (error instanceof ReviewAbort) return { status: "refused", reason: error.refusal };
    return { status: "refused", reason: "persistence-unavailable" };
  }
}

/**
 * ACCEPT one exact revision for the next internal step, under the tenant's Governance authority.
 *
 * The client names the artifact, the revision it was SHOWN, and writes a justification. It cannot
 * supply the tenant, the actor, the decision, the session, the outcome or the timestamp — those are
 * resolved or generated server-side, and the type gives them no parameter to arrive in.
 */
export async function acceptArtifactRevision(
  tenant: TenantContext | null,
  input: { readonly artifactId: string; readonly revisionId: string; readonly justification: string },
  deps: ArtifactReviewDeps = {},
): Promise<ArtifactReviewResult> {
  return review(tenant, input, "accepted", deps);
}

/**
 * RECORD that Governance did not accept one exact revision, and asks for changes.
 *
 * THIS WRITES NOTHING TO THE ARTIFACT, and that is the design — the same shape K4 chose for
 * rejection. There is no `rejected` column on a revision; the bytes stay exactly as authored and
 * fully readable. **It creates no replacement revision:** requesting changes is a judgement, and a
 * new revision appears only when a human runs the preparation act again.
 */
export async function requestArtifactRevisionChanges(
  tenant: TenantContext | null,
  input: { readonly artifactId: string; readonly revisionId: string; readonly justification: string },
  deps: ArtifactReviewDeps = {},
): Promise<ArtifactReviewResult> {
  return review(tenant, input, "changes-requested", deps);
}

/**
 * The DERIVED review state of the revisions of one artifact — read from the Governance ledger, not
 * from any column on the artifact.
 *
 * "Current" means the LATEST decision for that exact revision, by `decided_at`. Earlier decisions
 * are not hidden: `decisionCount` reports how many exist, so a reader can see that an organization
 * reversed itself rather than being shown only the answer.
 */
export async function readArtifactRevisionReviewStates(
  tenant: TenantContext | null,
  artifactId: string,
  deps: ArtifactReviewDeps = {},
): Promise<readonly ArtifactRevisionReviewState[]> {
  if (!tenant?.tenantId) return [];
  const db = (deps.getDb ?? resolveReviewDbOrNull)();
  if (!db) return [];

  try {
    const revisions = await db
      .select({ id: workArtifactRevisions.id, revisionNo: workArtifactRevisions.revisionNo })
      .from(workArtifactRevisions)
      .where(
        and(
          eq(workArtifactRevisions.artifactId, artifactId),
          eq(workArtifactRevisions.tenantId, tenant.tenantId),
        ),
      )
      .orderBy(desc(workArtifactRevisions.revisionNo));
    if (revisions.length === 0) return [];

    const decisions = await db
      .select({
        subjectId: decisionRecords.subjectId,
        decisionId: decisionRecords.id,
        outcome: decisionRecords.outcome,
        decidedAt: decisionRecords.decidedAt,
      })
      .from(decisionRecords)
      .where(
        and(
          eq(decisionRecords.tenantId, tenant.tenantId),
          eq(decisionRecords.subjectType, ARTIFACT_REVIEW_SUBJECT_TYPE),
          sql`${decisionRecords.subjectId} in ${revisions.map((r) => r.id)}`,
        ),
      )
      .orderBy(desc(decisionRecords.decidedAt));

    return revisions.map((revision) => {
      const mine = decisions.filter((d) => d.subjectId === revision.id);
      const latest = mine[0];
      return {
        revisionId: revision.id,
        revisionNo: revision.revisionNo,
        decision: latest
          ? latest.outcome === ARTIFACT_REVIEW_ACCEPTED_OUTCOME
            ? ("accepted" as const)
            : latest.outcome === ARTIFACT_REVIEW_REJECTED_OUTCOME
              ? ("changes-requested" as const)
              : null
          : null,
        decidedAt: latest?.decidedAt ? new Date(latest.decidedAt).toISOString() : null,
        decisionId: latest?.decisionId ?? null,
        decisionCount: mine.length,
      };
    });
  } catch {
    return [];
  }
}
