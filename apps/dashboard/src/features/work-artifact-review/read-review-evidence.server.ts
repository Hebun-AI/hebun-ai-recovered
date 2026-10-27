/*
 * work-artifact-review/read-review-evidence.server.ts — GOVERNANCE-DECISION-EVIDENCE-READ-1.
 *
 * What a Governance authority may read back, after the fact, about the review decisions recorded on
 * ONE revision: the stored decision row (who, when, why, under whose authority), the evidence the
 * review writer bound into it (artifact, revision number, content digest), and the audit events
 * filed under that decision's id.
 *
 * WHY A SEPARATE READER AND NOT A WIDER REVIEW STATE. `readCurrentRevisionReviewStates` feeds the
 * /approvals page payload and an /operations server action for anyone who reaches those surfaces.
 * Adding a justification or an actor id there would hand a Governance decision's own words to people
 * who do not hold Governance. This reader is asked for one revision, on demand, and answers only a
 * Governance authority — the same rule `readCurrentRevisionChangeRequest` already applies to a
 * reason text.
 *
 * ORDER OF QUESTIONS. Authority first: `not-authorized` is decided before any artifact, revision or
 * decision is read, so it reveals nothing. Then the revision inside the session's tenant; a foreign
 * or unknown one is `not-found`. Only then the decisions on that exact revision row.
 *
 * NOTHING IS INFERRED. Evidence fields are reported as recorded, absent or malformed. A digest
 * comparison is made only between the digest the decision recorded and the revision's stored
 * `content_digest`. Audit linkage is by tenant, entity type and entity id — a timestamp is never
 * treated as a relationship.
 *
 * It writes nothing, authorizes nothing and imports no writer. Server-only.
 */
