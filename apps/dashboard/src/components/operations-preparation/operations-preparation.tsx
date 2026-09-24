/*
 * operations-preparation.tsx — the Operations Preparation surface (OPS-P1).
 *
 * ── WHAT THIS COMPLETES, AND WHAT IT DELIBERATELY IS NOT ─────────────────────
 *
 * R3R made a recipient durable and R3W made a prepared draft durable. Both shipped with an
 * authority, a reader, a reference format and server actions — and no interface, so a human could
 * not reach either. `/send` needs the two canonical references those authorities mint, and until
 * now there was nowhere to obtain them. This is the missing VIEW LAYER and nothing more: it owns no
 * state, mints no reference, and every write goes through a server action that already shipped.
 *
 * IT LIVES ON `/operations` BECAUSE THE ACTION REGISTRY SAYS SO. Both tools that can ever name an
 * artifact as a `record-ref` — `heby.operations.prepare-plan` and
 * `heby.operations.send-communication` — declare `ownerWorkspace: "operations"`. No fifth L2
 * destination is added and no navigation changes: the released Operations L2 is exactly
 * `Overview · Execution · Runtime & Signals · Execution Substrate`, a deepEqual pin, and this
 * surface renders inside the workspace root rather than beside it.
 *
 * ── PREPARATION IS NOT PROPOSAL ──────────────────────────────────────────────
 *
 * Nothing here proposes, approves, authorizes, executes or sends. There is no "Prepare for
 * approval" control and no second caller of the proposal inlet: `recordActionRequest` keeps the one
 * caller R3A.1 gave it, and `/send` in Heby remains the only way a proposal is filed. What this
 * surface produces are the INPUTS a human then names in that command.
 *
 * Server component. It reads both listings and hands finished data to the two client sections; it
 * holds no client state and offers no mutation of its own.
 */
import {
  listArtifactMediaAssetsAction,
  readMediaAssetReviewStatesAction,
  listActiveRecipientsAction,
  listRetiredRecipientsAction,
  listWorkArtifactsAction,
  readArtifactWorkPurposeAction,
  readCurrentRevisionReviewStatesAction,
} from "@/app/(dashboard)/operations/actions";
import { RecipientsSection } from "./recipients-section";
import { PreparedWorkSection } from "./prepared-work-section";
import { GenerateImageWithHebun } from "./generate-image-with-hebun";
import { RevisionMediaAssets } from "./revision-media-assets";
import { ContentPackagePanel } from "./content-package-panel";
import { CONTENT_DRAFT_TYPE } from "@/features/work-artifacts/contracts";

