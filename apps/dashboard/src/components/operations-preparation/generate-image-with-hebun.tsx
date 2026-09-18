"use client";

import { useMemo, useState, useTransition } from "react";
import { requestMediaGenerationAction } from "@/app/(dashboard)/operations/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MEDIA_ASSET_LIMITS } from "@/features/media-assets/contracts";
import type {
  MediaAdmissionFailure,
  MediaAdmissionRefusal,
  MediaGenerationRefusal,
  RequestMediaGenerationResult,
} from "@/features/media-assets/contracts";

/*
 * generate-image-with-hebun.tsx — the human door to a real image generation (MEDIA-2B).
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * One control, calling the released `requestMediaGenerationAction` and nothing else. A human picks
 * a content draft they already prepared, names the exact revision the image is for, writes the
 * prompt, and asks once. Everything after the click belongs to the Media Asset authority: it
 * dispatches to OpenAI, verifies the returned bytes, writes them to the VPS store and files the
 * asset. This file owns no state that matters and decides nothing.
 *
 * ── WHAT A SUCCESSFUL GENERATION IS NOT ──────────────────────────────────────
 *
 * It is not approval and it is not publication. An admitted asset becomes a Governance
 * `media-asset-review` subject and waits there. Nothing here approves it, attaches it to the draft,
 * schedules it, or sends it anywhere — and there is no control in this file that could. The result
 * card says so in the reader's language rather than leaving it to be inferred.
 *
 * ── ASKING ONCE ──────────────────────────────────────────────────────────────
 *
 * `requestKey` is minted once per mounted form. Pressing the button twice, or resubmitting after a
 * network stall, resends the SAME key, so the authority collides on `(tenant_id, request_key)` and
 * answers `duplicate-request` WITHOUT a second paid call. A genuinely different image needs a fresh
 * form. There is no retry button, and a failure never re-dispatches on its own: each paid call is a
 * human pressing this button with a new key.
 *
 * ── WHY THE BYTE FACTS ARE SECONDARY ─────────────────────────────────────────
 *
 * The digest is the asset's identity and the reason anyone can trust it, but it is not what a
 * person reads a result for. The card leads with what was made and where it went; the digest, byte
 * count and ids live in a collapsed `<details>` for the moment someone needs to match a record.
 */

/** A content draft this surface may generate an image for. */
export interface GenerationTarget {
  readonly artifactId: string;
  readonly title: string;
  readonly currentRevision: number;
}

const NOT_DISPATCHED = "Nothing was sent to the provider and nothing was written.";

const REFUSAL_WORDING: Record<MediaGenerationRefusal, string> = {
  /* Preflight: the transport was never reached. */
  unauthenticated: `Your session could not be resolved. ${NOT_DISPATCHED}`,
  "invalid-input": `The request was not well formed. ${NOT_DISPATCHED}`,
  "storage-unavailable": `Media storage is not connected, so admitted bytes would have nowhere to live. ${NOT_DISPATCHED}`,
  "generation-transport-unavailable": `Image generation is not available: it is unconfigured, misconfigured, or the Director control is off. ${NOT_DISPATCHED}`,
  "persistence-unavailable": `The database could not be reached. ${NOT_DISPATCHED}`,
  "no-durable-agent": `Your organization has no durable agent that could author this. ${NOT_DISPATCHED}`,
  "source-revision-unresolvable": `That content draft revision could not be resolved in your organization. ${NOT_DISPATCHED}`,
  "duplicate-request": "This exact request was already submitted. It was not sent again, and you were not charged twice.",
  /* MEDIA-5 — all four are preflight, so none of them reached a provider or cost anything. */
  "source-asset-unresolvable": `That image could not be resolved in your organization. ${NOT_DISPATCHED}`,
  "source-asset-retired": `That image has been retired, and a retired image is not used as a reference. ${NOT_DISPATCHED}`,
  "source-asset-unavailable": `The stored bytes of that image could not be read, or no longer match its admitted digest. This is a storage custody problem and should be raised. ${NOT_DISPATCHED}`,
  "reference-edit-unsupported": `The configured image provider cannot edit an existing image. ${NOT_DISPATCHED}`,
};

