/*
 * media-assets/contracts.ts — the typed vocabulary of the Media Asset authority (MEDIA-1).
 *
 * THE CHAIN MEDIA-1 PROVES:
 *
 *   content-draft revision     work_artifact_revisions            (R3W — referenced, never copied)
 *          ↓
 *   generation invocation      media_generation_invocations       (who asked, which agent, which
 *                                                                   transport, how far it got)
 *          ↓
 *   admission                  Hebun verifies the bytes itself    (magic bytes, size, dimensions,
 *                                                                   SHA-256) and writes them through
 *                                                                   the storage port
 *          ↓
 *   media asset                media_assets                       (immutable byte identity)
 *          ↓
 *   Governance review          decision_records, subject media_asset   (media-asset-review)
 *
 * WHAT A MEDIA ASSET IS NOT: it is not the draft, not an approval, not a publication, not Knowledge,
 * and not a provider's output. A provider returning bytes makes nothing authoritative; only
 * admission does, and admission trusts nothing the provider declared.
 *
 * ── MEDIA-1 BOUNDARIES THAT ARE VALUES, SO A TEST CAN ASSERT THEM ────────────
 *
 *   image only         PNG, JPEG, WebP — no video, no SVG, no GIF
 *   transports         `fake` and, since MEDIA-2A, `live` (OpenAI GPT Image, text-to-image only)
 *   storage            the resolver answers `unavailable` unless the VPS store is fully configured
 *   no human door      no route, action or surface reaches this authority
 *
 * Pure types and frozen values. No React, no I/O, no database, no authority.
 */

/**
 * MV-2 — what kind of media an asset is. Read from `media_assets.media_kind`, never inferred from a
 * MIME type, filename, provider or credential. `video` is REPRESENTABLE in the schema; no writer
 * admits one yet, and `MEDIA_ASSET_MIME_TYPES` below — the admission allowlist — is still images.
 */
export type MediaKind = "image" | "video";
export const MEDIA_KINDS: readonly MediaKind[] = Object.freeze(["image", "video"]);

/** The admitted image types. Detected from magic bytes, never from a declared Content-Type. */
export type MediaAssetMimeType = "image/png" | "image/jpeg" | "image/webp";