import { and, desc, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { decisionRecords } from "@/db/schema/governance";
import { workArtifactRevisions } from "@/db/schema/work-artifact";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { readGovernanceHistory } from "@/features/governance-audit/governance-decision-audit.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { isArtifactContentDigest } from "@/features/work-artifacts/content-digest";
import {
  ARTIFACT_REVIEW_ACCEPTED_OUTCOME,
  ARTIFACT_REVIEW_REJECTED_OUTCOME,
  ARTIFACT_REVIEW_SUBJECT_TYPE,
  type ReviewAuditLinkage,
  type ReviewDecisionAudit,
  type ReviewDecisionEvidence,
  type ReviewDigestComparison,
  type ReviewEvidenceField,
  type RevisionReviewEvidence,
} from "./contracts";
import { resolveReviewDbOrNull } from "./read-revision-review-states.server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The action the review writer files with every review decision (`review-revision.server.ts`). */
export const REVIEW_DECISION_AUDIT_ACTION = "governance.decision.recorded" as const;

/** Upper bound on audit events read per decision. The writer files one; more is itself the finding. */
const AUDIT_EVENTS_PER_DECISION = 10;

export interface ReviewEvidenceDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

/** Shape check for a client-supplied target. Anything else never reaches a query. */
export function isReviewEvidenceTarget(
  input: unknown,
): input is { readonly artifactId: string; readonly revisionNo: number } {
  if (!input || typeof input !== "object") return false;
  const { artifactId, revisionNo } = input as Record<string, unknown>;
  return (
    typeof artifactId === "string" &&
    UUID.test(artifactId) &&
    typeof revisionNo === "number" &&
    Number.isSafeInteger(revisionNo) &&
    revisionNo >= 1
  );
}

function evidenceObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function field<T>(
  evidence: Record<string, unknown> | null,
  key: string,
  valid: (value: unknown) => value is T,
): ReviewEvidenceField<T> {
  if (!evidence || !(key in evidence) || evidence[key] === undefined || evidence[key] === null) {
    return { status: "absent" };
  }
  const value = evidence[key];
  return valid(value) ? { status: "recorded", value } : { status: "malformed" };
}

const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
const isRevisionNo = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 1;

/** Recorded digest vs the stored one. Absent or malformed is `not-recorded` — never a match. */
export function compareRecordedDigest(
  recorded: ReviewEvidenceField<string>,
  stored: string,
): ReviewDigestComparison {
  if (recorded.status !== "recorded") return "not-recorded";
  return recorded.value === stored ? "match" : "mismatch";
}

/** How the events filed under one decision id relate to it. All events are always returned. */
export function classifyAuditLinkage(actions: readonly string[]): ReviewAuditLinkage {
  if (actions.length === 0) return "missing";
  if (actions.length > 1) return "multiple";
  return actions[0] === REVIEW_DECISION_AUDIT_ACTION ? "linked" : "unexpected-action";
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function decisionWord(outcome: string): ReviewDecisionEvidence["decision"] {
  if (outcome === ARTIFACT_REVIEW_ACCEPTED_OUTCOME) return "accepted";
  if (outcome === ARTIFACT_REVIEW_REJECTED_OUTCOME) return "changes-requested";
  return null;
}

async function readDecisionAudit(
  db: ControlPlaneDatabase,
  tenant: TenantContext,
  decisionId: string,
): Promise<ReviewDecisionAudit> {
  const history = await readGovernanceHistory(
    { tenantId: tenant.tenantId! },
    { getDb: () => db, entityId: decisionId, limit: AUDIT_EVENTS_PER_DECISION },
  );
  if (history.status !== "read") return { status: "unavailable" };
  /* The filter is an equality in the reader's own predicate; re-checked so a widened reader cannot
   * silently attach another decision's event to this one. */
  const records = history.records.filter((record) => record.entityId === decisionId);
  if (records.length !== history.records.length) return { status: "unavailable" };
  return {
    status: "read",
    linkage: classifyAuditLinkage(records.map((record) => record.action)),
    expectedAction: REVIEW_DECISION_AUDIT_ACTION,
    records,
  };
}

/**
 * The recorded review decisions on revision `revisionNo` of one draft, with their evidence and audit
 * events — for a Governance authority of the session's tenant only.
 */
export async function readRevisionReviewEvidence(
  tenant: TenantContext | null,
  target: unknown,
  deps: ReviewEvidenceDeps = {},
): Promise<RevisionReviewEvidence> {
  if (typeof window !== "undefined") throw new Error("Review evidence reads are server-only.");
  if (!tenant?.tenantId || !tenant.userId) return { status: "not-authorized" };
  const db = (deps.getDb ?? resolveReviewDbOrNull)();
  /* No store: nothing can be read, authority included. Says nothing about any record. */
  if (!db) return { status: "unavailable" };

  /* The resolver fails closed: a ledger it cannot read is "no authority", never an exception. */
  const authority = await resolveGovernanceAuthority(tenant, { getDb: () => db });
  if (!authority.authorized) return { status: "not-authorized" };
  if (!isReviewEvidenceTarget(target)) return { status: "not-found" };

  try {
    const revision = (
      await db
        .select({
          id: workArtifactRevisions.id,
          artifactId: workArtifactRevisions.artifactId,
          revisionNo: workArtifactRevisions.revisionNo,
          contentDigest: workArtifactRevisions.contentDigest,
        })
        .from(workArtifactRevisions)
        .where(
          and(
            eq(workArtifactRevisions.tenantId, tenant.tenantId),
            eq(workArtifactRevisions.artifactId, target.artifactId),
            eq(workArtifactRevisions.revisionNo, target.revisionNo),
          ),
        )
        .limit(1)
    )[0];
    if (!revision) return { status: "not-found" };
    /* The schema CHECK guarantees this; a stored value of another shape is not something to compare. */
    if (!isArtifactContentDigest(revision.contentDigest)) return { status: "unavailable" };

    const rows = await db
      .select({
        id: decisionRecords.id,
        decisionType: decisionRecords.decisionType,
        outcome: decisionRecords.outcome,
        decidedAt: decisionRecords.decidedAt,
        actorType: decisionRecords.actorType,
        actorId: decisionRecords.actorId,
        authoritySourceActorType: decisionRecords.authoritySourceActorType,
        authoritySourceActorId: decisionRecords.authoritySourceActorId,
        justification: decisionRecords.justification,
        evidence: decisionRecords.evidence,
      })
      .from(decisionRecords)
      .where(
        and(
          eq(decisionRecords.tenantId, tenant.tenantId),
          eq(decisionRecords.subjectType, ARTIFACT_REVIEW_SUBJECT_TYPE),
          eq(decisionRecords.subjectId, revision.id),
        ),
      )
      .orderBy(desc(decisionRecords.decidedAt), desc(decisionRecords.id));

    const decisions: ReviewDecisionEvidence[] = [];
    for (const row of rows) {
      const evidence = evidenceObject(row.evidence);
      const recordedContentDigest = field(evidence, "contentDigest", isArtifactContentDigest);
      decisions.push({
        decisionId: row.id,
        decisionType: row.decisionType,
        outcome: row.outcome,
        decision: decisionWord(row.outcome),
        decidedAt: toIso(row.decidedAt),
        actorType: row.actorType,
        actorId: row.actorId,
        authoritySourceActorType: row.authoritySourceActorType ?? null,
        authoritySourceActorId: row.authoritySourceActorId ?? null,
        justification: row.justification,
        recordedArtifactId: field(evidence, "workArtifactId", isUuid),
        recordedRevisionNo: field(evidence, "revisionNo", isRevisionNo),
        recordedContentDigest,
        digestComparison: compareRecordedDigest(recordedContentDigest, revision.contentDigest),
        audit: await readDecisionAudit(db, tenant, row.id),
      });
    }

    return {
      status: "read",
      artifactId: revision.artifactId,
      revisionId: revision.id,
      revisionNo: revision.revisionNo,
      storedContentDigest: revision.contentDigest,
      decisions,
    };
  } catch {
    return { status: "unavailable" };
  }
}
