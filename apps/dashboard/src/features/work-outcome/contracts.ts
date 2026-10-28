/*
 * work-outcome/contracts.ts — WORK-OUTCOME-CLOSURE-1: what the records say about a work item's
 * outcome, and when Hebun may SUGGEST that a person declare it complete. Pure.
 *
 * ── THREE AUTHORITIES, NONE OF THEM HERE ─────────────────────────────────────
 *
 *   the work item and its declared state            Organizational Work (WORK-1, WORK-UPDATE V1)
 *   the drafts the work declares as its evidence    Organizational Work (WEV-1) → Work Artifacts
 *   the Governance review of each current revision  Governance (TRH-10, derived from the ledger)
 *
 * This module owns no state and decides nothing. It reads three answers the owners already gave and
 * says whether ALL of them line up. The suggestion is advice to a person; the declaration is the
 * Work Authority's existing human act (`setWorkDeclaredState`), under the authority it already asks.
 *
 *     REVIEW ACCEPTED      != WORK COMPLETE
 *     DECLARED COMPLETE    != VERIFIED
 *     REVIEW ACCEPTED      != PUBLICATION, SENDING OR EXECUTION AUTHORIZED
 *     SUGGESTION OFFERED   != DECLARATION MADE
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────────
 *
 * A suggestion is offered only when every one of these holds:
 *   - the work item is in service and its declared state is known and not `complete`;
 *   - the evidence read answered, completely (a bounded read that may be partial is not an answer);
 *   - the work declares at least one draft that is not retired;
 *   - the CURRENT revision of every such draft is `accepted`;
 *   - CONTENT-WORK-OUTCOME-1: for every such draft that is a `content-draft`, the action ledger records a
 *     publication of that same current revision, to the draft's declared destination, that the provider
 *     accepted. A content draft is the one artifact type that must declare a destination (validation
 *     and two database CHECKs), so it is the work's statement that publication is the deliverable. Plans
 *     and messages carry no destination and keep the rule above unchanged.
 *
 *     GOVERNANCE ACCEPTED  != PUBLISHED      PERMIT ISSUED != PUBLISHED
 *     ATTEMPT FAILED       != PUBLISHED      LEDGER UNREAD != NOTHING PUBLISHED
 *
 * A revision accepted earlier does not cover a newer one: the review state is read for the current
 * revision only, so a later, unreviewed revision reads `awaiting-review` and withholds the suggestion.
 * `unknown` withholds it too — missing or ambiguous review information never produces advice.
 *
 * No React, no I/O, no database, no authority. Client-safe.
 */
import type { ArtifactRowReviewStatus } from "@/features/work-artifact-review/contracts";
import type { WorkDeclaredState } from "@/features/organizational-work/work-contracts";
import type { ContentDestination, StoredWorkArtifactType } from "@/features/work-artifacts/contracts";
import type { ContentPublicationState } from "@/features/action-authorization/content-publication-state";

/**
 * CONTENT-WORK-OUTCOME-1 — what the action ledger records about publishing a content draft's CURRENT
 * revision, reduced to the four answers the outcome needs. Only a `content-draft` carries one.
 *
 *   verified     an attempt for exactly this revision, to the draft's destination, the provider accepted
 *   pending      the ledger was read and holds no such attempt, and the latest attempt did not fail
 *   failed       the ledger was read; the latest attempt for this revision failed, was refused or is unknown
 *   unavailable  the ledger was not read, its history was cut short, or Hebun cannot publish there
 */
export type WorkPublicationStatus = "verified" | "pending" | "failed" | "unavailable";

/** One draft a work item declares as its evidence, with the review of its CURRENT revision. */
export interface WorkOutcomeEvidence {
  readonly artifactId: string;
  /** `null` when the artifact authority could not name it; its review is then `unknown`. */
  readonly title: string | null;
  readonly artifactType: StoredWorkArtifactType | null;
  readonly revisionNo: number | null;
  readonly retired: boolean;
  readonly review: ArtifactRowReviewStatus;
  /**
   * CONTENT-WORK-OUTCOME-1. Present on a `content-draft` only. A content draft without it is read as
   * `unavailable` — the absence of a publication answer is never taken as a publication.
   */
  readonly publication?: WorkPublicationStatus;
}

/** Why no completion suggestion is offered. A closed set; each has one sentence below. */
export type CompletionWithheldReason =
  | "work-unknown"
  | "work-retired"
  | "work-complete"
  | "evidence-unknown"
  | "no-evidence"
  | "review-unknown"
  | "changes-requested"
  | "awaiting-review"
  | "publication-unavailable"
  | "publication-failed"
  | "publication-pending";

export type CompletionSuggestion =
  | { readonly offered: true }
  | { readonly offered: false; readonly reason: CompletionWithheldReason };

export interface CompletionInput {
  /** `null` when the work item's state could not be read. */
  readonly declaredState: WorkDeclaredState | null;
  readonly inService: boolean;
  /** `null` when the evidence read did not answer completely. */
  readonly evidence: readonly WorkOutcomeEvidence[] | null;
}

/**
 * THE ONE RULE. Every surface that suggests completion calls it, so Heby and the Work register cannot
 * disagree about the same work. Order matters only for which reason is reported; any failing
 * condition withholds the suggestion.
 */
