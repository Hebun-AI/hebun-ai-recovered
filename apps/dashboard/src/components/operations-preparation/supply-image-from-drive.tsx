"use client";

import { useState, useTransition } from "react";
import {
  admitSuppliedDriveImageAction,
  authorizeMediaPickerSessionAction,
} from "@/app/(dashboard)/operations/actions";
import { openGooglePicker } from "@/components/knowledge-workspace/google-picker.client";
import { Button } from "@/components/ui/button";
import type {
  AdmitSuppliedDriveImageRefusal,
  AdmitSuppliedDriveImageResult,
} from "@/features/media-assets/admit-supplied-drive-image.server";
import type { GenerationTarget } from "./generate-image-with-hebun";

/*
 * MEDIA-SUPPLIED — the human door for a photograph the organization already has in Google Drive.
 *
 * Least privilege, the production-accepted way: the human picks ONE image in GOOGLE'S OWN CHOOSER,
 * which is what grants Hebun per-file access (`drive.file`) to exactly that file. There is no pasted
 * link and no Drive-wide read. The chooser shows only JPEG, PNG and WebP — the list comes from the
 * server, the same list admission enforces.
 *
 * Two acts, kept separate: authorizing a chooser, then admitting what was chosen. The access token
 * goes from the server's answer straight into Google's chooser and is never kept in state. Selecting
 * a file admits nothing; the Media authority admits — or refuses — on its own.
 */

const NOTHING_KEPT = "Nothing was stored.";

const REFUSAL_WORDING: Record<AdmitSuppliedDriveImageRefusal, string> = {
  unauthenticated: `Your session could not be resolved. ${NOTHING_KEPT}`,
  "invalid-input": `The selection or the draft revision is not valid. ${NOTHING_KEPT}`,
  "storage-unavailable": `Media storage is not connected. ${NOTHING_KEPT}`,
  "persistence-unavailable": `The database could not be reached. ${NOTHING_KEPT}`,
  "source-revision-unresolvable": `That content draft revision could not be resolved in your organization. ${NOTHING_KEPT}`,
  "drive-capability-not-available": `Hebun has not been granted access to files you choose in Google Drive. ${NOTHING_KEPT}`,
  "drive-read-failed": `Google Drive did not return the selected file as a JPEG, PNG or WebP image. ${NOTHING_KEPT}`,
  "unsupported-image-signature": `The file's bytes are not a JPEG, PNG or WebP image. ${NOTHING_KEPT}`,
  "malformed-image": `The file does not parse as a complete image. ${NOTHING_KEPT}`,
  "declared-type-mismatch": `Drive's declared type does not match the file's bytes. ${NOTHING_KEPT}`,
  "empty-bytes": `The file is empty. ${NOTHING_KEPT}`,
  "byte-size-exceeded": `The file exceeds the 20 MiB limit. ${NOTHING_KEPT}`,
  "dimensions-exceeded": `The image exceeds 8192 px on an edge. ${NOTHING_KEPT}`,
  "download-url-invalid": NOTHING_KEPT,
  "download-host-not-allowed": NOTHING_KEPT,
  "download-redirect-refused": NOTHING_KEPT,
  "download-status-refused": NOTHING_KEPT,
  "download-timeout": NOTHING_KEPT,
  "download-failed": NOTHING_KEPT,
  "storage-write-failed": "The verified image could not be written to media storage. No asset was filed.",
  "integrity-mismatch": "The stored bytes did not match the verified image. No asset was filed; this should be raised.",
  "asset-retired": "This exact image was already supplied for this revision and has since been retired.",
};

const FIELD =
  "w-full min-w-0 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm text-fg-primary " +
  "placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-primary-ring disabled:cursor-not-allowed disabled:text-fg-muted";
const LABEL = "block text-xs font-medium text-fg-secondary";

export function SupplyImageFromDrive({ targets }: { readonly targets: readonly GenerationTarget[] }) {
  const [artifactId, setArtifactId] = useState("");
  const [revisionNo, setRevisionNo] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = targets.find((t) => t.artifactId === artifactId);
  const ready = Boolean(artifactId) && Boolean(revisionNo);

  function chooseAndSupply() {
    if (!ready || pending) return;
    setMessage(null);
    startTransition(async () => {
      const session = await authorizeMediaPickerSessionAction();
      if (session.status !== "authorized") {
        setMessage(session.detail);
        return;
      }
      const outcome = await openGooglePicker({
        accessToken: session.accessToken,
        apiKey: session.apiKey,
        appId: session.appId,
        mimeTypes: session.mimeTypes,
        title: "Choose one image to supply to Hebun",
      });
      if (outcome.status === "cancelled") {
        setMessage("No image was chosen. Nothing was read or stored.");
        return;
      }
      if (outcome.status === "unavailable") {
        setMessage(outcome.detail);
        return;
      }
      const result: AdmitSuppliedDriveImageResult = await admitSuppliedDriveImageAction({
        artifactId,
        revisionNo: Number(revisionNo),
        driveFileId: outcome.document.fileId,
      });
      setMessage(
        result.status === "refused"
          ? REFUSAL_WORDING[result.reason]
          : result.status === "admitted"
            ? "Admitted as a supplied image for this draft. It is not reviewed, approved or published."
            : "This exact image was already supplied for this revision. Nothing new was stored.",
      );
    });
  }

  if (targets.length === 0) {
    return (
      <p className="text-sm text-fg-secondary">
        Prepare a content draft first — a supplied image is always admitted for a specific draft revision.
      </p>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <div className="min-w-0 space-y-1.5">
          <label htmlFor="supply-artifact" className={LABEL}>
            Content draft
          </label>
          <select
            id="supply-artifact"
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
          <label htmlFor="supply-revision" className={LABEL}>
            Revision
          </label>
          <input
            id="supply-revision"
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
        You choose one JPEG, PNG or WebP image (up to 20 MiB) in Google&apos;s own chooser. Hebun can open
        only the file you choose, reads it once, verifies it and keeps its own copy.
      </p>
      <Button size="sm" onClick={chooseAndSupply} disabled={!ready || pending} aria-busy={pending}>
        {pending ? "Working…" : "Choose image in Google Drive"}
      </Button>
      {message ? (
        <p role="status" aria-live="polite" className="text-sm text-fg-primary">
          {message}
        </p>
      ) : null}
    </div>
  );
}
