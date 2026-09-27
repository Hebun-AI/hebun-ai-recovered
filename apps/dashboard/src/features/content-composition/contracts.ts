/*
 * content-composition/contracts.ts — the vocabulary of a content package (CONTENT-COMPOSE-1).
 *
 * ── WHAT A CONTENT PACKAGE IS ────────────────────────────────────────────────
 *
 * The answer to "what is the finished thing, and is it finished?" for ONE draft revision. It is a
 * READ across authorities that already exist, plus exactly one fact that none of them held:
 *
 *   destination        work_artifacts.intended_destination        (CGO-1)
 *   copy               work_artifact_revisions.content            (Work Artifact authority)
 *   copy review        decision_records / work_artifact_revision   (TRH-10)
 *   candidate media    media_generation_invocations provenance    (MEDIA-1 / MEDIA-4A / MV-7)
 *   media review       decision_records / media_asset             (MEDIA-3)
 *   SELECTED media     content_selected_media                     ← the only new fact
 *
 * VIDEO CONTENT CHAIN: a selected item is an image OR a generated video, and says which. A video in
 * a package is NOT publishable: the only publish path (PUBLISH-0, Instagram) reads images only and
 * refuses a video, and no YouTube authority exists.
 *
 * ── READINESS IS DERIVED, ALWAYS ─────────────────────────────────────────────
 *
 * `readiness` is computed at read time from the five sources above and is NEVER stored. A stored
 * readiness flag would be a second truth that goes stale the moment a decision is superseded or an
 * asset is retired — and it would quietly become the authority for a question Governance already
 * answers. Recomputing is cheap; disagreeing with Governance is not.
 *
 * ── READY IS NOT AUTHORIZED, AND CANNOT BECOME IT ────────────────────────────
 *
 * `ready` means every blocker below is absent. It does not mean published, scheduled, queued,
 * sent, or permitted, and no authority in this repository consumes it. There is no publishing
 * action kind (`AGENT_ORIGINABLE_ACTION_KINDS` is send / record-work) and Instagram's
 * `/media_publish` is on an explicitly banned path list, so "ready" cannot be escalated into an
 * external act by any code path that exists. It is a statement to a human and nothing more.
 *
 * Pure types and frozen values. No I/O.
 */
import type { ContentDestination } from "@/features/work-artifacts/contracts";

/**
 * Why a package is not ready. A CLOSED set, ordered from "nothing to send" to "not judged yet", so
 * a surface can render the first blocker as the headline without ranking them itself.
 */
/*
 * There is deliberately NO `destination-missing`. `work_artifacts_content_draft_destination_chk`
 * makes `intended_destination` NOT NULL for every `content-draft`, and the package reader refuses
 * any artifact that is not one — so a package without a destination is unrepresentable rather than
 * merely unlikely. A blocker that cannot fire is not a guard; it is a claim nobody can check.
 */
export const CONTENT_PACKAGE_BLOCKERS = [
  /** The revision's copy is empty or whitespace. There is nothing to say. */
  "copy-empty",
  /** No image or video is selected for this revision. Provenance is not selection — see the schema header. */
  "no-media-selected",
  /** A selected image was retired after it was selected. Custody removed it; the row stayed. */
  "selected-media-retired",
  /** A selected image carries a Governance decline. */
  "selected-media-declined",
  /** A selected image has never been reviewed. */
  "selected-media-unreviewed",
  /** The revision's own copy carries a Governance decline. */
  "copy-declined",
  /** The revision's own copy has never been reviewed. */
  "copy-unreviewed",
] as const;

export type ContentPackageBlocker = (typeof CONTENT_PACKAGE_BLOCKERS)[number];

/** Why a selection was refused. Closed, and never a database or provider message. */
export const CONTENT_SELECTION_REFUSALS = [
  "unauthenticated",
  "invalid-input",
  "persistence-unavailable",
  /** The revision is not this tenant's, or does not exist. Indistinguishable on purpose. */
  "revision-unresolvable",
  /** The asset is not this tenant's, or does not exist. Indistinguishable on purpose. */
  "asset-unresolvable",
  /** Custody, and only custody, gates selection. A retired image is not selectable. */
  "asset-retired",
  /**
   * VIDEO CONTENT CHAIN — the asset's `media_kind` is not the kind its invocation produced (or is
   * neither image nor video). Replaces MV-2's `asset-not-image`: a generated video is selectable.
   */
  "asset-kind-incoherent",
] as const;

