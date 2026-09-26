"use client";

import { useMemo, useState, useTransition } from "react";
import {
  readMediaAssetAction,
  requestMediaGenerationAction,
  reviewMediaAssetAction,
  setMediaSelectionAction,
} from "@/app/(dashboard)/operations/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MEDIA_ASSET_REVIEW_ACCEPT_NON_EFFECTS } from "@/features/media-asset-review/contracts";
import type { ContentSelectionRefusal } from "@/features/content-composition/contracts";
import type {
  MediaAssetReviewRefusal,
  MediaAssetReviewState,
} from "@/features/media-asset-review/contracts";
import type { ReadMediaAssetResult } from "@/features/media-assets/read-media-assets.server";
import type {
  MediaGenerationRefusal,
  RequestMediaGenerationResult,
} from "@/features/media-assets/contracts";

/*
 * revision-media-assets.tsx — the images generated for one content-draft revision (MEDIA-3).
 *
 * ── FIVE WORDS THAT MUST NOT BLUR ────────────────────────────────────────────
 *
 *   ADMITTED   the bytes were verified and stored. A fact about custody, written once.
 *   AVAILABLE  the private object can be verified and read RIGHT NOW. Checked per preview.
 *   APPROVED / DECLINED   a Governance decision exists. Read from the ledger, never from the asset.
 *   RETIRED    the Media Asset custody lifecycle ended. Unrelated to approval.
 *
 * NO DECISION IS NOT AN APPROVAL. An asset nobody has reviewed reads "Awaiting review", and the
 * only thing that turns that into "Approved" is a decision in the Governance ledger.
 *
 * ── APPROVED IS NOT PUBLISHED ────────────────────────────────────────────────
 *
 * Accepting records judgement and causes nothing. The released
 * `MEDIA_ASSET_REVIEW_ACCEPT_NON_EFFECTS` are rendered verbatim beside the decision controls rather
 * than paraphrased here, so the promise the authority makes is the sentence the reviewer reads.
 *
 * ── MEDIA-5: "USE AS REFERENCE" IS A NEW GENERATION, NEVER AN EDIT OF THIS ONE ──
 *
 * The control reads as what it is: this image is the INPUT to a new one. The original is never
 * opened for writing — there is no code path in Hebun that can rewrite admitted bytes — and the copy
 * says so beside the control rather than in a tooltip nobody opens.
 *
 * IT SENDS AN ASSET ID AND NOTHING ELSE. No storage key, no URL and no bytes cross this boundary;
 * the server resolves the id against the session tenant and derives the key itself.
 *
 * GOVERNANCE STATE IS SHOWN AND IS NOT A GATE. An admitted image may be used as a reference whether
 * it is approved, declined or never reviewed. Approving may not authorize an external act, so
 * declining may not forbid an internal one — the badge above informs the human, it does not permit
 * them. Only RETIRED removes the control, because that is a custody fact rather than a judgement.
 *
 * ── WHY PREVIEW IS LAZY ──────────────────────────────────────────────────────
 *
 * The listing is a database read. Opening ONE asset calls the released `readMediaAsset`, which
 * re-verifies byte size and SHA-256 against the store before minting a grant that lives about a
 * minute. Previewing every asset up front would mean a store round-trip per row and a fistful of
 * grants that expire before anyone clicks. The URL is deliberately short-lived and never cached.
 */

interface RevisionMediaAssetViewBase {
  readonly assetId: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly byteDigest: string;
  readonly width: number;
  readonly height: number;
  readonly admittedAt: string;
  readonly lifecycle: string;
  readonly sourceArtifactId: string;
  readonly sourceRevisionNo: number;
}

/*
 * MEDIA-SUPPLIED — a card renders what the record says about WHERE the bytes came from. A supplied
 * image carries no provider or model, so it cannot be captioned as generated.
 */
export type RevisionMediaAssetView =
  | (RevisionMediaAssetViewBase & {
      readonly origin: "generated";
      readonly provider: string;
      readonly model: string;
      readonly transport: string;
      readonly providerJobId: string | null;
    })
  | (RevisionMediaAssetViewBase & {
      readonly origin: "supplied";
      readonly suppliedSource: "google-drive";
      readonly suppliedSourceFileId: string;
    });

