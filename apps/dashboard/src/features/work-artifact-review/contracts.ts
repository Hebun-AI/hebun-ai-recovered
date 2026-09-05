/*
 * work-artifact-review/contracts.ts — the typed vocabulary of Governance-backed artifact review
 * (TRH-10).
 *
 * THE CHAIN TRH-10 COMPLETES:
 *
 *   agent-authored revision      work_artifact_revisions, immutable bytes   (R3W, CGO-*, TRH-8)
 *          ↓
 *   human review                 a human holding G2 authority reads THOSE bytes
 *          ↓
 *   G2 approve / reject decision decision_records, subject = work_artifact_revision
 *          ↓
 *   derived review state         the latest decision for that exact revision   (HERE)
 *
 * WHAT "ACCEPTED" MEANS, EXACTLY: a human holding this organization's Governance authority judged
 * THIS EXACT REVISION fit for the next internal step. It does NOT mean the bytes are true, accurate,
 * safe, on-brand, or approved for publication — and nothing in Hebun may translate it into any of
 * those. It is an organizational judgement about prepared work, not a claim about the world and not
 * a permission to act.
 *
 * ── WHY THERE IS NO ROW TO MUTATE ────────────────────────────────────────────
 *
 * Review writes NOTHING to `work_artifacts` and NOTHING to `work_artifact_revisions`. No
 * `approved` column, no `accepted_revision` pointer, no lifecycle transition. The artifact
 * lifecycle stays `draft | retired` exactly as its enum declares, and the current review state is
 * DERIVED from the Governance ledger.
 *
 * That is not a shortcut, it is the only honest shape: a decision is a historical fact about bytes
 * a human read at a moment. A pointer on the artifact would have to be updated when a new revision
 * appears, and would then answer "is the artifact approved?" — a question nobody can ask
 * truthfully, because approval was never about the artifact.
 *
 *   CURRENT REVISION  != ACCEPTED REVISION
 *   REVIEW ACCEPTED   != PUBLICATION AUTHORIZED
 *   REVIEW REJECTED   != REVISION DELETED
 *
 * Pure types and frozen values. No React, no I/O, no database, no authority.
 */

/**
 * The G2 subject type an artifact-review decision must carry. A REVISION, never an artifact.
 *
 * `work_artifacts.id` is deliberately unusable here: it names a timeless identity whose current
 * revision changes, so a decision bound to it would silently mean "whatever bytes are current when
 * someone reads this". `work_artifact_revisions` carries its own uuid primary key, so the exact
 * immutable bytes a human read are nameable without a composite id. Same lesson K4 learned when
 * `knowledge_fact` was removed in favour of `knowledge_node`.
 */
export const ARTIFACT_REVIEW_SUBJECT_TYPE = "work_artifact_revision" as const;

/** The `governance_domain` an artifact-review decision belongs to. */
export const ARTIFACT_REVIEW_DOMAIN = "artifact-review" as const;

/**
 * The two decision types, both already in the released `governance_decision_type` enum.
 *
 * NO NEW DECISION WORDS. `approve` and `reject` exist and mean what is needed; inventing
 * `accept-for-internal-step` would add a word to a constitutional vocabulary to make one surface
 * read better, which is exactly what the enum's own discipline refuses.
 */
export const ARTIFACT_REVIEW_ACCEPT_TYPE = "approve" as const;
export const ARTIFACT_REVIEW_REJECT_TYPE = "reject" as const;

/**
 * The ledger words.
 *
 * `artifact-revision-accepted` and NOT `approved`, for the reason SIA-3 chose `-accepted` over
 * `approved` for a hypothesis: a row read years from now must not suggest that anything was
 * published, executed or made true. What a human accepted is A REVISION, for A NEXT INTERNAL STEP.
 */
export const ARTIFACT_REVIEW_ACCEPTED_OUTCOME = "artifact-revision-accepted" as const;
export const ARTIFACT_REVIEW_REJECTED_OUTCOME = "artifact-revision-changes-requested" as const;

/** What accepting a revision does, and what it cannot. Values, not prose, so a test can assert them. */
export const ARTIFACT_REVIEW_ACCEPT_EFFECT =
  "records that this organization's Governance authority judged this exact revision fit for the next internal step";

export const ARTIFACT_REVIEW_ACCEPT_NON_EFFECTS: readonly string[] = Object.freeze([
  "does not authorize publication, sending, or any external act",
  "does not mint a permit or make anything executable",
  "does not make the content true, accurate, or verified",
  "does not apply to any other revision of this artifact",
  "does not change the artifact, its bytes, or which revision is current",
  "does not become organizational Knowledge",
]);

