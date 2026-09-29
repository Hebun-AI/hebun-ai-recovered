"use client";

import { useMemo, useState, useTransition } from "react";
import { requestVideoGenerationAction } from "@/app/(dashboard)/operations/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MEDIA_ASSET_LIMITS } from "@/features/media-assets/contracts";
import type { GenerationTarget } from "./generate-image-with-hebun";

/*
 * VIDEO CONTENT CHAIN — the human door to ONE text-to-video request.
 *
 * It calls one action, which registers the attempt (MV-4) and dispatches it ONCE through the transport
 * the lifecycle resolves (MV-6). Whether a provider may be called at all — provider selection, the
 * Director connectivity control, the live spend budget — is decided THERE; this form infers nothing
 * about capability and reads no configuration. A refusal before dispatch says "nothing was sent".
 *
 * A request is NOT a video. The provider answers later: the attempt appears under its draft, where a
 * human observes it (one status read per click — there is no scheduler) and, once the provider reports
 * output, admits it into Media (MV-7). `dispatch-unknown` is shown as unknown, never as failure.
 *
 * ONE FORM, ONE KEY. `requestKey` is minted once per mounted form, so a double submit carries the same
 * key and the lifecycle registers nothing the second time — no second POST, no second charge.
 */

type RequestResult = Awaited<ReturnType<typeof requestVideoGenerationAction>>;
type Refusal = Extract<RequestResult, { status: "refused" }>["reason"];

const NOT_SENT = "Nothing was sent to the provider.";

const REFUSAL_WORDING: Record<Refusal, string> = {
  unauthenticated: `Your session could not be resolved. ${NOT_SENT}`,
  "invalid-input": `The request was not well formed. ${NOT_SENT}`,
  "generation-transport-unavailable": `Video generation is not available: no provider is configured, or its connectivity is not enabled by the Director. ${NOT_SENT}`,
  "persistence-unavailable": `The database could not be reached. ${NOT_SENT}`,
  "no-durable-agent": `Your organization has no durable agent that could author this. ${NOT_SENT}`,
  "source-revision-unresolvable": `That content draft revision could not be resolved in your organization. ${NOT_SENT}`,
  "duplicate-request": "This exact request was already submitted. It was not sent again, and you were not charged twice.",
  "invocation-not-found": `The attempt could not be found. ${NOT_SENT}`,
  "transport-mismatch": `The configured provider is not the one this attempt was registered with. ${NOT_SENT}`,
  /* IMAGE → VIDEO — the source image, checked before anything is recorded or sent. */
  "source-asset-unresolvable": `That image could not be resolved in your organization. ${NOT_SENT}`,
  "source-asset-not-image": `That asset is not an image. ${NOT_SENT}`,
  "source-asset-retired": `That image has been retired. ${NOT_SENT}`,
  "source-asset-unavailable": `The image's stored bytes could not be verified against its record. ${NOT_SENT} This is a storage custody problem and should be raised.`,
  "storage-unavailable": `Media storage is not connected, so the image could not be read. ${NOT_SENT}`,
  "source-type-unsupported": `The provider does not accept this image type. No video was requested.`,
  "source-upload-refused": `The provider refused the image upload. No video was requested.`,
  "source-upload-unknown": `The image upload got no trustworthy answer. No video was requested, and nothing is retried.`,
  "source-not-prepared": `The image was not prepared for this attempt. No video was requested.`,
  "source-data-use-not-cleared": `No data-use decision allows sending this image to this video provider. Holding, reviewing or selecting an image, or the provider being switched on, is not that permission. ${NOT_SENT}`,
};

/** An admitted image this form may offer as a source. An id and a label — never a URL. */
export interface VideoSourceImage {
  readonly assetId: string;
  readonly sourceArtifactId: string;
  readonly label: string;
}

const DISPATCH_WORDING: Record<string, string> = {
  "provider-pending": "The provider accepted the job. It is not a video yet — observe it under its draft below.",
  "provider-failed": "The provider refused the job. No video will come from this attempt.",
  "dispatch-unknown":
    "The request left Hebun but no trustworthy answer came back. Its fate is UNKNOWN — it may still be billed. It is not retried; a new attempt is a new request.",
};

const FIELD =
  "w-full min-w-0 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm text-fg-primary " +
  "placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-primary-ring disabled:cursor-not-allowed disabled:text-fg-muted";
const LABEL = "block text-xs font-medium text-fg-secondary";

