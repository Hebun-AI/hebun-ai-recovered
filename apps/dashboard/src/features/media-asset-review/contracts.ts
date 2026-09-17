/*
 * media-asset-review/contracts.ts — the typed vocabulary of Governance-backed media asset review
 * (MEDIA-1).
 *
 * WHAT "ACCEPTED" MEANS, EXACTLY: a human holding this organization's Governance authority judged
 * THIS EXACT ADMITTED IMAGE — these bytes, by their SHA-256 — fit for the next internal step. It does
 * NOT mean the image is accurate, on-brand, licensed, safe, or approved for publication, and nothing
 * in Hebun may translate it into any of those.
 *
 *   ASSET ACCEPTED   != PUBLICATION AUTHORIZED
 *   ASSET ACCEPTED   != SOURCE DRAFT ACCEPTED        (that is a separate `work_artifact_revision` decision)
 *   ASSET DECLINED   != ASSET RETIRED OR DELETED
 *
 * ── WHY THERE IS NO ROW TO MUTATE ────────────────────────────────────────────
 *
 * Review writes NOTHING to `media_assets` or `media_generation_invocations`. No `accepted` column, no
 * lifecycle transition. The current review state is DERIVED from the latest decision for that asset,
 * exactly as TRH-10 derives it for a revision.
 *
 * ── HOW A FUTURE PUBLICATION BINDS BOTH, WITHOUT GIVING THE ASSET AUTHORITY ──
 *
 * Not implemented here, stated so nobody reaches for a column. A publication would be ONE action
 * request whose canonical payload names the draft revision (`work-artifact/<id>@<rev>` + content
 * digest) AND the asset (id + byte digest); R3A's `payload_digest` and the permit's
 * `bound_payload_digest` then bind both. Consumption would re-check the latest decision for each, that
 * the asset is still `admitted`, and that the asset's invocation names that same revision. The asset
 * itself is never read by any permit or execution path as a source of authority.
 *
 * Pure types and frozen values.
 */

/** The G2 subject type. The asset is its own immutable version, so its id names exact bytes. */
export const MEDIA_ASSET_REVIEW_SUBJECT_TYPE = "media_asset" as const;

export const MEDIA_ASSET_REVIEW_DOMAIN = "media-asset-review" as const;

/** Existing `governance_decision_type` values. No new decision words. */
export const MEDIA_ASSET_REVIEW_ACCEPT_TYPE = "approve" as const;
export const MEDIA_ASSET_REVIEW_DECLINE_TYPE = "reject" as const;

/** Ledger words. `-accepted`, never `approved`: nothing was published or authorized. */
export const MEDIA_ASSET_REVIEW_ACCEPTED_OUTCOME = "media-asset-accepted" as const;
export const MEDIA_ASSET_REVIEW_DECLINED_OUTCOME = "media-asset-declined" as const;

export const MEDIA_ASSET_REVIEW_ACCEPT_NON_EFFECTS: readonly string[] = Object.freeze([
  "does not authorize publication, sending, or any external act",
  "does not create an action request, mint a permit, or make anything executable",
  "does not accept the draft revision the image was generated from",
  "does not change the asset, its bytes, or its lifecycle",
  "does not become organizational Knowledge",
]);

export type MediaAssetReviewRefusal =
  | "unauthenticated"
  | "no-governance-authority"
  | "not-the-governance-authority"
  /** Missing, another tenant's, or not an asset id. One reason, so refusals reveal nothing. */
  | "asset-unresolvable"
  /** The asset exists in this tenant but has been retired; a retired asset is not reviewed. */
  | "asset-retired"
  /** The digest the reviewer was shown is not the digest of the asset. Nothing is recorded. */
  | "asset-digest-mismatch"
  | "justification-required"
  | "persistence-unavailable";

export type MediaAssetReviewDecision = "accepted" | "declined";

export type MediaAssetReviewResult =
  | {
      readonly status: "reviewed";
      readonly decision: MediaAssetReviewDecision;
      readonly assetId: string;
      readonly byteDigest: string;
      readonly decisionId: string;
      readonly governanceSessionId: string;
      readonly decidedAt: string;
    }
  | { readonly status: "refused"; readonly reason: MediaAssetReviewRefusal };

export type MediaAssetReviewState =
  | { readonly status: "unavailable" }
  | {
      readonly status: "read";
      /** `null` when no decision has ever been recorded for this asset. */
      readonly decision: MediaAssetReviewDecision | null;
      readonly decisionId: string | null;
      readonly decidedAt: string | null;
      readonly decisionCount: number;
    };
