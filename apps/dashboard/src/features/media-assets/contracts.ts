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
 *   fake transport     the only representable transport is `fake`
 *   no storage         the runtime storage resolver answers `unavailable`; nothing is connected
 *   no human door      no route, action or surface reaches this authority
 *
 * Pure types and frozen values. No React, no I/O, no database, no authority.
 */

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

/** The one transport MEDIA-1 can record. Mirrored by `media_generation_invocations_transport_chk`. */
export const MEDIA_GENERATION_TRANSPORT = "fake" as const;

export type MediaInvocationState =
  | "registered"
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
  | "duplicate-request";

export type RequestMediaGenerationResult =
  | { readonly status: "refused"; readonly reason: MediaGenerationRefusal }
  | {
      readonly status: "not-admitted";
      readonly invocationId: string;
      readonly state: MediaInvocationState;
      readonly admissionOutcome: MediaAdmissionOutcome;
      readonly failure: MediaAdmissionRefusal | MediaAdmissionFailure | null;
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
export function mediaAssetStorageKey(tenantId: string, assetId: string): string {
  return `tenants/${tenantId.toLowerCase()}/media/${assetId.toLowerCase()}`;
}

/** Code points, not UTF-16 units — same convention as `WORK_ARTIFACT_LIMITS`. */
export function countCodePoints(value: string): number {
  return Array.from(value).length;
}
