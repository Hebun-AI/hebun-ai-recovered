"use client";

import { useState, useTransition } from "react";
import {
  admitGeneratedVideoAction,
  listArtifactMediaVideosAction,
  listArtifactVideoGenerationsAction,
  observeVideoGenerationAction,
  readMediaVideoAction,
  reviewMediaAssetAction,
  setMediaSelectionAction,
} from "@/app/(dashboard)/operations/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MEDIA_ASSET_REVIEW_ACCEPT_NON_EFFECTS } from "@/features/media-asset-review/contracts";
import type { MediaAssetReviewState } from "@/features/media-asset-review/contracts";

/*
 * revision-media-videos.tsx — the videos of ONE content draft (MV-3, widened by VIDEO CONTENT CHAIN).
 *
 * Everything here is a rendering of rows the server already read, plus buttons that each call ONE
 * released action. Kind comes from the row (`media_kind`), provenance from the Media read model
 * (`origin`), review state from the Governance ledger, lifecycle state from the invocation row — never
 * from a MIME type, a file name, a credential or a provider descriptor. No provider URL reaches this
 * file: the lifecycle reports only WHETHER an output was reported.
 *
 * THE WORDS THAT MUST NOT BLUR:
 *
 *   provider-pending    ≠ failed          it is not a video yet; a human observes it, one read per click
 *   dispatch-unknown    ≠ failed          its fate is unknown; it is never retried
 *   provider-succeeded  ≠ admitted        the provider says output exists; Media holds nothing yet
 *   admitted            ≠ reviewed        bytes verified and stored; nobody has judged them
 *   reviewed            ≠ selected        a decision exists; the video is not in the draft
 *   selected            ≠ published       Hebun has no video publishing path at all
 *
 * A generated video is reviewed and chosen exactly as a generated image is. HEBY-CONTENT-OPS-1: a
 * SUPPLIED video is reviewed and chosen by the same released writers — its badge still says where it
 * came from, and nothing here makes it generated or clears it for an external AI provider.
 */

type VideoListing = Awaited<ReturnType<typeof listArtifactMediaVideosAction>>;
type GenerationListing = Awaited<ReturnType<typeof listArtifactVideoGenerationsAction>>;
export type DraftVideo = Extract<VideoListing, { status: "read" }>["videos"][number];
export type DraftVideoGeneration = Extract<GenerationListing, { status: "read" }>["generations"][number];

type AdmitResult = Awaited<ReturnType<typeof admitGeneratedVideoAction>>;
type ObserveResult = Awaited<ReturnType<typeof observeVideoGenerationAction>>;
type SelectResult = Awaited<ReturnType<typeof setMediaSelectionAction>>;
type ReviewResult = Awaited<ReturnType<typeof reviewMediaAssetAction>>;

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

const STATE_WORDING: Record<string, string> = {
  registered: "Registered. Nothing has been sent to the provider.",
  dispatching: "Being sent. The request may have left Hebun.",
  "provider-pending": "The provider accepted the job. It is not a video yet.",
  "provider-succeeded": "The provider reports an output. It is not in Media until admitted.",
  "provider-failed": "The provider reported that this job failed.",
  "dispatch-unknown": "Sent, but no trustworthy answer came back. Its fate is unknown, and it is not retried.",
};

const ADMISSION_WORDING: Record<string, string> = {
  "not-attempted": "Not admitted yet.",
  admitted: "Admitted into Media.",
  refused: "Admission was refused for these bytes.",
  failed: "Admission failed after the bytes were stored.",
};

function observeWording(r: ObserveResult): string {
  switch (r.status) {
    case "observed-pending":
      return "The provider says the job is still running.";
    case "observation-unreadable":
      return "No authoritative answer was read. The job is still recorded as pending — not failed.";
    case "transitioned":
      return `The job is now ${r.state}.`;
    case "no-transition":
      return `Nothing to observe: the job is ${r.state}.`;
    case "refused":
      return r.reason === "generation-transport-unavailable"
        ? "The provider cannot be asked right now: its connectivity is not enabled. Nothing was changed."
        : `Not observed (${r.reason}). Nothing was changed.`;
  }
}

