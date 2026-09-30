"use client";

/*
 * CONTENT-COMPOSE-1 — "what is the finished thing, and is it finished?"
 *
 * One panel per content draft, above its images. It renders the package the reader composed and
 * adds no rule of its own: `ready` and `blockers` arrive already decided, so this file cannot
 * invent a readiness rule from a subset of them and cannot disagree with Governance.
 *
 * READY IS RENDERED BESIDE WHAT IT DOES NOT MEAN. The non-claims are printed verbatim next to the
 * badge, every time, because the entire risk of this surface is a human reading "READY" as "Hebun
 * will post this". Publishing is a separate governed act; READY authorizes none of it.
 *
 * CONTENT-PUBLICATION-STATE-1 — beside readiness, what Action Authorization's ledger records about
 * publishing THIS revision, read on the server and handed down. Visibility only: this panel offers
 * no proposal, approval or execution control, and blocks nothing.
 */
import { useTransition } from "react";
import { setMediaSelectionAction } from "@/app/(dashboard)/operations/actions";
import type { ContentPackageResult } from "@/features/content-composition/read-content-package.server";
import {
  CONTENT_PACKAGE_NON_CLAIMS,
  CONTENT_PACKAGE_VIDEO_NON_CLAIM,
  describeSelectedMedia,
  type ContentPackageBlocker,
} from "@/features/content-composition/contracts";
import {
  CONTENT_PUBLICATION_NON_CLAIM,
  PUBLICATION_STAGE_WORDING,
  type ContentPublicationState,
} from "@/features/action-authorization/content-publication-state";
import {
  PUBLICATION_MEASUREMENT_NON_CLAIM,
  PUBLICATION_MEASUREMENT_WORDING,
  YOUTUBE_MEASUREMENT_NOT_AVAILABLE,
  type PublicationMeasurement,
  type RevisionPublicationMeasurements,
} from "@/features/content-publication-measurement/contracts";

