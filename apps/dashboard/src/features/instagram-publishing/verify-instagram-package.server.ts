/*
 * instagram-publishing/verify-instagram-package.server.ts — INSTAGRAM-PACKAGE-READINESS-1's ONE
 * read-only question: does the CURRENT Content Package of this exact revision authorize publishing
 * this exact original image to Instagram?
 *
 *   package of exactly this revision      the Content Package read, tenant-predicated
 *   destination                           the package's own (`instagram`)
 *   the image is SELECTED                 `pkg.selected` — other selected media may coexist
 *   the image is an image                 the selected item's own `mediaKind`
 *   the image is APPROVED                 `pkg.mediaReviewStates` (MEDIA-3, derived by the package)
 *   the package is READY                  `pkg.ready`, never recomputed here
 *   the image fits Meta's feed contract    INSTAGRAM-MEDIA-COMPATIBILITY-1, below
 *
 * ── INSTAGRAM-MEDIA-COMPATIBILITY-1 ─────────────────────────────────────────
 *
 * The Content Package is destination-neutral: READY never meant "Meta will take this image". Meta's
 * DOCUMENTED feed-image contract (IG Media reference; error 36003/2207009 for ratio, 36000/2207004
 * for size) is owned HERE, the one Instagram-specific readiness question, and nowhere else:
 *
 *   aspect ratio   4:5 through 1.91:1 inclusive, compared in integers (5w >= 4h, 100w <= 191h)
 *   JPEG bytes     at most 8,000,000 — the stricter reading of "8 MB" / "8MiB"; asked by the
 *                  proposal of the `jpeg-publish-v1` derivative it binds, not here (no derivative yet)
 *   width          NOT enforced: Meta documents scaling outside 320..1440 and raises no error for it
 *
 * Documented, not observed: Meta once accepted a 2000x2601 (0.769) image. A provider's undocumented
 * tolerance is not a contract, and publishing is irreversible, so this refuses it.
 *
 * Readiness is mutable organizational truth, so it is asked at proposal, again at execution
 * pre-flight, and again immediately before the provider call. The governed payload stays frozen and
 * digest-bound; only the question "is it still ready?" is re-read. Nothing is snapshotted.
 *
 * It writes nothing — no selection, no review, no decision, no permit, no attempt.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { ContentPackageView } from "@/features/content-composition/contracts";
import { readContentPackage, type ContentPackageDeps } from "@/features/content-composition/read-content-package.server";

export type InstagramPackageFailure =
  | "persistence-unavailable"
  /** No package for this revision in this tenant (unknown, foreign, or not a content draft). */
  | "package-unresolvable"
  /** The package exists but is not an Instagram package. */
  | "package-not-instagram"
  /** The requested original is not in the package's selected media, or is not an image there. */
  | "image-not-selected"
  /** The requested image is selected but its current MEDIA-3 review is not `approved`. */
  | "image-not-approved"
  /** INSTAGRAM-MEDIA-COMPATIBILITY-1 — selected and approved, but outside Meta's documented 4:5..1.91:1. */
  | "image-aspect-unsupported"
  /** The package itself is BLOCKED; `blockers` carries the package's own typed reasons. */
  | "package-not-ready";

export type InstagramPackageVerdict =
  | { readonly ok: true; readonly pkg: ContentPackageView }
  | { readonly ok: false; readonly failure: InstagramPackageFailure; readonly blockers?: ContentPackageView["blockers"] };

/** INSTAGRAM-MEDIA-COMPATIBILITY-1 — the largest `jpeg-publish-v1` derivative a proposal may bind. */
export const INSTAGRAM_MAX_PUBLISH_IMAGE_BYTES = 8_000_000;

/** Meta's documented feed range, 4:5 through 1.91:1 inclusive, in integers so a boundary never rounds. */
export function isInstagramFeedAspect(width: number, height: number): boolean {
  return Number.isSafeInteger(width) && Number.isSafeInteger(height) && width > 0 && height > 0 && 5 * width >= 4 * height && 100 * width <= 191 * height;
}

export function isInstagramPublishImageSize(byteSize: number): boolean {
  return Number.isSafeInteger(byteSize) && byteSize > 0 && byteSize <= INSTAGRAM_MAX_PUBLISH_IMAGE_BYTES;
}

export interface InstagramPackageInput {
  readonly artifactId: string;
  readonly revisionNo: number;
  /** The ORIGINAL media asset the publication names (never the publish derivative). */
  readonly mediaAssetId: string;
}

export interface InstagramPackageDeps extends ContentPackageDeps {
  readonly readPackage?: typeof readContentPackage;
}

export async function verifyInstagramPackageReadiness(
  tenant: Pick<TenantContext, "tenantId"> | null,
  input: InstagramPackageInput,
  deps: InstagramPackageDeps = {},
): Promise<InstagramPackageVerdict> {
  const read = await (deps.readPackage ?? readContentPackage)(
    tenant as TenantContext | null,
    { artifactId: input.artifactId, revisionNo: input.revisionNo },
    deps,
  );
  if (read.status === "unavailable") return { ok: false, failure: "persistence-unavailable" };
  if (read.status !== "read") return { ok: false, failure: "package-unresolvable" };
  const pkg = read.package;
  if (pkg.artifactId !== input.artifactId || pkg.revisionNo !== input.revisionNo) {
    return { ok: false, failure: "package-unresolvable" };
  }
  if (pkg.destination !== "instagram") return { ok: false, failure: "package-not-instagram" };
  const assetId = input.mediaAssetId.toLowerCase();
  const selected = pkg.selected.find((m) => m.mediaAssetId === assetId);
  if (!selected || selected.mediaKind !== "image") return { ok: false, failure: "image-not-selected" };
  if (pkg.mediaReviewStates[assetId] !== "approved") return { ok: false, failure: "image-not-approved" };
  if (!isInstagramFeedAspect(selected.width, selected.height)) return { ok: false, failure: "image-aspect-unsupported" };
  if (!pkg.ready) return { ok: false, failure: "package-not-ready", blockers: pkg.blockers };
  return { ok: true, pkg };
}
