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
 * will post this". Hebun cannot post anything: there is no publishing action kind and Instagram's
 * `/media_publish` is on an explicitly banned path list.
 */
import { useEffect, useState, useTransition } from "react";
import {
  readContentPackageAction,
  setMediaSelectionAction,
} from "@/app/(dashboard)/operations/actions";
import type { ContentPackageResult } from "@/features/content-composition/read-content-package.server";
import {
  CONTENT_PACKAGE_NON_CLAIMS,
  type ContentPackageBlocker,
} from "@/features/content-composition/contracts";

const BLOCKER_WORDING: Record<ContentPackageBlocker, string> = {
  "copy-empty": "This revision has no copy yet.",
  "no-media-selected": "No image has been chosen for this draft.",
  "selected-media-retired": "A chosen image has been retired and can no longer be used.",
  "selected-media-declined": "A chosen image was declined in review.",
  "selected-media-unreviewed": "A chosen image has not been reviewed yet.",
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
}: {
  readonly artifactId: string;
  readonly revisionNo: number;
}) {
  const [result, setResult] = useState<ContentPackageResult | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let live = true;
    void readContentPackageAction({ artifactId, revisionNo }).then((r) => {
      if (live) setResult(r);
    });
    return () => {
      live = false;
    };
  }, [artifactId, revisionNo]);

  function remove(mediaAssetId: string) {
    startTransition(async () => {
      await setMediaSelectionAction({ artifactId, revisionNo, mediaAssetId, selected: false });
      setResult(await readContentPackageAction({ artifactId, revisionNo }));
    });
  }

  if (result === null) {
    return <p className="text-xs text-fg-muted">Reading the content package…</p>;
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
          <dt className="min-w-24">Chosen images</dt>
          <dd className="text-fg-secondary">{pkg.selected.length}</dd>
        </div>
      </dl>

      {pkg.selected.length === 0 ? null : (
        <ul className="min-w-0 space-y-1">
          {pkg.selected.map((s) => (
            <li key={s.mediaAssetId} className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-fg-secondary">
                {s.width}×{s.height} {s.mimeType.replace("image/", "").toUpperCase()}{" "}
                {formatBytes(s.byteSize)}
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

      {/* Printed every time, ready or not. This is the part that must not be collapsible. */}
      <ul className="space-y-0.5 text-[11px] text-fg-muted">
        {CONTENT_PACKAGE_NON_CLAIMS.map((claim) => (
          <li key={claim}>{claim}</li>
        ))}
      </ul>
    </section>
  );
}
