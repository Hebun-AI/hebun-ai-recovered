/*
 * content-composition/read-content-package.server.ts — "what is the finished thing, and is it
 * finished?" for one draft revision.
 *
 * ── A READ, ACROSS AUTHORITIES THAT ALREADY EXIST ────────────────────────────
 *
 * This module owns ONE table, `content_selected_media`, and reads four others without owning any of
 * them. Destination and title come from the Work Artifact authority, copy from its revision, image
 * identity and custody from the Media Asset authority, and BOTH review states from Governance's own
 * ledger through the released MEDIA-3 and TRH-10 readers. Nothing is copied into a package row,
 * because a copy is a second truth that goes stale the instant a decision is superseded.
 *
 * ── READINESS IS COMPUTED HERE AND STORED NOWHERE ────────────────────────────
 *
 * `blockers` is derived on every read, in a fixed order, from the state as it is RIGHT NOW. Retire
 * a selected image and the package stops being ready with no writer involved. Supersede an approval
 * and the same. That is the entire reason readiness is not a column.
 *
 * `ready` is exactly `blockers.length === 0` and is carried explicitly so no surface invents its
 * own rule from a subset of the blockers.
 *
 * ── UNAVAILABLE IS NOT UNREVIEWED ────────────────────────────────────────────
 *
 * When Governance cannot be read, the released readers answer `unavailable`. This module maps that
 * to `unreviewed`, which BLOCKS readiness — it never lets an unreadable ledger read as approval.
 * A package is ready only when Hebun can currently see that it is.
 *
 * ── THIS MODULE GRANTS NOTHING ───────────────────────────────────────────────
 *
 * It writes no row of any kind. `ready` is consumed by no permit, no execution attempt and no
 * provider path, and none exists to consume it: the originable action kinds are send / record-work,
 * and Instagram's `/media_publish` is on an explicitly banned path list. Ready is a sentence for a
 * human.
 *
 * Server-only.
 */
import { and, asc, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { contentSelectedMedia } from "@/db/schema/content-selected-media";
import { mediaAssets, mediaGenerationInvocations } from "@/db/schema/media-asset";
import { workArtifactRevisions, workArtifacts } from "@/db/schema/work-artifact";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { isUuid } from "@/features/media-assets/contracts";
import { resolveMediaDbOrNull } from "@/features/media-assets/media-db.server";
import { readMediaAssetReviewStates } from "@/features/media-asset-review/review-media-asset.server";
import { readArtifactRevisionReviewStates } from "@/features/work-artifact-review/review-revision.server";
import { isContentDestination } from "@/features/work-artifacts/contracts";
import type {
  ContentPackageBlocker,
  ContentPackageView,
  SelectedMediaView,
} from "./contracts";

export interface ContentPackageDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly readMediaReviewStates?: typeof readMediaAssetReviewStates;
  readonly readRevisionReviewStates?: typeof readArtifactRevisionReviewStates;
}

export type ContentPackageResult =
  | { readonly status: "unavailable"; readonly reason: "persistence-unavailable" }
  | { readonly status: "not-found" }
  | { readonly status: "read"; readonly package: ContentPackageView };

type ReviewWord = "approved" | "declined" | "unreviewed";