export async function OperationsPreparation() {
  /*
   * REV-3 adds one more independent read to the same parallel fetch. It is the Work Authority's
   * relationship, read through its own released seam, and it is composed HERE rather than inside
   * the artifact reader — `read-work-evidence.server.ts` already imports `listWorkArtifacts`, so
   * folding the inverse into that reader would close an import cycle and make the artifact
   * authority a participant in a relationship it does not own.
   */
  const [active, retired, artifacts, workPurpose] = await Promise.all([
    listActiveRecipientsAction(),
    listRetiredRecipientsAction(),
    listWorkArtifactsAction(),
    readArtifactWorkPurposeAction(),
  ]);

  /*
   * CGO-8. The Governance review state of each row's CURRENT revision, read once for the whole
   * listing from the review authority's own batched reader. It depends on the listing, so it follows
   * it rather than joining the parallel fetch; an unreadable listing asks the ledger nothing.
   */
  const reviewStates =
    artifacts.status === "read"
      ? await readCurrentRevisionReviewStatesAction({
          artifacts: artifacts.artifacts.map((a) => ({
            artifactId: a.id,
            revisionNo: a.currentRevision,
          })),
        })
      : ({ status: "unavailable" } as const);

  /*
   * OPS-VIS-1. The drafts a generation door and an asset listing may be offered for, computed ONCE
   * and passed to both consumers. It is the same filter both call sites already applied
   * independently; deriving it here removes the duplicate, not a check — the Media authority
   * re-resolves every pair against the tenant regardless, and this list is a convenience rather
   * than a permission.
   */
  const drafts =
    artifacts.status === "read"
      ? artifacts.artifacts
          .filter((a) => a.artifactType === CONTENT_DRAFT_TYPE && a.lifecycleStatus === "draft")
          .map((a) => ({ artifactId: a.id, title: a.title, currentRevision: a.currentRevision }))
      : [];

  /*
   * OPS-VIS-1. The media listing is read HERE rather than inside the gallery, so the summary strip
   * and the gallery are two renderings of ONE read. A second read for the tile would be a second
   * count of the same rows, free to disagree with the first.
   */
  const mediaListing =
    drafts.length > 0
      ? await listArtifactMediaAssetsAction({ artifactIds: drafts.map((d) => d.artifactId) })
      : ({ status: "read", assets: [] } as const);

  const mediaReviewStates =
    mediaListing.status === "read" && mediaListing.assets.length > 0
      ? await readMediaAssetReviewStatesAction({
          assetIds: mediaListing.assets.map((a) => a.assetId),
        })
      /*
       * The reader's own empty answer. It is reached only when there is no asset to have a state
       * for, so it never stands in for a read that failed.
       */
      : [];

  return (
    /*
     * OPS-VIS-3. `mt-8` is gone. The page header already carries `mb-8`, so the two stacked into a
     * band of empty canvas between the title and the first operational fact — the most valuable
     * vertical space on the page, spent on nothing.
     */
    <div className="flex min-w-0 flex-col gap-4">
      {/*
        THE COUNTERS. Four of them, and they are COUNTERS — a number, what it counts, and the
        authority that answered, in three lines of falling weight. They were feature-sized cards
        with a sentence each; a counter that needs a sentence is not a counter.

        Every value is a count of rows a released reader returned on THIS render. No health score,
        no trend, no percentage, no campaign or idea count, and no second read. A reader that failed
        contributes "unknown", never zero: an unreadable listing is not an empty organization.
      */}
      <ul className="grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          {
            label: "Prepared work",
            value: artifacts.status === "read" ? `${artifacts.artifacts.length}` : "unknown",
            note: "Work Artifact",
          },
          {
            label: "Content drafts",
            value: artifacts.status === "read" ? `${drafts.length}` : "unknown",
            note: "open for revision",
          },
          {
            label: "Images held",
            value: mediaListing.status === "read" ? `${mediaListing.assets.length}` : "unknown",
            note: "admitted, not sent out",
          },
          {
            label: "Recipients",
            value: active.unavailableReason ? "unknown" : `${active.recipients.length}`,
            note: "active addresses",
          },
        ].map((tile) => (
          <li
            key={tile.label}
            className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2.5"
          >
            <p className="text-2xl font-semibold leading-8 tabular-nums text-fg">{tile.value}</p>
            <p className="truncate text-xs font-medium leading-5 text-fg-secondary">{tile.label}</p>
            <p className="truncate text-[0.65rem] leading-4 text-fg-muted">{tile.note}</p>
          </li>
        ))}
      </ul>

      {/*
        The workspace, two columns on a desktop: the work a human is finishing leads, and the
        addresses it could eventually be sent to sit beside it rather than above it.
      */}
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <PreparedWorkSection listing={artifacts} workPurpose={workPurpose} reviewStates={reviewStates} />
        <RecipientsSection active={active} retired={retired} />
      </div>

      {/*
        MEDIA-3, widened by MEDIA-4A. The images generated for each draft, shown beside the draft
        they belong to and GROUPED BY THE EXACT REVISION THEY WERE GENERATED FROM. The relationship
        is the invocation's own `(tenant, artifact, revision)` key, so this reads a relationship
        MEDIA-1 already owns and records nothing new.
      */}
      <MediaAssetsForDrafts drafts={drafts} listing={mediaListing} reviewStates={mediaReviewStates} />

      {/*
        MEDIA-2B. The generation door is offered only for drafts the authority would actually
        accept: a content draft that is still `draft`. The authority re-resolves the pair against
        the tenant anyway — this list is a convenience, never the permission.

        It is a secondary operational action, so it rests closed rather than occupying the page.
      */}
      <details className="min-w-0 rounded-lg border border-border bg-surface">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-fg-secondary">
          + Generate an image with Hebun
        </summary>
        <div className="border-t border-border px-3 pb-3 pt-3">
          <GenerateImageWithHebun targets={drafts} />
        </div>
      </details>
    </div>
  );
}

/**
 * The generated images of several drafts, grouped by the revision each one came from (MEDIA-4A).
 *
 * ── WHY THE SPLIT IS "CURRENT" vs "PREVIOUS", AND WHERE EACH WORD COMES FROM ─
 *
 * `currentRevision` is the WORK ARTIFACT AUTHORITY'S answer, carried on the artifact row and read
 * through its released listing. `sourceRevisionNo` is the MEDIA AUTHORITY'S answer, carried on the
 * invocation's composite foreign key into `work_artifact_revisions`. This composition puts the two
 * beside each other and computes nothing else: it never infers which revision is current from the
 * media rows, which would make a draft sitting at revision 3 with images only up to revision 2
 * claim that revision 2 is current.
 *
 * ── HISTORICAL MEANS ONE THING ONLY ──────────────────────────────────────────
 *
 * "Its authoritative source revision is not this draft's current revision." It does NOT mean
 * retired, declined, obsolete, superseded, inherited, selected or attached. No asset is carried
 * forward into a newer revision, because nothing in the repository records such a fact — provenance
 * is not usage, and MEDIA-4A introduces neither.
 *
 * Server-only composition. It owns nothing: one released batched reader for the assets, one
 * released batched reader for their Governance state, and the released MEDIA-3 card for every
 * asset in every group — there is no second asset-review implementation.
 */