export function suggestCompletion(input: CompletionInput): CompletionSuggestion {
  if (input.declaredState === null) return { offered: false, reason: "work-unknown" };
  if (!input.inService) return { offered: false, reason: "work-retired" };
  if (input.declaredState === "complete") return { offered: false, reason: "work-complete" };
  if (input.evidence === null) return { offered: false, reason: "evidence-unknown" };
  const relevant = input.evidence.filter((evidence) => !evidence.retired);
  if (relevant.length === 0) return { offered: false, reason: "no-evidence" };
  if (relevant.some((evidence) => evidence.review === "unknown")) return { offered: false, reason: "review-unknown" };
  if (relevant.some((evidence) => evidence.review === "changes-requested")) return { offered: false, reason: "changes-requested" };
  if (relevant.some((evidence) => evidence.review !== "accepted")) return { offered: false, reason: "awaiting-review" };
  const publications = relevant
    .filter((evidence) => evidence.artifactType === "content-draft")
    .map((evidence) => evidence.publication ?? "unavailable");
  if (publications.includes("unavailable")) return { offered: false, reason: "publication-unavailable" };
  if (publications.includes("failed")) return { offered: false, reason: "publication-failed" };
  if (publications.includes("pending")) return { offered: false, reason: "publication-pending" };
  return { offered: true };
}

/** The destinations Hebun can publish to and therefore hold an attempt for. TikTok has none. */
const PUBLISHABLE_DESTINATIONS: readonly ContentDestination[] = ["instagram", "youtube"];
const UNSUCCESSFUL_ATTEMPT_STAGES: readonly string[] = ["execution-failed", "execution-refused", "execution-unknown"];

/**
 * CONTENT-WORK-OUTCOME-1 — the ledger's answer for one content revision, reduced. `state` is the
 * Action Authorization projection for THIS revision's reference, or `undefined` when it was not read.
 * An accepted attempt anywhere in the kept history verifies; anything else needs the whole history.
 */
export function workPublicationStatus(
  state: ContentPublicationState | undefined,
  destination: ContentDestination | null,
): WorkPublicationStatus {
  if (destination === null || !PUBLISHABLE_DESTINATIONS.includes(destination)) return "unavailable";
  if (!state || state.status === "unknown") return "unavailable";
  if (state.status === "no-request-recorded") return "pending";
  const verified = state.entries.some(
    (entry) =>
      entry.stage === "execution-accepted" &&
      entry.destination === destination &&
      entry.attempt?.status === "accepted" &&
      entry.attempt.providerResultId !== null,
  );
  if (verified) return "verified";
  if (state.truncated) return "unavailable";
  const latest = state.entries[state.entries.length - 1];
  return latest && UNSUCCESSFUL_ATTEMPT_STAGES.includes(latest.stage) ? "failed" : "pending";
}

/** A content draft's publication, worded beside its review. Ledger words; never "live" or "published". */
export const WORK_PUBLICATION_WORDING: Readonly<Record<WorkPublicationStatus, string>> = Object.freeze({
  verified: "publication of this revision accepted by the provider (Hebun's ledger, not a live provider read)",
  pending: "no publication of this revision accepted by the provider yet",
  failed: "the latest publication attempt for this revision did not succeed",
  unavailable: "publication record unavailable",
});

/** The sentence beside the declare control when the suggestion is offered. */
export const COMPLETION_SUGGESTION_TEXT =
  "Governance accepted the current revision of every draft this work declares as its evidence. " +
  "If the work itself is done, you may declare it complete. Hebun does not declare it for you, " +
  "and declaring it records what a person said — Hebun verifies nothing.";

/** What a person reads when no suggestion is offered. Facts only; nothing is inferred. */
export const COMPLETION_WITHHELD_TEXT: Readonly<Record<CompletionWithheldReason, string>> = Object.freeze({
  "work-unknown": "Hebun could not read this work's declared state, so it suggests nothing.",
  "work-retired": "This work is retired, so nothing is suggested.",
  "work-complete": "This work is already declared complete.",
  "evidence-unknown":
    "Hebun could not read every draft this work declares as evidence, so it suggests nothing. That is a read failure, not missing evidence.",
  "no-evidence": "This work declares no draft as its evidence, so there is no review to go on.",
  "review-unknown": "The review of at least one linked draft could not be read, so nothing is suggested.",
  "changes-requested": "Governance asked for changes on at least one linked draft.",
  "awaiting-review": "At least one linked draft's current revision is waiting for review.",
  "publication-unavailable":
    "Hebun could not establish the publication record of at least one linked content draft — the ledger was not read, its history was cut short, or Hebun has no publication route to that destination — so it suggests nothing.",
  "publication-failed": "The latest publication attempt for at least one linked content draft's current revision did not succeed.",
  "publication-pending":
    "At least one linked content draft is accepted, but no publication of its current revision has been accepted by the provider. Acceptance is not publication.",
});

/** The review of a linked draft, worded for the work it is evidence for. Never "complete". */
export const OUTCOME_REVIEW_WORDING: Readonly<Record<ArtifactRowReviewStatus, string>> = Object.freeze({
  "awaiting-review": "current revision waiting for review",
  "changes-requested": "changes requested on the current revision",
  accepted: "current revision accepted for the next internal step",
  unknown: "review state could not be read",
});

/** Said wherever an acceptance is shown next to the work it concerns. */
export const ACCEPTANCE_IS_NOT_COMPLETION =
  "Accepting a revision records Governance's judgement of that draft only. It does not change the " +
  "work's declared state, and it authorizes no publication, sending or execution; a person declares " +
  "the work complete on the work itself.";

/** The declared state the suggestion leads to. A constant: the suggestion never chooses another. */
export const SUGGESTED_DECLARED_STATE: WorkDeclaredState = "complete";
