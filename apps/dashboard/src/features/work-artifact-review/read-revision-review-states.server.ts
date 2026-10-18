/*
 * work-artifact-review/read-revision-review-states.server.ts — the derived review state of a work
 * artifact's revisions, read from the Governance ledger (TRH-10, CGO-8).
 *
 * WHY THIS IS ITS OWN MODULE (SUITE-RECOVERY-1, RC-A): Heby's content package read (HEBY-MEDIA-1)
 * needs revision review state. While this reader lived in `review-revision.server.ts`, Heby's answer
 * graph reached the module that records the review decision, and through it the Governance decision
 * writer — what the G6C authority-reachability firewall forbids. The reader, its DB resolver and the
 * one shared derivation moved here verbatim; `review-revision.server.ts` imports and re-exports them,
 * so every existing caller and the CGO-8 batched reader are unchanged. This module imports no
 * Governance writer and no audit writer, and it must stay that way.
 *
 * Server-only.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { decisionRecords } from "@/db/schema/governance";
import { workArtifactRevisions } from "@/db/schema/work-artifact";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  ARTIFACT_REVIEW_ACCEPTED_OUTCOME,
  ARTIFACT_REVIEW_REJECTED_OUTCOME,
  ARTIFACT_REVIEW_SUBJECT_TYPE,
  type ArtifactRevisionReviewState,
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

    return deriveReviewStates(revisions, decisions);
  } catch {
    return [];
  }
}

export interface RevisionRow {
  readonly id: string;
  readonly revisionNo: number;
}

export interface DecisionRow {
  readonly subjectId: string | null;
  readonly decisionId: string;
  readonly outcome: string | null;
  readonly decidedAt: Date | string | null;
}

/**
 * THE ONE DERIVATION. Both readers call it, so "the current review state of a revision" cannot mean
 * two things. `decisions` must be ordered newest-first; the latest decision for a revision wins and
 * every earlier one is still counted.
 */
export function deriveReviewStates(
  revisions: readonly RevisionRow[],
  decisions: readonly DecisionRow[],
): readonly ArtifactRevisionReviewState[] {
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
}