function MediaAssetsForDrafts({
  drafts,
  listing,
  reviewStates,
}: {
  readonly drafts: readonly {
    readonly artifactId: string;
    readonly title: string;
    readonly currentRevision: number;
  }[];
  /*
   * OPS-VIS-1. Both reads are performed by the caller and handed down, so the summary tile and
   * this gallery render ONE listing rather than two that may disagree. This component became a
   * pure arrangement of already-read rows; it opens nothing.
   */
  readonly listing: Awaited<ReturnType<typeof listArtifactMediaAssetsAction>>;
  readonly reviewStates: Awaited<ReturnType<typeof readMediaAssetReviewStatesAction>>;
}) {
  if (drafts.length === 0) return null;
  if (listing.status !== "read" || listing.assets.length === 0) return null;

  const byDraft = drafts
    .map((draft) => {
      const assets = listing.assets.filter((a) => a.sourceArtifactId === draft.artifactId);
      const current = assets.filter((a) => a.sourceRevisionNo === draft.currentRevision);
      /*
       * Grouped by the revision the asset itself names, newest revision first. The reader already
       * returned the rows in that order, so this preserves it rather than re-deciding it.
       */
      const previous = new Map<number, typeof assets>();
      for (const asset of assets) {
        if (asset.sourceRevisionNo === draft.currentRevision) continue;
        previous.set(asset.sourceRevisionNo, [...(previous.get(asset.sourceRevisionNo) ?? []), asset]);
      }
      return { draft, current, previous: [...previous.entries()] };
    })
    /* A draft with no images at all renders nothing — no empty scaffolding for an empty draft. */
    .filter((entry) => entry.current.length > 0 || entry.previous.length > 0);

  if (byDraft.length === 0) return null;

  return (
    /*
     * OPS-VIS-2. One card per draft, with the draft's name as its heading, so the media the
     * workspace holds reads as a section of the workspace rather than as loose blocks under it.
     * Nothing about the grouping changed: current revision first, earlier revisions apart and
     * named, and no asset carried forward into a revision it did not come from.
     */
    <div className="min-w-0 space-y-4">
      {byDraft.map(({ draft, current, previous }) => (
        <section
          key={draft.artifactId}
          className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4"
        >
          <h3 className="text-sm font-semibold text-fg-primary">{draft.title}</h3>

          {/*
            CONTENT-COMPOSE-1. The package is composed for the CURRENT revision, because that is the
            one a human is finishing. Older revisions keep their images (MEDIA-4A) but are not what
            is being assembled.
          */}
          <ContentPackagePanel artifactId={draft.artifactId} revisionNo={draft.currentRevision} />

          {/*
            The current revision, named explicitly. It is stated even when it has no images, because
            "revision 4 is current and has none" is exactly the fact a human needs in order to read
            the historical groups below correctly.
          */}
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium text-fg-secondary">
              Revision {draft.currentRevision} — current
            </p>
            {current.length > 0 ? (
              <RevisionMediaAssets
                assets={current}
                reviewStates={reviewStates}
                selectionTarget={{ artifactId: draft.artifactId, revisionNo: draft.currentRevision }}
              />
            ) : (
              <p className="text-xs text-fg-muted">No images have been generated for this revision.</p>
            )}
          </div>

          {/*
            OPS-VIS-2. Earlier revisions REST CLOSED. They are history, not the work being
            finished, and a draft at revision 6 pushed five revisions of images between the current
            one and everything below it. Every word of the historical wording is kept, inside.
          */}
          {previous.length === 0 ? null : (
            <details className="min-w-0 space-y-2 rounded-lg border border-border-subtle bg-surface-sunken p-3">
              <summary className="cursor-pointer select-none text-xs font-medium text-fg-secondary">
                Previous revisions ({previous.length})
              </summary>
              {/*
                Stated once, above the historical groups, so no asset card has to carry a disclaimer
                and no reader can mistake an older image for this revision's. Each card still names
                its own source revision, so the fact survives even out of this context.
              */}
              <p className="text-xs text-fg-muted">
                These images were generated from earlier revisions of this draft. They are shown with
                the revision they came from, and none of them is carried forward into revision{" "}
                {draft.currentRevision}.
              </p>
              {previous.map(([revisionNo, assets]) => (
                <div key={revisionNo} className="min-w-0 space-y-2">
                  <p className="text-xs text-fg-muted">Revision {revisionNo}</p>
                  <RevisionMediaAssets
                    assets={assets}
                    reviewStates={reviewStates}
                    selectionTarget={{ artifactId: draft.artifactId, revisionNo: draft.currentRevision }}
                  />
                </div>
              ))}
            </details>
          )}
        </section>
      ))}
    </div>
  );
}