export type ContentSelectionRefusal = (typeof CONTENT_SELECTION_REFUSALS)[number];

/**
 * What Hebun refuses to claim about a ready package. Rendered verbatim beside readiness, because
 * the entire risk of this capability is a human reading "READY" as "Hebun will post this".
 */
export const CONTENT_PACKAGE_NON_CLAIMS: readonly string[] = [
  "Ready means this draft is complete and reviewed. It does not mean it has been published, scheduled or queued.",
  "Hebun has no publishing capability. Nothing here sends anything to any platform.",
  "A declared destination is not a connected account, and no account is authorized by this package.",
  "Publishing, when it exists, will be a separate governed act requiring its own authorization.",
] as const;

/**
 * VIDEO CONTENT CHAIN — the probed facts of a selected VIDEO, from `media_assets`. Never provider
 * metadata, never inferred from a file name.
 */
export interface SelectedVideoFacts {
  readonly durationMs: number;
  readonly videoCodec: string;
  /** `null` is a silent video, which is legitimate. */
  readonly audioCodec: string | null;
  readonly frameRate: string;
}

/**
 * VIDEO CONTENT CHAIN — rendered whenever a package holds a video. A video in a ready package is not
 * a publishable video: PUBLISH-0 (Instagram) reads images only and refuses a video, and no YouTube
 * publishing authority exists.
 */
export const CONTENT_PACKAGE_VIDEO_NON_CLAIM =
  "A chosen video is part of this package only. Hebun cannot publish a video: no platform path accepts one." as const;

export interface SelectedMediaView {
  readonly mediaAssetId: string;
  readonly selectedAt: string;
  /**
   * VIDEO CONTENT CHAIN — the kind, read from the row's `media_kind`. A surface decides image or
   * video from THIS field and nothing else.
   */
  readonly mediaKind: "image" | "video";
  /** Present exactly when `mediaKind` is `video`; `null` for an image. */
  readonly video: SelectedVideoFacts | null;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly width: number;
  readonly height: number;
  /** Custody, from `media_assets`. `retired` keeps the row but blocks readiness. */
  readonly lifecycle: string;
  /** The revision this image was GENERATED from — provenance, not this selection. */
  readonly sourceRevisionNo: number;
}

export interface ContentPackageView {
  readonly artifactId: string;
  readonly revisionNo: number;
  readonly title: string;
  /** Never null: a package exists only for a content-draft, and CGO-1's CHECK makes it NOT NULL. */
  readonly destination: ContentDestination;
  readonly copy: string;
  readonly copyReviewState: "approved" | "declined" | "unreviewed";
  readonly selected: readonly SelectedMediaView[];
  /** Per selected asset, keyed by id. Derived from `decision_records`, never from the asset. */
  readonly mediaReviewStates: Readonly<Record<string, "approved" | "declined" | "unreviewed">>;
  readonly blockers: readonly ContentPackageBlocker[];
  /** Exactly `blockers.length === 0`. Carried explicitly so a surface cannot invent its own rule. */
  readonly ready: boolean;
}

export function isContentPackageBlocker(value: unknown): value is ContentPackageBlocker {
  return (
    typeof value === "string" && (CONTENT_PACKAGE_BLOCKERS as readonly string[]).includes(value)
  );
}

/**
 * VIDEO CONTENT CHAIN — "N images · M videos", counted from each selected item's `mediaKind` and
 * nothing else. Pure, so the sentence a human reads is the one the tests assert.
 */
export function describeSelectedMedia(selected: readonly Pick<SelectedMediaView, "mediaKind">[]): string {
  const images = selected.filter((s) => s.mediaKind === "image").length;
  const videos = selected.filter((s) => s.mediaKind === "video").length;
  return `${images} image${images === 1 ? "" : "s"} · ${videos} video${videos === 1 ? "" : "s"}`;
}