/**
 * Rejection, stated so nobody expects a deletion or an automatic rewrite.
 *
 * A reject decision records that Governance did not accept THIS revision. It does NOT delete it,
 * alter its bytes, mark it false, or create a replacement — the revision stays exactly as authored
 * and fully readable in history. **Nothing in this feature creates a revision**, so "request
 * changes" is a judgement, never a trigger: a new revision appears only when a human runs the
 * preparation act again.
 */
export const ARTIFACT_REVIEW_REJECT_EFFECT =
  "records that Governance did not accept this revision and asks for changes. The revision is unchanged and remains readable";

export const ARTIFACT_REVIEW_REJECT_NON_EFFECTS: readonly string[] = Object.freeze([
  "does not delete the revision or any revision of this artifact",
  "does not change the bytes",
  "does not create a new revision",
  "does not retire the artifact",
]);

/**
 * The sentence the surface must show before either decision, and a test asserts is present.
 *
 * The confusion this exists to prevent is the expensive one: a human clicking a button labelled
 * only "Approve" on a draft addressed to Instagram would reasonably believe they had approved it
 * for Instagram.
 */
export const ARTIFACT_REVIEW_PUBLICATION_NOTICE =
  "Content acceptance is not publication authorization. Accepting this revision authorizes no " +
  "external act: publishing it would need its own action request, its own Governance decision and " +
  "its own permit, and no provider is connected.";

/**
 * The version-scoping notice, mirroring K4's. A reviewer must not believe they blessed the artifact.
 */
export const ARTIFACT_REVIEW_REVISION_SCOPE_NOTICE =
  "This decision applies only to the displayed revision. A later revision is unreviewed and will " +
  "require its own decision; this one stays in the ledger as what was decided about these bytes.";

/**
 * APPEND-ONLY, AND REVERSAL IS A NEW DECISION.
 *
 * Nothing here updates or deletes a prior decision. Accepting a revision that was rejected, or
 * rejecting one that was accepted, records a SECOND decision — both stay in the ledger, and the
 * derived current state is simply the latest one. A mutable approval row would have destroyed the
 * evidence that an organization changed its mind, which is often the useful part.
 */
export const ARTIFACT_REVIEW_HISTORY_IS_APPEND_ONLY = Object.freeze({
  priorDecisionsMutated: false as const,
  priorDecisionsDeleted: false as const,
  reversalRecordedAsNewDecision: true as const,
  currentStateDerivedFromLatest: true as const,
});

/** Why a review attempt ended the way it did. A closed set — no free-text excuses. */
export type ArtifactReviewRefusal =
  /** No authenticated session, so there is no tenant and no actor. */
  | "unauthenticated"
  /** The tenant has no bootstrap decision, so no Governance authority exists yet. */
  | "no-governance-authority"
  /** Authenticated — possibly the artifact's own author — but not the Governance authority. */
  | "not-the-governance-authority"
  /**
   * The artifact, or the named revision, does not exist inside this tenant, or the revision does
   * not belong to the named artifact. ONE reason for all three: a caller must not be able to use
   * refusals to discover what exists in another organization.
   */
  | "revision-unresolvable"
  | "justification-required"
  | "persistence-unavailable";

export type ArtifactReviewDecision = "accepted" | "changes-requested";

export type ArtifactReviewResult =
  | {
      readonly status: "reviewed";
      readonly decision: ArtifactReviewDecision;
      readonly artifactId: string;
      readonly revisionId: string;
      readonly revisionNo: number;
      readonly decisionId: string;
      readonly governanceSessionId: string;
      readonly decidedAt: string;
    }
  | { readonly status: "refused"; readonly reason: ArtifactReviewRefusal };

/**
 * The derived review state of one revision, for reads.
 *
 * Deliberately ABSENT: score, confidence, quality, readiness percentage, "publishable". None of
 * those exists, and an accepted revision is not a verified one.
 */
export interface ArtifactRevisionReviewState {
  readonly revisionId: string;
  readonly revisionNo: number;
  /** `null` when no decision has ever been recorded for this exact revision. */
  readonly decision: ArtifactReviewDecision | null;
  readonly decidedAt: string | null;
  readonly decisionId: string | null;
  /** How many decisions this revision has accumulated. Append-only history is visible, not hidden. */
  readonly decisionCount: number;
}