const SELECTION_REFUSAL_WORDING: Record<ContentSelectionRefusal, string> = {
  unauthenticated: "Your session has expired. Sign in again.",
  "invalid-input": "That image could not be added to this draft.",
  "persistence-unavailable": "Hebun could not record that right now. Nothing was changed.",
  "revision-unresolvable": "This draft revision could not be found in your organization.",
  "asset-unresolvable": "That image could not be found in your organization.",
  "asset-retired": "This image has been retired, and a retired image is not used in a draft.",
  "asset-not-image": "This asset is not an image, and a draft's content package takes images only.",
};

const PREVIEW_WORDING: Record<string, string> = {
  "storage-unavailable": "Media storage is not connected, so the image cannot be shown right now.",
  "persistence-unavailable": "The record could not be read right now.",
  /* NOT "no image". The asset exists; its stored bytes could not be confirmed. */
  "object-absent": "The stored image could not be found in media storage. The record still exists — this is a storage problem, not a missing asset.",
  "integrity-mismatch": "The stored bytes no longer match the admitted digest, so nothing was displayed. The record is intact — this is a storage custody problem and should be raised.",
};

const REVIEW_REFUSAL_WORDING: Record<MediaAssetReviewRefusal, string> = {
  unauthenticated: "Your session could not be resolved. Nothing was recorded.",
  "no-governance-authority": "This organization has no Governance authority yet, so no one can decide about this image.",
  "not-the-governance-authority": "Reviewing is a Governance act, and you do not hold it here. Nothing was recorded.",
  "asset-unresolvable": "That image could not be resolved in your organization. Nothing was recorded.",
  "asset-retired": "This image has been retired, and a retired image is not reviewed.",
  "asset-not-image": "This asset is not an image, and this review is for generated images only. Nothing was recorded.",
  "asset-digest-mismatch": "The image you were shown is not the image on record, so nothing was recorded. Reload before deciding again.",
  "justification-required": "A reason is required. Nothing was recorded.",
  "persistence-unavailable": "The Governance ledger could not be reached. Nothing was recorded.",
};

/* MEDIA-5. Every one of these is a preflight refusal: nothing was dispatched and nothing was spent. */
const GENERATION_REFUSAL_WORDING: Record<MediaGenerationRefusal, string> = {
  unauthenticated: "Your session could not be resolved.",
  "invalid-input": "The request was not well formed.",
  "storage-unavailable": "Media storage is not connected, so a new image would have nowhere to live.",
  "generation-transport-unavailable": "Image generation is not available right now.",
  "persistence-unavailable": "The database could not be reached.",
  "no-durable-agent": "Your organization has no durable agent that could author this.",
  "source-revision-unresolvable": "That content draft revision could not be resolved.",
  "duplicate-request": "This exact request was already submitted. It was not sent again, and you were not charged twice.",
  "source-asset-unresolvable": "That image could not be resolved in your organization.",
  "source-asset-retired": "This image has been retired, and a retired image is not used as a reference.",
  "source-asset-not-image": "This asset is not an image, and only an image can be used as a reference.",
  "source-asset-unavailable":
    "The stored bytes could not be read, or no longer match the admitted digest. Nothing was sent. This is a storage custody problem and should be raised.",
  "reference-edit-unsupported": "The configured image provider cannot edit an existing image.",
};

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The ledger's answer, in the reader's words. Absence is stated as absence. */
function reviewBadge(state: MediaAssetReviewState | undefined) {
  if (!state || state.status === "unavailable") {
    return { variant: "neutral" as const, label: "Review state unavailable" };
  }
  if (state.decision === "accepted") return { variant: "success" as const, label: "Approved" };
  if (state.decision === "declined") return { variant: "error" as const, label: "Declined" };
  return { variant: "warning" as const, label: "Awaiting review" };
}