const BLOCKER_WORDING: Record<ContentPackageBlocker, string> = {
  "copy-empty": "This revision has no copy yet.",
  "no-media-selected": "No image or video has been chosen for this draft.",
  "selected-media-retired": "A chosen image or video has been retired and can no longer be used.",
  "selected-media-declined": "A chosen image or video was declined in review.",
  "selected-media-unreviewed": "A chosen image or video has not been reviewed yet.",
  "copy-declined": "The copy was sent back for changes.",
  "copy-unreviewed": "The copy has not been reviewed yet.",
};

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ContentPackagePanel({
  artifactId,
  revisionNo,
  result,
  publication,
  measurement,
}: {
  readonly artifactId: string;
  readonly revisionNo: number;
  /*
   * VIDEO CONTENT CHAIN (production-acceptance fix). The package is read ON THE SERVER, by the
   * released reader, on every render of /operations, and handed down. It used to be fetched here
   * once, on mount, into client state — so after a selection elsewhere on the page the server
   * re-rendered, the props did not change, the effect did not re-run, and this panel kept showing
   * the package as it was BEFORE the selection. Now every successful selection or removal
   * (`revalidatePath("/operations")` in the action) re-reads the package on the server, and this
   * panel renders exactly that read. It holds no copy of its own.
   */
  readonly result: ContentPackageResult;
  /* CONTENT-PUBLICATION-STATE-1 — the ledger's record for this revision, read on the server. */
  readonly publication: ContentPublicationState;
  /* CONTENT-PUBLICATION-MEASUREMENT-LINK-1 — derived on the server from the ledger + observations. */
  readonly measurement: RevisionPublicationMeasurements;
}) {
  const [pending, startTransition] = useTransition();

  function remove(mediaAssetId: string) {
    /* The action revalidates /operations on success; the new server read arrives as `result`. */
    startTransition(async () => {
      await setMediaSelectionAction({ artifactId, revisionNo, mediaAssetId, selected: false });
    });
  }

  if (result.status === "unavailable") {
    return <p className="text-xs text-fg-muted">The content package could not be read right now.</p>;
  }
  /* Not a content draft, or not this tenant's. Both are simply "nothing to compose here". */
  if (result.status === "not-found") return null;

  const pkg = result.package;

  return (
    <section className="min-w-0 space-y-3 rounded-md border border-border-subtle p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-xs font-medium text-fg-secondary">Content package</h4>
        <span
          className={
            pkg.ready
              ? "rounded px-1.5 py-0.5 text-[11px] font-medium text-fg-primary ring-1 ring-border-strong"
              : "rounded px-1.5 py-0.5 text-[11px] text-fg-muted ring-1 ring-border-subtle"
          }
        >
          {pkg.ready ? "READY" : "NOT READY"}
        </span>
        <span className="text-[11px] text-fg-muted">
          for {pkg.destination} · revision {pkg.revisionNo}
        </span>
      </div>

      <dl className="grid gap-1 text-[11px] text-fg-muted">
        <div className="flex gap-2">
          <dt className="min-w-24">Copy review</dt>
          <dd className="text-fg-secondary">{pkg.copyReviewState}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="min-w-24">Chosen media</dt>
          <dd className="text-fg-secondary">{describeSelectedMedia(pkg.selected)}</dd>
        </div>
      </dl>

      {pkg.selected.length === 0 ? null : (
        <ul className="min-w-0 space-y-1">
          {pkg.selected.map((s) => (
            <li key={s.mediaAssetId} className="flex flex-wrap items-center gap-2 text-[11px]">
              {/* VIDEO CONTENT CHAIN — the kind is the reader's `mediaKind`, never the MIME or a name. */}
              <span className="text-fg-secondary">
                {s.mediaKind === "video" && s.video
                  ? `Video ${s.width}×${s.height} · ${(s.video.durationMs / 1000).toFixed(1)} s · ${s.video.videoCodec}${s.video.audioCodec ? ` + ${s.video.audioCodec}` : " · no audio"} · ${formatBytes(s.byteSize)}`
                  : `Image ${s.width}×${s.height} ${s.mimeType.replace("image/", "").toUpperCase()} ${formatBytes(s.byteSize)}`}
              </span>
              <span className="text-fg-muted">
                {pkg.mediaReviewStates[s.mediaAssetId] ?? "unreviewed"}
              </span>
              {/* Provenance, kept visible: chosen here, generated there. MEDIA-4A's distinction. */}
              <span className="text-fg-muted">generated in revision {s.sourceRevisionNo}</span>
              {s.lifecycle === "retired" ? <span className="text-fg-muted">retired</span> : null}
              <button
                type="button"
                onClick={() => remove(s.mediaAssetId)}
                disabled={pending}
                className="underline underline-offset-2 text-fg-muted disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {pkg.blockers.length === 0 ? null : (
        <ul className="space-y-0.5 text-[11px] text-fg-muted">
          {pkg.blockers.map((b) => (
            <li key={b}>{BLOCKER_WORDING[b]}</li>
          ))}
        </ul>
      )}

      {/*
        VIDEO CONTENT CHAIN / YOUTUBE-WRITE-2 — uploading a chosen video is its own governed act.
        Said whenever a video is chosen.
      */}
      {pkg.selected.some((s) => s.mediaKind === "video") ? (
        <p className="text-[11px] text-fg-muted">{CONTENT_PACKAGE_VIDEO_NON_CLAIM}</p>
      ) : null}

      <PublicationRecord publication={publication} />
      <PublicationMeasurementRecord measurement={measurement} />

      {/* Printed every time, ready or not. This is the part that must not be collapsible. */}
      <ul className="space-y-0.5 text-[11px] text-fg-muted">
        {CONTENT_PACKAGE_NON_CLAIMS.map((claim) => (
          <li key={claim}>{claim}</li>
        ))}
      </ul>
    </section>
  );
}

/*
 * CONTENT-PUBLICATION-STATE-1 — three answers, never collapsed: could not be read, read and empty,
 * or the recorded requests oldest first. Ledger words only; nothing here says "published" or "live",
 * and no control is offered.
 */
function PublicationRecord({ publication }: { readonly publication: ContentPublicationState }) {
  return (
    <div className="min-w-0 space-y-1 text-[11px]">
      <h5 className="font-medium text-fg-secondary">Publication record (this revision)</h5>
      {publication.status === "unknown" ? (
        <p className="text-fg-muted">The publication record could not be read right now. That is unknown, not “none”.</p>
      ) : publication.status === "no-request-recorded" ? (
        <p className="text-fg-muted">No publish request is recorded for this revision.</p>
      ) : (
        <>
          {publication.truncated ? (
            <p className="text-fg-muted">Showing the most recent {publication.entries.length} requests; older ones are not shown.</p>
          ) : null}
          <ul className="min-w-0 space-y-0.5">
            {publication.entries.map((e) => (
              <li key={e.requestId} className="flex min-w-0 flex-wrap gap-x-2 text-fg-muted">
                <span className="text-fg-secondary">{e.destination === "youtube" ? "YouTube" : "Instagram"}</span>
                <span>{PUBLICATION_STAGE_WORDING[e.stage]}</span>
                {e.attempt?.providerResultId ? (
                  <span className="break-all">provider id {e.attempt.providerResultId}</span>
                ) : null}
                {/* DUPLICATE-GUARD-1: the id an intentional new publication acknowledges. */}
                {e.attempt ? <span className="break-all">attempt {e.attempt.attemptId}</span> : null}
                <span>proposed {new Date(e.proposedAt).toISOString().slice(0, 16).replace("T", " ")} UTC</span>
              </li>
            ))}
          </ul>
          <p className="text-fg-muted">{CONTENT_PUBLICATION_NON_CLAIM}</p>
        </>
      )}
    </div>
  );
}

/*
 * CONTENT-PUBLICATION-MEASUREMENT-LINK-1 — what Hebun's stored Instagram observations say about
 * each accepted publication's provider id. Read-only: no control, no interpretation. A count
 * Instagram did not report is printed as "not reported", never as 0.
 */
const utc = (iso: string): string => `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;
const count = (value: number | null): string => (value === null ? "not reported" : String(value));

function PublicationMeasurementRecord({ measurement }: { readonly measurement: RevisionPublicationMeasurements }) {
  if (measurement.status === "unknown") return null;
  if (measurement.instagram.length === 0 && measurement.youtubeAcceptedCount === 0) return null;
  return (
    <div className="min-w-0 space-y-1 text-[11px]">
      <h5 className="font-medium text-fg-secondary">Observed after publication</h5>
      <ul className="min-w-0 space-y-0.5">
        {measurement.instagram.map((m) => (
          <li key={m.publication.attemptId} className="flex min-w-0 flex-wrap gap-x-2 text-fg-muted">
            <span className="text-fg-secondary">Instagram</span>
            <span className="break-all">id {m.publication.providerResultId}</span>
            <span>{PUBLICATION_MEASUREMENT_WORDING[m.status]}</span>
            <MeasurementFacts m={m} />
          </li>
        ))}
      </ul>
      {measurement.youtubeAcceptedCount > 0 ? <p className="text-fg-muted">{YOUTUBE_MEASUREMENT_NOT_AVAILABLE}</p> : null}
      {measurement.instagram.length > 0 ? <p className="text-fg-muted">{PUBLICATION_MEASUREMENT_NON_CLAIM}</p> : null}
    </div>
  );
}

function MeasurementFacts({ m }: { readonly m: PublicationMeasurement }) {
  switch (m.status) {
    case "observed":
      return (
        <>
          <span>likes {count(m.latestLikeCount)}</span>
          <span>comments {count(m.latestCommentCount)}</span>
          <span>as of {utc(m.latestObservedAt)}</span>
          {m.earliestObservedAt !== m.latestObservedAt ? <span>first seen {utc(m.earliestObservedAt)}</span> : null}
          {m.evolution ? (
            <span>
              since {utc(m.evolution.previousObservedAt)}:{" "}
              likes {m.evolution.item.likeCount.status === "comparable" ? signed(m.evolution.item.likeCount.change) : "not comparable"},{" "}
              comments {m.evolution.item.commentCount.status === "comparable" ? signed(m.evolution.item.commentCount.change) : "not comparable"}
            </span>
          ) : null}
        </>
      );
    case "no-observation-since-publication":
      return m.latestObservedAt ? <span>latest observation {utc(m.latestObservedAt)}</span> : null;
    case "absent-from-complete-window":
    case "outside-clipped-window":
      return <span>observation {utc(m.latestObservedAt)}</span>;
    case "history-unreadable":
      return null;
  }
}

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));