function admitWording(r: AdmitResult): string {
  switch (r.status) {
    case "admitted":
    case "existing":
      return "Admitted. The video below is now in Media, awaiting review.";
    case "not-admitted":
      return `The output was ${r.outcome === "refused" ? "refused" : "not admitted"}: ${r.failure}.${r.bytesOrphaned ? " Bytes were stored but no asset names them." : ""}`;
    case "refused":
      return r.reason === "generation-transport-unavailable"
        ? "The provider cannot be asked for the output right now: its connectivity is not enabled. Nothing was recorded."
        : `Not admitted (${r.reason}). Nothing was recorded.`;
  }
}

function GenerationRow({ generation }: { readonly generation: DraftVideoGeneration }) {
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canObserve = generation.state === "provider-pending";
  const canAdmit = generation.state === "provider-succeeded" && generation.admissionOutcome === "not-attempted";
  return (
    <li className="min-w-0 space-y-1.5 rounded-lg border border-border-subtle p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant={generation.state === "provider-failed" ? "error" : generation.state === "dispatch-unknown" ? "warning" : "info"}>
          {generation.state}
        </Badge>
        {generation.state === "provider-succeeded" ? (
          <span className="text-fg-muted">{ADMISSION_WORDING[generation.admissionOutcome] ?? generation.admissionOutcome}</span>
        ) : null}
        {generation.simulated ? <Badge variant="warning">simulated</Badge> : null}
        <span className="text-fg-muted">
          {generation.provider} · {generation.model} · from revision {generation.sourceRevisionNo}
          {/* IMAGE → VIDEO: the MEDIA-5 lineage, as recorded on the attempt. */}
          {generation.sourceMediaAssetId ? ` · from image ${generation.sourceMediaAssetId.slice(0, 8)}` : ""}
        </span>
      </div>
      <p className="text-xs text-fg-secondary">{STATE_WORDING[generation.state] ?? generation.state}</p>
      {generation.pollCount > 0 ? (
        <p className="text-[11px] text-fg-muted">
          Observed {generation.pollCount} time{generation.pollCount === 1 ? "" : "s"}
          {generation.lastPolledAt ? `, last ${new Date(generation.lastPolledAt).toLocaleString()}` : ""}.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canObserve ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => start(async () => setNote(observeWording(await observeVideoGenerationAction({ invocationId: generation.invocationId }))))}
          >
            {pending ? "Asking…" : "Observe"}
          </Button>
        ) : null}
        {canAdmit ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => start(async () => setNote(admitWording(await admitGeneratedVideoAction({ invocationId: generation.invocationId }))))}
          >
            {pending ? "Admitting…" : "Admit into Media"}
          </Button>
        ) : null}
      </div>
      {note ? <p className="text-xs text-fg-muted">{note}</p> : null}
    </li>
  );
}

function reviewWord(state: MediaAssetReviewState | undefined): { label: string; variant: "success" | "error" | "warning" | "info" } {
  if (!state || state.status !== "read") return { label: "Review state unavailable", variant: "warning" };
  if (state.decision === "accepted") return { label: "Approved", variant: "success" };
  if (state.decision === "declined") return { label: "Declined", variant: "error" };
  return { label: "Awaiting review", variant: "info" };
}

function reviewNote(r: ReviewResult): string {
  if (r.status === "reviewed") return r.decision === "accepted" ? "Accepted. Nothing was published." : "Declined. The video is unchanged.";
  return `Nothing was recorded (${r.reason}).`;
}

function selectNote(r: SelectResult): string {
  if (r.status === "selected") return "Added to this draft. It appears in the content package above.";
  if (r.status === "deselected") return "Removed from this draft.";
  return `Not added (${r.reason}).`;
}