const ADMISSION_WORDING: Record<MediaAdmissionRefusal | MediaAdmissionFailure, string> = {
  "unsupported-image-signature": "The provider returned bytes that are not a PNG, JPEG or WebP image.",
  "malformed-image": "The provider returned bytes that do not parse as a complete image.",
  "declared-type-mismatch": "The provider's declared type did not match the bytes it sent.",
  "empty-bytes": "The provider returned no bytes.",
  "byte-size-exceeded": `The image exceeded the ${MEDIA_ASSET_LIMITS.maxByteSize / (1024 * 1024)} MiB limit.`,
  "dimensions-exceeded": `The image exceeded ${MEDIA_ASSET_LIMITS.maxDimension} px on an edge.`,
  "download-url-invalid": "The provider offered an unusable download location.",
  "download-host-not-allowed": "The provider offered a download from a host that is not allowed.",
  "download-redirect-refused": "The provider's download redirected somewhere that is not allowed.",
  "download-status-refused": "The provider's download did not succeed.",
  "download-timeout": "The provider's download timed out.",
  "download-failed": "The provider's download failed.",
  "storage-write-failed": "The verified image could not be written to media storage, so no asset was filed.",
  "persistence-failed": "The verified and stored image could not be recorded, so no asset was filed.",
};

/** What a refusal means for the person: can they act, or is this someone else's to fix? */
const OPERATOR_REFUSALS = new Set<MediaGenerationRefusal>([
  "generation-transport-unavailable",
  "storage-unavailable",
  "persistence-unavailable",
  "no-durable-agent",
]);

function admissionWording(failure: string | null): string {
  return failure && failure in ADMISSION_WORDING
    ? ADMISSION_WORDING[failure as MediaAdmissionRefusal | MediaAdmissionFailure]
    : "The attempt did not produce an admissible image.";
}

const FIELD =
  "w-full min-w-0 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm text-fg-primary " +
  "placeholder:text-fg-muted transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring " +
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-fg-muted";

