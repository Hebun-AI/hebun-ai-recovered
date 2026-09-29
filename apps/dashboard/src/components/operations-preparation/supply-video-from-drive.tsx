"use client";

import { useState, useTransition } from "react";
import {
  admitSuppliedDriveVideoBatchAction,
  authorizeMediaVideoPickerSessionAction,
} from "@/app/(dashboard)/operations/actions";
import { Button } from "@/components/ui/button";
import { CONTENT_INTAKE_BATCH_LIMITS } from "@/features/content-intake/contracts";
import { BATCH_REFUSAL_WORDING, DriveBatchOutcome, runDriveBatch, type DriveBatchRun } from "./drive-batch-outcome";
import { openGoogleDriveMediaPicker } from "./google-drive-media-picker.client";
import type {
  AdmitSuppliedDriveVideoRefusal,
} from "@/features/media-assets/admit-supplied-drive-video.server";
import type { GenerationTarget } from "./generate-image-with-hebun";

/*
 * MV-3 — the human door for a video the organization already has in Google Drive. Same least-privilege
 * model as the image door: files picked in Google's own chooser (per-file `drive.file`; CONTENT-INTAKE-1:
 * up to the server's video bound in one ceremony, each admitted on its own), the chooser
 * offering only `video/mp4` (the list comes from the server). The access token goes from the server's
 * answer straight into Google's chooser and is never kept in state.
 */

const NOTHING_KEPT = "No asset was filed.";

/*
 * MV-3 — a supplied Drive video. Streamed from Drive to the Hebun media store, probed there, and
 * admitted only as MP4 + H.264 + (AAC or no audio). Supplying is not a review, a selection or a publish.
 */
const REFUSAL_WORDING: Record<AdmitSuppliedDriveVideoRefusal, string> = {
  unauthenticated: `Your session could not be resolved. ${NOTHING_KEPT}`,
  "invalid-input": `The selection or the draft revision is not valid. ${NOTHING_KEPT}`,
  "storage-unavailable": `Media storage is not connected. ${NOTHING_KEPT}`,
  "persistence-unavailable": `The database could not be reached. ${NOTHING_KEPT}`,
  "source-revision-unresolvable": `That content draft revision could not be resolved in your organization. ${NOTHING_KEPT}`,
  "drive-capability-not-available": `Hebun has not been granted access to files you choose in Google Drive. ${NOTHING_KEPT}`,
  "drive-connection-not-bound": `The Google account you chose the file with is no longer the one connected, or the chooser session expired. Nothing was read through any other account. Open the chooser again. ${NOTHING_KEPT}`,
  "drive-read-failed": `Google Drive did not return the selected file as an MP4 video. ${NOTHING_KEPT}`,
  "byte-size-exceeded": `The video exceeds the 20 MiB limit. ${NOTHING_KEPT}`,
  "storage-write-failed": `The media store did not accept the video. Video storage may not be enabled yet. ${NOTHING_KEPT}`,
  "probe-failed": `The file could not be read as a video. ${NOTHING_KEPT}`,
  "video-not-admissible": `Only MP4 video with H.264 and AAC (or no) audio is accepted. ${NOTHING_KEPT}`,
  "integrity-mismatch": `The stored bytes did not match what was relayed. ${NOTHING_KEPT} This should be raised.`,
  "asset-retired": "This exact video was already supplied for this revision and has since been retired.",
};

/** CONTENT-INTAKE-1 — the server's bound for one video batch; the chooser is told the same number. */
const MAX = CONTENT_INTAKE_BATCH_LIMITS.video.maxFiles;
const NOUN = { one: "video", many: "videos" } as const;

const FIELD =
  "w-full min-w-0 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm text-fg-primary " +
  "placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-primary-ring disabled:cursor-not-allowed disabled:text-fg-muted";
const LABEL = "block text-xs font-medium text-fg-secondary";

export function SupplyVideoFromDrive({ targets }: { readonly targets: readonly GenerationTarget[] }) {
  const [artifactId, setArtifactId] = useState("");
  const [revisionNo, setRevisionNo] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [run, setRun] = useState<{ readonly outcome: DriveBatchRun; readonly names: ReadonlyMap<string, string> } | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = targets.find((t) => t.artifactId === artifactId);
  const ready = Boolean(artifactId) && Boolean(revisionNo);

  function chooseAndSupply() {
    if (!ready || pending) return;
    setMessage(null);
    setRun(null);
    startTransition(async () => {
      const session = await authorizeMediaVideoPickerSessionAction();
      if (session.status !== "authorized") {
        setMessage(session.detail);
        return;
      }
      const outcome = await openGoogleDriveMediaPicker({
        accessToken: session.accessToken,
        apiKey: session.apiKey,
        appId: session.appId,
        mimeTypes: session.mimeTypes,
        maxItems: MAX,
        title: `Choose up to ${MAX} MP4 videos to supply to Hebun`,
      });
      if (outcome.status === "cancelled") {
        setMessage("No video was chosen. Nothing was read or stored.");
        return;
      }
      if (outcome.status === "unavailable") {
        setMessage(outcome.detail);
        return;
      }
      const names = new Map(outcome.documents.map((d) => [d.fileId, d.name] as const));
      const result = await runDriveBatch(
        outcome.documents.map((d) => d.fileId),
        (driveFileIds) =>
          admitSuppliedDriveVideoBatchAction({ artifactId, revisionNo: Number(revisionNo), driveFileIds, pickerBinding: session.binding }),
      );
      if (result.status === "refused") {
        setMessage(BATCH_REFUSAL_WORDING[result.reason]);
        return;
      }
      setRun({ outcome: result, names });
    });
  }

  if (targets.length === 0) {
    return (
      <p className="text-sm text-fg-secondary">
        Prepare a content draft first — a supplied video is always admitted for a specific draft revision.
      </p>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <div className="min-w-0 space-y-1.5">
          <label htmlFor="supply-video-artifact" className={LABEL}>
            Content draft
          </label>
          <select
            id="supply-video-artifact"
            className={FIELD}
            value={artifactId}
            disabled={pending}
            onChange={(e) => {
              setArtifactId(e.target.value);
              const next = targets.find((t) => t.artifactId === e.target.value);
              setRevisionNo(next ? String(next.currentRevision) : "");
            }}
          >
            <option value="">Choose a draft…</option>
            {targets.map((t) => (
              <option key={t.artifactId} value={t.artifactId}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 space-y-1.5">
          <label htmlFor="supply-video-revision" className={LABEL}>
            Revision
          </label>
          <input
            id="supply-video-revision"
            type="number"
            inputMode="numeric"
            min={1}
            max={selected?.currentRevision ?? 1}
            className={FIELD}
            value={revisionNo}
            disabled={pending || !selected}
            onChange={(e) => setRevisionNo(e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-fg-muted">
        You choose up to {MAX} MP4 videos (H.264, AAC or silent, each up to 20 MiB) in Google&apos;s own chooser, in one go; each is admitted or refused on its own. Hebun
        can open only the file you choose, streams it once to its own store and verifies it there.
      </p>
      <Button size="sm" onClick={chooseAndSupply} disabled={!ready || pending} aria-busy={pending}>
        {pending ? "Working…" : "Choose videos in Google Drive"}
      </Button>
      {run ? <DriveBatchOutcome run={run.outcome} names={run.names} refusalWording={REFUSAL_WORDING} noun={NOUN} /> : null}
      {message ? (
        <p role="status" aria-live="polite" className="text-sm text-fg-primary">
          {message}
        </p>
      ) : null}
    </div>
  );
}