export function GenerateVideoWithHebun({
  targets,
  sourceImages = [],
}: {
  readonly targets: readonly GenerationTarget[];
  /** IMAGE → VIDEO: admitted images, offered per draft. Picking one sends only its id. */
  readonly sourceImages?: readonly VideoSourceImage[];
}) {
  const requestKey = useMemo(() => crypto.randomUUID(), []);
  const [artifactId, setArtifactId] = useState("");
  const [revisionNo, setRevisionNo] = useState("");
  const [promptText, setPromptText] = useState("");
  const [sourceAssetId, setSourceAssetId] = useState("");
  const [result, setResult] = useState<RequestResult | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = targets.find((t) => t.artifactId === artifactId);
  const draftImages = sourceImages.filter((i) => i.sourceArtifactId === artifactId);
  const trimmed = promptText.trim();
  const ready = Boolean(artifactId) && Boolean(revisionNo) && trimmed.length > 0;
  /* One form, one request: once anything was registered, this form is spent. */
  const spent = result !== null && result.status !== "refused";

  function submit() {
    if (!ready || pending || spent) return;
    startTransition(async () => {
      setResult(
        await requestVideoGenerationAction({
          artifactId,
          revisionNo: Number(revisionNo),
          promptText: trimmed,
          requestKey,
          sourceAssetId: sourceAssetId || null,
        }),
      );
    });
  }

  if (targets.length === 0) {
    return <p className="text-xs text-fg-muted">No open content draft to generate a video for.</p>;
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <div className="min-w-0 space-y-1.5">
          <label htmlFor="video-artifact" className={LABEL}>
            Content draft
          </label>
          <select
            id="video-artifact"
            className={FIELD}
            value={artifactId}
            disabled={pending || spent}
            onChange={(e) => {
              setArtifactId(e.target.value);
              setSourceAssetId("");
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
          <label htmlFor="video-revision" className={LABEL}>
            Revision
          </label>
          <input
            id="video-revision"
            type="number"
            inputMode="numeric"
            min={1}
            max={selected?.currentRevision ?? 1}
            className={FIELD}
            value={revisionNo}
            disabled={pending || spent || !selected}
            onChange={(e) => setRevisionNo(e.target.value)}
          />
        </div>
      </div>

      {/*
        IMAGE → VIDEO. Optional. Only this draft's admitted images are offered, by id. The server
        re-resolves the id against your organization and verifies the stored bytes before anything
        is sent. The warning is not decoration: it is the Director's G2 decision, stated where the
        choice is made.
      */}
      <div className="min-w-0 space-y-1.5">
        <label htmlFor="video-source" className={LABEL}>
          Start from an image (optional)
        </label>
        <select
          id="video-source"
          className={FIELD}
          value={sourceAssetId}
          disabled={pending || spent || draftImages.length === 0}
          onChange={(e) => setSourceAssetId(e.target.value)}
        >
          <option value="">No image — text to video</option>
          {draftImages.map((i) => (
            <option key={i.assetId} value={i.assetId}>
              {i.label}
            </option>
          ))}
        </select>
        {sourceAssetId ? (
          <p className="text-xs text-fg-muted">
            The image is uploaded to the video provider, whose terms allow inputs to be used for model
            training. Real company or customer images are NOT authorized for this path; use a
            non-sensitive image only. Image-to-video has its own Director control and is off unless
            the Director enabled it.
          </p>
        ) : null}
      </div>

      <div className="min-w-0 space-y-1.5">
        <label htmlFor="video-prompt" className={LABEL}>
          Prompt
        </label>
        <textarea
          id="video-prompt"
          rows={4}
          className={`${FIELD} resize-y leading-6`}
          placeholder="Describe the short video you want: subject, motion, setting and style."
          value={promptText}
          maxLength={MEDIA_ASSET_LIMITS.maxPromptCodePoints}
          disabled={pending || spent}
          onChange={(e) => setPromptText(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-xs text-fg-muted">
          One request per form, sent once, never retried. A paid provider call may follow.
        </p>
        <Button onClick={submit} disabled={!ready || pending || spent} aria-busy={pending} className="shrink-0 sm:w-auto">
          {pending ? "Sending…" : "Request video"}
        </Button>
      </div>

      {result ? (
        <section role="status" aria-live="polite" className="min-w-0 space-y-2 rounded-lg border border-border-subtle bg-surface-2 p-3">
          {result.status === "refused" ? (
            <>
              <Badge variant={result.reason === "duplicate-request" ? "info" : "warning"}>
                {result.reason === "duplicate-request" ? "Already submitted" : "Not sent"}
              </Badge>
              <p className="text-sm text-fg-primary">{REFUSAL_WORDING[result.reason]}</p>
            </>
          ) : result.status === "registered-not-sent" ? (
            <>
              <Badge variant="warning">Registered, not sent</Badge>
              <p className="text-sm text-fg-primary">{REFUSAL_WORDING[result.reason]}</p>
              <p className="text-xs text-fg-secondary">The attempt is recorded as registered. No provider call was made.</p>
            </>
          ) : (
            <>
              <Badge variant={result.state === "provider-pending" ? "info" : "warning"}>{result.state}</Badge>
              <p className="text-sm text-fg-primary">{DISPATCH_WORDING[result.state] ?? `The attempt is ${result.state}.`}</p>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