export async function readContentPackage(
  tenant: TenantContext | null,
  input: { readonly artifactId: string; readonly revisionNo: number } | null,
  deps: ContentPackageDeps = {},
): Promise<ContentPackageResult> {
  if (typeof window !== "undefined") {
    throw new Error("Content package reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "persistence-unavailable" };
  if (!input || !isUuid(input.artifactId)) return { status: "not-found" };
  if (!Number.isSafeInteger(input.revisionNo) || input.revisionNo < 1) {
    return { status: "not-found" };
  }

  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };

  let head;
  let selectedRows;
  try {
    /* The draft and its revision, tenant-predicated on BOTH tables. */
    const headRows = await db
      .select({
        title: workArtifacts.title,
        artifactType: workArtifacts.artifactType,
        destination: workArtifacts.intendedDestination,
        copy: workArtifactRevisions.content,
      })
      .from(workArtifactRevisions)
      .innerJoin(
        workArtifacts,
        and(
          eq(workArtifacts.tenantId, workArtifactRevisions.tenantId),
          eq(workArtifacts.id, workArtifactRevisions.artifactId),
        ),
      )
      .where(
        and(
          eq(workArtifactRevisions.tenantId, tenant.tenantId),
          eq(workArtifactRevisions.artifactId, input.artifactId),
          eq(workArtifactRevisions.revisionNo, input.revisionNo),
        ),
      )
      .limit(1);
    head = headRows[0];
    if (!head) return { status: "not-found" };
    /*
     * A content package is a content-draft concept. For any other artifact type the destination
     * CHECK forces `intended_destination` NULL, so there is nothing here to compose — and refusing
     * is truer than returning a package that could never be ready.
     */
    if (head.artifactType !== "content-draft") return { status: "not-found" };

    /*
     * The selections, joined to the images they name. `source_revision_no` comes along because a
     * surface must be able to say "selected here, generated in revision 1" — MEDIA-4A's distinction
     * survives being put into a package.
     */
    selectedRows = await db
      .select({
        mediaAssetId: contentSelectedMedia.mediaAssetId,
        selectedAt: contentSelectedMedia.selectedAt,
        mimeType: mediaAssets.mimeType,
        byteSize: mediaAssets.byteSize,
        width: mediaAssets.width,
        height: mediaAssets.height,
        lifecycle: mediaAssets.assetLifecycleStatus,
        sourceRevisionNo: mediaGenerationInvocations.sourceRevisionNo,
      })
      .from(contentSelectedMedia)
      .innerJoin(
        mediaAssets,
        and(
          eq(mediaAssets.tenantId, contentSelectedMedia.tenantId),
          eq(mediaAssets.id, contentSelectedMedia.mediaAssetId),
        ),
      )
      .innerJoin(
        mediaGenerationInvocations,
        and(
          eq(mediaGenerationInvocations.tenantId, mediaAssets.tenantId),
          eq(mediaGenerationInvocations.id, mediaAssets.invocationId),
        ),
      )
      .where(
        and(
          eq(contentSelectedMedia.tenantId, tenant.tenantId),
          eq(contentSelectedMedia.artifactId, input.artifactId),
          eq(contentSelectedMedia.revisionNo, input.revisionNo),
        ),
      )
      .orderBy(asc(contentSelectedMedia.selectedAt));
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }

  const selected: SelectedMediaView[] = selectedRows.map((r) => ({
    mediaAssetId: r.mediaAssetId,
    selectedAt: r.selectedAt.toISOString(),
    mimeType: r.mimeType,
    byteSize: r.byteSize,
    width: r.width,
    height: r.height,
    lifecycle: r.lifecycle,
    sourceRevisionNo: r.sourceRevisionNo,
  }));

  /* ── Governance, read from its own ledger, never from these rows ──────────── */
  const readMedia = deps.readMediaReviewStates ?? readMediaAssetReviewStates;
  const readRevisions = deps.readRevisionReviewStates ?? readArtifactRevisionReviewStates;

  const mediaStates = await readMedia(
    tenant,
    selected.map((s) => s.mediaAssetId),
  );
  const mediaReviewStates: Record<string, ReviewWord> = {};
  for (const s of selected) {
    const state = mediaStates.get(s.mediaAssetId);
    /* `unavailable` and "never decided" both read as unreviewed, and both block. */
    mediaReviewStates[s.mediaAssetId] =
      state?.status === "read" && state.decision === "accepted"
        ? "approved"
        : state?.status === "read" && state.decision === "declined"
          ? "declined"
          : "unreviewed";
  }

  const revisionStates = await readRevisions(tenant, input.artifactId);
  const thisRevision = revisionStates.find((r) => r.revisionNo === input.revisionNo);
  const copyReviewState: ReviewWord =
    thisRevision?.decision === "accepted"
      ? "approved"
      : thisRevision?.decision === "changes-requested"
        ? "declined"
        : "unreviewed";

  /* ── Readiness, derived, in a fixed order ────────────────────────────────── */
  const blockers: ContentPackageBlocker[] = [];
  /* Guaranteed by the CHECK above plus the content-draft refusal; narrowed, never defaulted. */
  if (!isContentDestination(head.destination)) return { status: "not-found" };
  const destination = head.destination;
  if (head.copy.trim().length === 0) blockers.push("copy-empty");
  if (selected.length === 0) blockers.push("no-media-selected");
  if (selected.some((s) => s.lifecycle !== "admitted")) blockers.push("selected-media-retired");
  if (selected.some((s) => mediaReviewStates[s.mediaAssetId] === "declined")) {
    blockers.push("selected-media-declined");
  }
  if (selected.some((s) => mediaReviewStates[s.mediaAssetId] === "unreviewed")) {
    blockers.push("selected-media-unreviewed");
  }
  if (copyReviewState === "declined") blockers.push("copy-declined");
  if (copyReviewState === "unreviewed") blockers.push("copy-unreviewed");

  return {
    status: "read",
    package: {
      artifactId: input.artifactId,
      revisionNo: input.revisionNo,
      title: head.title,
      destination,
      copy: head.copy,
      copyReviewState,
      selected,
      mediaReviewStates,
      blockers,
      ready: blockers.length === 0,
    },
  };
}
