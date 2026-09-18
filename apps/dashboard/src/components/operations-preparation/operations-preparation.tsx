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
  listRevisionMediaAssetsAction,
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

  return (
    <div className="mt-8 space-y-8">
      <RecipientsSection active={active} retired={retired} />
      <PreparedWorkSection listing={artifacts} workPurpose={workPurpose} reviewStates={reviewStates} />
      {/*
        MEDIA-2B. The generation door is offered only for drafts the authority would actually
        accept: a content draft that is still `draft`. The authority re-resolves the pair against
        the tenant anyway — this list is a convenience, never the permission.
      */}
      {/*
        MEDIA-3. The images generated for each draft's CURRENT revision, shown beside the draft they
        belong to. The relationship is the invocation's own `(tenant, artifact, revision)` key, so
        this reads a relationship MEDIA-1 already owns and records nothing new.

        The listings run in parallel and touch the database only — no store round-trip and no signed
        URL is created here. The review states are then read for EVERY listed asset in one batched
        call rather than one per asset, and a preview grant is minted only when a human opens one.
      */}
      <MediaAssetsForDrafts
        drafts={
          artifacts.status === "read"
            ? artifacts.artifacts
                .filter((a) => a.artifactType === CONTENT_DRAFT_TYPE && a.lifecycleStatus === "draft")
                .map((a) => ({ artifactId: a.id, title: a.title, revisionNo: a.currentRevision }))
            : []
        }
      />
      <GenerateImageWithHebun
        targets={
          artifacts.status === "read"
            ? artifacts.artifacts
                .filter((a) => a.artifactType === CONTENT_DRAFT_TYPE && a.lifecycleStatus === "draft")
                .map((a) => ({ artifactId: a.id, title: a.title, currentRevision: a.currentRevision }))
            : []
        }
      />
    </div>
  );
}

/**
 * The generated images of several drafts' current revisions.
 *
 * Server-only composition. It owns nothing: each listing is the released per-revision reader, and
 * every asset's Governance state comes from ONE batched derived read. A draft with no images
 * renders nothing at all, so an empty organization sees no empty scaffolding.
 */
async function MediaAssetsForDrafts({
  drafts,
}: {
  readonly drafts: readonly { readonly artifactId: string; readonly title: string; readonly revisionNo: number }[];
}) {
  if (drafts.length === 0) return null;

  const listings = await Promise.all(
    drafts.map(async (draft) => ({
      draft,
      listing: await listRevisionMediaAssetsAction({
        artifactId: draft.artifactId,
        revisionNo: draft.revisionNo,
      }),
    })),
  );

  const withAssets = listings.filter(
    (entry) => entry.listing.status === "read" && entry.listing.assets.length > 0,
  );
  if (withAssets.length === 0) return null;

  /* One read for every asset on the page, not one per asset. */
  const reviewStates = await readMediaAssetReviewStatesAction({
    assetIds: withAssets.flatMap((entry) =>
      entry.listing.status === "read" ? entry.listing.assets.map((a) => a.assetId) : [],
    ),
  });

  return (
    <div className="min-w-0 space-y-6">
      {withAssets.map(({ draft, listing }) => (
        <section key={draft.artifactId} className="min-w-0 space-y-2">
          <h3 className="text-sm font-medium text-fg-primary">{draft.title}</h3>
          <RevisionMediaAssets
            assets={listing.status === "read" ? listing.assets : []}
            reviewStates={reviewStates}
          />
        </section>
      ))}
    </div>
  );
}
