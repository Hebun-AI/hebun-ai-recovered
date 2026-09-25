"use client";

import { useState, useTransition } from "react";
import { admitSuppliedDriveImageAction } from "@/app/(dashboard)/operations/actions";
import { Button } from "@/components/ui/button";
import type {
  AdmitSuppliedDriveImageRefusal,
  AdmitSuppliedDriveImageResult,
} from "@/features/media-assets/admit-supplied-drive-image.server";
import type { GenerationTarget } from "./generate-image-with-hebun";

/*
 * MEDIA-SUPPLIED — the human door for a photograph the organization already has in Google Drive.
 *
 * One control, calling `admitSuppliedDriveImageAction` and nothing else. The person names the draft
 * revision and the Drive file; the Media authority reads, verifies, stores and records it. The result
 * is an admitted asset marked "Supplied from Google Drive" — never "generated", never "approved".
 */

const NOTHING_KEPT = "Nothing was stored.";

const REFUSAL_WORDING: Record<AdmitSuppliedDriveImageRefusal, string> = {
  unauthenticated: `Your session could not be resolved. ${NOTHING_KEPT}`,
  "invalid-input": `That is not a Google Drive file id or file link, or the draft revision is not valid. ${NOTHING_KEPT}`,
  "storage-unavailable": `Media storage is not connected. ${NOTHING_KEPT}`,
  "persistence-unavailable": `The database could not be reached. ${NOTHING_KEPT}`,
  "source-revision-unresolvable": `That content draft revision could not be resolved in your organization. ${NOTHING_KEPT}`,
  "drive-capability-not-available": `Google Drive file access is not granted for your organization. ${NOTHING_KEPT}`,
  "drive-read-failed": `Google Drive did not return that file as a JPEG, PNG or WebP image. ${NOTHING_KEPT}`,
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
  "storage-write-failed": `The verified image could not be written to media storage. No asset was filed.`,
  "integrity-mismatch": `The stored bytes did not match the verified image. No asset was filed; this should be raised.`,
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
  const [driveFile, setDriveFile] = useState("");
  const [result, setResult] = useState<AdmitSuppliedDriveImageResult | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = targets.find((t) => t.artifactId === artifactId);
  const ready = Boolean(artifactId) && Boolean(revisionNo) && driveFile.trim().length > 0;

  function submit() {
    if (!ready || pending) return;
    setResult(null);
    startTransition(async () => {
      setResult(
        await admitSuppliedDriveImageAction({ artifactId, revisionNo: Number(revisionNo), driveFile: driveFile.trim() }),
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
      <div className="min-w-0 space-y-1.5">
        <label htmlFor="supply-drive-file" className={LABEL}>
          Google Drive file link or id
        </label>
        <input
          id="supply-drive-file"
          className={FIELD}
          value={driveFile}
          disabled={pending}
          placeholder="https://drive.google.com/file/d/…"
          onChange={(e) => setDriveFile(e.target.value)}
        />
        <p className="text-xs text-fg-muted">
          JPEG, PNG or WebP, up to 20 MiB. Hebun reads the file once, verifies it and keeps its own copy.
        </p>
      </div>
      <Button size="sm" onClick={submit} disabled={!ready || pending} aria-busy={pending}>
        {pending ? "Reading from Drive…" : "Add image from Drive"}
      </Button>
      {result ? (
        <p role="status" aria-live="polite" className="text-sm text-fg-primary">
          {result.status === "refused"
            ? REFUSAL_WORDING[result.reason]
            : result.status === "admitted"
              ? "Admitted as a supplied image for this draft. It is not reviewed, approved or published."
              : "This exact image was already supplied for this revision. Nothing new was stored."}
        </p>
      ) : null}
    </div>
  );
}