export function RevisionMediaAssets({
  assets,
  reviewStates,
  selectionTarget,
}: {
  readonly assets: readonly RevisionMediaAssetView[];
  readonly reviewStates: readonly { readonly assetId: string; readonly state: MediaAssetReviewState }[];
  /*
   * CONTENT-COMPOSE-1. Which revision a chosen image would be chosen FOR — always the draft's
   * current revision, never the revision the image happens to have come from. An older image may be
   * chosen for today's revision; that is the whole point of keeping it reachable.
   */
  readonly selectionTarget?: { readonly artifactId: string; readonly revisionNo: number };
}) {
  if (assets.length === 0) return null;
  const byAsset = new Map(reviewStates.map((r) => [r.assetId, r.state]));
  return (
    <section className="min-w-0 space-y-3">
      <h4 className="text-xs font-medium text-fg-secondary">
        Images ({assets.length})
      </h4>
      {/*
        OPS-VIS-2. A GRID, not a stack. Each asset card is unchanged — same badges, same metadata,
        same lazy verified preview, same review controls, same custody wording. Stacking them full
        width made four images four screens; a grid makes them one, and changes nothing about what
        any card claims.
      */}
      <ul className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {assets.map((asset) => (
          <li key={asset.assetId} className="min-w-0">
            <AssetCard
              asset={asset}
              reviewState={byAsset.get(asset.assetId)}
              selectionTarget={selectionTarget}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AssetCard({
  asset,
  reviewState,
  selectionTarget,
}: {
  readonly asset: RevisionMediaAssetView;
  readonly reviewState: MediaAssetReviewState | undefined;
  readonly selectionTarget?: { readonly artifactId: string; readonly revisionNo: number };
}) {
  const [preview, setPreview] = useState<ReadMediaAssetResult | null>(null);
  const [loadingPreview, startPreview] = useTransition();
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [deciding, startDecision] = useTransition();

  const badge = reviewBadge(reviewState);
  const retired = asset.lifecycle === "retired";
  const supplied = asset.origin === "supplied";
  const decided = reviewState?.status === "read" && reviewState.decision !== null;

  function openPreview() {
    if (loadingPreview) return;
    startPreview(async () => setPreview(await readMediaAssetAction({ assetId: asset.assetId })));
  }

  function decide(decision: "accept" | "decline") {
    if (deciding || justification.trim().length === 0) return;
    setReviewMessage(null);
    startDecision(async () => {
      const result = await reviewMediaAssetAction({
        assetId: asset.assetId,
        /* Bound to the digest THIS card was rendered from: a stale card cannot decide. */
        byteDigest: asset.byteDigest,
        justification: justification.trim(),
        decision,
      });
      setReviewMessage(
        result.status === "reviewed"
          ? `Recorded: ${result.decision}. The image is unchanged, and nothing was published.`
          : REVIEW_REFUSAL_WORDING[result.reason],
      );
      if (result.status === "reviewed") setJustification("");
    });
  }

  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-lg border border-border-subtle bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={retired ? "neutral" : "success"}>{retired ? "Retired" : "Admitted"}</Badge>
        <Badge variant="neutral">{supplied ? "Supplied from Google Drive" : "AI-generated"}</Badge>
        {supplied ? null : <Badge variant={badge.variant}>{badge.label}</Badge>}
      </div>

      <dl className="grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs text-fg-muted">Dimensions</dt>
          <dd className="text-fg-primary">
            {asset.width} × {asset.height}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-fg-muted">Format</dt>
          <dd className="text-fg-primary">
            {asset.mimeType.replace("image/", "").toUpperCase()} · {formatBytes(asset.byteSize)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-fg-muted">Source</dt>
          <dd className="text-fg-primary">Revision {asset.sourceRevisionNo} of this draft</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-fg-muted">{supplied ? "Admitted" : "Generated"}</dt>
          <dd className="text-fg-primary">{new Date(asset.admittedAt).toLocaleString()}</dd>
        </div>
      </dl>

      {/* ── Preview: one asset, on request, always re-verified ── */}
      <div className="min-w-0 space-y-2">
        {preview === null ? (
          <Button variant="outline" size="sm" onClick={openPreview} disabled={loadingPreview} aria-busy={loadingPreview}>
            {loadingPreview ? "Verifying…" : "Show image"}
          </Button>
        ) : preview.status === "read" ? (
          <figure className="min-w-0 space-y-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL is not a static asset and must not be optimized, cached or proxied. */}
            <img
              src={preview.access.url}
              alt={`${supplied ? "Supplied" : "Generated"} image for revision ${asset.sourceRevisionNo}`}
              width={preview.asset.width}
              height={preview.asset.height}
              className="h-auto w-full rounded-lg border border-border-subtle"
            />
            <figcaption className="text-xs text-fg-muted">
              Private link, expires shortly. Verified against the admitted digest before it was shown.
            </figcaption>
          </figure>
        ) : (
          <p role="status" className="text-sm text-fg-primary">
            {preview.status === "unavailable"
              ? (PREVIEW_WORDING[preview.reason] ?? "The image could not be shown right now.")
              : preview.status === "not-found"
                ? "That image could not be resolved in your organization."
                : "Your session could not be resolved."}
          </p>
        )}
      </div>

      {/*
        ── Governance decision: the released writers, and nothing else ──
        MEDIA-SUPPLIED: the MEDIA-3 review is a creative review of GENERATED output; it is not offered
        for an image a human supplied.
      */}
      {retired || supplied ? null : (
        <details className="min-w-0">
          <summary className="cursor-pointer text-xs text-fg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring">
            {decided ? "Record another Governance decision" : "Review this image"}
          </summary>
          <div className="mt-3 space-y-2">
            <label htmlFor={`just-${asset.assetId}`} className="block text-xs font-medium text-fg-secondary">
              Reason
            </label>
            <textarea
              id={`just-${asset.assetId}`}
              rows={3}
              value={justification}
              disabled={deciding}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Why this image is, or is not, right for this draft."
              className="w-full min-w-0 resize-y rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm text-fg-primary placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:cursor-not-allowed disabled:text-fg-muted"
            />
            <ul className="space-y-0.5">
              {MEDIA_ASSET_REVIEW_ACCEPT_NON_EFFECTS.map((claim) => (
                <li key={claim} className="text-xs text-fg-muted">
                  Accepting {claim}.
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => decide("accept")}
                disabled={deciding || justification.trim().length === 0}
                aria-busy={deciding}
              >
                {deciding ? "Recording…" : "Accept"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => decide("decline")}
                disabled={deciding || justification.trim().length === 0}
                aria-busy={deciding}
              >
                Decline
              </Button>
            </div>
            {reviewMessage ? (
              <p role="status" aria-live="polite" className="text-sm text-fg-primary">
                {reviewMessage}
              </p>
            ) : null}
          </div>
        </details>
      )}

      {/* ── MEDIA-5: this image as the input to a new one ── */}
      {retired || supplied ? null : <UseAsReference asset={asset} />}
      {retired || supplied || !selectionTarget ? null : (
        <ChooseForDraft asset={asset} target={selectionTarget} />
      )}

      <details className="min-w-0">
        <summary className="cursor-pointer text-xs text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring">
          Record details
        </summary>
        <dl className="mt-2 space-y-2 text-xs">
          <div className="min-w-0">
            <dt className="text-fg-muted">Asset</dt>
            <dd className="break-all font-mono text-fg-secondary">{asset.assetId}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-fg-muted">SHA-256</dt>
            <dd className="break-all font-mono text-fg-secondary">{asset.byteDigest}</dd>
          </div>
          {asset.origin === "supplied" ? (
            <div className="min-w-0">
              <dt className="text-fg-muted">Supplied from</dt>
              <dd className="break-all text-fg-secondary">
                Google Drive file <span className="font-mono">{asset.suppliedSourceFileId}</span>
              </dd>
            </div>
          ) : (
            <div className="min-w-0">
              <dt className="text-fg-muted">Generated by</dt>
              <dd className="text-fg-secondary">
                {asset.provider} · {asset.model}
              </dd>
            </div>
          )}
        </dl>
      </details>
    </article>
  );
}

/*
 * CONTENT-COMPOSE-1 — put this image into the draft.
 *
 * Adds no rule. Custody is already reflected by the caller (a retired image gets no button), and
 * Governance is deliberately NOT consulted here: a declined image may still be chosen, because
 * declining may not forbid an internal act. Whether the package is READY is a separate question,
 * answered by the panel above from live Governance.
 */
function ChooseForDraft({
  asset,
  target,
}: {
  readonly asset: RevisionMediaAssetView;
  readonly target: { readonly artifactId: string; readonly revisionNo: number };
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function choose() {
    startTransition(async () => {
      const result = await setMediaSelectionAction({
        artifactId: target.artifactId,
        revisionNo: target.revisionNo,
        mediaAssetId: asset.assetId,
        selected: true,
      });
      setMessage(
        result.status === "refused"
          ? SELECTION_REFUSAL_WORDING[result.reason]
          : "Added to this draft. It appears in the content package above.",
      );
    });
  }

  return (
    <div className="mt-2 space-y-1">
      <button
        type="button"
        onClick={choose}
        disabled={pending}
        className="text-xs underline underline-offset-2 text-fg-secondary disabled:opacity-50"
      >
        Use in this draft
      </button>
      {message ? <p className="text-[11px] text-fg-muted">{message}</p> : null}
    </div>
  );
}

/**
 * MEDIA-5 — ask for a new image, using this one as the visual reference.
 *
 * ONE CLICK IS ONE REQUEST. `requestKey` is minted once per mounted form, so a double-click, a
 * double-submit or a resubmission after an error all carry the SAME key and the authority answers
 * `duplicate-request` without dispatching or charging again. The disabled button is a courtesy; the
 * database's unique index is the actual guarantee, and the copy says which one is load-bearing.
 */
function UseAsReference({ asset }: { readonly asset: RevisionMediaAssetView }) {
  const requestKey = useMemo(() => crypto.randomUUID(), []);
  const [instruction, setInstruction] = useState("");
  const [result, setResult] = useState<RequestMediaGenerationResult | null>(null);
  const [generating, startGeneration] = useTransition();

  function generate() {
    if (generating || instruction.trim().length === 0) return;
    setResult(null);
    startGeneration(async () => {
      setResult(
        await requestMediaGenerationAction({
          artifactId: asset.sourceArtifactId,
          revisionNo: asset.sourceRevisionNo,
          promptText: instruction.trim(),
          requestKey,
          /* The ID, and only the ID. No key, no URL, no bytes. */
          sourceAssetId: asset.assetId,
        }),
      );
    });
  }

  return (
    <details className="min-w-0">
      <summary className="cursor-pointer text-xs text-fg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring">
        Use as reference
      </summary>
      <div className="mt-3 space-y-2">
        <p className="text-xs text-fg-muted">
          Hebun will generate a <strong className="font-medium text-fg-secondary">new</strong> image using
          this one as the visual reference. This image is not changed: its bytes, its record and its
          review stay exactly as they are.
        </p>
        <label htmlFor={`ref-${asset.assetId}`} className="block text-xs font-medium text-fg-secondary">
          Instruction
        </label>
        <textarea
          id={`ref-${asset.assetId}`}
          rows={3}
          value={instruction}
          disabled={generating}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="What should change, and what should stay."
          className="w-full min-w-0 resize-y rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm text-fg-primary placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:cursor-not-allowed disabled:text-fg-muted"
        />
        <dl className="text-xs">
          <dt className="text-fg-muted">Reference image</dt>
          <dd className="break-all font-mono text-fg-secondary">{asset.assetId}</dd>
        </dl>
        <p className="text-xs text-fg-muted">
          The new image is filed for this draft at revision {asset.sourceRevisionNo}, and arrives
          unreviewed. Generating it publishes nothing and authorizes nothing.
        </p>
        <Button size="sm" onClick={generate} disabled={generating || instruction.trim().length === 0} aria-busy={generating}>
          {generating ? "Generating…" : "Generate from this image"}
        </Button>
        {result === null ? null : (
          <p role="status" aria-live="polite" className="text-sm text-fg-primary">
            {result.status === "admitted"
              ? "A new image was generated and admitted. It appears with this draft's images, awaiting review."
              : result.status === "refused"
                ? GENERATION_REFUSAL_WORDING[result.reason]
                : "The request was made, but no image was admitted. The attempt is on record."}
          </p>
        )}
      </div>
    </details>
  );
}