export const MEDIA_ASSET_MIME_TYPES: readonly MediaAssetMimeType[] = Object.freeze([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/**
 * The Director-approved bounds. Mirrored by CHECK constraints in `db/schema/media-asset.ts`, and a
 * test asserts the two agree. `promptText` is counted in Unicode code points, which is what
 * PostgreSQL's `char_length` counts.
 */
export const MEDIA_ASSET_LIMITS = Object.freeze({
  maxByteSize: 20 * 1024 * 1024,
  maxDimension: 8192,
  maxPromptCodePoints: 4000,
});

/** Provider download bounds. A provider URL is followed only inside these. */
export const MEDIA_DOWNLOAD_LIMITS = Object.freeze({
  timeoutMs: 30_000,
  maxRedirects: 2,
});

/** The transport kinds that can be recorded. Mirrored by `media_generation_invocations_transport_chk`. */
export const MEDIA_GENERATION_TRANSPORTS = Object.freeze(["fake", "live"] as const);

export type MediaGenerationTransportKind = (typeof MEDIA_GENERATION_TRANSPORTS)[number];

/**
 * Why a transport reported that no image came back (MEDIA-2A). Recorded on the invocation as
 * `provider_failure`; mirrored by `media_generation_invocations_provider_failure_chk`.
 *
 *   authentication-failed   the provider refused the credential (401/403)
 *   request-rejected        the provider refused the request for another client-side reason (4xx)
 *   moderation-blocked      the provider's safety system refused the prompt or output
 *   rate-limited            too many requests (429)
 *   quota-exhausted         the provider account has no credit left (429, quota code)
 *   timeout                 no complete answer inside the transport's deadline — the provider MAY
 *                           still have generated and billed; nothing is retried
 *   provider-unavailable    server error, overload, or no network path
 *   malformed-response      a success status whose body is not the documented contract
 *   budget-exhausted        the process live-call budget refused: NO request left Hebun
 *   dispatch-error          the transport threw instead of reporting (state `dispatch-failed`)
 */
export const MEDIA_PROVIDER_FAILURES = Object.freeze([
  "authentication-failed",
  "request-rejected",
  "moderation-blocked",
  "rate-limited",
  "quota-exhausted",
  "timeout",
  "provider-unavailable",
  "malformed-response",
  "budget-exhausted",
  "dispatch-error",
] as const);

export type MediaProviderFailure = (typeof MEDIA_PROVIDER_FAILURES)[number];

/** Provider-reported usage. Both counts or none. */
export interface MediaProviderUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/**
 * Mirrored by `media_generation_invocations_state_chk`. MV-4 adds the three asynchronous states:
 * `dispatching` (intent recorded before the external call), `dispatch-unknown` (the call was made and
 * its fate cannot be known — not a failure, never retried) and `provider-pending` (accepted, working).
 */
export type MediaInvocationState =
  | "registered"
  | "dispatching"
  | "dispatch-unknown"
  | "provider-pending"
  | "dispatch-failed"
  | "provider-failed"
  | "provider-succeeded";

export type MediaAdmissionOutcome = "not-attempted" | "admitted" | "refused" | "failed";

export type MediaAssetLifecycleStatus = "admitted" | "retired";

/**
 * Why Hebun refused to admit bytes a provider returned. Recorded on the invocation; no asset exists.
 */
export type MediaAdmissionRefusal =
  | "unsupported-image-signature"
  | "malformed-image"
  | "declared-type-mismatch"
  | "empty-bytes"
  | "byte-size-exceeded"
  | "dimensions-exceeded"
  | "download-url-invalid"
  | "download-host-not-allowed"
  | "download-redirect-refused"
  | "download-status-refused"
  | "download-timeout"
  | "download-failed";

/** Why admission could not complete even though the bytes were acceptable. */
export type MediaAdmissionFailure = "storage-write-failed" | "persistence-failed";

/** Why a generation request never reached the transport. Nothing is written for any of these. */
export type MediaGenerationRefusal =
  | "unauthenticated"
  | "invalid-input"
  | "storage-unavailable"
  | "generation-transport-unavailable"
  | "persistence-unavailable"
  | "no-durable-agent"
  | "source-revision-unresolvable"
  /** The request key was already used in this tenant. The earlier attempt is not repeated. */
  | "duplicate-request"
  /*
   * ── MEDIA-5 ──────────────────────────────────────────────────────────────
   * Four refusals, all reached in preflight — before any row is written and before any paid call.
   */
  /** Missing, another tenant's, or not an asset id. One reason, so a refusal reveals nothing. */
  | "source-asset-unresolvable"
  /** The asset exists in this tenant but its custody lifecycle ended. A retired image is not reused. */
  | "source-asset-retired"
  /**
   * The object could not be read, was larger than the authority accepts, or the bytes as stored no
   * longer match the admitted digest. A CUSTODY problem, never "no image" — and it stops the request
   * before the provider is called, so unverified bytes can never leave Hebun.
   */
  | "source-asset-unavailable"
  /** The resolved transport does not do reference edits. Refused before registering an invocation. */
  | "reference-edit-unsupported"
  /** MV-2 — the reference is not an image (e.g. a video row). Image generation never takes it. */
  | "source-asset-not-image";

export type RequestMediaGenerationResult =
  | { readonly status: "refused"; readonly reason: MediaGenerationRefusal }
  | {
      readonly status: "not-admitted";
      readonly invocationId: string;
      readonly state: MediaInvocationState;
      readonly admissionOutcome: MediaAdmissionOutcome;
      readonly failure: MediaAdmissionRefusal | MediaAdmissionFailure | MediaProviderFailure | null;
    }
  | {
      readonly status: "admitted";
      readonly invocationId: string;
      readonly assetId: string;
      readonly mimeType: MediaAssetMimeType;
      readonly byteSize: number;
      readonly byteDigest: string;
      readonly width: number;
      readonly height: number;
    };

/** What a caller supplies. Tenant, requester, agent, transport identity and timestamps are absent BY TYPE. */
export interface RequestMediaGenerationInput {
  readonly artifactId: string;
  readonly revisionNo: number;
  readonly promptText: string;
  readonly requestKey: string;
  /**
   * MEDIA-5 — the admitted image to edit, named BY ASSET ID and by nothing else.
   *
   * Absent means text-to-image, exactly as released. A storage key, a store URL, an external URL or
   * raw bytes are all unrepresentable here on purpose: the authority resolves the id against THIS
   * tenant and derives the key itself, so a caller can never point the reader at an object it was
   * not entitled to, and never at another tenant's.
   */
  readonly sourceAssetId?: string | null;
}

export const MEDIA_ASSET_ACCEPTANCE_NOTICE =
  "Asset acceptance is not publication authorization. Accepting this image authorizes no external " +
  "act: publishing it would need its own action request, its own Governance decision and its own " +
  "permit, and Hebun holds no provider capability that can publish.";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGEST_RE = /^[0-9a-f]{64}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function isByteDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST_RE.test(value);
}

/**
 * THE storage identity. Derived from the tenant and the asset id only — no filename, no extension,
 * no caller text — and CHECKed in the database to equal exactly this, so a row can never name an
 * object under another tenant's prefix.
 */
/**
 * PUBLISH-0 — the one derivation this authority knows. Mirrored by `media_assets_derivation_chk`.
 * Lives here, not beside the transform, so a lineage READER never has to load the image codec.
 */
export const JPEG_PUBLISH_DERIVATION = "jpeg-publish-v1" as const;

export function mediaAssetStorageKey(tenantId: string, assetId: string): string {
  return `tenants/${tenantId.toLowerCase()}/media/${assetId.toLowerCase()}`;
}

/** Code points, not UTF-16 units — same convention as `WORK_ARTIFACT_LIMITS`. */
export function countCodePoints(value: string): number {
  return Array.from(value).length;
}