const LABEL = "block text-xs font-medium text-fg-secondary";

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GenerateImageWithHebun({ targets }: { readonly targets: readonly GenerationTarget[] }) {
  /* One key per mounted form: the same submission can never become two paid calls. */
  const requestKey = useMemo(() => crypto.randomUUID(), []);
  const [artifactId, setArtifactId] = useState("");
  const [revisionNo, setRevisionNo] = useState("");
  const [promptText, setPromptText] = useState("");
  const [result, setResult] = useState<RequestMediaGenerationResult | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = targets.find((t) => t.artifactId === artifactId);
  const trimmed = promptText.trim();
  const ready = Boolean(artifactId) && Boolean(revisionNo) && trimmed.length > 0;

  function submit() {
    if (!ready || pending) return;
    setResult(null);
    startTransition(async () => {
      setResult(
        await requestMediaGenerationAction({
          artifactId,
          revisionNo: Number(revisionNo),
          promptText: trimmed,
          requestKey,
        }),
      );
    });
  }

  return (
    <Card>
      <CardHeader stacked>
        <CardTitle>Generate an image</CardTitle>
        <CardDescription>
          Hebun asks the image provider for one image for the draft revision you name. Generated
          assets are verified, stored securely, and sent to Governance for review before further use.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {targets.length === 0 ? (
          <p className="text-sm text-fg-secondary">
            Prepare a content draft first — an image is always generated for a specific draft
            revision, never on its own.
          </p>
        ) : (
          <>
            {/*
              SOURCE, NOT SETTINGS. The draft and its revision are the asset's provenance — the
              record this image will forever point at — so they are grouped and labelled as such,
              away from the prompt. They are not generation parameters and must not read like them.
            */}
            <fieldset className="min-w-0 space-y-3 rounded-lg border border-border-subtle bg-surface-2 p-4">
              <legend className="px-1 text-xs font-medium text-fg-secondary">Source</legend>

              <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                <div className="min-w-0 space-y-1.5">
                  <label htmlFor="media-artifact" className={LABEL}>
                    Content draft
                  </label>
                  <select
                    id="media-artifact"
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
                  <label htmlFor="media-revision" className={LABEL}>
                    Revision
                  </label>
                  <input
                    id="media-revision"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={selected?.currentRevision ?? 1}
                    className={FIELD}
                    value={revisionNo}
                    disabled={pending || !selected}
                    aria-describedby="media-revision-hint"
                    onChange={(e) => setRevisionNo(e.target.value)}
                  />
                </div>
              </div>

              <p id="media-revision-hint" className="text-xs text-fg-muted">
                {selected
                  ? `This draft is at revision ${selected.currentRevision}. The image records the exact revision you name.`
                  : "Choose a draft to name its revision."}
              </p>
            </fieldset>

            <div className="min-w-0 space-y-1.5">
              <label htmlFor="media-prompt" className={LABEL}>
                Prompt
              </label>
              <textarea
                id="media-prompt"
                rows={6}
                className={`${FIELD} resize-y leading-6`}
                placeholder="Describe the image you want. Be specific about subject, setting and style."
                value={promptText}
                maxLength={MEDIA_ASSET_LIMITS.maxPromptCodePoints}
                disabled={pending}
                aria-describedby="media-prompt-count"
                onChange={(e) => setPromptText(e.target.value)}
              />
              <p id="media-prompt-count" className="text-xs text-fg-muted">
                {trimmed.length} / {MEDIA_ASSET_LIMITS.maxPromptCodePoints} characters
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0 text-xs text-fg-muted">
                One request per form. Generating can take up to two minutes.
              </p>
              <Button
                onClick={submit}
                disabled={!ready || pending}
                aria-busy={pending}
                className="shrink-0 sm:w-auto"
              >
                {pending ? (
                  <>
                    {/* Motion is the affordance; the word is the guarantee, for anyone who sees neither. */}
                    <span
                      aria-hidden="true"
                      className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                    />
                    Generating…
                  </>
                ) : (
                  "Generate image"
                )}
              </Button>
            </div>

            {pending ? (
              <p role="status" aria-live="polite" className="text-xs text-fg-secondary">
                Asking the provider for one image. Do not refresh — this request is already counted.
              </p>
            ) : null}

            {result ? <GenerationResult result={result} /> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GenerationResult({ result }: { readonly result: RequestMediaGenerationResult }) {
  /* Every state announces itself with a WORD and an icon-free badge, never with colour alone. */
  if (result.status === "admitted") {
    return (
      <section
        role="status"
        aria-live="polite"
        className="min-w-0 space-y-3 rounded-lg border border-border-subtle bg-surface-2 p-4"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">Admitted</Badge>
          <Badge variant="warning">Awaiting review</Badge>
        </div>

        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs text-fg-muted">Dimensions</dt>
            <dd className="text-fg-primary">
              {result.width} × {result.height}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-fg-muted">Format</dt>
            <dd className="text-fg-primary">
              {result.mimeType.replace("image/", "").toUpperCase()} · {formatBytes(result.byteSize)}
            </dd>
          </div>
        </dl>

        <p className="text-xs text-fg-secondary">
          The image was verified and stored securely. It is now with Governance for review — it is
          not approved, not attached to the draft, and not published.
        </p>

        <details className="min-w-0">
          <summary className="cursor-pointer text-xs text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring">
            Record details
          </summary>
          <dl className="mt-2 space-y-2 text-xs">
            <div className="min-w-0">
              <dt className="text-fg-muted">Asset</dt>
              <dd className="break-all font-mono text-fg-secondary">{result.assetId}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-fg-muted">SHA-256</dt>
              <dd className="break-all font-mono text-fg-secondary">{result.byteDigest}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-fg-muted">Exact size</dt>
              <dd className="font-mono text-fg-secondary">{result.byteSize} bytes</dd>
            </div>
          </dl>
        </details>
      </section>
    );
  }

  if (result.status === "refused") {
    const actionable = OPERATOR_REFUSALS.has(result.reason);
    return (
      <section
        role="status"
        aria-live="polite"
        className="min-w-0 space-y-2 rounded-lg border border-border-subtle bg-surface-2 p-4"
      >
        <Badge variant={result.reason === "duplicate-request" ? "info" : "warning"}>
          {result.reason === "duplicate-request" ? "Already submitted" : "Not sent"}
        </Badge>
        <p className="text-sm text-fg-primary">{REFUSAL_WORDING[result.reason]}</p>
        {actionable ? (
          <p className="text-xs text-fg-secondary">
            This is a configuration or connection matter rather than something to retry — ask your
            Director to check it.
          </p>
        ) : null}
      </section>
    );
  }

  /* Attempted, and honestly not admitted. The provider's own error text never reaches the reader. */
  return (
    <section
      role="status"
      aria-live="polite"
      className="min-w-0 space-y-2 rounded-lg border border-border-subtle bg-surface-2 p-4"
    >
      <Badge variant="error">No asset filed</Badge>
      <p className="text-sm text-fg-primary">{admissionWording(result.failure)}</p>
      <p className="text-xs text-fg-secondary">
        The attempt was recorded. Nothing was stored, and nothing went to Governance.
      </p>
    </section>
  );
}