function VideoRow({
  video,
  reviewState,
  target,
}: {
  readonly video: DraftVideo;
  readonly reviewState: MediaAssetReviewState | undefined;
  readonly target: { readonly artifactId: string; readonly revisionNo: number };
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [pending, start] = useTransition();
  const retired = video.lifecycle !== "admitted";
  const generated = video.origin === "generated";
  const review = reviewWord(reviewState);

  function decide(decision: "accept" | "decline") {
    if (pending || justification.trim().length === 0) return;
    start(async () => {
      setNote(
        reviewNote(
          await reviewMediaAssetAction({
            assetId: video.assetId,
            /* The digest shown below is the one bound: a mismatch records nothing. */
            byteDigest: video.byteDigest,
            justification: justification.trim(),
            decision,
          }),
        ),
      );
    });
  }

  return (
    <li className="min-w-0 space-y-2 rounded-lg border border-border-subtle p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{generated ? "Generated video" : "Supplied video"}</Badge>
        <Badge variant={review.variant}>{review.label}</Badge>
        {retired ? <Badge variant="warning">Retired</Badge> : null}
        <span className="text-[11px] text-fg-muted">from revision {video.sourceRevisionNo}</span>
      </div>
      <p className="text-xs text-fg-secondary">
        {video.width}×{video.height} · {seconds(video.durationMs)} · {video.videoCodec}
        {video.audioCodec ? ` + ${video.audioCodec}` : " · no audio"} · {video.frameRate} fps ·{" "}
        {(video.byteSize / (1024 * 1024)).toFixed(1)} MiB
      </p>
      <p className="break-all font-mono text-[11px] text-fg-muted">SHA-256 {video.byteDigest}</p>

      {url ? (
        <video className="w-full max-w-md rounded" controls preload="metadata" src={url} />
      ) : (
        <Button
          size="sm"
          disabled={pending || retired}
          onClick={() =>
            start(async () => {
              setNote(null);
              const r = await readMediaVideoAction({ assetId: video.assetId });
              if (r.status === "read") setUrl(r.access.url);
              else setNote("This video could not be opened: its stored bytes were not verified.");
            })
          }
        >
          {pending ? "Verifying…" : "Play"}
        </Button>
      )}

      {!retired ? (
        <div className="min-w-0 space-y-2 border-t border-border-subtle pt-2">
          <label htmlFor={`video-review-${video.assetId}`} className="block text-xs font-medium text-fg-secondary">
            Review reason
          </label>
          <textarea
            id={`video-review-${video.assetId}`}
            rows={2}
            className="w-full min-w-0 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm text-fg-primary"
            value={justification}
            disabled={pending}
            onChange={(e) => setJustification(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending || justification.trim().length === 0} onClick={() => decide("accept")}>
              Accept video
            </Button>
            <Button size="sm" variant="outline" disabled={pending || justification.trim().length === 0} onClick={() => decide("decline")}>
              Decline video
            </Button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () =>
                  setNote(
                    selectNote(
                      await setMediaSelectionAction({
                        artifactId: target.artifactId,
                        revisionNo: target.revisionNo,
                        mediaAssetId: video.assetId,
                        selected: true,
                      }),
                    ),
                  ),
                )
              }
              className="text-xs underline underline-offset-2 text-fg-secondary disabled:opacity-50"
            >
              Use in revision {target.revisionNo}
            </button>
          </div>
          <ul className="space-y-0.5 text-[11px] text-fg-muted">
            {MEDIA_ASSET_REVIEW_ACCEPT_NON_EFFECTS.map((line) => (
              <li key={line}>Accepting {line}.</li>
            ))}
          </ul>
        </div>
      ) : null}
      {!generated ? (
        <p className="text-[11px] text-fg-muted">
          Supplied from the organization&apos;s own Google Drive. It was not generated by Hebun.
        </p>
      ) : null}
      {note ? <p className="text-xs text-fg-muted">{note}</p> : null}
    </li>
  );
}

/** The videos and video attempts of ONE draft. Rows arrive already read; nothing is fetched on mount. */
export function DraftVideos({
  artifactId,
  currentRevision,
  videos,
  generations,
  reviewStates,
}: {
  readonly artifactId: string;
  readonly currentRevision: number;
  readonly videos: readonly DraftVideo[];
  readonly generations: readonly DraftVideoGeneration[];
  readonly reviewStates: readonly { readonly assetId: string; readonly state: MediaAssetReviewState }[];
}) {
  /* An admitted attempt is represented by its video; only the attempts still in motion are listed. */
  const attempts = generations.filter((g) => g.admissionOutcome !== "admitted");
  if (videos.length === 0 && attempts.length === 0) return null;
  const target = { artifactId, revisionNo: currentRevision };
  return (
    <div className="min-w-0 space-y-2">
      {attempts.length > 0 ? (
        <ul className="min-w-0 space-y-2" aria-label="Video generation attempts">
          {attempts.map((g) => (
            <GenerationRow key={g.invocationId} generation={g} />
          ))}
        </ul>
      ) : null}
      {videos.length > 0 ? (
        <ul className="min-w-0 space-y-2" aria-label="Videos">
          {videos.map((v) => (
            <VideoRow
              key={v.assetId}
              video={v}
              reviewState={reviewStates.find((r) => r.assetId === v.assetId)?.state}
              target={target}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
