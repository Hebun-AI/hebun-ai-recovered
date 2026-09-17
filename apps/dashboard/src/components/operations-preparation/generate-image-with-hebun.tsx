"use client";

import { useMemo, useState, useTransition } from "react";
import { requestMediaGenerationAction } from "@/app/(dashboard)/operations/actions";
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
 * schedules it, or sends it anywhere — and there is no control in this file that could.
 *
 * ── ASKING ONCE ──────────────────────────────────────────────────────────────
 *
 * `requestKey` is minted once per mounted form. Pressing the button twice, or resubmitting after a
 * network stall, resends the SAME key, so the authority collides on `(tenant_id, request_key)` and
 * answers `duplicate-request` WITHOUT a second paid call. A genuinely different image needs a fresh
 * form. There is no retry button, and a failure never re-dispatches on its own: each paid call is a
 * human pressing this button with a new key.
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

function describe(result: RequestMediaGenerationResult): string {
  if (result.status === "refused") return REFUSAL_WORDING[result.reason];
  if (result.status === "admitted") {
    return `Image admitted. Asset ${result.assetId} — ${result.width}×${result.height} ${result.mimeType}, ${result.byteSize} bytes, digest ${result.byteDigest}. It is now awaiting Governance review; it has not been approved, attached or published.`;
  }
  const why =
    result.failure && result.failure in ADMISSION_WORDING
      ? ADMISSION_WORDING[result.failure as MediaAdmissionRefusal | MediaAdmissionFailure]
      : "The attempt did not produce an admissible image.";
  return `No asset was filed. ${why} The attempt is recorded as ${result.state}.`;
}

export function GenerateImageWithHebun({ targets }: { readonly targets: readonly GenerationTarget[] }) {
  /* One key per mounted form: the same submission can never become two paid calls. */
  const requestKey = useMemo(() => crypto.randomUUID(), []);
  const [artifactId, setArtifactId] = useState("");
  const [revisionNo, setRevisionNo] = useState("");
  const [promptText, setPromptText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = targets.find((t) => t.artifactId === artifactId);
  const ready = Boolean(artifactId) && Boolean(revisionNo) && promptText.trim().length > 0;

  function submit() {
    if (!ready || pending) return;
    setMessage(null);
    startTransition(async () => {
      const result = await requestMediaGenerationAction({
        artifactId,
        revisionNo: Number(revisionNo),
        promptText: promptText.trim(),
        requestKey,
      });
      setMessage(describe(result));
    });
  }

  if (targets.length === 0) {
    return (
      <section>
        <h3>Generate an image</h3>
        <p>Prepare a content draft first — an image is generated for a specific draft revision.</p>
      </section>
    );
  }

  return (
    <section>
      <h3>Generate an image</h3>
      <p>
        Hebun asks OpenAI for one image for the draft revision you name. The bytes are verified and
        stored, and the result goes to Governance review. It is not approved, attached or published.
      </p>

      <label htmlFor="media-artifact">Content draft</label>
      <select
        id="media-artifact"
        value={artifactId}
        onChange={(e) => {
          setArtifactId(e.target.value);
          const next = targets.find((t) => t.artifactId === e.target.value);
          setRevisionNo(next ? String(next.currentRevision) : "");
        }}
        disabled={pending}
      >
        <option value="">Choose a draft…</option>
        {targets.map((t) => (
          <option key={t.artifactId} value={t.artifactId}>
            {t.title}
          </option>
        ))}
      </select>

      <label htmlFor="media-revision">Revision</label>
      <input
        id="media-revision"
        type="number"
        min={1}
        max={selected?.currentRevision ?? 1}
        value={revisionNo}
        onChange={(e) => setRevisionNo(e.target.value)}
        disabled={pending || !selected}
      />

      <label htmlFor="media-prompt">Prompt</label>
      <textarea
        id="media-prompt"
        value={promptText}
        maxLength={MEDIA_ASSET_LIMITS.maxPromptCodePoints}
        onChange={(e) => setPromptText(e.target.value)}
        disabled={pending}
      />

      <button type="button" onClick={submit} disabled={!ready || pending}>
        {pending ? "Generating…" : "Generate one image"}
      </button>

      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
