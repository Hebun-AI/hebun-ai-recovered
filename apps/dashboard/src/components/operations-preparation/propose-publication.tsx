"use client";

/*
 * CONTENT-PUBLISH-FROM-PACKAGE-1 — "propose this for publishing", from the READY package.
 *
 * One explicit human click files ONE pending request through the existing inlet; a person then
 * decides it on /approvals. The control names the revision only: which image or video is published
 * is the package's own choice, read again on the server. Nothing here approves, mints, executes or
 * posts, and nothing dispatches on its own.
 *
 * YouTube needs four facts only a human can declare. Privacy starts at `private`, the most
 * restrictive value the contract allows; the category and both declarations start empty and must be
 * chosen — they are never inferred.
 */
import Link from "next/link";
import { useState, useTransition } from "react";
import { proposePackagePublicationAction } from "@/app/(dashboard)/operations/publication-actions";
import type {
  PackagePublicationProposalResult,
  PackagePublicationRefusal,
} from "@/features/heby-action-inlet/package-publication-proposal.server";

const REFUSAL_WORDING: Partial<Record<PackagePublicationRefusal, string>> = {
  unauthenticated: "Your session could not be confirmed. Sign in again.",
  "invalid-input": "The proposal was incomplete. Check the fields and try again.",
  "persistence-unavailable": "Hebun could not read or record this right now. Nothing was filed.",
  "publish-not-possible": "This organization has no connection that can publish here right now.",
  "channel-not-verified": "YouTube did not confirm exactly one channel for this connection.",
  "draft-not-found": "This revision could not be found.",
  "draft-retired": "This draft has been retired.",
  "draft-superseded": "A newer revision exists. Refresh and propose the current one.",
  "package-not-ready": "The package is no longer READY. Refresh to see what changed.",
  "no-publishable-media": "The package has no approved medium this destination can publish.",
  "media-choice-ambiguous": "More than one medium is chosen. Remove all but the one to publish.",
  "image-aspect-unsupported": "Instagram does not accept this image's shape (4:5 to 1.91:1).",
  "publish-image-too-large": "The image is too large for Instagram.",
  "caption-too-long": "The caption is longer than Instagram allows.",
  "metadata-invalid": "The title or description is outside YouTube's limits.",
  "already-pending": "A request for exactly this is already waiting for a decision.",
  "publication-in-flight": "A publication of this revision is already waiting or under way.",
  "prior-publication-unacknowledged": "This revision was already published.",
  "prior-publication-acknowledgement-stale": "A newer publication of this revision exists. Refresh and try again.",
  "prior-publication-acknowledgement-mismatch": "The acknowledged publication does not match this revision.",
};

const WAITING = new Set<PackagePublicationRefusal>(["already-pending", "publication-in-flight"]);

export function ProposePublication({
  artifactId,
  revisionNo,
  destination,
}: {
  readonly artifactId: string;
  readonly revisionNo: number;
  readonly destination: "instagram" | "youtube";
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<PackagePublicationProposalResult | null>(null);
  const [privacyStatus, setPrivacyStatus] = useState("private");
  const [categoryId, setCategoryId] = useState("");
  const [madeForKids, setMadeForKids] = useState("");
  const [syntheticMedia, setSyntheticMedia] = useState("");

  const youtubeComplete = /^[0-9]{1,4}$/.test(categoryId) && madeForKids !== "" && syntheticMedia !== "";
  const canSubmit = !pending && (destination === "instagram" || youtubeComplete);

  function propose(acknowledgesPriorAttemptId?: string) {
    startTransition(async () => {
      setResult(
        await proposePackagePublicationAction({
          artifactId,
          revisionNo,
          ...(destination === "youtube" ? { youtube: { privacyStatus, categoryId, madeForKids, syntheticMedia } } : {}),
          ...(acknowledgesPriorAttemptId ? { acknowledgesPriorAttemptId } : {}),
        }),
      );
    });
  }

  if (result?.status === "proposed") {
    return (
      <div className="space-y-1 text-[11px]">
        <p className="text-fg-secondary">
          Proposal filed for {destination === "youtube" ? `YouTube${result.channelTitle ? ` (${result.channelTitle})` : ""}` : "Instagram"}.
          Nothing is published until it is approved and executed.
        </p>
        <Link href="/approvals" className="underline underline-offset-2 text-fg-primary">
          Open Approvals
        </Link>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-2 text-[11px]">
      <h5 className="font-medium text-fg-secondary">Propose for publishing</h5>
      {destination === "youtube" ? (
        <div className="grid gap-1.5 sm:grid-cols-2">
          <label className="flex items-center gap-2">
            <span className="min-w-24 text-fg-muted">Privacy</span>
            <select value={privacyStatus} onChange={(e) => setPrivacyStatus(e.target.value)} className="rounded border border-border-subtle bg-transparent px-1 py-0.5">
              <option value="private">private</option>
              <option value="unlisted">unlisted</option>
              <option value="public">public</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="min-w-24 text-fg-muted">Category id</span>
            <input
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value.trim())}
              inputMode="numeric"
              placeholder="e.g. 22"
              className="w-20 rounded border border-border-subtle bg-transparent px-1 py-0.5"
            />
          </label>
          <Declaration label="Made for kids" value={madeForKids} onChange={setMadeForKids} name={`kids-${artifactId}`} />
          <Declaration label="Synthetic media" value={syntheticMedia} onChange={setSyntheticMedia} name={`synthetic-${artifactId}`} />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => propose()}
        disabled={!canSubmit}
        className="rounded px-2 py-1 font-medium text-fg-primary ring-1 ring-border-strong disabled:opacity-50"
      >
        {pending ? "Filing…" : `Propose ${destination === "youtube" ? "YouTube upload" : "Instagram post"}`}
      </button>

      {result?.status === "refused" ? (
        <div className="space-y-1">
          <p className="text-fg-muted">
            Not filed. {REFUSAL_WORDING[result.reason] ?? `Refused (${result.reason}).`}
          </p>
          {WAITING.has(result.reason) ? (
            <Link href="/approvals" className="underline underline-offset-2 text-fg-primary">
              Open Approvals
            </Link>
          ) : null}
          {result.reason === "prior-publication-unacknowledged" && result.priorAttemptId ? (
            <button
              type="button"
              onClick={() => propose(result.priorAttemptId)}
              disabled={pending}
              className="underline underline-offset-2 text-fg-primary disabled:opacity-50"
            >
              Propose a new publication anyway (acknowledges attempt {result.priorAttemptId})
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Declaration({
  label,
  value,
  onChange,
  name,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly name: string;
}) {
  return (
    <fieldset className="flex items-center gap-2">
      <legend className="sr-only">{label}</legend>
      <span className="min-w-24 text-fg-muted">{label}</span>
      {(["yes", "no"] as const).map((v) => (
        <label key={v} className="flex items-center gap-1">
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
          {v}
        </label>
      ))}
    </fieldset>
  );
}
